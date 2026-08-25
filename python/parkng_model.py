# -*- coding: utf-8 -*-
"""Realtime CCTV car, license plate, and parking-slot monitor."""

import argparse
import cv2
try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None
import easyocr
import numpy as np
import torch
import re
from ultralytics import YOLO
import ultralytics
import os
import json
import glob
import time
from pathlib import Path

from cctv_viewer import load_cameras, open_capture, select_camera


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CCTV_JSON = Path(__file__).resolve().parent / 'oldcctvinfo4.json'
DEFAULT_PARKING_JSON = (
    PROJECT_ROOT / 'json_file' / 'parking_slots' / 'E4_cars'
    / 'E4_zoneA_cars.json'
)
MODEL_DIR = PROJECT_ROOT / 'yolo_models'


def parse_runtime_args():
    parser = argparse.ArgumentParser(
        description='Realtime CCTV parking monitor.'
    )
    parser.add_argument(
        '--camera',
        default='1',
        help='Camera NO, list index, IP, or name from the CCTV JSON.'
    )
    parser.add_argument(
        '--cctv-json',
        type=Path,
        default=DEFAULT_CCTV_JSON,
        help='CCTV JSON file containing RTSP URLs.'
    )
    parser.add_argument(
        '--parking',
        choices=('on', 'off'),
        default='on',
        help='Enable or disable parking-slot detection.'
    )
    parser.add_argument(
        '--parking-json',
        type=Path,
        default=DEFAULT_PARKING_JSON,
        help='COCO JSON file containing parking-slot annotations.'
    )
    parser.add_argument(
        '--video',
        help='Optional RTSP URL or video path; overrides --camera.'
    )
    parser.add_argument(
        '--max-frames',
        type=int,
        default=0,
        help='Stop after this many frames; 0 means keep running.'
    )
    return parser.parse_args()


RUNTIME_ARGS = parse_runtime_args()
PARKING_ENABLED = RUNTIME_ARGS.parking == 'on'

if RUNTIME_ARGS.video:
    video_path = RUNTIME_ARGS.video
else:
    cameras = load_cameras(RUNTIME_ARGS.cctv_json)
    selected_camera = select_camera(cameras, RUNTIME_ARGS.camera)
    video_path = selected_camera['ANPR&PTZ RTSP']

print('Realtime source:', video_path)

# Realtime video + parking JSON + car/plate/OCR/parking



# ============================================================
# 0) INPUT PATHS + PARKING SLOT JSON
# ============================================================
# For export/deployment, these are the main input paths to change.
#
# IMPORTANT:
#   The video filename and parking JSON filename should contain the same
#   Zone token, for example:
#       parkingEntranceZoneBv2.mp4
#       E4_zoneB.json
#
# Cell 10 now loads parking_slots by itself.
# Cell 9 is NOT required before running this cell.

PARKING_JSON_PATH = RUNTIME_ARGS.parking_json

# If PARKING_JSON_PATH does not exist, Cell 10 searches this directory for
# another JSON file whose Zone matches the video filename.
PARKING_JSON_DIR = str(PARKING_JSON_PATH.parent)

# Optional: manually disable parking slots.
# Example:
# DISABLED_SLOTS = {'zoneB_slot12'}
DISABLED_SLOTS = set()

# Use coordinates exactly as stored in the JSON.
# Change to 'scale_to_video' only when the annotation image and video have
# the same view but different resolutions.
PARKING_COORD_MODE = 'scale_to_video'  # 'json_exact' or 'scale_to_video'

# Parking-slot drawing options.
DRAW_SLOT_POLYGON = True
DRAW_SLOT_BBOX = False

# Keep False for normal runs/export. Set True only when you want an initial
# parking-slot preview before the full video pipeline starts.
SHOW_PARKING_SETUP_PREVIEW = False


def extract_zone_token(path_or_name):
    """
    Extract zonea / zoneb / ... from a filename.

    Examples:
        parkingEntranceZoneBv2.mp4 -> zoneb
        E4_zoneB.json              -> zoneb
    """
    name = os.path.basename(str(path_or_name))
    match = re.search(
        r'zone[_\-\s]*([a-z])',
        name,
        flags=re.IGNORECASE
    )

    if not match:
        return None

    return f"zone{match.group(1).lower()}"


def resolve_parking_json(video_path, preferred_json_path, json_dir):
    """Return a parking JSON whose Zone matches the video filename."""
    video_zone = extract_zone_token(video_path)

    if video_zone is None:
        raise ValueError(
            'Cannot find Zone token (ZoneA/ZoneB/...) in video filename:\n'
            f'{video_path}'
        )

    # Preferred JSON.
    if preferred_json_path and os.path.exists(preferred_json_path):
        json_zone = extract_zone_token(preferred_json_path)

        if json_zone != video_zone:
            raise ValueError(
                f'Zone mismatch: video={video_zone}, json={json_zone}\n'
                f'Video: {video_path}\n'
                f'JSON : {preferred_json_path}'
            )

        return preferred_json_path, video_zone

    # Fallback: search the JSON directory for the same Zone.
    candidates = []

    if json_dir and os.path.isdir(json_dir):
        for path in glob.glob(os.path.join(json_dir, '*.json')):
            if extract_zone_token(path) == video_zone:
                candidates.append(path)

    if not candidates:
        raise FileNotFoundError(
            f'Parking JSON not found: {preferred_json_path}\n'
            f'No JSON matching {video_zone} was found in:\n'
            f'{json_dir}'
        )

    candidates = sorted(
        candidates,
        key=lambda p: (
            len(os.path.basename(p)),
            p.lower()
        )
    )

    selected = candidates[0]

    if len(candidates) > 1:
        print(f'⚠️ Multiple parking JSON files match {video_zone}:')
        for path in candidates:
            print('   -', path)
        print('Using:', selected)

    return selected, video_zone


def load_parking_slots_from_json(
    video_path,
    parking_json_path,
    disabled_slots=None,
    coord_mode='json_exact'
):
    """
    Load COCO parking-slot annotations and return:
        parking_slots, first_video_frame, video_width, video_height

    Polygon coordinates are preserved exactly in json_exact mode.
    """
    disabled_slots = set(disabled_slots or [])

    cap_preview = open_capture(video_path)

    if not cap_preview.isOpened():
        raise RuntimeError(
            f'Could not open video: {video_path}'
        )

    video_w = int(
        cap_preview.get(cv2.CAP_PROP_FRAME_WIDTH)
    )
    video_h = int(
        cap_preview.get(cv2.CAP_PROP_FRAME_HEIGHT)
    )

    ret, preview_frame = cap_preview.read()
    cap_preview.release()

    if not ret:
        raise RuntimeError(
            f'Could not read first frame from video: {video_path}'
        )

    with open(
        parking_json_path,
        'r',
        encoding='utf-8'
    ) as f:
        parking_coco = json.load(f)

    categories_by_id = {
        int(cat['id']): cat
        for cat in parking_coco.get('categories', [])
    }

    images_by_id = {
        int(img['id']): img
        for img in parking_coco.get('images', [])
    }

    annotations = parking_coco.get(
        'annotations',
        []
    )

    if not annotations:
        raise ValueError(
            'No parking annotations found in JSON.'
        )

    slots = []

    for ann in annotations:
        category_id = int(
            ann['category_id']
        )

        category = categories_by_id.get(
            category_id,
            {}
        )

        slot_name = category.get(
            'name',
            f'slot_{category_id}'
        )

        # Ignore the generic parent class.
        if slot_name.lower() == 'parking-slot':
            continue

        image_info = images_by_id.get(
            int(ann['image_id']),
            {}
        )

        src_w = int(
            image_info.get(
                'width',
                video_w
            )
        )

        src_h = int(
            image_info.get(
                'height',
                video_h
            )
        )

        if coord_mode == 'json_exact':
            scale_x = 1.0
            scale_y = 1.0

        elif coord_mode == 'scale_to_video':
            scale_x = (
                video_w / max(src_w, 1)
            )
            scale_y = (
                video_h / max(src_h, 1)
            )

        else:
            raise ValueError(
                "PARKING_COORD_MODE must be "
                "'json_exact' or 'scale_to_video'"
            )

        # COCO bbox = [x, y, width, height]
        bx, by, bw, bh = ann['bbox']

        x1 = int(
            round(bx * scale_x)
        )
        y1 = int(
            round(by * scale_y)
        )
        x2 = int(
            round((bx + bw) * scale_x)
        )
        y2 = int(
            round((by + bh) * scale_y)
        )

        x1 = max(
            0,
            min(video_w - 1, x1)
        )
        y1 = max(
            0,
            min(video_h - 1, y1)
        )
        x2 = max(
            0,
            min(video_w - 1, x2)
        )
        y2 = max(
            0,
            min(video_h - 1, y2)
        )

        # COCO segmentation polygon = actual parking-slot outline.
        polygon = None

        segmentation = ann.get(
            'segmentation',
            []
        )

        if (
            isinstance(segmentation, list)
            and segmentation
            and isinstance(segmentation[0], list)
            and len(segmentation[0]) >= 6
        ):
            pts = np.array(
                segmentation[0],
                dtype=np.float32
            ).reshape(-1, 2)

            pts[:, 0] *= scale_x
            pts[:, 1] *= scale_y

            pts[:, 0] = np.clip(
                pts[:, 0],
                0,
                video_w - 1
            )
            pts[:, 1] = np.clip(
                pts[:, 1],
                0,
                video_h - 1
            )

            polygon = np.rint(
                pts
            ).astype(np.int32)

        attributes = ann.get(
            'attributes',
            {}
        )

        json_status = str(
            ann.get(
                'status',
                (
                    attributes.get(
                        'status',
                        ''
                    )
                    if isinstance(
                        attributes,
                        dict
                    )
                    else ''
                )
            )
        ).strip().lower()

        disabled = (
            slot_name in disabled_slots
            or json_status == 'disable'
            or json_status == 'disabled'
        )

        slots.append({
            'name': slot_name,
            'category_id': category_id,
            'bbox': (
                x1,
                y1,
                x2,
                y2
            ),
            'polygon': polygon,
            'source_resolution': (
                src_w,
                src_h
            ),
            'video_resolution': (
                video_w,
                video_h
            ),
            'disabled': disabled,
            'status': (
                'disable'
                if disabled
                else 'available'
            )
        })

    slots.sort(
        key=lambda slot: slot['category_id']
    )

    if not slots:
        raise ValueError(
            'No usable parking-slot classes were found in JSON.'
        )

    return (
        slots,
        preview_frame,
        video_w,
        video_h
    )


if PARKING_ENABLED:
    parking_json_path = PARKING_JSON_PATH
    if not parking_json_path.exists():
        raise FileNotFoundError(
            f'Parking JSON not found: {parking_json_path}'
        )

    PARKING_ZONE = extract_zone_token(parking_json_path) or 'zoneA'
    (
        parking_slots,
        parking_preview_frame,
        parking_video_w,
        parking_video_h
    ) = load_parking_slots_from_json(
        video_path,
        parking_json_path,
        disabled_slots=DISABLED_SLOTS,
        coord_mode=PARKING_COORD_MODE
    )
else:
    parking_json_path = PARKING_JSON_PATH
    PARKING_ZONE = 'disabled'
    parking_slots = []
    parking_preview_frame = None
    parking_video_w = 0
    parking_video_h = 0

print('\n' + '=' * 66)
print('INPUT CONFIGURATION')
print('=' * 66)
print(f'Video Zone          : {PARKING_ZONE}')
print(f'Video Path          : {video_path}')
print(f'Parking Detection   : {"ON" if PARKING_ENABLED else "OFF"}')
print(f'Parking JSON Path   : {parking_json_path}')
print(
    f'Video Resolution    : '
    f'{parking_video_w} x {parking_video_h}'
)
print(
    f'Parking Slots       : '
    f'{len(parking_slots)}'
)
print('=' * 66)

if PARKING_COORD_MODE == 'json_exact':
    source_resolutions = sorted({
        slot['source_resolution']
        for slot in parking_slots
    })

    for src_w, src_h in source_resolutions:
        if (
            src_w,
            src_h
        ) != (
            parking_video_w,
            parking_video_h
        ):
            print(
                '⚠️ JSON exact-coordinate mode: '
                f'JSON={src_w}x{src_h}, '
                f'video={parking_video_w}x{parking_video_h}. '
                'Coordinates are NOT scaled.'
            )


# ============================================================
# SAFE SPEED: cache static parking geometry once
# ============================================================
for _slot in parking_slots:
    _poly = _slot.get('polygon')

    if _poly is not None and len(_poly) >= 3:
        _poly_f32 = np.ascontiguousarray(
            np.asarray(_poly, dtype=np.float32).reshape(-1, 1, 2)
        )
        _slot['_polygon_f32'] = _poly_f32
        _slot['_slot_area'] = max(
            abs(float(cv2.contourArea(_poly_f32))),
            1.0
        )
        _slot['_polygon_is_convex'] = bool(
            cv2.isContourConvex(_poly_f32)
        )
        _flat = _poly_f32.reshape(-1, 2)
        _slot['_label_xy'] = (
            int(np.min(_flat[:, 0])),
            int(np.min(_flat[:, 1]))
        )
    else:
        _slot['_polygon_f32'] = None
        x1, y1, x2, y2 = _slot['bbox']
        _slot['_slot_area'] = max(
            float(max(0, x2 - x1) * max(0, y2 - y1)),
            1.0
        )
        _slot['_polygon_is_convex'] = False
        _slot['_label_xy'] = (int(x1), int(y1))



if SHOW_PARKING_SETUP_PREVIEW:
    _preview = parking_preview_frame.copy()

    for slot in parking_slots:
        x1, y1, x2, y2 = slot['bbox']

        color = (
            (128, 128, 128)
            if slot['disabled']
            else (0, 255, 0)
        )

        polygon = slot.get(
            'polygon'
        )

        if (
            DRAW_SLOT_POLYGON
            and polygon is not None
        ):
            cv2.polylines(
                _preview,
                [polygon],
                isClosed=True,
                color=color,
                thickness=2,
                lineType=cv2.LINE_AA
            )

            label_x = int(
                np.min(
                    polygon[:, 0]
                )
            )
            label_y = int(
                np.min(
                    polygon[:, 1]
                )
            )

        else:
            label_x = x1
            label_y = y1

        if (
            DRAW_SLOT_BBOX
            or polygon is None
        ):
            cv2.rectangle(
                _preview,
                (x1, y1),
                (x2, y2),
                color,
                2,
                lineType=cv2.LINE_AA
            )

        cv2.putText(
            _preview,
            f"{slot['name']} | {slot['status']}",
            (
                label_x,
                max(
                    20,
                    label_y - 8
                )
            ),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            color,
            2,
            cv2.LINE_AA
        )

    if plt is not None:
        plt.figure(
            figsize=(16, 9)
        )

        plt.imshow(
            cv2.cvtColor(
                _preview,
                cv2.COLOR_BGR2RGB
            )
        )

        plt.title(
            f'Parking slots preview | '
            f'{PARKING_ZONE} | '
            f'{os.path.basename(parking_json_path)}'
        )

        plt.axis('off')
        plt.show()



# ============================================================
# 1) Setup & Constants
# ============================================================

USE_GPU = torch.cuda.is_available()
DEVICE = 'cuda' if USE_GPU else 'cpu'
print(f'Device: {DEVICE}')

LICENSE_PLATE_MODEL_PATH = MODEL_DIR / 'best_license_plate_detector.pt'
if 'trained_model' not in globals():
    trained_model = YOLO(LICENSE_PLATE_MODEL_PATH)
trained_model.to(DEVICE)
print(f'License plate detector ready: {LICENSE_PLATE_MODEL_PATH}')

CAR_MODEL_PATH = MODEL_DIR / 'trained_car_detector.pt'
car_detector_model = YOLO(CAR_MODEL_PATH)
car_detector_model.to(DEVICE)
print(f'Car detector model loaded from: {CAR_MODEL_PATH}')

reader = easyocr.Reader(['th'], gpu=USE_GPU, verbose=False)


# ============================================================
# Thresholds
# ============================================================

CAR_CONF_THRESHOLD = 0.60
PLATE_CONF_THRESHOLD = 0.3
SHARPNESS_THRESHOLD = 40.0
LOCK_CONF_THRESHOLD = 0.5
MIN_PLATE_LENGTH = 5

CAR_DEDUP_IOU_THRESHOLD = 0.5
CAR_CONTAINMENT_THRESHOLD = 0.8

MIN_DIGITS_FOR_ID_MATCH = 3
MAX_TRACK_MERGE_FRAME_GAP = 60
TRACK_MERGE_IOU_THRESHOLD = 0.1
TRACK_MERGE_CENTER_DISTANCE = 0.6

DIGITS_LOCK_MIN_VOTES = 2
FULL_PLATE_LOCK_MIN_VOTES = 3
VOTE_MIN_SHARE = 0.6
MAX_OBSERVATIONS_PER_CAR = 30

# Stable Memory: once a full plate becomes reliable, preserve it even if later
# OCR gets worse when the car moves far away. A different plate can replace it
# only when the new candidate has clearly stronger evidence.
STABLE_REPLACE_EXTRA_VOTES = 3
STABLE_REPLACE_MIN_SHARE = 0.75
STABLE_REPLACE_SCORE_TOLERANCE = 0.05

# Re-identification: if a new tracker ID later reads the exact same full plate
# as an existing stable memory, merge it back to the old canonical car ID even
# when the spatial/frame-gap test is no longer valid. Exact full stable plate
# is much safer than digit-only matching.
GLOBAL_STABLE_PLATE_REID = True
GLOBAL_STABLE_PLATE_REID_MIN_LENGTH = 5

# ============================================================
# v6.1 Same-frame canonical ID safety
# ============================================================
# One canonical vehicle ID may belong to only ONE accepted bounding box in
# the same frame. This prevents Plate ReID / stale aliases from making two
# different visible cars display the exact same ID + plate memory.
SAME_FRAME_CANONICAL_LOCK = True
SAME_FRAME_CANONICAL_DEBUG = False

# Short/medium-gap tracker recovery when the plate is temporarily unreadable.
# A track may be recovered from either a stable plate OR a sufficiently useful
# historical plate memory. Geometry must still be unambiguous.
RECENT_GEOMETRY_REID = True
RECENT_GEOMETRY_REID_MAX_GAP = 120
RECENT_GEOMETRY_REID_MIN_IOU = 0.10
RECENT_GEOMETRY_REID_MAX_CENTER_DISTANCE = 0.50
RECENT_GEOMETRY_REID_MIN_SCORE_MARGIN = 0.15
RECENT_REID_MEMORY_MIN_SCORE = 0.45
RECENT_REID_MEMORY_MIN_PLATE_LENGTH = 5

# ============================================================
# v6 Tracker identity continuity
# ============================================================
# The tracker receives lower-confidence detections so a physical car can keep
# its track through blur, side-view rotation and partial occlusion. The rest of
# this application STILL accepts/draws/parks only detections >= 0.60.
TRACKER_INPUT_CONF = 0.10
TRACKER_BUFFER = 120

# BoT-SORT appearance ReID. Static parking camera -> GMC is unnecessary.
# Lower proximity threshold allows appearance matching even when a front-view
# box becomes a side-view box and IoU drops during the turn.
BOTSORT_PROXIMITY_THRESH = 0.20
BOTSORT_APPEARANCE_THRESH = 0.75
CUSTOM_TRACKER_PATH = MODEL_DIR / 'parking_botsort_reid.yaml'

with open(CUSTOM_TRACKER_PATH, 'w') as _tracker_file:
    _tracker_file.write(
        f"""tracker_type: botsort
track_high_thresh: 0.25
track_low_thresh: 0.10
new_track_thresh: 0.55
track_buffer: {TRACKER_BUFFER}
match_thresh: 0.80
fuse_score: True
gmc_method: none
proximity_thresh: {BOTSORT_PROXIMITY_THRESH}
appearance_thresh: {BOTSORT_APPEARANCE_THRESH}
with_reid: True
model: auto
"""
    )

# Second software-level recovery for an ID switch specifically while a car is
# rotating in-view. This is deliberately independent of OCR on the new frame.
TURN_REID = True
TURN_REID_MAX_FRAME_GAP = 90
TURN_REID_MAX_PRED_CENTER_DISTANCE = 1.10
TURN_REID_MAX_LAST_CENTER_DISTANCE = 1.25
TURN_REID_MAX_AREA_RATIO = 4.00
TURN_REID_MIN_SCORE_MARGIN = 0.18
TURN_REID_MIN_ACCEPT_SCORE = 1.15
TURN_REID_HISTORY = 8

print(f'Ultralytics version: {getattr(ultralytics, "__version__", "unknown")}')
print(
    'Tracker: BoT-SORT + ReID | '
    f'buffer={TRACKER_BUFFER} | '
    f'proximity={BOTSORT_PROXIMITY_THRESH:.2f} | '
    f'appearance={BOTSORT_APPEARANCE_THRESH:.2f}'
)

CAR_DETECTOR_IMGSZ = 960
DETECTOR_IMGSZ = 640
DETECT_EVERY_N_FRAMES = 8

# Car crop recovery: YOLO detection box stays unchanged for tracking/merge,
# but Stage-2 may retry with a padded crop when the raw car box cuts off the plate.
CAR_CROP_PAD_X = 0.20
CAR_CROP_PAD_TOP = 0.12
CAR_CROP_PAD_BOTTOM = 0.22
PLATE_EXPANDED_RETRY_CONF = 0.45

# Make the visible/matching car box 10% smaller than the raw YOLO box.
# 0.10 means final width and height are 90% of the YOLO box.
CAR_BOX_SHRINK_RATIO = 0.10

# Keep padded boxes for license-plate retry crops only; do not draw them.
DRAW_PADDED_CAR_BOX = False

# Performance optimization: keep model resolution and car-detection cadence unchanged.
YOLO_QUANTIZE = 16 if USE_GPU else None  # FP16 on GPU; FP32 on CPU
DISPLAY_EVERY_N_FRAMES = 1              # Show every frame for realtime playback
STABLE_STAGE2_EVERY_N_FRAMES = 6        # once stable, re-check plate/OCR less often

# ============================================================
# SAFE SPEED OPTIMIZATION
# ============================================================
# Accuracy-sensitive settings stay unchanged:
#   CAR_DETECTOR_IMGSZ, DETECTOR_IMGSZ, confidence thresholds,
#   confidence thresholds, OCR 2x zoom, voting and lock thresholds.
PLATE_BATCH_SIZE = 8 if USE_GPU else 2
EASYOCR_BATCH_SIZE = 8 if USE_GPU else 1
DRAW_ONLY_ON_DISPLAY_FRAMES = True
RUNTIME_VERBOSE_DETAILS = False
LIVE_PLOT_ENABLED = False
DISPLAY_MAX_WIDTH = 1280
DISPLAY_MAX_HEIGHT = 720

# Faster inference kernels; no reduction in input resolution.
torch.set_grad_enabled(False)
torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
if USE_GPU:
    torch.backends.cudnn.benchmark = True

MIN_STABLE_FULL_VOTES_FOR_THROTTLE = 5
MIN_STABLE_PREFIX_SHARE_FOR_THROTTLE = 0.75
MIN_STABLE_DIGIT_SHARE_FOR_THROTTLE = 0.75

def print_threshold_config():
    print('\n' + '=' * 66)
    print('THRESHOLD CONFIGURATION — VIDEO PIPELINE')
    print('=' * 66)


def prepare_display_frame(frame):
    """Fit the display image without upscaling or changing its aspect ratio."""
    frame_height, frame_width = frame.shape[:2]
    scale = min(
        DISPLAY_MAX_WIDTH / max(frame_width, 1),
        DISPLAY_MAX_HEIGHT / max(frame_height, 1),
        1.0
    )

    if scale >= 1.0:
        return frame

    return cv2.resize(
        frame,
        (
            max(1, int(frame_width * scale)),
            max(1, int(frame_height * scale))
        ),
        interpolation=cv2.INTER_AREA
    )

    print(f'[Confidence] Car Detector            : >= {CAR_CONF_THRESHOLD:.2f}')
    print(f'[Confidence] License Plate Detector  : >= {PLATE_CONF_THRESHOLD:.2f}')
    print(f'[Confidence] OCR Lock / Accept       : >= {LOCK_CONF_THRESHOLD:.2f}')

    print('-' * 66)

    print(f'[Filter]     Sharpness (Laplacian)   : >= {SHARPNESS_THRESHOLD:.1f}')
    print(f'[Filter]     Car Dedup IoU            : >= {CAR_DEDUP_IOU_THRESHOLD:.2f}')
    print(f'[Filter]     Car Containment / IoS    : >= {CAR_CONTAINMENT_THRESHOLD:.2f}')
    print(f'[Filter]     Minimum Plate Length     : >= {MIN_PLATE_LENGTH} characters')
    print(f'[Recovery]   Car crop pad X            : {CAR_CROP_PAD_X:.2f}')
    print(f'[Recovery]   Car crop pad top/bottom   : {CAR_CROP_PAD_TOP:.2f} / {CAR_CROP_PAD_BOTTOM:.2f}')
    print(f'[Recovery]   Expanded retry below conf : {PLATE_EXPANDED_RETRY_CONF:.2f}')

    print(f'[Merge]      Min digits for ID match  : >= {MIN_DIGITS_FOR_ID_MATCH}')
    print(f'[Merge]      Max frame gap            : <= {MAX_TRACK_MERGE_FRAME_GAP}')

    print(f'[Voting]     Digits stable votes      : >= {DIGITS_LOCK_MIN_VOTES}')
    print(f'[Voting]     Full plate lock votes    : >= {FULL_PLATE_LOCK_MIN_VOTES}')
    print(f'[Memory]     Stable replace extra votes: >= {STABLE_REPLACE_EXTRA_VOTES}')
    print(f'[Memory]     Stable replace min share  : >= {STABLE_REPLACE_MIN_SHARE:.2f}')
    print(f'[Performance] YOLO precision           : {"FP16" if YOLO_QUANTIZE == 16 else "FP32"}')
    print(f'[Performance] Display every            : {DISPLAY_EVERY_N_FRAMES} frames')
    print(f'[Performance] Stable Stage-2 every     : {STABLE_STAGE2_EVERY_N_FRAMES} frames')
    print(f'[Tracker]     BoT-SORT ReID            : enabled')
    print(f'[Tracker]     Track buffer             : {TRACKER_BUFFER} frames')
    print(f'[Tracker]     ReID proximity           : {BOTSORT_PROXIMITY_THRESH:.2f}')
    print(f'[Tracker]     ReID appearance          : {BOTSORT_APPEARANCE_THRESH:.2f}')
    print(f'[Identity]    Turning ReID max gap     : {TURN_REID_MAX_FRAME_GAP} frames')
    print('=' * 66)


print_threshold_config()
print('Running Car Detection -> Zoom -> License Plate Detection -> EasyOCR -> Voting ...')


# ============================================================
# 2) Memory
# ============================================================

car_memory = {}
car_id_alias = {}

# Canonical identity is separate from the tracker ID. A physical vehicle may
# accumulate many tracker IDs after occlusion/rotation, while its canonical ID
# and historical plate memory remain unchanged.
vehicle_identity_registry = {}
vehicle_motion_memory = {}


# ============================================================
# 3) Image preprocessing
# ============================================================

def is_image_sharp(cropped_img, threshold=SHARPNESS_THRESHOLD):
    if cropped_img is None or cropped_img.size == 0:
        return False

    gray = cv2.cvtColor(cropped_img, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()

    return laplacian_var >= threshold


_clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))


def enhance_frame_for_detection(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)

    l_enhanced = _clahe.apply(l_channel)
    lab_enhanced = cv2.merge((l_enhanced, a_channel, b_channel))

    return cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)


# ============================================================
# 4) Geometry helpers
# ============================================================

def _intersection_area(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)

    return inter_w * inter_h


def _box_area(box):
    x1, y1, x2, y2 = box
    return max(0, x2 - x1) * max(0, y2 - y1)


def _box_iou(box_a, box_b):
    inter_area = _intersection_area(box_a, box_b)
    union_area = _box_area(box_a) + _box_area(box_b) - inter_area

    if union_area <= 0:
        return 0.0

    return inter_area / union_area


def _box_ios(box_a, box_b):
    inter_area = _intersection_area(box_a, box_b)
    smaller_area = min(_box_area(box_a), _box_area(box_b))

    if smaller_area <= 0:
        return 0.0

    return inter_area / smaller_area


def _normalized_center_distance(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    acx = (ax1 + ax2) / 2.0
    acy = (ay1 + ay2) / 2.0
    bcx = (bx1 + bx2) / 2.0
    bcy = (by1 + by2) / 2.0

    center_dist = ((acx - bcx) ** 2 + (acy - bcy) ** 2) ** 0.5

    aw = max(1, ax2 - ax1)
    ah = max(1, ay2 - ay1)
    bw = max(1, bx2 - bx1)
    bh = max(1, by2 - by1)

    diag_a = (aw ** 2 + ah ** 2) ** 0.5
    diag_b = (bw ** 2 + bh ** 2) ** 0.5

    scale = max(1.0, (diag_a + diag_b) / 2.0)

    return center_dist / scale


def _boxes_likely_same_car(box_a, box_b):
    iou = _box_iou(box_a, box_b)
    ios = _box_ios(box_a, box_b)
    center_distance = _normalized_center_distance(box_a, box_b)

    return (
        iou >= TRACK_MERGE_IOU_THRESHOLD
        or ios >= CAR_CONTAINMENT_THRESHOLD
        or center_distance <= TRACK_MERGE_CENTER_DISTANCE
    )


def expand_car_box(
    box,
    frame_shape,
    pad_x=CAR_CROP_PAD_X,
    pad_top=CAR_CROP_PAD_TOP,
    pad_bottom=CAR_CROP_PAD_BOTTOM
):
    """
    Expand only the processing/display region around a YOLO car box.
    The original YOLO box must still be used for tracking, dedup and identity matching.
    """
    x1, y1, x2, y2 = box
    frame_h, frame_w = frame_shape[:2]

    box_w = max(1, x2 - x1)
    box_h = max(1, y2 - y1)

    ex1 = max(0, int(round(x1 - box_w * pad_x)))
    ex2 = min(frame_w, int(round(x2 + box_w * pad_x)))
    ey1 = max(0, int(round(y1 - box_h * pad_top)))
    ey2 = min(frame_h, int(round(y2 + box_h * pad_bottom)))

    return ex1, ey1, ex2, ey2


def shrink_car_box(box, frame_shape, shrink_ratio=CAR_BOX_SHRINK_RATIO):
    """
    Shrink a YOLO car box around its center.

    shrink_ratio=0.10 -> final width/height = 90% of original.
    This smaller box is used only for parking overlap and visualization.
    Raw YOLO boxes are still used for tracking/merge and plate OCR crops.
    """
    x1, y1, x2, y2 = map(float, box)
    frame_h, frame_w = frame_shape[:2]

    shrink_ratio = float(np.clip(shrink_ratio, 0.0, 0.90))
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0

    new_w = max(1.0, (x2 - x1) * (1.0 - shrink_ratio))
    new_h = max(1.0, (y2 - y1) * (1.0 - shrink_ratio))

    sx1 = max(0, int(round(cx - new_w / 2.0)))
    sy1 = max(0, int(round(cy - new_h / 2.0)))
    sx2 = min(frame_w - 1, int(round(cx + new_w / 2.0)))
    sy2 = min(frame_h - 1, int(round(cy + new_h / 2.0)))

    return sx1, sy1, sx2, sy2


# ============================================================
# 5) Same-frame car dedup
# ============================================================

def dedup_car_detections(
    detections,
    iou_threshold=CAR_DEDUP_IOU_THRESHOLD,
    containment_threshold=CAR_CONTAINMENT_THRESHOLD
):
    if not detections:
        return [], {}

    sorted_dets = sorted(detections, key=lambda d: d[5], reverse=True)

    kept = []
    aliases = {}

    for det in sorted_dets:
        det_id = det[0]
        box = det[1:5]
        duplicate_of = None

        for kept_det in kept:
            kept_box = kept_det[1:5]

            iou = _box_iou(box, kept_box)
            ios = _box_ios(box, kept_box)

            if iou >= iou_threshold or ios >= containment_threshold:
                duplicate_of = kept_det[0]
                break

        if duplicate_of is None:
            kept.append(det)
        else:
            aliases[det_id] = duplicate_of

    return kept, aliases


# ============================================================
# 6) Plate parsing / Track alias
# ============================================================

THAI_DIGIT_TRANSLATION = str.maketrans({
    '๐': '0',
    '๑': '1',
    '๒': '2',
    '๓': '3',
    '๔': '4',
    '๕': '5',
    '๖': '6',
    '๗': '7',
    '๘': '8',
    '๙': '9'
})


def resolve_car_id(track_id, alias_map=car_id_alias):
    seen = set()

    while track_id in alias_map and track_id not in seen:
        seen.add(track_id)
        track_id = alias_map[track_id]

    return track_id



def _register_canonical_track(canonical_id, raw_track_id=None, frame_idx=None, reason=None):
    """Remember every tracker ID that has represented one physical vehicle."""
    canonical_id = resolve_car_id(int(canonical_id))

    entry = vehicle_identity_registry.setdefault(
        canonical_id,
        {
            'canonical_id': canonical_id,
            'tracker_ids': [],
            'last_reid_reason': None,
            'last_reid_frame': None
        }
    )

    if raw_track_id is not None:
        raw_track_id = int(raw_track_id)
        if raw_track_id not in entry['tracker_ids']:
            entry['tracker_ids'].append(raw_track_id)

    if reason:
        entry['last_reid_reason'] = str(reason)
        entry['last_reid_frame'] = (
            int(frame_idx) if frame_idx is not None else None
        )

    info = car_memory.get(canonical_id)
    if info is not None:
        info['canonical_id'] = canonical_id
        info['tracker_ids'] = list(entry['tracker_ids'])
        if reason:
            info['last_reid_reason'] = str(reason)
            info['last_reid_frame'] = entry['last_reid_frame']

    return canonical_id


def _merge_vehicle_motion_memory(source_id, target_id):
    source_id = int(source_id)
    target_id = int(target_id)

    if source_id == target_id:
        return

    source = vehicle_motion_memory.pop(source_id, None)
    if not source:
        return

    target = vehicle_motion_memory.setdefault(target_id, {'history': []})
    combined = target.get('history', []) + source.get('history', [])
    combined.sort(key=lambda x: x['frame'])

    # Deduplicate same-frame samples and keep the newest bounded history.
    by_frame = {}
    for item in combined:
        by_frame[int(item['frame'])] = item

    target['history'] = list(by_frame.values())[-TURN_REID_HISTORY:]


def bind_tracker_to_canonical(raw_track_id, canonical_id, frame_idx=None, reason='reid'):
    """
    Bind a newly-created tracker ID to an existing physical vehicle identity.
    Plate/OCR memory is preserved under the canonical vehicle ID.
    """
    raw_track_id = int(raw_track_id)
    source_id = resolve_car_id(raw_track_id)
    canonical_id = resolve_car_id(int(canonical_id))

    if source_id != canonical_id:
        if source_id in car_memory:
            merge_track_memories(car_memory, source_id, canonical_id)
        else:
            car_id_alias[source_id] = canonical_id

        _merge_vehicle_motion_memory(source_id, canonical_id)

    car_id_alias[raw_track_id] = canonical_id
    _register_canonical_track(
        canonical_id,
        raw_track_id=raw_track_id,
        frame_idx=frame_idx,
        reason=reason
    )

    return canonical_id


def _detach_raw_track_alias(raw_track_id, frame_idx=None, reason='SAME_FRAME_COLLISION'):
    """
    Detach ONLY the current raw tracker ID from a stale canonical alias.

    This does NOT delete the old canonical vehicle memory. The detached raw
    tracker becomes an independent identity again and can build its own OCR
    memory. This is intentionally safer than allowing two visible boxes to
    share one canonical ID.
    """
    raw_track_id = int(raw_track_id)
    old_canonical = resolve_car_id(raw_track_id)

    # Remove the direct raw -> canonical edge. A current tracker ID created by
    # BoT-SORT is the edge we want to split; historical canonical memory stays.
    car_id_alias.pop(raw_track_id, None)

    # Keep the registry honest for debug/display purposes.
    entry = vehicle_identity_registry.get(old_canonical)
    if entry is not None:
        entry['tracker_ids'] = [
            tid for tid in entry.get('tracker_ids', [])
            if int(tid) != raw_track_id
        ]

    if SAME_FRAME_CANONICAL_DEBUG:
        print(
            f'[v6.1 SAME_FRAME_SPLIT] raw={raw_track_id} '
            f'was canonical={old_canonical} reason={reason} frame={frame_idx}'
        )

    return raw_track_id


def _canonical_collision_score(canonical_id, det, frame_idx):
    """Score which raw box most plausibly belongs to an already-known canonical."""
    raw_id = int(det[0])
    current_box = tuple(map(float, det[1:5]))
    conf = float(det[5]) if len(det) > 5 else 0.0

    # Strong preference: if the tracker itself still carries the canonical ID,
    # keep that box and detach newer aliases.
    score = 5.0 if raw_id == int(canonical_id) else 0.0

    info = car_memory.get(canonical_id, {})
    history = vehicle_motion_memory.get(canonical_id, {}).get('history', [])

    if history:
        last_box = tuple(history[-1]['box'])
    else:
        last_box = info.get('last_box')

    if last_box is not None:
        last_box = tuple(map(float, last_box))
        iou = _box_iou(last_box, current_box)
        ios = _box_ios(last_box, current_box)
        center_dist = _normalized_center_distance(last_box, current_box)

        score += iou * 2.0
        score += ios * 0.75
        score += max(0.0, 1.0 - center_dist) * 1.25

    predicted = _predict_vehicle_center(canonical_id, frame_idx)
    if predicted is not None:
        cx = (current_box[0] + current_box[2]) / 2.0
        cy = (current_box[1] + current_box[3]) / 2.0

        if last_box is None:
            norm_box = current_box
        else:
            norm_box = last_box

        pred_dist = _point_distance_normalized(
            predicted,
            (cx, cy),
            norm_box,
            current_box
        )
        score += max(0.0, 1.0 - pred_dist) * 0.75

    score += conf * 0.05
    return float(score)


def enforce_same_frame_canonical_uniqueness(detections, frame_idx):
    """
    Repair stale aliases BEFORE OCR/display/parking.

    Same-frame car dedup has already run before this function. Therefore, when
    two surviving accepted detections resolve to the same canonical ID, they
    should be treated as two distinct physical boxes unless proven otherwise.

    Returns:
        {raw_track_id: old_canonical_id} for aliases that were detached.
    """
    if not SAME_FRAME_CANONICAL_LOCK or not detections:
        return {}

    groups = {}
    for det in detections:
        raw_id = int(det[0])
        canonical_id = resolve_car_id(raw_id)
        groups.setdefault(canonical_id, []).append(det)

    repaired = {}

    for canonical_id, group in groups.items():
        if len(group) <= 1:
            continue

        ranked = sorted(
            group,
            key=lambda det: _canonical_collision_score(
                canonical_id,
                det,
                frame_idx
            ),
            reverse=True
        )

        winner_raw = int(ranked[0][0])

        for det in ranked[1:]:
            loser_raw = int(det[0])

            # If this raw ID somehow is the canonical number itself, never
            # destroy canonical memory; winner selection strongly prefers it.
            if loser_raw == int(canonical_id):
                continue

            old_canonical = resolve_car_id(loser_raw)
            if old_canonical != canonical_id:
                continue

            _detach_raw_track_alias(
                loser_raw,
                frame_idx=frame_idx,
                reason=f'CANONICAL_{canonical_id}_ALREADY_USED_BY_RAW_{winner_raw}'
            )
            repaired[loser_raw] = canonical_id

    return repaired


def build_frame_canonical_claims(detections):
    """Build canonical_id -> raw_track_id after collision repair."""
    claims = {}

    for det in detections:
        raw_id = int(det[0])
        canonical_id = resolve_car_id(raw_id)

        # This should not occur after enforce_same_frame_canonical_uniqueness().
        # If it does, keep the first claim and do NOT silently overwrite it.
        if canonical_id not in claims:
            claims[canonical_id] = raw_id

    return claims


def _update_vehicle_motion(canonical_id, raw_track_id, box, frame_idx):
    canonical_id = resolve_car_id(int(canonical_id))
    raw_track_id = int(raw_track_id)
    box = tuple(map(float, box))
    cx = (box[0] + box[2]) / 2.0
    cy = (box[1] + box[3]) / 2.0

    entry = vehicle_motion_memory.setdefault(canonical_id, {'history': []})
    history = entry.setdefault('history', [])
    history.append({
        'frame': int(frame_idx),
        'box': box,
        'center': (cx, cy),
        'raw_track_id': raw_track_id
    })

    entry['history'] = history[-TURN_REID_HISTORY:]
    _register_canonical_track(canonical_id, raw_track_id=raw_track_id)

    # Keep geometry alive even on a frame where the plate is invisible.
    info = car_memory.get(canonical_id)
    if info is not None:
        info['last_box'] = box
        info['last_seen_frame'] = int(frame_idx)


def _point_distance_normalized(point_a, point_b, box_a, box_b):
    ax, ay = point_a
    bx, by = point_b
    dist = ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5

    def diag(box):
        x1, y1, x2, y2 = box
        return max(1.0, ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5)

    scale = max(1.0, (diag(box_a) + diag(box_b)) / 2.0)
    return dist / scale


def _predict_vehicle_center(canonical_id, current_frame):
    """Constant-velocity center prediction from the last two distinct frames."""
    canonical_id = resolve_car_id(int(canonical_id))
    history = vehicle_motion_memory.get(canonical_id, {}).get('history', [])

    if not history:
        return None

    last = history[-1]
    if len(history) < 2:
        return last['center']

    prev = None
    for item in reversed(history[:-1]):
        if int(item['frame']) < int(last['frame']):
            prev = item
            break

    if prev is None:
        return last['center']

    dt = max(1, int(last['frame']) - int(prev['frame']))
    future = max(0, int(current_frame) - int(last['frame']))

    vx = (last['center'][0] - prev['center'][0]) / dt
    vy = (last['center'][1] - prev['center'][1]) / dt

    # Do not let a noisy two-frame velocity prediction explode over a gap.
    last_box = last['box']
    diag = max(
        1.0,
        ((last_box[2] - last_box[0]) ** 2 + (last_box[3] - last_box[1]) ** 2) ** 0.5
    )
    max_shift = diag * 1.50
    shift_x = float(np.clip(vx * future, -max_shift, max_shift))
    shift_y = float(np.clip(vy * future, -max_shift, max_shift))

    return (
        last['center'][0] + shift_x,
        last['center'][1] + shift_y
    )


def _normalize_plate_text(text):
    if not text:
        return ''

    text = str(text).translate(THAI_DIGIT_TRANSLATION)
    text = re.sub(r'\s+', '', text)

    return text.strip()


def split_plate_text(text):
    """
    Example:
        ขอ 5337 -> prefix='ขอ', digits='5337'
    """

    norm = _normalize_plate_text(text)

    if not norm:
        return '', ''

    matches = list(re.finditer(r'\d+', norm))

    if not matches:
        prefix = re.sub(r'[^\u0E01-\u0E5BA-Za-z]', '', norm)
        return prefix, ''

    best_match = max(matches, key=lambda m: len(m.group(0)))

    digits = best_match.group(0)
    prefix_raw = norm[:best_match.start()]
    prefix = re.sub(r'[^\u0E01-\u0E5BA-Za-z]', '', prefix_raw)

    return prefix, digits


# ============================================================
# 7) Spatial / Temporal matching
# ============================================================

def _same_track_spatial_temporal(info, current_box, current_frame):
    if current_box is None:
        return False

    last_box = info.get('last_box')
    last_seen = info.get('last_seen_frame')

    if last_box is None or last_seen is None:
        return False

    frame_gap = abs(int(current_frame) - int(last_seen))

    if frame_gap > MAX_TRACK_MERGE_FRAME_GAP:
        return False

    # Same frame ต้อง overlap / containment จริง
    if frame_gap == 0:
        return (
            _box_iou(last_box, current_box) >= CAR_DEDUP_IOU_THRESHOLD
            or _box_ios(last_box, current_box) >= CAR_CONTAINMENT_THRESHOLD
        )

    return _boxes_likely_same_car(last_box, current_box)


def find_matching_car_id(
    car_memory,
    text,
    current_box,
    current_frame,
    exclude_id=None,
    active_canonical_claims=None,
    current_raw_track_id=None
):
    """
    Re-identify a tracker ID using two levels:

    1) Exact FULL stable plate match
       - may match across a long tracker gap / camera blur period.
       - this preserves the old canonical ID and plate memory.

    2) Normal spatial-temporal match
       - required for weaker full/partial digit matches.
    """
    norm_text = _normalize_plate_text(text)
    _, digits = split_plate_text(text)

    best_candidate = None
    best_strength = -1.0

    for tid, info in list(car_memory.items()):
        tid = resolve_car_id(tid)

        if tid == exclude_id or tid not in car_memory:
            continue

        info = car_memory[tid]

        # v6.1: a canonical ID that is already represented by another accepted
        # box in THIS frame cannot be a Plate-ReID target. This is the key guard
        # that prevents two visible cars from becoming the same ID.
        if active_canonical_claims is not None:
            claimed_raw = active_canonical_claims.get(tid)
            if (
                claimed_raw is not None
                and current_raw_track_id is not None
                and int(claimed_raw) != int(current_raw_track_id)
            ):
                continue

        existing_text = info.get('stable_text') or info.get('text', '')
        existing_digits = info.get('stable_digits') or info.get('digits', '')
        existing_score = (
            info.get('stable_score')
            if info.get('stable_text')
            else info.get('score', 0.0)
        )
        existing_norm = _normalize_plate_text(existing_text)

        # ----------------------------------------------------
        # Strongest re-ID: exact historical FULL stable plate.
        # This intentionally does NOT require the old track box
        # to still be nearby.
        # ----------------------------------------------------
        exact_stable_full = (
            GLOBAL_STABLE_PLATE_REID
            and bool(info.get('stable_text'))
            and bool(norm_text)
            and len(norm_text) >= GLOBAL_STABLE_PLATE_REID_MIN_LENGTH
            and norm_text == existing_norm
        )

        if exact_stable_full:
            strength = 10.0 + float(existing_score or 0.0)
            if strength > best_strength:
                best_strength = strength
                best_candidate = tid
            continue

        # ----------------------------------------------------
        # Weaker matching still requires spatial + temporal
        # consistency to avoid merging two different vehicles.
        # ----------------------------------------------------
        if not _same_track_spatial_temporal(
            info,
            current_box,
            current_frame
        ):
            continue

        full_match = bool(norm_text) and norm_text == existing_norm
        digit_match = (
            len(digits) >= MIN_DIGITS_FOR_ID_MATCH
            and digits == existing_digits
        )

        if not (full_match or digit_match):
            continue

        strength = 2.5 if full_match else 1.0

        if info.get('stable_text'):
            strength += 0.5

        strength += float(existing_score or 0.0) * 0.1

        if strength > best_strength:
            best_strength = strength
            best_candidate = tid

    return best_candidate


# ============================================================
# 8) EasyOCR
# ============================================================

def read_plate_with_easyocr(reader, plate_img):
    # Same EasyOCR detector/recognizer and same plate image.
    # batch_size only groups recognition work internally.
    easy_results = reader.readtext(
        plate_img,
        batch_size=EASYOCR_BATCH_SIZE,
        workers=0
    )

    if not easy_results:
        return '', 0.0

    text = ' '.join(res[1] for res in easy_results)
    avg_conf = sum(res[2] for res in easy_results) / len(easy_results)

    return text, avg_conf


# ============================================================
# 9) Voting
# ============================================================

def _weighted_winner(items, value_key, weight_key='score'):
    totals = {}
    counts = {}

    for item in items:
        value = item.get(value_key, '')

        if not value:
            continue

        weight = max(float(item.get(weight_key, 0.0)), 0.01)

        totals[value] = totals.get(value, 0.0) + weight
        counts[value] = counts.get(value, 0) + 1

    if not totals:
        return '', 0.0, 0, 0.0

    winner = max(totals, key=totals.get)
    winner_weight = totals[winner]

    total_weight = sum(totals.values())
    share = winner_weight / total_weight if total_weight > 0 else 0.0

    return winner, winner_weight, counts[winner], share


def _stable_snapshot(info):
    """Return the currently preserved stable plate, or None."""
    if not info.get('stable_text'):
        return None

    return {
        'text': info.get('stable_text', ''),
        'prefix': info.get('stable_prefix', ''),
        'digits': info.get('stable_digits', ''),
        'score': float(info.get('stable_score', 0.0)),
        'car_conf': info.get('stable_car_conf'),
        'plate_conf': info.get('stable_plate_conf'),
        'digit_votes': int(info.get('stable_digit_votes', 0)),
        'digit_share': float(info.get('stable_digit_share', 0.0)),
        'prefix_votes': int(info.get('stable_prefix_votes', 0)),
        'prefix_share': float(info.get('stable_prefix_share', 0.0)),
        'full_support_count': int(info.get('stable_full_support_count', 0)),
        'frame_idx': info.get('stable_frame_idx')
    }


def _save_stable_snapshot(info, candidate):
    """Save a reliable plate candidate as long-term historical memory."""
    info.update({
        'stable_text': candidate['text'],
        'stable_prefix': candidate['prefix'],
        'stable_digits': candidate['digits'],
        'stable_score': float(candidate['score']),
        'stable_car_conf': candidate.get('car_conf'),
        'stable_plate_conf': candidate.get('plate_conf'),
        'stable_digit_votes': int(candidate.get('digit_votes', 0)),
        'stable_digit_share': float(candidate.get('digit_share', 0.0)),
        'stable_prefix_votes': int(candidate.get('prefix_votes', 0)),
        'stable_prefix_share': float(candidate.get('prefix_share', 0.0)),
        'stable_full_support_count': int(candidate.get('full_support_count', 0)),
        'stable_frame_idx': candidate.get('frame_idx')
    })


def _should_replace_stable(stable, candidate):
    """
    A different plate may replace stable memory only when the challenger is
    clearly stronger. This avoids a distant/blurred OCR burst overwriting a
    plate that was already read correctly while the car was parked.
    """
    if stable is None:
        return True

    if _normalize_plate_text(stable['text']) == _normalize_plate_text(candidate['text']):
        return False

    enough_extra_votes = (
        candidate['full_support_count']
        >= stable['full_support_count'] + STABLE_REPLACE_EXTRA_VOTES
    )

    strong_share = (
        candidate['digit_share'] >= STABLE_REPLACE_MIN_SHARE
        and candidate['prefix_share'] >= STABLE_REPLACE_MIN_SHARE
    )

    score_not_much_worse = (
        candidate['score']
        >= stable['score'] - STABLE_REPLACE_SCORE_TOLERANCE
    )

    return enough_extra_votes and strong_share and score_not_much_worse


def recompute_car_memory(info):
    observations = info.get('observations', [])

    if not observations:
        return info

    # ----- Vote Digits -----
    best_digits, _, digit_votes, digit_share = _weighted_winner(
        observations,
        'digits'
    )

    if best_digits:
        digit_obs = [
            o for o in observations
            if o.get('digits') == best_digits
        ]
    else:
        digit_obs = observations

    # ----- Vote Prefix -----
    best_prefix, _, prefix_votes, prefix_share = _weighted_winner(
        digit_obs,
        'prefix'
    )

    # ----- Current candidate text -----
    if best_digits:
        current_text = f'{best_prefix} {best_digits}'.strip()
    else:
        best_raw = max(
            observations,
            key=lambda o: o.get('score', 0.0)
        )
        current_text = best_raw.get('text', '')

    supporting = [
        o for o in observations
        if (not best_digits or o.get('digits') == best_digits)
        and (not best_prefix or o.get('prefix') == best_prefix)
    ]

    if not supporting:
        supporting = digit_obs if digit_obs else observations

    best_observation = max(
        supporting,
        key=lambda o: o.get('score', 0.0)
    )

    # ----- Current digits stable -----
    current_digits_locked = (
        bool(best_digits)
        and digit_votes >= DIGITS_LOCK_MIN_VOTES
        and digit_share >= VOTE_MIN_SHARE
    )

    # ----- Current full plate votes -----
    full_support_count = sum(
        1
        for o in observations
        if o.get('digits') == best_digits
        and o.get('prefix') == best_prefix
        and bool(best_prefix)
        and bool(best_digits)
    )

    # ----- Current full lock -----
    current_is_locked = (
        current_digits_locked
        and bool(best_prefix)
        and full_support_count >= FULL_PLATE_LOCK_MIN_VOTES
        and prefix_share >= VOTE_MIN_SHARE
        and float(best_observation.get('score', 0.0)) >= LOCK_CONF_THRESHOLD
    )

    current_candidate = {
        'text': current_text,
        'prefix': best_prefix,
        'digits': best_digits,
        'score': float(best_observation.get('score', 0.0)),
        'car_conf': best_observation.get('car_conf'),
        'plate_conf': best_observation.get('plate_conf'),
        'digit_votes': digit_votes,
        'digit_share': digit_share,
        'prefix_votes': prefix_votes,
        'prefix_share': prefix_share,
        'full_support_count': full_support_count,
        'frame_idx': best_observation.get('frame_idx')
    }

    # Keep current/rolling OCR separately for debugging.
    info.update({
        'current_text': current_text,
        'current_prefix': best_prefix,
        'current_digits': best_digits,
        'current_score': float(best_observation.get('score', 0.0)),
        'current_car_conf': best_observation.get('car_conf'),
        'current_plate_conf': best_observation.get('plate_conf'),
        'current_digits_locked': current_digits_locked,
        'current_is_locked': current_is_locked,
        'current_digit_votes': digit_votes,
        'current_digit_share': digit_share,
        'current_prefix_votes': prefix_votes,
        'current_prefix_share': prefix_share,
        'current_full_support_count': full_support_count
    })

    # ----- Stable historical memory -----
    stable = _stable_snapshot(info)

    if current_is_locked:
        if stable is None:
            # First reliable green result -> remember it permanently.
            _save_stable_snapshot(info, current_candidate)

        elif _normalize_plate_text(stable['text']) == _normalize_plate_text(current_candidate['text']):
            # Same plate became even stronger. Refresh evidence, but never
            # lower the saved confidence.
            if current_candidate['full_support_count'] >= stable['full_support_count']:
                refreshed = dict(current_candidate)

                if stable['score'] > refreshed['score']:
                    refreshed['score'] = stable['score']
                    refreshed['car_conf'] = stable.get('car_conf')
                    refreshed['plate_conf'] = stable.get('plate_conf')

                _save_stable_snapshot(info, refreshed)

        elif _should_replace_stable(stable, current_candidate):
            # A clearly stronger later reading is allowed to correct an
            # earlier stable result.
            _save_stable_snapshot(info, current_candidate)

    stable = _stable_snapshot(info)

    # ----- Public/display result -----
    # If we ever had a reliable green result, keep showing that historical
    # plate even when the car becomes tiny/far and current OCR degrades.
    if stable is not None:
        info.update({
            'text': stable['text'],
            'prefix': stable['prefix'],
            'digits': stable['digits'],
            'score': stable['score'],
            'car_conf': stable.get('car_conf'),
            'plate_conf': stable.get('plate_conf'),
            'digits_locked': True,
            'is_locked': True,
            'digit_votes': stable['digit_votes'],
            'digit_share': stable['digit_share'],
            'prefix_votes': stable['prefix_votes'],
            'prefix_share': stable['prefix_share'],
            'full_support_count': stable['full_support_count'],
            'has_stable_memory': True
        })
    else:
        info.update({
            'text': current_text,
            'prefix': best_prefix,
            'digits': best_digits,
            'score': float(best_observation.get('score', 0.0)),
            'car_conf': best_observation.get('car_conf'),
            'plate_conf': best_observation.get('plate_conf'),
            'digits_locked': current_digits_locked,
            'is_locked': current_is_locked,
            'digit_votes': digit_votes,
            'digit_share': digit_share,
            'prefix_votes': prefix_votes,
            'prefix_share': prefix_share,
            'full_support_count': full_support_count,
            'has_stable_memory': False
        })

    return info


# ============================================================
# 10) Update Car Memory
# ============================================================

def update_car_memory(
    car_memory,
    track_id,
    text,
    avg_conf,
    char_count,
    car_conf=None,
    plate_conf=None,
    current_box=None,
    frame_idx=None
):
    if not text:
        if track_id in car_memory:
            if current_box is not None:
                car_memory[track_id]['last_box'] = tuple(current_box)

            if frame_idx is not None:
                car_memory[track_id]['last_seen_frame'] = int(frame_idx)

        return False

    prefix, digits = split_plate_text(text)

    observation = {
        'text': text,
        'prefix': prefix,
        'digits': digits,
        'score': float(avg_conf),
        'char_count': int(char_count),
        'car_conf': car_conf,
        'plate_conf': plate_conf,
        'frame_idx': frame_idx
    }

    if track_id not in car_memory:
        car_memory[track_id] = {
            'text': text,
            'prefix': prefix,
            'digits': digits,
            'score': float(avg_conf),
            'car_conf': car_conf,
            'plate_conf': plate_conf,
            'digits_locked': False,
            'is_locked': False,
            'canonical_id': resolve_car_id(track_id),
            'tracker_ids': list(
                vehicle_identity_registry.get(resolve_car_id(track_id), {}).get('tracker_ids', [track_id])
            ),
            'observations': [],
            'last_box': (
                tuple(current_box)
                if current_box is not None
                else None
            ),
            'last_seen_frame': (
                int(frame_idx)
                if frame_idx is not None
                else None
            )
        }

    info = car_memory[track_id]

    info.setdefault('observations', []).append(observation)

    info['observations'] = (
        info['observations'][-MAX_OBSERVATIONS_PER_CAR:]
    )

    if current_box is not None:
        info['last_box'] = tuple(current_box)

    if frame_idx is not None:
        info['last_seen_frame'] = int(frame_idx)

    recompute_car_memory(info)
    _register_canonical_track(
        resolve_car_id(track_id),
        raw_track_id=track_id,
        frame_idx=frame_idx,
        reason='PLATE_MEMORY_UPDATE'
    )

    return True


# ============================================================
# 11) Merge Track Memory
# ============================================================

def _stable_strength(info):
    if not info or not info.get('stable_text'):
        return (-1, -1.0, -1.0)

    return (
        int(info.get('stable_full_support_count', 0)),
        float(info.get('stable_prefix_share', 0.0)),
        float(info.get('stable_score', 0.0))
    )


def _copy_stable_fields(source, target):
    stable_keys = [
        'stable_text',
        'stable_prefix',
        'stable_digits',
        'stable_score',
        'stable_car_conf',
        'stable_plate_conf',
        'stable_digit_votes',
        'stable_digit_share',
        'stable_prefix_votes',
        'stable_prefix_share',
        'stable_full_support_count',
        'stable_frame_idx'
    ]

    for key in stable_keys:
        if key in source:
            target[key] = source[key]


def merge_track_memories(car_memory, source_id, target_id):
    source_id = resolve_car_id(source_id)
    target_id = resolve_car_id(target_id)

    if source_id == target_id:
        return target_id

    source = car_memory.get(source_id)
    target = car_memory.get(target_id)

    if source is None:
        car_id_alias[source_id] = target_id
        return target_id

    if target is None:
        car_memory[target_id] = source
        del car_memory[source_id]
        car_id_alias[source_id] = target_id
        return target_id

    # Preserve the stronger historical stable plate before combining rolling
    # observations. This prevents merge from accidentally deleting a green
    # result that was captured earlier.
    if _stable_strength(source) > _stable_strength(target):
        _copy_stable_fields(source, target)

    target.setdefault('observations', [])
    target['observations'].extend(source.get('observations', []))
    target['observations'] = target['observations'][-MAX_OBSERVATIONS_PER_CAR:]

    source_seen = source.get('last_seen_frame')
    target_seen = target.get('last_seen_frame')

    if (
        source_seen is not None
        and (target_seen is None or source_seen > target_seen)
    ):
        target['last_seen_frame'] = source_seen
        target['last_box'] = source.get('last_box')

    recompute_car_memory(target)

    del car_memory[source_id]
    car_id_alias[source_id] = target_id

    for alias_id, canonical_id in list(car_id_alias.items()):
        if canonical_id == source_id:
            car_id_alias[alias_id] = target_id

    # v6 canonical vehicle memory: merge tracker-ID history + motion history too.
    source_registry = vehicle_identity_registry.pop(source_id, None)
    target_registry = vehicle_identity_registry.setdefault(
        target_id,
        {
            'canonical_id': target_id,
            'tracker_ids': [],
            'last_reid_reason': None,
            'last_reid_frame': None
        }
    )

    if source_registry:
        for tid in source_registry.get('tracker_ids', []):
            if tid not in target_registry['tracker_ids']:
                target_registry['tracker_ids'].append(tid)

    _merge_vehicle_motion_memory(source_id, target_id)
    _register_canonical_track(target_id)

    return target_id


# ============================================================
# 12) License Plate Detection
# ============================================================

def detect_best_plate_in_car(
    car_crop,
    plate_model,
    conf_threshold=PLATE_CONF_THRESHOLD,
    imgsz=DETECTOR_IMGSZ
):
    if car_crop is None or car_crop.size == 0:
        return None, 0.0

    plate_results = plate_model(
    car_crop,
    conf=conf_threshold,
    imgsz=imgsz,
    verbose=False,
    quantize=YOLO_QUANTIZE
    )

    best_box = None
    best_conf = -1.0

    for plate_res in plate_results:
        if plate_res.boxes is None:
            continue

        for box in plate_res.boxes:
            conf = float(box.conf[0])

            if conf > best_conf:
                best_conf = conf

                rx1, ry1, rx2, ry2 = map(
                    int,
                    box.xyxy[0]
                )

                best_box = (rx1, ry1, rx2, ry2)

    if best_box is None:
        return None, 0.0

    return best_box, best_conf


def detect_best_plates_batch(
    car_crops,
    plate_model,
    conf_threshold=PLATE_CONF_THRESHOLD,
    imgsz=DETECTOR_IMGSZ,
    batch_size=PLATE_BATCH_SIZE
):
    """
    Batched equivalent of detect_best_plate_in_car().

    Same plate model, confidence threshold, imgsz, and best-confidence
    box selection. Only execution is grouped to reduce GPU launch overhead.
    """
    if not car_crops:
        return []

    outputs = [(None, 0.0)] * len(car_crops)
    batch_size = max(1, int(batch_size))

    for start in range(0, len(car_crops), batch_size):
        chunk = car_crops[start:start + batch_size]

        valid_indices = []
        valid_crops = []

        for local_idx, crop in enumerate(chunk):
            if crop is not None and getattr(crop, 'size', 0) > 0:
                valid_indices.append(start + local_idx)
                valid_crops.append(crop)

        if not valid_crops:
            continue

        plate_results = plate_model(
            valid_crops,
            conf=conf_threshold,
            imgsz=imgsz,
            verbose=False,
            quantize=YOLO_QUANTIZE
        )

        for global_idx, plate_res in zip(valid_indices, plate_results):
            if plate_res.boxes is None or len(plate_res.boxes) == 0:
                continue

            confs = plate_res.boxes.conf
            best_i = int(torch.argmax(confs).item())
            best_conf = float(confs[best_i].item())

            xyxy = plate_res.boxes.xyxy[best_i]
            rx1, ry1, rx2, ry2 = map(
                int,
                xyxy.detach().cpu().tolist()
            )

            outputs[global_idx] = (
                (rx1, ry1, rx2, ry2),
                best_conf
            )

    return outputs


# ============================================================
# 13) EasyOCR Pipeline per Track
# ============================================================

def process_plate_for_track(
    track_id,
    plate_zoom,
    reader,
    car_memory,
    car_conf=None,
    plate_conf=None,
    current_box=None,
    frame_idx=None,
    active_canonical_claims=None
):
    raw_track_id = int(track_id)
    track_id = resolve_car_id(track_id)

    # ----- Sharpness -----
    if not is_image_sharp(
        plate_zoom,
        threshold=SHARPNESS_THRESHOLD
    ):
        if track_id in car_memory:
            if current_box is not None:
                car_memory[track_id]['last_box'] = tuple(current_box)

            if frame_idx is not None:
                car_memory[track_id]['last_seen_frame'] = int(frame_idx)

        return track_id, car_memory.get(track_id)

    # ----- EasyOCR Only -----
    text, avg_conf = read_plate_with_easyocr(
        reader,
        plate_zoom
    )

    char_count = (
        len(_normalize_plate_text(text))
        if text
        else 0
    )

    # ----- Find duplicate track -----
    if text:
        matching_id = find_matching_car_id(
            car_memory,
            text=text,
            current_box=current_box,
            current_frame=(
                frame_idx if frame_idx is not None else 0
            ),
            exclude_id=track_id,
            active_canonical_claims=active_canonical_claims,
            current_raw_track_id=raw_track_id
        )

        if (
            matching_id is not None
            and matching_id != track_id
        ):
            if track_id in car_memory:
                track_id = merge_track_memories(
                    car_memory,
                    track_id,
                    matching_id
                )
            else:
                track_id = bind_tracker_to_canonical(
                    track_id,
                    matching_id,
                    frame_idx=frame_idx,
                    reason='PLATE_REID'
                )

            # v6.1: transfer this frame's claim from the fresh canonical ID to
            # the recovered historical ID. Matching_id was guaranteed free.
            if active_canonical_claims is not None:
                for claimed_id, claimed_raw in list(active_canonical_claims.items()):
                    if int(claimed_raw) == raw_track_id and claimed_id != track_id:
                        active_canonical_claims.pop(claimed_id, None)
                active_canonical_claims[track_id] = raw_track_id

    # ----- Update voting -----
    update_car_memory(
        car_memory,
        track_id,
        text,
        avg_conf,
        char_count,
        car_conf=car_conf,
        plate_conf=plate_conf,
        current_box=current_box,
        frame_idx=frame_idx
    )

    return track_id, car_memory.get(track_id)


# ============================================================
# 14) Performance helper
# ============================================================

def should_run_stage2(track_id, frame_idx):
    info = car_memory.get(resolve_car_id(track_id))

    # ยังไม่มีผล -> OCR เต็มกำลัง
    if info is None:
        return True

    # ยังไม่มี Stable Memory -> OCR เต็มกำลัง
    if not info.get('has_stable_memory', False):
        return True

    # Stable แล้ว แต่ evidence ยังไม่แข็งแรงพอ
    # -> ยัง OCR เต็มกำลังต่อ
    strong_stable = (
        info.get('stable_full_support_count', 0)
        >= MIN_STABLE_FULL_VOTES_FOR_THROTTLE

        and info.get('stable_prefix_share', 0.0)
        >= MIN_STABLE_PREFIX_SHARE_FOR_THROTTLE

        and info.get('stable_digit_share', 0.0)
        >= MIN_STABLE_DIGIT_SHARE_FOR_THROTTLE
    )

    if not strong_stable:
        return True

    # Stable + evidence แข็งแรงจริง
    # ค่อยลดความถี่ Plate Detection + OCR
    return frame_idx % STABLE_STAGE2_EVERY_N_FRAMES == 0



# ============================================================
# 15) Parking-slot integration
# parking_slots was loaded at the top of THIS Cell 10.
# Cell 9 is no longer required.
# ============================================================

if PARKING_ENABLED and not parking_slots:
    raise RuntimeError(
        'parking_slots could not be loaded from PARKING_JSON_PATH.'
    )


# ============================================================
# Parking status thresholds
# ============================================================

# A car starts affecting an AVAILABLE slot when its anchor/center enters
# the polygon or enough of the reduced car box overlaps the slot.
PARKING_ENTRY_SCORE_THRESHOLD = 0.12

# A car can become PARKING only when it is sufficiently deep in the slot
# and remains nearly stationary for several detection updates.
PARKING_DEEP_SCORE_THRESHOLD = 0.30
PARKING_STABLE_DETECTIONS = 5
PARKING_STATIONARY_CENTER_THRESHOLD = 0.035

# Once a slot reaches PARKING, keep ownership locked to the same car.
# A different car is NOT allowed to steal that slot simply because its
# bounding box overlaps more strongly while driving past.
PARKING_OWNER_LOCK = True

# How weak the current owner's overlap may become while still being treated
# as the same parked owner. This is intentionally lower than the entry score.
PARKING_OWNER_HOLD_SCORE_THRESHOLD = 0.06

# Number of detection updates the PARKING owner can disappear / move outside
# before the slot is finally released to AVAILABLE.
PARKING_EMPTY_RELEASE_DETECTIONS = 8

# OCCUPIED is only mildly sticky. If the entering car disappears briefly,
# keep OCCUPIED for a short grace period before releasing the slot.
OCCUPIED_EMPTY_RELEASE_DETECTIONS = 4

# Parking anchor = lower-middle point of the reduced YOLO car box.
# This helps prevent a large box from claiming a neighbouring slot when only
# the upper/side portion of the car overlaps that slot.
PARKING_ANCHOR_Y_RATIO = 0.82

# ============================================================
# Occlusion / ID-reset protection
# ============================================================

# IMPORTANT:
# False AVAILABLE is worse than a temporary stale PARKING state for cameras
# where pillars/cars can hide a parked vehicle. Therefore PARKING does NOT
# auto-release merely because YOLO temporarily stops detecting the owner.
# It releases only after the SAME owner is actually seen outside the slot for
# several detection updates.
PARKING_MISSING_AUTO_RELEASE = False
PARKING_MISSING_RELEASE_DETECTIONS = 150
PARKING_EXIT_CONFIRM_DETECTIONS = 5

# If YOLO creates a NEW track ID for a car that is still inside a locked
# PARKING slot, map that new ID back to the old owner ID without requiring OCR.
# The test is intentionally strict to avoid stealing an adjacent car.
PARKING_TRACK_REID = True
PARKING_REID_MIN_OVERLAP = 0.30
PARKING_REID_MAX_CENTER_DISTANCE = 0.85
PARKING_REID_MIN_MARGIN = 0.15

# If a car was clearly entering a slot and then disappears behind a pillar
# BEFORE it becomes stationary enough to reach PARKING, keep the reservation
# and promote it to PARKING after a short occlusion instead of returning AVAILABLE.
OCCUPIED_OCCLUSION_PROMOTE = True
OCCUPIED_OCCLUSION_PROMOTE_MISSING = 2
OCCUPIED_OCCLUSION_MIN_INSIDE_HITS = 2
OCCUPIED_OCCLUSION_MIN_DEEP_HITS = 1
OCCUPIED_OCCLUSION_MIN_MAX_OVERLAP = 0.22

PARKING_STATUS_COLORS = {
    'available': (0, 200, 0),
    'occupied': (0, 165, 255),
    'parking': (0, 0, 255),
    'disable': (128, 128, 128)
}


# ============================================================
# Parking geometry helpers
# ============================================================

def _box_center(box):
    x1, y1, x2, y2 = box
    return (
        (float(x1) + float(x2)) / 2.0,
        (float(y1) + float(y2)) / 2.0
    )


def _parking_anchor(box, y_ratio=PARKING_ANCHOR_Y_RATIO):
    """
    Lower-middle anchor point of a car box.

    y_ratio=0.82 means the point is 82% of the way from the top edge
    toward the bottom edge of the reduced car box.
    """
    x1, y1, x2, y2 = map(float, box)

    cx = (x1 + x2) / 2.0
    cy = y1 + (y2 - y1) * float(y_ratio)

    return cx, cy


def _point_inside_slot(point, slot):
    px, py = point
    polygon_f32 = slot.get('_polygon_f32')

    if polygon_f32 is not None:
        return cv2.pointPolygonTest(
            polygon_f32,
            (float(px), float(py)),
            False
        ) >= 0

    x1, y1, x2, y2 = slot['bbox']
    return x1 <= px <= x2 and y1 <= py <= y2


def _polygon_rect_intersection_area(slot, car_box):
    """
    Intersection area using cached static slot geometry.
    """
    polygon = slot.get('_polygon_f32')

    if polygon is None:
        return float(
            _intersection_area(
                slot['bbox'],
                car_box
            )
        )

    x1, y1, x2, y2 = map(float, car_box)
    car_poly = np.array(
        [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2]
        ],
        dtype=np.float32
    ).reshape(-1, 1, 2)

    if slot.get('_polygon_is_convex', False):
        inter_area, _ = cv2.intersectConvexConvex(
            polygon,
            car_poly
        )
        return max(0.0, float(inter_area))

    poly_points = polygon.reshape(-1, 2)

    roi_x1 = int(np.floor(min(np.min(poly_points[:, 0]), x1)))
    roi_y1 = int(np.floor(min(np.min(poly_points[:, 1]), y1)))
    roi_x2 = int(np.ceil(max(np.max(poly_points[:, 0]), x2)))
    roi_y2 = int(np.ceil(max(np.max(poly_points[:, 1]), y2)))

    roi_w = max(1, roi_x2 - roi_x1 + 1)
    roi_h = max(1, roi_y2 - roi_y1 + 1)

    slot_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)
    car_mask = np.zeros((roi_h, roi_w), dtype=np.uint8)

    shifted_poly = np.round(
        poly_points - np.array([roi_x1, roi_y1], dtype=np.float32)
    ).astype(np.int32)

    cv2.fillPoly(
        slot_mask,
        [shifted_poly],
        1
    )

    rx1 = int(round(x1 - roi_x1))
    ry1 = int(round(y1 - roi_y1))
    rx2 = int(round(x2 - roi_x1))
    ry2 = int(round(y2 - roi_y1))

    cv2.rectangle(
        car_mask,
        (rx1, ry1),
        (rx2, ry2),
        1,
        -1
    )

    intersection_mask = cv2.bitwise_and(
        slot_mask,
        car_mask
    )

    return float(cv2.countNonZero(intersection_mask))



def _slot_car_metrics(slot, car_box):
    """
    Compare one reduced car box against the exact parking-slot geometry.

    Returns:
      overlap_score : intersection / min(slot area, car area)
      slot_coverage : intersection / slot area
      car_coverage  : intersection / car area
      center_inside : car-box center inside the slot polygon/bbox
      anchor_inside : lower-middle parking anchor inside the slot polygon/bbox
      center        : car-box center
      anchor        : parking anchor
    """
    polygon_f32 = slot.get('_polygon_f32')
    car_area = max(float(_box_area(car_box)), 1.0)

    if polygon_f32 is not None:
        slot_area = float(slot.get('_slot_area', 1.0))
        inter = _polygon_rect_intersection_area(
            slot,
            car_box
        )

    else:
        slot_box = slot['bbox']
        slot_area = float(
            slot.get(
                '_slot_area',
                max(float(_box_area(slot_box)), 1.0)
            )
        )
        inter = float(
            _intersection_area(slot_box, car_box)
        )

    center = _box_center(car_box)
    anchor = _parking_anchor(car_box)

    overlap_score = inter / min(slot_area, car_area)
    slot_coverage = inter / slot_area
    car_coverage = inter / car_area

    center_inside = _point_inside_slot(
        center,
        slot
    )

    anchor_inside = _point_inside_slot(
        anchor,
        slot
    )

    return {
        'overlap_score': float(overlap_score),
        'slot_coverage': float(slot_coverage),
        'car_coverage': float(car_coverage),
        'center_inside': bool(center_inside),
        'anchor_inside': bool(anchor_inside),
        'center': center,
        'anchor': anchor
    }


def _make_slot_candidate(slot, car_id, car_box):
    metrics = _slot_car_metrics(
        slot,
        car_box
    )

    # Anchor-inside gets the strongest preference because it is less affected
    # by a large perspective-distorted bounding box touching a neighbour slot.
    rank_score = metrics['overlap_score']

    if metrics['center_inside']:
        rank_score += 0.35

    if metrics['anchor_inside']:
        rank_score += 0.75

    return {
        'slot_name': slot['name'],
        'car_id': resolve_car_id(car_id),
        'car_box': tuple(car_box),
        'overlap_score': metrics['overlap_score'],
        'slot_coverage': metrics['slot_coverage'],
        'car_coverage': metrics['car_coverage'],
        'center_inside': metrics['center_inside'],
        'anchor_inside': metrics['anchor_inside'],
        'center': metrics['center'],
        'anchor': metrics['anchor'],
        'rank_score': float(rank_score)
    }


def _candidate_can_enter(candidate):
    return (
        candidate['anchor_inside']
        or candidate['center_inside']
        or candidate['overlap_score'] >= PARKING_ENTRY_SCORE_THRESHOLD
    )


def _candidate_can_hold_parking_owner(candidate):
    """
    More tolerant condition for the current PARKING owner.
    This prevents small YOLO jitter from unlocking the slot.
    """
    return (
        candidate['anchor_inside']
        or candidate['center_inside']
        or candidate['overlap_score'] >= PARKING_OWNER_HOLD_SCORE_THRESHOLD
    )


# ============================================================
# Parking runtime state
# ============================================================

parking_state = {}

for slot in parking_slots:
    parking_state[slot['name']] = {
        'status': 'disable' if slot.get('disabled') else 'available',
        'car_id': None,
        'overlap_score': 0.0,
        'slot_coverage': 0.0,
        'car_coverage': 0.0,
        'center_inside': False,
        'anchor_inside': False,
        'stationary_hits': 0,
        'inside_hits': 0,
        'deep_hits': 0,
        'max_overlap_score': 0.0,
        'empty_hits': 0,
        'missing_hits': 0,
        'occupied_missing_hits': 0,
        'exit_hits': 0,
        'inferred_parking': False,
        'owner_last_seen_frame': None,
        'owner_plate_text': '',
        'last_center': None,
        'last_anchor': None,
        'last_car_box': None,
        'last_update_frame': None
    }

    slot['status'] = parking_state[slot['name']]['status']


def _resolve_latest_car_boxes(car_boxes):
    resolved = {}

    for tid, box in car_boxes.items():
        canonical = resolve_car_id(tid)

        # If aliases produce duplicate canonical IDs, keep the larger box.
        if canonical not in resolved:
            resolved[canonical] = tuple(box)
        else:
            old_box = resolved[canonical]

            if _box_area(box) > _box_area(old_box):
                resolved[canonical] = tuple(box)

    return resolved


def _resolve_state_owner(state):
    owner_id = state.get('car_id')

    if owner_id is None:
        return None

    owner_id = resolve_car_id(owner_id)
    state['car_id'] = owner_id

    return owner_id


# ============================================================
# Identity-memory eligibility for tracker re-ID
# ============================================================

def _has_reid_identity_memory(info):
    if not info:
        return False

    if info.get('has_stable_memory', False) or info.get('stable_text'):
        return True

    text = info.get('text') or info.get('current_text') or ''
    norm = _normalize_plate_text(text)

    score = float(
        info.get('score')
        or info.get('current_score')
        or 0.0
    )

    return (
        len(norm) >= RECENT_REID_MEMORY_MIN_PLATE_LENGTH
        and (
            info.get('digits_locked', False)
            or score >= RECENT_REID_MEMORY_MIN_SCORE
        )
    )


# ============================================================
# Short/medium-gap geometry re-ID
# ============================================================

def recover_recent_track_ids_by_geometry(detections, frame_idx):
    """
    Recover a NEW YOLO track ID when the same physical car disappears only
    briefly and its plate is unreadable on the reappearance frame.

    Safety rules:
      - old identity must have useful historical plate memory
      - frame gap must be bounded
      - geometry must be strong
      - ambiguous matches are rejected
    """
    if not RECENT_GEOMETRY_REID or not detections:
        return {}

    visible_ids = {resolve_car_id(det[0]) for det in detections}
    recovered = {}
    used_old_ids = set()

    for det in detections:
        raw_id = int(det[0])
        source_id = resolve_car_id(raw_id)

        # Already aliased by parking-slot recovery or another earlier rule.
        if source_id != raw_id:
            continue

        current_box = tuple(det[1:5])
        candidates = []

        for old_id, info in list(car_memory.items()):
            old_id = resolve_car_id(old_id)

            if old_id == source_id or old_id in used_old_ids:
                continue
            if old_id in visible_ids:
                continue
            if old_id not in car_memory:
                continue

            info = car_memory[old_id]
            if not _has_reid_identity_memory(info):
                continue

            last_box = info.get('last_box')
            last_seen = info.get('last_seen_frame')
            if last_box is None or last_seen is None:
                continue

            gap = int(frame_idx) - int(last_seen)
            if gap <= 0 or gap > RECENT_GEOMETRY_REID_MAX_GAP:
                continue

            iou = _box_iou(last_box, current_box)
            ios = _box_ios(last_box, current_box)
            center_dist = _normalized_center_distance(last_box, current_box)

            spatial_ok = (
                iou >= RECENT_GEOMETRY_REID_MIN_IOU
                or ios >= 0.35
                or center_dist <= RECENT_GEOMETRY_REID_MAX_CENTER_DISTANCE
            )
            if not spatial_ok:
                continue

            # Higher is better. Penalize longer gaps.
            score = (
                iou * 2.0
                + ios * 0.75
                + max(0.0, 1.0 - center_dist)
                - (gap / max(RECENT_GEOMETRY_REID_MAX_GAP, 1)) * 0.25
            )
            candidates.append((score, old_id))

        candidates.sort(reverse=True)
        if not candidates:
            continue

        if len(candidates) > 1:
            margin = candidates[0][0] - candidates[1][0]
            if margin < RECENT_GEOMETRY_REID_MIN_SCORE_MARGIN:
                continue

        _, old_id = candidates[0]

        old_id = bind_tracker_to_canonical(
            raw_id,
            old_id,
            frame_idx=frame_idx,
            reason='GEOMETRY_REID'
        )
        recovered[raw_id] = old_id
        used_old_ids.add(old_id)
        visible_ids.add(old_id)

    return recovered


# ============================================================
# v6 Turning / orientation-change re-ID
# ============================================================

def recover_turning_track_ids(detections, frame_idx):
    """
    Reconnect a fresh tracker ID to a canonical vehicle when the car rotates
    from front/rear view to a strong side view and IoU/plate visibility drops.

    Important safety gates:
      - old vehicle must already have useful plate identity memory
      - old ID must not currently be visible
      - short bounded frame gap
      - current center must agree with last/predicted motion
      - vehicle area may change strongly, but not arbitrarily
      - ambiguous best-vs-second-best matches are rejected
    """
    if not TURN_REID or not detections:
        return {}

    visible_ids = {resolve_car_id(int(det[0])) for det in detections}
    recovered = {}
    used_old_ids = set()

    for det in detections:
        raw_id = int(det[0])
        source_id = resolve_car_id(raw_id)

        # Already recovered by another rule.
        if source_id != raw_id:
            continue

        current_box = tuple(map(float, det[1:5]))
        current_center = (
            (current_box[0] + current_box[2]) / 2.0,
            (current_box[1] + current_box[3]) / 2.0
        )
        current_area = max(_box_area(current_box), 1.0)

        candidates = []

        for old_id, info in list(car_memory.items()):
            old_id = resolve_car_id(old_id)

            if old_id == source_id or old_id in used_old_ids:
                continue
            if old_id in visible_ids:
                continue
            if old_id not in car_memory:
                continue

            info = car_memory[old_id]
            if not _has_reid_identity_memory(info):
                continue

            history = vehicle_motion_memory.get(old_id, {}).get('history', [])
            if history:
                last_sample = history[-1]
                last_box = tuple(last_sample['box'])
                last_seen = int(last_sample['frame'])
                last_center = tuple(last_sample['center'])
            else:
                last_box = info.get('last_box')
                last_seen = info.get('last_seen_frame')
                if last_box is None or last_seen is None:
                    continue
                last_box = tuple(map(float, last_box))
                last_center = (
                    (last_box[0] + last_box[2]) / 2.0,
                    (last_box[1] + last_box[3]) / 2.0
                )

            gap = int(frame_idx) - int(last_seen)
            if gap <= 0 or gap > TURN_REID_MAX_FRAME_GAP:
                continue

            last_area = max(_box_area(last_box), 1.0)
            area_ratio = max(current_area / last_area, last_area / current_area)
            if area_ratio > TURN_REID_MAX_AREA_RATIO:
                continue

            predicted_center = _predict_vehicle_center(old_id, frame_idx)
            if predicted_center is None:
                predicted_center = last_center

            pred_dist = _point_distance_normalized(
                predicted_center,
                current_center,
                last_box,
                current_box
            )
            last_dist = _point_distance_normalized(
                last_center,
                current_center,
                last_box,
                current_box
            )

            # Rotation can destroy IoU, so center/motion is the hard gate.
            if (
                pred_dist > TURN_REID_MAX_PRED_CENTER_DISTANCE
                and last_dist > TURN_REID_MAX_LAST_CENTER_DISTANCE
            ):
                continue

            iou = _box_iou(last_box, current_box)
            ios = _box_ios(last_box, current_box)

            memory_bonus = 0.35 if info.get('has_stable_memory', False) else 0.15
            gap_penalty = (gap / max(TURN_REID_MAX_FRAME_GAP, 1)) * 0.30
            area_penalty = min(max(area_ratio - 1.0, 0.0) / 3.0, 1.0) * 0.20

            score = (
                max(0.0, 1.0 - pred_dist / TURN_REID_MAX_PRED_CENTER_DISTANCE) * 1.25
                + max(0.0, 1.0 - last_dist / TURN_REID_MAX_LAST_CENTER_DISTANCE) * 0.75
                + min(ios, 1.0) * 0.25
                + min(iou, 1.0) * 0.15
                + memory_bonus
                - gap_penalty
                - area_penalty
            )

            candidates.append((score, old_id, pred_dist, last_dist, gap))

        candidates.sort(key=lambda x: x[0], reverse=True)
        if not candidates:
            continue

        best = candidates[0]
        if best[0] < TURN_REID_MIN_ACCEPT_SCORE:
            continue

        if len(candidates) > 1:
            margin = best[0] - candidates[1][0]
            if margin < TURN_REID_MIN_SCORE_MARGIN:
                continue

        _, old_id, _, _, _ = best
        canonical_id = bind_tracker_to_canonical(
            raw_id,
            old_id,
            frame_idx=frame_idx,
            reason='TURN_REID'
        )

        recovered[raw_id] = canonical_id
        used_old_ids.add(canonical_id)
        visible_ids.add(canonical_id)

    return recovered


# ============================================================
# Parking owner identity helpers / tracker-ID recovery
# ============================================================

def _refresh_slot_owner_identity(state, car_id, frame_idx=None):
    car_id = resolve_car_id(car_id)
    state['car_id'] = car_id

    if frame_idx is not None:
        state['owner_last_seen_frame'] = int(frame_idx)

    info = car_memory.get(car_id)
    if info:
        plate_text = info.get('stable_text') or info.get('text', '')
        if plate_text:
            state['owner_plate_text'] = plate_text


def _strong_reid_candidate_for_slot(slot, car_id, car_box):
    """Strict geometry gate for mapping a NEW tracker ID to a parked owner."""
    candidate = _make_slot_candidate(slot, car_id, car_box)

    if not (
        candidate['center_inside']
        and candidate['anchor_inside']
        and candidate['overlap_score'] >= PARKING_REID_MIN_OVERLAP
    ):
        return None

    return candidate


def recover_parking_track_ids(detections, frame_shape, frame_idx):
    """
    Recover YOLO tracker ID resets for RESERVED slots: OCCUPIED or PARKING.

    This is important when the tracker changes ID while the car is entering,
    becomes hidden by a pillar, or reappears blurred. A strong and unique
    detection inside the SAME reserved slot is mapped back to the old owner ID
    before plate OCR runs, so the old plate memory is preserved.
    """
    if not PARKING_TRACK_REID or not detections:
        return {}

    recovered = {}
    currently_visible = {
        resolve_car_id(det[0])
        for det in detections
    }
    claimed_sources = set()

    for slot in parking_slots:
        if slot.get('disabled'):
            continue

        name = slot['name']
        state = parking_state[name]

        if state.get('status') not in ('occupied', 'parking'):
            continue

        owner_id = _resolve_state_owner(state)
        if owner_id is None or owner_id in currently_visible:
            continue

        last_box = state.get('last_car_box')
        slot_candidates = []

        for det in detections:
            raw_id = int(det[0])
            source_id = resolve_car_id(raw_id)

            if source_id == owner_id or source_id in claimed_sources:
                continue

            raw_box = tuple(det[1:5])
            reduced_box = shrink_car_box(
                raw_box,
                frame_shape,
                CAR_BOX_SHRINK_RATIO
            )

            candidate = _strong_reid_candidate_for_slot(
                slot,
                source_id,
                reduced_box
            )
            if candidate is None:
                continue

            # New box should still be reasonably close to the last parked box.
            if last_box is not None:
                spatial_ok = (
                    _box_iou(last_box, reduced_box) >= 0.03
                    or _box_ios(last_box, reduced_box) >= 0.20
                    or _normalized_center_distance(last_box, reduced_box)
                    <= PARKING_REID_MAX_CENTER_DISTANCE
                )
                if not spatial_ok:
                    continue

            # The locked slot must be this detection's best geometric slot.
            other_scores = []
            for other_slot in parking_slots:
                if other_slot.get('disabled'):
                    continue

                other_candidate = _make_slot_candidate(
                    other_slot,
                    source_id,
                    reduced_box
                )
                other_scores.append(
                    (other_candidate['rank_score'], other_slot['name'])
                )

            other_scores.sort(reverse=True)
            if not other_scores or other_scores[0][1] != name:
                continue

            margin = (
                other_scores[0][0] - other_scores[1][0]
                if len(other_scores) > 1
                else other_scores[0][0]
            )
            if margin < PARKING_REID_MIN_MARGIN:
                continue

            slot_candidates.append(
                (candidate['rank_score'], raw_id, source_id)
            )

        # Avoid guessing when more than one new car could plausibly be the owner.
        slot_candidates.sort(reverse=True)
        if not slot_candidates:
            continue

        if len(slot_candidates) > 1:
            top_margin = slot_candidates[0][0] - slot_candidates[1][0]
            if top_margin < PARKING_REID_MIN_MARGIN:
                continue

        _, raw_id, source_id = slot_candidates[0]

        if source_id != owner_id:
            owner_id = bind_tracker_to_canonical(
                raw_id,
                owner_id,
                frame_idx=frame_idx,
                reason='PARKING_REID'
            )
        else:
            _register_canonical_track(
                owner_id,
                raw_track_id=raw_id,
                frame_idx=frame_idx,
                reason='PARKING_OWNER'
            )

        recovered[raw_id] = owner_id
        claimed_sources.add(source_id)
        currently_visible.add(owner_id)

        state['car_id'] = owner_id
        state['owner_last_seen_frame'] = int(frame_idx)

    return recovered


# ============================================================
# Conflict-safe one-car-to-one-slot matching
# ============================================================

def match_cars_to_slots(car_boxes):
    """
    STRICT reservation matching.

    - available : may accept a new car
    - occupied  : reserved to its current owner
    - parking   : reserved to its current owner
    - disable   : ignored

    A different car NEVER challenges an occupied/parking slot. It falls
    through to the next AVAILABLE slot instead.

    Returns:
        assignments : {slot_name: candidate}
        lock_reasons: {slot_name: owner_present/owner_missing/owner_outside/no_owner}
    """
    car_boxes = _resolve_latest_car_boxes(car_boxes)

    assignments = {}
    used_slots = set()
    used_cars = set()
    lock_reasons = {}

    # --------------------------------------------------------
    # PASS 1: reserve every OCCUPIED / PARKING slot first.
    # --------------------------------------------------------
    for slot in parking_slots:
        if slot.get('disabled'):
            continue

        name = slot['name']
        state = parking_state[name]
        status = state.get('status', 'available')

        if status not in ('occupied', 'parking'):
            continue

        used_slots.add(name)
        owner_id = _resolve_state_owner(state)

        if owner_id is None:
            lock_reasons[name] = 'no_owner'
            continue

        # Reserve the owner as well so it cannot be assigned to a second slot.
        used_cars.add(owner_id)
        owner_box = car_boxes.get(owner_id)

        if owner_box is None:
            lock_reasons[name] = 'owner_missing'
            continue

        owner_candidate = _make_slot_candidate(
            slot,
            owner_id,
            owner_box
        )

        if status == 'parking':
            owner_valid = _candidate_can_hold_parking_owner(owner_candidate)
        else:
            owner_valid = _candidate_can_enter(owner_candidate)

        if owner_valid:
            assignments[name] = owner_candidate
            lock_reasons[name] = 'owner_present'
        else:
            lock_reasons[name] = 'owner_outside'

    # --------------------------------------------------------
    # PASS 2: remaining cars may see AVAILABLE slots only.
    # --------------------------------------------------------
    candidates = []

    for slot in parking_slots:
        if slot.get('disabled'):
            continue

        name = slot['name']
        state = parking_state[name]

        if name in used_slots:
            continue

        if state.get('status', 'available') != 'available':
            continue

        for car_id, car_box in car_boxes.items():
            car_id = resolve_car_id(car_id)

            if car_id in used_cars:
                continue

            candidate = _make_slot_candidate(
                slot,
                car_id,
                car_box
            )

            if not _candidate_can_enter(candidate):
                continue

            candidates.append(candidate)

    candidates.sort(
        key=lambda x: (
            x['rank_score'],
            x['anchor_inside'],
            x['center_inside'],
            x['overlap_score']
        ),
        reverse=True
    )

    # --------------------------------------------------------
    # PASS 3: one car -> one slot, one slot -> one car.
    # --------------------------------------------------------
    for candidate in candidates:
        slot_name = candidate['slot_name']
        car_id = resolve_car_id(candidate['car_id'])

        if slot_name in used_slots or car_id in used_cars:
            continue

        assignments[slot_name] = candidate
        used_slots.add(slot_name)
        used_cars.add(car_id)

    return assignments, lock_reasons


# ============================================================
# Parking state machine
# ============================================================

def _clear_slot_to_available(state, frame_idx):
    state.update({
        'status': 'available',
        'car_id': None,
        'overlap_score': 0.0,
        'slot_coverage': 0.0,
        'car_coverage': 0.0,
        'center_inside': False,
        'anchor_inside': False,
        'stationary_hits': 0,
        'inside_hits': 0,
        'deep_hits': 0,
        'max_overlap_score': 0.0,
        'empty_hits': 0,
        'missing_hits': 0,
        'occupied_missing_hits': 0,
        'exit_hits': 0,
        'inferred_parking': False,
        'owner_last_seen_frame': None,
        'owner_plate_text': '',
        'last_center': None,
        'last_anchor': None,
        'last_car_box': None,
        'last_update_frame': frame_idx
    })


def update_parking_states(car_boxes, frame_idx):
    assignments, lock_reasons = match_cars_to_slots(car_boxes)

    for slot in parking_slots:
        name = slot['name']
        state = parking_state[name]

        # ----------------------------------------------------
        # DISABLE
        # ----------------------------------------------------
        if slot.get('disabled'):
            state.update({
                'status': 'disable',
                'car_id': None,
                'overlap_score': 0.0,
                'slot_coverage': 0.0,
                'car_coverage': 0.0,
                'center_inside': False,
                'anchor_inside': False,
                'stationary_hits': 0,
                'empty_hits': 0,
                'missing_hits': 0,
                'exit_hits': 0,
                'owner_last_seen_frame': None,
                'owner_plate_text': '',
                'last_center': None,
                'last_anchor': None,
                'last_car_box': None,
                'last_update_frame': frame_idx
            })
            slot['status'] = 'disable'
            continue

        previous_status = state.get('status', 'available')
        previous_owner = _resolve_state_owner(state)
        assigned = assignments.get(name)
        lock_reason = lock_reasons.get(name)

        # ----------------------------------------------------
        # No valid owner assignment this update
        # ----------------------------------------------------
        if assigned is None:
            state['last_update_frame'] = frame_idx

            # =================================================
            # PARKING = sticky / occlusion-safe.
            # =================================================
            if previous_status == 'parking':
                state['status'] = 'parking'

                if lock_reason == 'owner_outside':
                    # We actually SEE the same owner outside its slot.
                    # This is positive evidence that the car is leaving.
                    state['exit_hits'] += 1
                    state['missing_hits'] = 0

                    if state['exit_hits'] >= PARKING_EXIT_CONFIRM_DETECTIONS:
                        _clear_slot_to_available(state, frame_idx)
                else:
                    # owner_missing / no_owner = no visual evidence that the
                    # parking space became empty. Keep PARKING to survive pillar
                    # occlusion, temporary detector misses and another adjacent car.
                    state['missing_hits'] += 1
                    state['exit_hits'] = 0

                    if (
                        PARKING_MISSING_AUTO_RELEASE
                        and state['missing_hits']
                        >= PARKING_MISSING_RELEASE_DETECTIONS
                    ):
                        _clear_slot_to_available(state, frame_idx)

                slot['status'] = state['status']
                continue

            # =================================================
            # OCCUPIED = reserved while entering.
            #
            # Important occlusion case:
            # if the car was clearly INSIDE/DEEP in this slot and then vanishes
            # behind a pillar before stationary_hits reaches PARKING, promote
            # the reservation to PARKING instead of falsely returning AVAILABLE.
            # =================================================
            if previous_status == 'occupied':
                state['empty_hits'] += 1

                if lock_reason in ('owner_missing', 'no_owner'):
                    state['occupied_missing_hits'] += 1
                else:
                    # owner_outside = positive evidence that it moved away.
                    state['occupied_missing_hits'] = 0

                occlusion_evidence = (
                    state.get('inside_hits', 0)
                    >= OCCUPIED_OCCLUSION_MIN_INSIDE_HITS
                    and state.get('deep_hits', 0)
                    >= OCCUPIED_OCCLUSION_MIN_DEEP_HITS
                    and state.get('max_overlap_score', 0.0)
                    >= OCCUPIED_OCCLUSION_MIN_MAX_OVERLAP
                )

                if (
                    OCCUPIED_OCCLUSION_PROMOTE
                    and lock_reason in ('owner_missing', 'no_owner')
                    and occlusion_evidence
                    and state.get('occupied_missing_hits', 0)
                    >= OCCUPIED_OCCLUSION_PROMOTE_MISSING
                ):
                    state['status'] = 'parking'
                    state['inferred_parking'] = True
                    state['missing_hits'] = state.get('occupied_missing_hits', 0)
                    state['empty_hits'] = 0

                elif state['empty_hits'] >= OCCUPIED_EMPTY_RELEASE_DETECTIONS:
                    _clear_slot_to_available(state, frame_idx)

                else:
                    state['status'] = 'occupied'

                slot['status'] = state['status']
                continue

            _clear_slot_to_available(state, frame_idx)
            slot['status'] = state['status']
            continue

        # ----------------------------------------------------
        # Valid assignment
        # ----------------------------------------------------
        car_id = resolve_car_id(assigned['car_id'])
        car_box = tuple(assigned['car_box'])
        center = assigned['center']
        anchor = assigned['anchor']

        same_car = (
            previous_owner is not None
            and previous_owner == car_id
        )

        # Use anchor movement for parking stability.
        if same_car and state.get('last_anchor') is not None:
            old_ax, old_ay = state['last_anchor']
            ax, ay = anchor
            sx1, sy1, sx2, sy2 = slot['bbox']

            slot_diag = max(
                ((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2) ** 0.5,
                1.0
            )
            movement = (
                ((ax - old_ax) ** 2 + (ay - old_ay) ** 2) ** 0.5
                / slot_diag
            )

            if movement <= PARKING_STATIONARY_CENTER_THRESHOLD:
                state['stationary_hits'] += 1
            else:
                state['stationary_hits'] = 0
        else:
            state['stationary_hits'] = 0

        inside_now = (
            assigned['anchor_inside']
            or assigned['center_inside']
        )

        deep_evidence_now = (
            (
                assigned['anchor_inside']
                and assigned['overlap_score'] >= PARKING_DEEP_SCORE_THRESHOLD
            )
            or (
                assigned['center_inside']
                and assigned['overlap_score'] >= 0.40
            )
            or assigned['overlap_score'] >= 0.55
        )

        if inside_now:
            state['inside_hits'] = state.get('inside_hits', 0) + 1
        else:
            state['inside_hits'] = 0

        if deep_evidence_now:
            state['deep_hits'] = state.get('deep_hits', 0) + 1
        else:
            state['deep_hits'] = 0

        state['max_overlap_score'] = max(
            float(state.get('max_overlap_score', 0.0)),
            float(assigned['overlap_score'])
        )

        state.update({
            'car_id': car_id,
            'overlap_score': assigned['overlap_score'],
            'slot_coverage': assigned['slot_coverage'],
            'car_coverage': assigned['car_coverage'],
            'center_inside': assigned['center_inside'],
            'anchor_inside': assigned['anchor_inside'],
            'empty_hits': 0,
            'missing_hits': 0,
            'occupied_missing_hits': 0,
            'exit_hits': 0,
            'owner_last_seen_frame': int(frame_idx),
            'last_center': center,
            'last_anchor': anchor,
            'last_car_box': car_box,
            'last_update_frame': frame_idx
        })
        _refresh_slot_owner_identity(state, car_id, frame_idx)

        # ----------------------------------------------------
        # PARKING
        # ----------------------------------------------------
        if (
            PARKING_OWNER_LOCK
            and previous_status == 'parking'
            and same_car
        ):
            state['status'] = 'parking'
        else:
            deep_enough = deep_evidence_now

            if (
                deep_enough
                and state['stationary_hits'] >= PARKING_STABLE_DETECTIONS
            ):
                state['status'] = 'parking'
            else:
                state['status'] = 'occupied'

        slot['status'] = state['status']

    return assignments


# ============================================================
# Parking visualization / console output
# ============================================================

def draw_parking_slots(frame):
    for slot in parking_slots:
        name = slot['name']
        state = parking_state[name]
        status = state['status']
        color = PARKING_STATUS_COLORS[status]

        x1, y1, x2, y2 = slot['bbox']
        polygon = slot.get('polygon')

        # Draw exact JSON polygon only. The extra rectangle remains disabled
        # unless DRAW_SLOT_BBOX=True or no polygon exists.
        if DRAW_SLOT_POLYGON and polygon is not None:
            cv2.polylines(
                frame,
                [polygon],
                isClosed=True,
                color=color,
                thickness=3,
                lineType=cv2.LINE_AA
            )

            label_x = int(
                np.min(polygon[:, 0])
            )
            label_y = int(
                np.min(polygon[:, 1])
            )

        else:
            label_x, label_y = x1, y1

        if (
            globals().get('DRAW_SLOT_BBOX', False)
            or polygon is None
        ):
            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                color,
                2,
                lineType=cv2.LINE_AA
            )

        label = f'{name} | {status}'

        if state.get('car_id') is not None:
            label += f" | Car {state['car_id']}"

        if status == 'parking' and PARKING_OWNER_LOCK:
            label += ' | LOCK'

            if state.get('inferred_parking', False):
                label += ' | OCCLUSION'

            if state.get('missing_hits', 0) > 0:
                label += f" | HOLD {state['missing_hits']}"

        cv2.putText(
            frame,
            label,
            (label_x, max(20, label_y - 8)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.52,
            color,
            2,
            cv2.LINE_AA
        )


def parking_status_counts():
    counts = {
        'available': 0,
        'occupied': 0,
        'parking': 0,
        'disable': 0
    }

    for state in parking_state.values():
        counts[state['status']] += 1

    return counts


def print_parking_statuses():
    counts = parking_status_counts()

    print(
        '\n--- Parking Status --- '
        f"available={counts['available']} | "
        f"occupied={counts['occupied']} | "
        f"parking={counts['parking']} | "
        f"disable={counts['disable']}"
    )

    for slot in parking_slots:
        state = parking_state[slot['name']]
        car_id = state.get('car_id')

        plate_text = ''

        if car_id is not None:
            car_id = resolve_car_id(car_id)
            info = car_memory.get(car_id)

            if info:
                plate_text = info.get(
                    'stable_text',
                    ''
                ) or info.get(
                    'text',
                    ''
                )

        if not plate_text:
            plate_text = state.get('owner_plate_text', '')

        lock_text = (
            'LOCK'
            if (
                state['status'] == 'parking'
                and PARKING_OWNER_LOCK
            )
            else '-'
        )

        print(
            f"{slot['name']:<18} "
            f"| {state['status']:<9} "
            f"| Car: {str(car_id) if car_id is not None else '-':<4} "
            f"| Plate: {plate_text or '-':<12} "
            f"| overlap={state['overlap_score']:.2f} "
            f"| anchor={str(state['anchor_inside']):<5} "
            f"| stationary={state['stationary_hits']:<2} "
            f"| empty={state['empty_hits']:<2} "
            f"| missing={state.get('missing_hits', 0):<3} "
            f"| exit={state.get('exit_hits', 0):<2} "
            f"| {lock_text}"
        )


# ============================================================
# 16) Combined Main Loop
# Car -> License Plate -> OCR + Parking Slot Status
# ============================================================

cap = open_capture(video_path)

if not cap.isOpened():
    raise RuntimeError(f'Could not open video: {video_path}')

frame_count_drive = 0
max_frames_to_process = RUNTIME_ARGS.max_frames or None

last_boxes = []
car_boxes_latest = {}
plate_crops = {}

_processing_started_at = time.perf_counter()
cv2.namedWindow('Parking CCTV', cv2.WINDOW_NORMAL)
cv2.resizeWindow(
    'Parking CCTV',
    DISPLAY_MAX_WIDTH,
    DISPLAY_MAX_HEIGHT
)

try:
    while cap.isOpened() and (
        max_frames_to_process is None
        or frame_count_drive < max_frames_to_process
    ):
        ret, frame = cap.read()

        if not ret:
            print('Frame read failed. Reconnecting to CCTV...')
            cap.release()
            time.sleep(1)
            cap = open_capture(video_path)
            continue

        run_detection = (
            frame_count_drive % DETECT_EVERY_N_FRAMES == 0
        )

        # ====================================================
        # Detection
        # ====================================================

        if run_detection:
            detect_frame = enhance_frame_for_detection(frame)

            car_results = car_detector_model.track(
                detect_frame,
                # Give BoT-SORT low-confidence boxes so it can KEEP an ID
                # through blur/partial occlusion. We still filter application
                # detections to CAR_CONF_THRESHOLD (0.60) below.
                conf=TRACKER_INPUT_CONF,
                imgsz=CAR_DETECTOR_IMGSZ,
                tracker=CUSTOM_TRACKER_PATH,
                persist=True,
                verbose=False,
                quantize=YOLO_QUANTIZE
            )

            raw_detections = []

            for car_result in car_results:
                if car_result.boxes is None:
                    continue

                for box in car_result.boxes:
                    if box.id is None:
                        continue

                    car_track_id = int(box.id[0])
                    px1, py1, px2, py2 = map(
                        int,
                        box.xyxy[0]
                    )

                    conf = float(box.conf[0])

                    # Explicit second guard: keep only car detections >= 0.60.
                    # Ultralytics already receives conf=CAR_CONF_THRESHOLD above,
                    # but this prevents low-confidence boxes from entering the
                    # rest of the pipeline if tracker behavior changes.
                    if conf < CAR_CONF_THRESHOLD:
                        continue

                    raw_detections.append(
                        (
                            car_track_id,
                            px1,
                            py1,
                            px2,
                            py2,
                            conf
                        )
                    )

            # =================================================
            # Same-frame dedup
            # =================================================

            (
                deduped_detections,
                same_frame_aliases
            ) = dedup_car_detections(raw_detections)

            for duplicate_id, kept_id in same_frame_aliases.items():
                canonical_kept = resolve_car_id(kept_id)
                duplicate_resolved = resolve_car_id(duplicate_id)

                if duplicate_resolved != canonical_kept:
                    if duplicate_resolved in car_memory:
                        merge_track_memories(
                            car_memory,
                            duplicate_resolved,
                            canonical_kept
                        )
                    else:
                        car_id_alias[
                            duplicate_resolved
                        ] = canonical_kept

            # =================================================
            # Recover tracker ID resets for RESERVED (OCCUPIED/PARKING) cars
            # BEFORE plate OCR. This lets a blurred/occluded car keep
            # its old canonical ID and historical plate memory.
            # =================================================
            recover_parking_track_ids(
                deduped_detections,
                frame.shape,
                frame_count_drive
            )

            # v6: recover front/rear -> side-view ID switches before OCR.
            # This uses canonical plate memory + motion continuity, so the new
            # side-view track does NOT need to see the license plate.
            recover_turning_track_ids(
                deduped_detections,
                frame_count_drive
            )

            # Existing short-gap geometry fallback remains as a stricter backup.
            recover_recent_track_ids_by_geometry(
                deduped_detections,
                frame_count_drive
            )

            # =================================================
            # v6.1 SAME-FRAME CANONICAL LOCK
            # =================================================
            # ReID rules above may legitimately create aliases, but after all
            # recovery passes every surviving physical box in this frame must
            # own a unique canonical vehicle ID. Repair stale collisions now,
            # before motion memory, OCR, display, or parking dictionaries.
            enforce_same_frame_canonical_uniqueness(
                deduped_detections,
                frame_count_drive
            )

            frame_canonical_claims = build_frame_canonical_claims(
                deduped_detections
            )

            last_boxes = []
            car_boxes_latest = {}

            # =================================================
            # Process cars + collect Stage-2 jobs
            # =================================================

            stage2_tasks = []

            for (
                car_track_id,
                px1,
                py1,
                px2,
                py2,
                conf
            ) in deduped_detections:

                resolved_id = resolve_car_id(car_track_id)
                raw_car_box = (px1, py1, px2, py2)

                _update_vehicle_motion(
                    resolved_id,
                    car_track_id,
                    raw_car_box,
                    frame_count_drive
                )

                reduced_car_box = shrink_car_box(
                    raw_car_box,
                    frame.shape,
                    CAR_BOX_SHRINK_RATIO
                )

                padded_car_box = expand_car_box(
                    raw_car_box,
                    frame.shape
                )

                display_box = (
                    padded_car_box
                    if DRAW_PADDED_CAR_BOX
                    else reduced_car_box
                )
                dx1, dy1, dx2, dy2 = display_box

                last_box_index = len(last_boxes)
                last_boxes.append(
                    (
                        resolved_id,
                        dx1,
                        dy1,
                        dx2,
                        dy2
                    )
                )

                if resolved_id not in car_boxes_latest:
                    car_boxes_latest[resolved_id] = reduced_car_box
                else:
                    if int(car_track_id) != int(resolved_id):
                        _detach_raw_track_alias(
                            car_track_id,
                            frame_idx=frame_count_drive,
                            reason='PARKING_DICT_COLLISION'
                        )
                        resolved_id = resolve_car_id(car_track_id)
                        last_boxes[last_box_index] = (
                            resolved_id,
                            dx1,
                            dy1,
                            dx2,
                            dy2
                        )
                        frame_canonical_claims[resolved_id] = int(car_track_id)
                        car_boxes_latest[resolved_id] = reduced_car_box

                if not should_run_stage2(
                    resolved_id,
                    frame_count_drive
                ):
                    if resolved_id in car_memory:
                        car_memory[resolved_id]['last_box'] = raw_car_box
                        car_memory[resolved_id]['last_seen_frame'] = frame_count_drive
                    continue

                car_crop = frame[py1:py2, px1:px2]

                if car_crop.size == 0:
                    continue

                stage2_tasks.append({
                    'raw_track_id': int(car_track_id),
                    'resolved_id': int(resolved_id),
                    'raw_car_box': raw_car_box,
                    'reduced_car_box': reduced_car_box,
                    'padded_car_box': padded_car_box,
                    'display_box': display_box,
                    'last_box_index': last_box_index,
                    'conf': float(conf),
                    'car_crop': car_crop,
                    'selected_crop': car_crop,
                    'plate_box': None,
                    'plate_conf': 0.0
                })

            # =================================================
            # Batch plate YOLO pass 1: original car crops
            # =================================================

            if stage2_tasks:
                raw_plate_results = detect_best_plates_batch(
                    [task['car_crop'] for task in stage2_tasks],
                    trained_model
                )

                for task, result in zip(
                    stage2_tasks,
                    raw_plate_results
                ):
                    task['plate_box'], task['plate_conf'] = result

            # =================================================
            # Batch plate YOLO pass 2: fallback padded crops only
            # =================================================

            fallback_tasks = []
            fallback_crops = []

            for task in stage2_tasks:
                retry_with_padding = (
                    task['plate_box'] is None
                    or task['plate_conf'] < PLATE_EXPANDED_RETRY_CONF
                )

                if (
                    retry_with_padding
                    and task['padded_car_box'] != task['raw_car_box']
                ):
                    cx1, cy1, cx2, cy2 = task['padded_car_box']
                    padded_crop = frame[cy1:cy2, cx1:cx2]

                    if padded_crop.size > 0:
                        fallback_tasks.append(task)
                        fallback_crops.append(padded_crop)

            if fallback_tasks:
                padded_plate_results = detect_best_plates_batch(
                    fallback_crops,
                    trained_model
                )

                for task, padded_crop, result in zip(
                    fallback_tasks,
                    fallback_crops,
                    padded_plate_results
                ):
                    padded_plate_box, padded_plate_conf = result

                    if (
                        padded_plate_box is not None
                        and (
                            task['plate_box'] is None
                            or padded_plate_conf > task['plate_conf']
                        )
                    ):
                        task['selected_crop'] = padded_crop
                        task['plate_box'] = padded_plate_box
                        task['plate_conf'] = padded_plate_conf

            # =================================================
            # OCR + voting / merge
            # Same 2x plate zoom and EasyOCR model as before.
            # =================================================

            for task in stage2_tasks:
                resolved_id = resolve_car_id(
                    task['resolved_id']
                )
                raw_track_id = task['raw_track_id']
                raw_car_box = task['raw_car_box']
                reduced_car_box = task['reduced_car_box']
                dx1, dy1, dx2, dy2 = task['display_box']

                plate_box = task['plate_box']
                plate_conf = task['plate_conf']

                if plate_box is None:
                    if resolved_id in car_memory:
                        car_memory[resolved_id]['last_box'] = raw_car_box
                        car_memory[resolved_id]['last_seen_frame'] = frame_count_drive
                    continue

                car_crop = task['selected_crop']
                rx1, ry1, rx2, ry2 = plate_box
                plate_crop = car_crop[ry1:ry2, rx1:rx2]

                if plate_crop.size == 0:
                    continue

                h, w = plate_crop.shape[:2]

                plate_zoom = cv2.resize(
                    plate_crop,
                    (w * 2, h * 2),
                    interpolation=cv2.INTER_CUBIC
                )

                plate_crops[resolved_id] = plate_zoom

                final_id, _ = process_plate_for_track(
                    raw_track_id,
                    plate_zoom,
                    reader,
                    car_memory,
                    car_conf=task['conf'],
                    plate_conf=plate_conf,
                    current_box=raw_car_box,
                    frame_idx=frame_count_drive,
                    active_canonical_claims=frame_canonical_claims
                )

                if final_id != resolved_id:
                    idx = task['last_box_index']
                    last_boxes[idx] = (
                        final_id,
                        dx1,
                        dy1,
                        dx2,
                        dy2
                    )

                    old_box = car_boxes_latest.pop(
                        resolved_id,
                        reduced_car_box
                    )

                    car_boxes_latest[final_id] = old_box

                    if resolved_id in plate_crops:
                        plate_crops[final_id] = (
                            plate_crops.pop(resolved_id)
                        )

            # =================================================
            # Parking slot matching/status update
            # =================================================
            if PARKING_ENABLED:
                update_parking_states(
                    car_boxes_latest,
                    frame_count_drive
                )

        render_this_frame = (
            (not DRAW_ONLY_ON_DISPLAY_FRAMES)
            or frame_count_drive % DISPLAY_EVERY_N_FRAMES == 0
        )

        if render_this_frame:
            # ====================================================
            # Draw Cars
            # ====================================================

            for (
                car_track_id,
                px1,
                py1,
                px2,
                py2
            ) in last_boxes:

                car_track_id = resolve_car_id(car_track_id)
                result_info = car_memory.get(car_track_id)

                if result_info and result_info.get('is_locked'):
                    box_color = (0, 255, 0)

                elif result_info and result_info.get('digits_locked'):
                    box_color = (0, 255, 255)

                else:
                    box_color = (0, 165, 255)

                cv2.rectangle(
                    frame,
                    (px1, py1),
                    (px2, py2),
                    box_color,
                    3
                )

                if result_info:
                    if result_info.get('is_locked'):
                        status = 'LOCK'

                    elif result_info.get('digits_locked'):
                        status = 'DIGITS'

                    else:
                        status = 'READ'

                    label = (
                        f"Car {car_track_id}: "
                        f"{result_info['text']} "
                        f"({result_info['score']:.2f}) "
                        f"[{status}]"
                    )

                else:
                    label = f'Car {car_track_id}: reading...'

                cv2.putText(
                    frame,
                    label,
                    (px1, max(py1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    box_color,
                    2
                )

            # ====================================================
            # Draw Parking Slots AFTER cars so slot status is visible
            # ====================================================

            draw_parking_slots(frame)

            cv2.imshow('Parking CCTV', prepare_display_frame(frame))
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord('q')):
                break

        # ====================================================
        # Display
        # ====================================================

        if LIVE_PLOT_ENABLED and plt is not None and frame_count_drive % DISPLAY_EVERY_N_FRAMES == 0:

            zoom_track_id = None

            if car_memory:
                locked_ids = [
                    tid
                    for tid, info in car_memory.items()
                    if info.get('is_locked')
                ]

                digits_locked_ids = [
                    tid
                    for tid, info in car_memory.items()
                    if info.get('digits_locked')
                    and not info.get('is_locked')
                ]

                if locked_ids:
                    zoom_track_id = max(
                        locked_ids,
                        key=lambda tid:
                            car_memory[tid]['score']
                    )

                elif digits_locked_ids:
                    zoom_track_id = max(
                        digits_locked_ids,
                        key=lambda tid:
                            car_memory[tid]['score']
                    )

                else:
                    zoom_track_id = max(
                        car_memory,
                        key=lambda tid:
                            car_memory[tid]['score']
                    )

            elif last_boxes:
                zoom_track_id = last_boxes[0][0]

            if zoom_track_id is not None:
                zoom_track_id = resolve_car_id(
                    zoom_track_id
                )

            zoom_img = (
                plate_crops.get(zoom_track_id)
                if zoom_track_id is not None
                else None
            )

            fig, (ax_main, ax_zoom) = plt.subplots(
                1,
                2,
                figsize=(18, 9),
                gridspec_kw={
                    'width_ratios': [2.4, 1]
                }
            )

            # ----- Main frame -----
            ax_main.imshow(
                cv2.cvtColor(
                    frame,
                    cv2.COLOR_BGR2RGB
                )
            )

            counts = parking_status_counts()

            ax_main.set_title(
                f'Frame {frame_count_drive} '
                f'| Cars tracked: {len(last_boxes)}\n'
                f"Available: {counts['available']} | "
                f"Occupied: {counts['occupied']} | "
                f"Parking: {counts['parking']} | "
                f"Disable: {counts['disable']}"
            )

            ax_main.axis('off')

            # ----- Plate zoom -----
            if zoom_img is not None:
                ax_zoom.imshow(
                    cv2.cvtColor(
                        zoom_img,
                        cv2.COLOR_BGR2RGB
                    )
                )

                info = car_memory.get(zoom_track_id)

                if info:
                    if info.get('has_stable_memory'):
                        status_line = 'STABLE MEMORY | historical green result preserved'

                    elif info.get('is_locked'):
                        status_line = 'FULL LOCK'

                    elif info.get('digits_locked'):
                        status_line = (
                            'DIGITS STABLE | prefix voting...'
                        )

                    else:
                        status_line = 'Collecting OCR votes...'

                    current_text = info.get(
                        'current_text',
                        info['text']
                    )

                    zoom_title = (
                        f"Car {zoom_track_id}: {info['text']}\n"
                        f"{status_line} "
                        f"| saved OCR {info['score']:.2f}\n"
                        f"Current OCR: {current_text}"
                    )

                else:
                    zoom_title = (
                        f'Car {zoom_track_id}: reading...'
                    )

                ax_zoom.set_title(
                    zoom_title,
                    fontsize=11
                )

            else:
                ax_zoom.imshow(
                    np.full(
                        (200, 400, 3),
                        230,
                        dtype=np.uint8
                    )
                )

                ax_zoom.set_title(
                    'No plate detected',
                    fontsize=11
                )

            ax_zoom.axis('off')

            plt.tight_layout()
            plt.show()
            plt.close(fig)

            # ----- Console status -----
            elapsed = max(
                time.perf_counter() - _processing_started_at,
                1e-6
            )
            processing_fps = (
                (frame_count_drive + 1) / elapsed
            )

            counts = parking_status_counts()

            print(
                f'Frame {frame_count_drive} | '
                f'processing FPS: {processing_fps:.2f} | '
                f'cars memory: {len(car_memory)} | '
                f"available={counts['available']} | "
                f"occupied={counts['occupied']} | "
                f"parking={counts['parking']} | "
                f"disable={counts['disable']}"
            )

            if RUNTIME_VERBOSE_DETAILS:
                print_threshold_config()

                print(
                    f'--- Current Car Memory '
                    f'({len(car_memory)} cars after merge) ---'
                )

                for tid, info in car_memory.items():
                    car_conf_txt = (
                        f"{info.get('car_conf', 0.0):.2f}"
                        if info.get('car_conf') is not None
                        else 'N/A'
                    )

                    plate_conf_txt = (
                        f"{info.get('plate_conf', 0.0):.2f}"
                        if info.get('plate_conf') is not None
                        else 'N/A'
                    )

                    print(
                        f"Car ID: {tid} "
                        f"| Saved: {info['text']} "
                        f"| Current: {info.get('current_text', info['text'])} "
                        f"| Stable Memory: {info.get('has_stable_memory', False)} "
                        f"| Car Conf: {car_conf_txt} "
                        f"| Plate Conf: {plate_conf_txt} "
                        f"| Saved OCR Conf: {info['score']:.2f} "
                        f"| Locked: {info['is_locked']}"
                    )

                print_parking_statuses()

        frame_count_drive += 1


except KeyboardInterrupt:
    print('Interrupted by user.')


# ============================================================
# Final Results
# ============================================================

finally:
    cap.release()

    print('\nProcessing Finished.')
    print_threshold_config()

    print(
        f'\n=== Final Car Results '
        f'({len(car_memory)} cars after merge) ==='
    )

    for tid, info in car_memory.items():
        car_conf_txt = (
            f"{info.get('car_conf', 0.0):.2f}"
            if info.get('car_conf') is not None
            else 'N/A'
        )

        plate_conf_txt = (
            f"{info.get('plate_conf', 0.0):.2f}"
            if info.get('plate_conf') is not None
            else 'N/A'
        )

        print(f'Car ID: {tid}')
        print(f"Plate (Saved/Final): {info['text']}")
        print(f"Stable Memory: {info.get('has_stable_memory', False)}")
        print(f"Stable Frame: {info.get('stable_frame_idx', 'N/A')}")
        print(f"Current OCR Candidate: {info.get('current_text', info['text'])}")
        print(f"Current OCR Conf: {info.get('current_score', info['score']):.2f}")
        print(f"Prefix: {info.get('prefix', '')}")
        print(f"Digits: {info.get('digits', '')}")
        print(f'Car Detection Conf: {car_conf_txt}')
        print(f'Plate Detection Conf: {plate_conf_txt}')
        print(f"Saved OCR Conf: {info['score']:.2f}")
        print(f"Locked: {info['is_locked']}")
        print(f"Observations (rolling): {len(info.get('observations', []))}")
        print('-' * 50)

    print('\n=== Final Parking Slot Results ===')
    print_parking_statuses()