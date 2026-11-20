"""Batch-test the parking CCTV vision pipeline on still images.

Run from python-v2 with the project's Python environment. This is an offline
image tester, not the live CCTV/backend service. See README.md in this folder.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import torch
from ultralytics import YOLO


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR.parent
DEFAULT_INPUT = SCRIPT_DIR
DEFAULT_CAR_MODEL = PROJECT_DIR / "models" / "trained_car_detector.pt"
DEFAULT_PLATE_MODEL = PROJECT_DIR / "models" / "best_license_plate_detector.pt"
DEFAULT_TRACKER = PROJECT_DIR / "tracker" / "parking_botsort_reid.yaml"

# Keep these image-test defaults aligned with python-v2/parkng_model.py.
CAR_CONF_THRESHOLD = 0.80
TRACKER_INPUT_CONF = 0.10
PLATE_CONF_THRESHOLD = 0.30
PLATE_RETRY_CONF_THRESHOLD = 0.45
CAR_IMAGE_SIZE = 960
PLATE_IMAGE_SIZE = 640
DETECT_EVERY_N_FRAMES = 8
CAR_BOX_SHRINK_RATIO = 0.10
CAR_DISPLAY_BOX_EXPAND_RATIO = 0.10
CAR_CROP_PAD_X = 0.20
CAR_CROP_PAD_TOP = 0.12
CAR_CROP_PAD_BOTTOM = 0.22
SHARPNESS_THRESHOLD = 40.0
OCR_LOCK_CONF_THRESHOLD = 0.50
OCR_MIN_TEXT_LENGTH = 5
OCR_STABLE_VOTES = 3
OCR_VOTE_SHARE = 0.60
PARKING_ANCHOR_Y_RATIO = 0.82
PARKING_ENTRY_SCORE_THRESHOLD = 0.12
PARKING_DEEP_SCORE_THRESHOLD = 0.30
PARKING_STABLE_DETECTIONS = 5
PARKING_STATIONARY_CENTER_THRESHOLD = 0.035
OCCUPIED_EMPTY_RELEASE_DETECTIONS = 4
TRACKER_BATCH_SIZE_GPU = 8
TRACKER_BATCH_SIZE_CPU = 2

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def natural_key(path: Path) -> list[Any]:
    return [int(part) if part.isdigit() else part.lower()
            for part in re.split(r"(\d+)", path.name)]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run car, plate, Thai OCR, and optional parking-slot checks on images."
    )
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT,
                        help="Image file or folder; defaults to this pic_test folder.")
    parser.add_argument("--output", type=Path, default=None,
                        help="Output folder. Default: pic_test/output/run_<timestamp>.")
    parser.add_argument("--car-model", type=Path, default=DEFAULT_CAR_MODEL)
    parser.add_argument("--plate-model", type=Path, default=DEFAULT_PLATE_MODEL)
    parser.add_argument("--tracker", type=Path, default=DEFAULT_TRACKER)
    parser.add_argument("--device", default="auto",
                        help="auto, cpu, 0, cuda:0, etc. Offline image testing allows CPU.")
    parser.add_argument("--batch-size", type=int, default=8,
                        help="Number of images per YOLO batch in independent-image mode.")
    parser.add_argument("--plate-batch-size", type=int, default=None,
                        help="Plate-crop batch size; defaults to 8 on CUDA, 2 on CPU.")
    parser.add_argument("--car-conf", type=float, default=CAR_CONF_THRESHOLD,
                        help="Application car-confidence threshold (default 0.80).")
    parser.add_argument("--plate-conf", type=float, default=PLATE_CONF_THRESHOLD,
                        help="Plate-box confidence threshold (default 0.30).")
    parser.add_argument("--slots-json", type=Path, default=None,
                        help="Optional COCO parking-slot JSON matching the image viewpoint.")
    parser.add_argument("--no-plates", action="store_true",
                        help="Skip plate-model loading and plate detection.")
    parser.add_argument("--no-ocr", action="store_true",
                        help="Detect plate boxes but skip EasyOCR.")
    parser.add_argument("--no-slots", action="store_true",
                        help="Skip parking-slot polygon overlays and overlap scores.")
    parser.add_argument("--sequence", action="store_true",
                        help="Track frames in natural filename order; use only for one same-camera sequence.")
    parser.add_argument("--show", action="store_true",
                        help="Open each annotated output in a window after processing.")
    parser.add_argument("--recursive", action="store_true",
                        help="Search input folder recursively for images.")
    return parser.parse_args()


def collect_images(input_path: Path, recursive: bool) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() not in IMAGE_EXTENSIONS:
            raise ValueError(f"Unsupported image extension: {input_path.suffix}")
        return [input_path.resolve()]
    if not input_path.is_dir():
        raise FileNotFoundError(f"Image file/folder does not exist: {input_path}")

    iterator = input_path.rglob("*") if recursive else input_path.glob("*")
    images = [p.resolve() for p in iterator
              if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
              and "output" not in p.parts]
    return sorted(images, key=natural_key)


def read_image(path: Path) -> np.ndarray:
    raw = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(raw, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"OpenCV could not decode image: {path}")
    return image


def choose_device(requested: str) -> str:
    if requested.lower() != "auto":
        return requested
    return "0" if torch.cuda.is_available() else "cpu"


def box_iou(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = max(1, a[2] - a[0]) * max(1, a[3] - a[1])
    area_b = max(1, b[2] - b[0]) * max(1, b[3] - b[1])
    return inter / max(area_a + area_b - inter, 1)


def box_ios(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_min = min(max(1, a[2] - a[0]) * max(1, a[3] - a[1]),
                   max(1, b[2] - b[0]) * max(1, b[3] - b[1]))
    return inter / area_min


def deduplicate(detections: list[dict[str, Any]]) -> list[dict[str, Any]]:
    kept: list[dict[str, Any]] = []
    for item in sorted(detections, key=lambda d: d["car_conf"], reverse=True):
        if any(box_iou(item["car_box"], old["car_box"]) >= 0.50
               or box_ios(item["car_box"], old["car_box"]) >= 0.80 for old in kept):
            continue
        kept.append(item)
    return kept


def shrink_box(box: tuple[int, int, int, int], shape: tuple[int, ...]) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = map(float, box)
    h, w = shape[:2]
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    nw, nh = (x2 - x1) * (1 - CAR_BOX_SHRINK_RATIO), (y2 - y1) * (1 - CAR_BOX_SHRINK_RATIO)
    return (max(0, round(cx - nw / 2)), max(0, round(cy - nh / 2)),
            min(w - 1, round(cx + nw / 2)), min(h - 1, round(cy + nh / 2)))


def expand_display_box(box: tuple[int, int, int, int], shape: tuple[int, ...]) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    h, w = shape[:2]
    px = (x2 - x1) * CAR_DISPLAY_BOX_EXPAND_RATIO / 2
    py = (y2 - y1) * CAR_DISPLAY_BOX_EXPAND_RATIO / 2
    return (max(0, round(x1 - px)), max(0, round(y1 - py)),
            min(w - 1, round(x2 + px)), min(h - 1, round(y2 + py)))


def padded_car_crop(image: np.ndarray, box: tuple[int, int, int, int],
                    pad_x: float = CAR_CROP_PAD_X,
                    pad_top: float = CAR_CROP_PAD_TOP,
                    pad_bottom: float = CAR_CROP_PAD_BOTTOM) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    x1, y1, x2, y2 = box
    h, w = image.shape[:2]
    bw, bh = max(1, x2 - x1), max(1, y2 - y1)
    crop_box = (max(0, round(x1 - bw * pad_x)),
                max(0, round(y1 - bh * pad_top)),
                min(w, round(x2 + bw * pad_x)),
                min(h, round(y2 + bh * pad_bottom)))
    x1c, y1c, x2c, y2c = crop_box
    return image[y1c:y2c, x1c:x2c].copy(), crop_box


def load_slots(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    categories = {int(x["id"]): x.get("name", str(x["id"]))
                  for x in payload.get("categories", [])}
    images = {int(x["id"]): x for x in payload.get("images", [])}
    slots = []
    for ann in payload.get("annotations", []):
        name = categories.get(int(ann.get("category_id", -1)), "")
        if not name or name.lower() in {"parking-slot", "parking_slot", "parking slot"}:
            continue
        image_meta = images.get(int(ann.get("image_id", -1)), {})
        src_w = float(image_meta.get("width", 0) or 0)
        src_h = float(image_meta.get("height", 0) or 0)
        segmentation = ann.get("segmentation") or []
        polygon = None
        if segmentation and isinstance(segmentation[0], list) and len(segmentation[0]) >= 6:
            coords = segmentation[0]
            polygon = [(float(coords[i]), float(coords[i + 1]))
                       for i in range(0, len(coords) - 1, 2)]
        bbox = ann.get("bbox", [0, 0, 0, 0])
        if polygon is None:
            x, y, bw, bh = map(float, bbox)
            polygon = [(x, y), (x + bw, y), (x + bw, y + bh), (x, y + bh)]
        slots.append({"name": name, "polygon_source": polygon,
                      "source_width": src_w, "source_height": src_h})
    return slots


def scale_slots(slots: list[dict[str, Any]], shape: tuple[int, ...]) -> list[dict[str, Any]]:
    h, w = shape[:2]
    scaled = []
    for slot in slots:
        sw, sh = slot["source_width"], slot["source_height"]
        if sw <= 0 or sh <= 0:
            sx = sy = 1.0
        else:
            sx, sy = w / sw, h / sh
        poly = np.asarray([(round(x * sx), round(y * sy)) for x, y in slot["polygon_source"]],
                          dtype=np.int32)
        scaled.append({"name": slot["name"], "polygon": poly})
    return scaled


def slot_metrics(car_box: tuple[int, int, int, int], slot_poly: np.ndarray) -> dict[str, Any]:
    x1, y1, x2, y2 = car_box
    h = max(1, y2 - y1)
    anchor = ((x1 + x2) / 2, y1 + h * PARKING_ANCHOR_Y_RATIO)
    center = ((x1 + x2) / 2, (y1 + y2) / 2)
    anchor_inside = cv2.pointPolygonTest(slot_poly.reshape(-1, 1, 2).astype(np.float32), anchor, False) >= 0
    center_inside = cv2.pointPolygonTest(slot_poly.reshape(-1, 1, 2).astype(np.float32), center, False) >= 0
    # Use a local ROI so slot/car intersection checks do not allocate a mask
    # for every pixel from the top-left corner of the full frame.
    px1, py1 = max(0, int(slot_poly[:, 0].min())), max(0, int(slot_poly[:, 1].min()))
    px2, py2 = min(slot_mask.shape[1] - 1, int(slot_poly[:, 0].max())), min(slot_mask.shape[0] - 1, int(slot_poly[:, 1].max()))
    rx1, ry1 = min(px1, x1), min(py1, y1)
    rx2, ry2 = max(px2, x2), max(py2, y2)
    roi_w, roi_h = max(1, rx2 - rx1 + 1), max(1, ry2 - ry1 + 1)
    sm = np.zeros((roi_h, roi_w), dtype=np.uint8)
    cm = np.zeros((roi_h, roi_w), dtype=np.uint8)
    shifted = slot_poly - np.array([rx1, ry1], dtype=np.int32)
    cv2.fillPoly(sm, [shifted], 1)
    cv2.rectangle(cm, (x1 - rx1, y1 - ry1), (x2 - rx1, y2 - ry1), 1, -1)
    inter = float(cv2.countNonZero(cv2.bitwise_and(sm, cm)))
    slot_area = max(1.0, float(cv2.countNonZero(sm)))
    car_area = max(1.0, float(cv2.countNonZero(cm)))
    score = inter / min(slot_area, car_area)
    return {"overlap_score": score, "slot_coverage": inter / slot_area,
            "car_coverage": inter / car_area, "anchor_inside": bool(anchor_inside),
            "center_inside": bool(center_inside)}


def assign_slots(detections: list[dict[str, Any]], slots: list[dict[str, Any]]) -> None:
    for det in detections:
        reduced = det["slot_box"]
        candidates = []
        for slot in slots:
            metrics = slot_metrics(reduced, slot["polygon"])
            can_enter = (metrics["anchor_inside"] or metrics["center_inside"]
                         or metrics["overlap_score"] >= PARKING_ENTRY_SCORE_THRESHOLD)
            if not can_enter:
                continue
            rank = metrics["overlap_score"] + 0.35 * metrics["center_inside"] + 0.75 * metrics["anchor_inside"]
            candidates.append((rank, slot["name"], metrics))
        if candidates:
            _, name, metrics = max(candidates, key=lambda item: item[0])
            det["slot_candidate"] = name
            det["slot_metrics"] = metrics


def apply_sequence_slot_states(images_data: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Apply the CCTV entry/stability rules to an ordered same-camera sequence.

    Still-image batch mode intentionally does not call this because independent
    photos have no temporal order. This mirrors core occupancy rules for a
    sequence; no backend events are sent by this offline tester.
    """
    if not images_data or not images_data[0]["slots"]:
        return []
    states: dict[str, dict[str, Any]] = {}
    transitions: list[dict[str, Any]] = []
    for slot in images_data[0]["slots"]:
        states[slot["name"]] = {
            "status": "available", "owner": None, "last_center": None,
            "stationary_hits": 0, "empty_hits": 0, "missing_hits": 0,
            "exit_hits": 0,
        }

    for frame_index, data in enumerate(images_data):
        by_slot: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for det in data["detections"]:
            if det.get("slot_candidate"):
                by_slot[det["slot_candidate"]].append(det)
        for slot in data["slots"]:
            name = slot["name"]
            state = states[name]
            previous = state["status"]
            options = by_slot.get(name, [])
            selected = max(options, key=lambda d: d.get("slot_metrics", {}).get("overlap_score", 0.0)) if options else None
            if selected is None:
                state["empty_hits"] += 1
                state["missing_hits"] += 1
                owner_seen_elsewhere = any(
                    det.get("track_id") == state["owner"] and det.get("slot_candidate") != name
                    for det in data["detections"]
                ) if state["owner"] is not None else False
                if state["status"] == "parking" and owner_seen_elsewhere:
                    state["exit_hits"] += 1
                    if state["exit_hits"] >= 5:
                        state.update(status="available", owner=None, last_center=None,
                                     stationary_hits=0, exit_hits=0)
                elif state["status"] == "parking":
                    state["exit_hits"] = 0
                # The CCTV runtime does not release a locked parked space only
                # because the detector temporarily lost its car.
                if state["status"] == "occupied" and state["empty_hits"] >= OCCUPIED_EMPTY_RELEASE_DETECTIONS:
                    state.update(status="available", owner=None, last_center=None, stationary_hits=0)
            else:
                metrics = selected["slot_metrics"]
                track_id = selected.get("track_id")
                same_owner = state["owner"] is not None and track_id == state["owner"]
                box = selected["slot_box"]
                center = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
                slot_box = cv2.boundingRect(slot["polygon"])
                slot_diag = max(math.hypot(slot_box[2], slot_box[3]), 1.0)
                if same_owner and state["last_center"] is not None:
                    movement = math.dist(center, state["last_center"]) / slot_diag
                    state["stationary_hits"] = (state["stationary_hits"] + 1
                                                  if movement <= PARKING_STATIONARY_CENTER_THRESHOLD else 0)
                else:
                    state["stationary_hits"] = 0
                inside = metrics["anchor_inside"] or metrics["center_inside"]
                deep = ((metrics["anchor_inside"] and metrics["overlap_score"] >= PARKING_DEEP_SCORE_THRESHOLD)
                        or (metrics["center_inside"] and metrics["overlap_score"] >= 0.40)
                        or metrics["overlap_score"] >= 0.55)
                if previous == "parking" and same_owner:
                    state["status"] = "parking"
                elif deep and state["stationary_hits"] >= PARKING_STABLE_DETECTIONS:
                    state["status"] = "parking"
                else:
                    state["status"] = "occupied"
                state.update(owner=track_id, last_center=center, empty_hits=0, missing_hits=0, exit_hits=0)
                selected["slot_state"] = state["status"]
                selected["slot_deep_evidence"] = bool(deep)
            if state["status"] != previous:
                transitions.append({"image": data["path"].name, "slot": name,
                                    "from": previous, "to": state["status"],
                                    "track_id": state["owner"]})
            slot["runtime_status"] = state["status"]
            slot["map_status"] = {"available": "available", "occupied": "incoming",
                                   "parking": "occupied"}.get(state["status"], state["status"])
            slot["stationary_hits"] = state["stationary_hits"]
            slot["missing_hits"] = state["missing_hits"]
    return transitions


def normalize_ocr(text: str) -> str:
    return re.sub(r"\s+", "", text or "").strip()


def stable_vote(items: list[dict[str, Any]]) -> dict[str, Any]:
    valid = [x for x in items if len(x["ocr_text"]) >= OCR_MIN_TEXT_LENGTH]
    if not valid:
        return {"stable_text": "", "votes": 0, "vote_share": 0.0, "locked": False}
    weights: dict[str, float] = defaultdict(float)
    counts: Counter[str] = Counter()
    for item in valid:
        weights[item["ocr_text"]] += max(item["ocr_conf"], 0.01)
        counts[item["ocr_text"]] += 1
    winner = max(weights, key=weights.get)
    share = weights[winner] / max(sum(weights.values()), 1e-9)
    lock_conf = max(x["ocr_conf"] for x in valid if x["ocr_text"] == winner)
    return {"stable_text": winner, "votes": counts[winner], "vote_share": share,
            "locked": counts[winner] >= OCR_STABLE_VOTES and share >= OCR_VOTE_SHARE
                      and lock_conf >= OCR_LOCK_CONF_THRESHOLD}


def draw_results(image: np.ndarray, detections: list[dict[str, Any]],
                 slots: list[dict[str, Any]]) -> np.ndarray:
    canvas = image.copy()
    for slot in slots:
        poly = slot["polygon"]
        color = {"available": (0, 180, 0), "incoming": (0, 210, 255),
                 "occupied": (0, 0, 255)}.get(slot.get("map_status"), (0, 180, 0))
        cv2.polylines(canvas, [poly], True, color, 2)
        point = tuple(map(int, poly.min(axis=0)))
        status_label = slot.get("map_status", "no car detected")
        cv2.putText(canvas, f"{slot['name']}: {status_label}", (point[0], max(18, point[1] - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.46, (0, 180, 0), 1, cv2.LINE_AA)
    for det in detections:
        x1, y1, x2, y2 = det["display_box"]
        label = f"Car {det['track_id'] if det['track_id'] is not None else '-'} {det['car_conf']:.2f}"
        cv2.rectangle(canvas, (x1, y1), (x2, y2), (255, 255, 255), 2)
        cv2.putText(canvas, label, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX,
                    0.60, (255, 255, 255), 2, cv2.LINE_AA)
        if det.get("plate_box"):
            px1, py1, px2, py2 = det["plate_box"]
            cv2.rectangle(canvas, (px1, py1), (px2, py2), (255, 0, 255), 2)
            plate_label = det.get("stable_text") or det.get("ocr_text") or "plate"
            cv2.putText(canvas, f"{plate_label} ({det['plate_conf']:.2f})",
                        (px1, max(18, py1 - 6)), cv2.FONT_HERSHEY_SIMPLEX,
                        0.48, (255, 0, 255), 2, cv2.LINE_AA)
        if det.get("slot_candidate"):
            cv2.putText(canvas, f"slot candidate: {det['slot_candidate']}",
                        (x1, min(canvas.shape[0] - 6, y2 + 20)), cv2.FONT_HERSHEY_SIMPLEX,
                        0.48, (0, 220, 255), 2, cv2.LINE_AA)
    return canvas


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    args = parse_args()
    images = collect_images(args.input, args.recursive)
    if not images:
        raise SystemExit(f"No supported images found in: {args.input}")
    if args.sequence and not args.input.is_file():
        images = sorted(images, key=natural_key)

    output_dir = args.output or (SCRIPT_DIR / "output" / f"run_{datetime.now():%Y%m%d_%H%M%S}")
    annotated_dir = output_dir / "annotated"
    annotated_dir.mkdir(parents=True, exist_ok=True)

    car_path = args.car_model.resolve()
    plate_path = args.plate_model.resolve()
    if not car_path.is_file():
        raise FileNotFoundError(f"Car model weight not found: {car_path}")
    if not args.no_plates and not plate_path.is_file():
        raise FileNotFoundError(f"Plate model weight not found: {plate_path}")
    if args.sequence and not args.tracker.is_file():
        raise FileNotFoundError(f"Tracker config not found: {args.tracker}")
    if args.slots_json and not args.no_slots and not args.slots_json.is_file():
        raise FileNotFoundError(f"Parking-slot JSON not found: {args.slots_json}")

    device = choose_device(args.device)
    is_cuda = device not in {"cpu", "mps"} and torch.cuda.is_available()
    batch_size = max(1, args.batch_size)
    plate_batch_size = max(1, args.plate_batch_size or
                           (TRACKER_BATCH_SIZE_GPU if is_cuda else TRACKER_BATCH_SIZE_CPU))
    print(f"Loading car detector: {car_path}")
    car_model = YOLO(str(car_path))
    plate_model = None
    reader = None
    if not args.no_plates:
        print(f"Loading plate detector: {plate_path}")
        plate_model = YOLO(str(plate_path))
    if plate_model is not None and not args.no_ocr:
        import easyocr
        print("Loading EasyOCR (Thai)")
        reader = easyocr.Reader(["th"], gpu=is_cuda, verbose=False)

    base_slots = []
    if args.slots_json and not args.no_slots:
        base_slots = load_slots(args.slots_json.resolve())
        print(f"Loaded {len(base_slots)} slot polygons from {args.slots_json}")
    elif not args.no_slots:
        print("Slot overlay disabled: pass --slots-json only when its camera view matches these images.")

    images_data: list[dict[str, Any]] = []
    car_batch_times: dict[str, float] = {}
    print(f"Processing {len(images)} image(s) on device={device}, batch={batch_size}, sequence={args.sequence}")
    run_start = time.perf_counter()

    for start in range(0, len(images), 1 if args.sequence else batch_size):
        chunk_paths = images[start:start + (1 if args.sequence else batch_size)]
        chunk_images = [read_image(path) for path in chunk_paths]
        infer_start = time.perf_counter()
        if args.sequence:
            result_chunks = [car_model.track(
                source=chunk_images[0], conf=TRACKER_INPUT_CONF, imgsz=CAR_IMAGE_SIZE,
                tracker=str(args.tracker), persist=True, device=device, verbose=False,
            )[0]]
        else:
            result_chunks = car_model.predict(
                source=chunk_images, conf=TRACKER_INPUT_CONF, imgsz=CAR_IMAGE_SIZE,
                device=device, verbose=False, batch=len(chunk_images),
            )
        batch_car_ms = (time.perf_counter() - infer_start) * 1000

        for local_i, (path, image, result) in enumerate(zip(chunk_paths, chunk_images, result_chunks)):
            h, w = image.shape[:2]
            detections = []
            if result.boxes is not None:
                for box in result.boxes:
                    conf = float(box.conf[0].detach().cpu().item())
                    if conf < args.car_conf:
                        continue
                    coords = tuple(int(round(v)) for v in box.xyxy[0].detach().cpu().tolist())
                    track_id = int(box.id[0].detach().cpu().item()) if box.id is not None else None
                    reduced = shrink_box(coords, image.shape)
                    detections.append({
                        "image": path.name, "track_id": track_id,
                        "car_box": coords, "slot_box": reduced,
                        "display_box": expand_display_box(reduced, image.shape),
                        "car_conf": conf,
                    })
            detections = deduplicate(detections)
            slots = scale_slots(base_slots, image.shape) if base_slots else []
            if slots:
                assign_slots(detections, slots)
            images_data.append({
                "path": path, "image": image, "detections": detections,
                "slots": slots, "batch_car_inference_ms": batch_car_ms,
                "image_width": w, "image_height": h,
            })
            car_batch_times[str(path)] = batch_car_ms
            print(f"[{start + local_i + 1}/{len(images)}] {path.name}: cars={len(detections)} | car batch={batch_car_ms:.1f} ms")

    slot_transitions = apply_sequence_slot_states(images_data) if args.sequence else []

    # Detect plates on padded car crops in batches, then run OCR only on found plates.
    plate_jobs: list[dict[str, Any]] = []
    crop_start = time.perf_counter()
    if plate_model is not None:
        for data in images_data:
            for det in data["detections"]:
                crop, crop_box = padded_car_crop(data["image"], det["car_box"])
                if crop.size:
                    plate_jobs.append({"data": data, "det": det, "crop": crop, "crop_box": crop_box})
        for start in range(0, len(plate_jobs), plate_batch_size):
            jobs = plate_jobs[start:start + plate_batch_size]
            plate_results = plate_model.predict(
                source=[x["crop"] for x in jobs], conf=args.plate_conf,
                imgsz=PLATE_IMAGE_SIZE, device=device, verbose=False,
                batch=len(jobs),
            )
            for job, result in zip(jobs, plate_results):
                det = job["det"]
                det.update({"plate_box": None, "plate_conf": 0.0,
                            "ocr_text": "", "ocr_conf": 0.0,
                            "ocr_status": "not_detected"})
                if result.boxes is None or len(result.boxes) == 0:
                    continue
                best_index = int(torch.argmax(result.boxes.conf).item())
                plate_conf = float(result.boxes.conf[best_index].detach().cpu().item())
                xyxy = [int(round(v)) for v in result.boxes.xyxy[best_index].detach().cpu().tolist()]
                cx1, cy1, _, _ = job["crop_box"]
                det["plate_box"] = (xyxy[0] + cx1, xyxy[1] + cy1,
                                     xyxy[2] + cx1, xyxy[3] + cy1)
                det["plate_conf"] = plate_conf
                det["ocr_status"] = "plate_found_ocr_disabled" if reader is None else "pending"

        retry_jobs = []
        for job in plate_jobs:
            det = job["det"]
            if det.get("plate_box") is None or det["plate_conf"] < PLATE_RETRY_CONF_THRESHOLD:
                retry_crop, retry_box = padded_car_crop(
                    job["data"]["image"], det["car_box"], pad_x=0.30,
                    pad_top=0.20, pad_bottom=0.32,
                )
                if retry_crop.size:
                    retry_jobs.append({**job, "crop": retry_crop, "crop_box": retry_box})
        for start in range(0, len(retry_jobs), plate_batch_size):
            jobs = retry_jobs[start:start + plate_batch_size]
            retry_results = plate_model.predict(
                source=[x["crop"] for x in jobs], conf=args.plate_conf,
                imgsz=PLATE_IMAGE_SIZE, device=device, verbose=False,
                batch=len(jobs),
            )
            for job, result in zip(jobs, retry_results):
                if result.boxes is None or len(result.boxes) == 0:
                    continue
                best_index = int(torch.argmax(result.boxes.conf).item())
                conf = float(result.boxes.conf[best_index].detach().cpu().item())
                if conf <= job["det"].get("plate_conf", 0.0):
                    continue
                coords = [int(round(v)) for v in result.boxes.xyxy[best_index].detach().cpu().tolist()]
                cx1, cy1, _, _ = job["crop_box"]
                job["det"]["plate_box"] = (coords[0] + cx1, coords[1] + cy1,
                                             coords[2] + cx1, coords[3] + cy1)
                job["det"]["plate_conf"] = conf
                job["det"]["ocr_status"] = "pending" if reader is not None else "plate_found_ocr_disabled"

    plate_stage_ms = (time.perf_counter() - crop_start) * 1000
    ocr_start = time.perf_counter()
    if reader is not None:
        for data in images_data:
            image = data["image"]
            h, w = image.shape[:2]
            for det in data["detections"]:
                if det.get("plate_box") is None:
                    continue
                x1, y1, x2, y2 = det["plate_box"]
                crop = image[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                if crop.size == 0:
                    det["ocr_status"] = "empty_plate_crop"
                    continue
                zoom = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
                sharpness = float(cv2.Laplacian(zoom, cv2.CV_64F).var())
                det["plate_sharpness"] = sharpness
                if sharpness < SHARPNESS_THRESHOLD:
                    det["ocr_status"] = "too_blurry"
                    continue
                ocr_rows = reader.readtext(zoom, batch_size=1, workers=0)
                text = normalize_ocr(" ".join(row[1] for row in ocr_rows))
                confidence = (sum(float(row[2]) for row in ocr_rows) / len(ocr_rows)) if ocr_rows else 0.0
                det["ocr_text"] = text
                det["ocr_conf"] = confidence
                det["ocr_status"] = "candidate" if text else "no_text"
    ocr_ms = (time.perf_counter() - ocr_start) * 1000

    # Voting mirrors CCTV's multi-observation idea. Independent images are never
    # assumed to show the same car; voting is grouped by track only in sequence mode.
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for data in images_data:
        for index, det in enumerate(data["detections"]):
            key = f"track:{det['track_id']}" if args.sequence and det.get("track_id") is not None else f"image:{data['path'].name}:{index}"
            groups[key].append(det)
    for group in groups.values():
        vote = stable_vote(group)
        for det in group:
            det.update(vote)
            if det.get("ocr_text"):
                det["ocr_status"] = "stable" if vote["locked"] else "candidate_unlocked"

    summary_rows = []
    detection_rows = []
    full_results = []
    for data in images_data:
        path, image, detections, slots = data["path"], data["image"], data["detections"], data["slots"]
        annotated = draw_results(image, detections, slots)
        output_image = annotated_dir / f"{path.stem}_result.jpg"
        encoded_ok, encoded_image = cv2.imencode(".jpg", annotated)
        if not encoded_ok:
            raise OSError(f"Could not write annotated output: {output_image}")
        encoded_image.tofile(str(output_image))
        slot_candidates = sorted({d["slot_candidate"] for d in detections if d.get("slot_candidate")})
        summary_rows.append({
            "image": path.name, "width": data["image_width"], "height": data["image_height"],
            "car_count": len(detections), "slot_count": len(slots),
            "slot_candidates": ";".join(slot_candidates),
            "car_batch_inference_ms": round(data["batch_car_inference_ms"], 2),
            "note": "Independent still image; slot labels are evidence only, not temporal final states.",
        })
        for det in detections:
            row = {k: det.get(k) for k in (
                "image", "track_id", "car_conf", "car_box", "slot_candidate",
                "plate_box", "plate_conf", "plate_sharpness", "ocr_text", "ocr_conf",
                "stable_text", "votes", "vote_share", "locked", "ocr_status")}
            row["car_box"] = json.dumps(row["car_box"])
            row["plate_box"] = json.dumps(row["plate_box"])
            metrics = det.get("slot_metrics", {})
            row.update({f"slot_{k}": v for k, v in metrics.items()})
            detection_rows.append(row)
        full_results.append({
            "image": str(path), "width": data["image_width"], "height": data["image_height"],
            "annotated_output": str(output_image), "batch_car_inference_ms": round(data["batch_car_inference_ms"], 2),
            "detections": [{**{k: v for k, v in d.items() if k not in {"slot_box", "display_box"}},
                            "car_box": list(d["car_box"]),
                            "plate_box": list(d["plate_box"]) if d.get("plate_box") else None}
                           for d in detections],
            "slot_evidence": [{"name": s["name"], "status": "car_candidate" if s["name"] in slot_candidates else "no_car_detected"}
                              for s in slots],
        })

    write_csv(output_dir / "image_summary.csv", summary_rows,
              ["image", "width", "height", "car_count", "slot_count", "slot_candidates",
               "car_batch_inference_ms", "note"])
    detection_fields = ["image", "track_id", "car_conf", "car_box", "slot_candidate",
                        "slot_overlap_score", "slot_slot_coverage", "slot_car_coverage",
                        "slot_anchor_inside", "slot_center_inside", "plate_box", "plate_conf",
                        "plate_sharpness", "ocr_text", "ocr_conf", "stable_text", "votes",
                        "vote_share", "locked", "ocr_status"]
    write_csv(output_dir / "detections.csv", detection_rows, detection_fields)

    total_ms = (time.perf_counter() - run_start) * 1000
    run_info = {
        "created_at": datetime.now().astimezone().isoformat(),
        "device": device, "sequence_tracking": args.sequence,
        "image_count": len(images), "car_model": str(car_path),
        "plate_model": None if args.no_plates else str(plate_path),
        "slots_json": str(args.slots_json.resolve()) if args.slots_json and not args.no_slots else None,
        "settings": {
            "car_tracker_input_conf": TRACKER_INPUT_CONF,
            "car_application_conf": args.car_conf, "car_imgsz": CAR_IMAGE_SIZE,
            "car_frame_step_cctv": DETECT_EVERY_N_FRAMES,
            "plate_conf": args.plate_conf, "plate_imgsz": PLATE_IMAGE_SIZE,
            "plate_crop_padding": {"x": CAR_CROP_PAD_X, "top": CAR_CROP_PAD_TOP, "bottom": CAR_CROP_PAD_BOTTOM},
            "plate_ocr_zoom": 2.0, "ocr_language": "th",
            "sharpness_threshold": SHARPNESS_THRESHOLD,
            "ocr_lock_conf": OCR_LOCK_CONF_THRESHOLD, "ocr_min_length": OCR_MIN_TEXT_LENGTH,
            "ocr_stable_votes": OCR_STABLE_VOTES, "ocr_vote_share": OCR_VOTE_SHARE,
            "car_box_shrink_for_slot_match": CAR_BOX_SHRINK_RATIO,
            "car_display_box_expand": CAR_DISPLAY_BOX_EXPAND_RATIO,
            "slot_entry_overlap": PARKING_ENTRY_SCORE_THRESHOLD,
        },
        "slot_transitions": slot_transitions,
        "timing_ms": {"car_and_outputs_total": round(total_ms, 2),
                      "plate_stage_total": round(plate_stage_ms, 2),
                      "ocr_total": round(ocr_ms, 2),
                      "average_total_per_image": round(total_ms / max(len(images), 1), 2)},
        "note": "Image batch timing is offline processing time; it is not live CCTV end-to-end latency. Slot evidence is not a temporal parking status.",
    }
    (output_dir / "results.json").write_text(
        json.dumps({"run": run_info, "images": full_results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    if slot_transitions:
        write_csv(output_dir / "slot_transitions.csv", slot_transitions,
                  ["image", "slot", "from", "to", "track_id"])
    print("\nCompleted image batch.")
    print(f"Output folder: {output_dir.resolve()}")
    print(f"Images: {len(images)} | cars: {len(detection_rows)} | total: {total_ms:.1f} ms")
    print("Files: annotated/*.jpg, image_summary.csv, detections.csv, results.json")

    if args.show:
        for data in images_data:
            output_image = annotated_dir / f"{data['path'].stem}_result.jpg"
            display = cv2.imread(str(output_image))
            cv2.imshow("Parking image test — press any key for next, q to stop", display)
            if cv2.waitKey(0) & 0xFF == ord("q"):
                break
        cv2.destroyAllWindows()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
