"""Publish a low-rate raw RTSP preview with optional COCO parking-slot boxes."""

import json
import math
import sys
import time
from typing import Any, Mapping, Tuple

import cv2
import numpy as np

from cctv_viewer import open_capture

MAX_FRAME_WIDTH = 1280
MAX_JPEG_BYTES = 1_000_000
JPEG_QUALITY = 72
PREVIEW_FPS = 5
MAX_ANNOTATIONS = 1000


def _image_dimensions(
    slot_data: Mapping[str, Any],
    image_id: Any,
    frame_width: int,
    frame_height: int,
) -> Tuple[int, int]:
    images = slot_data.get("images")
    if isinstance(images, list):
        for image in images:
            if isinstance(image, dict) and image.get("id") == image_id:
                try:
                    width, height = int(image["width"]), int(image["height"])
                    if width > 0 and height > 0:
                        return width, height
                except (KeyError, TypeError, ValueError):
                    break
    return frame_width, frame_height


def draw_slot_bboxes(frame: np.ndarray, slot_data: Any) -> np.ndarray:
    if not isinstance(slot_data, dict):
        return frame
    annotations = slot_data.get("annotations")
    if not isinstance(annotations, list):
        return frame

    frame_height, frame_width = frame.shape[:2]
    category_list = slot_data.get("categories")
    if not isinstance(category_list, list):
        category_list = []
    categories = {
        category.get("id"): str(category.get("name", "")).strip()
        for category in category_list
        if isinstance(category, dict)
        and isinstance(category.get("id"), (int, float, str))
    }

    for annotation in annotations[:MAX_ANNOTATIONS]:
        if not isinstance(annotation, dict):
            continue
        bbox = annotation.get("bbox")
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            continue
        try:
            x, y, width, height = (float(value) for value in bbox)
        except (TypeError, ValueError):
            continue
        if not all(math.isfinite(value) for value in (x, y, width, height)):
            continue
        if width <= 0 or height <= 0:
            continue

        source_width, source_height = _image_dimensions(
            slot_data,
            annotation.get("image_id"),
            frame_width,
            frame_height,
        )
        scale_x = frame_width / source_width
        scale_y = frame_height / source_height
        x1 = max(0, min(frame_width - 1, round(x * scale_x)))
        y1 = max(0, min(frame_height - 1, round(y * scale_y)))
        x2 = max(0, min(frame_width - 1, round((x + width) * scale_x)))
        y2 = max(0, min(frame_height - 1, round((y + height) * scale_y)))
        if x1 >= x2 or y1 >= y2:
            continue

        category_id = annotation.get("category_id")
        label = (
            categories.get(category_id, "")
            if isinstance(category_id, (int, float, str))
            else ""
        )
        if label.lower() == "parking-slot":
            continue
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2, cv2.LINE_AA)
        if label:
            cv2.putText(
                frame,
                label,
                (x1, max(18, y1 - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                (0, 255, 0),
                1,
                cv2.LINE_AA,
            )
    return frame


def _preview_frame(frame: np.ndarray, slot_data: Any) -> bytes:
    height, width = frame.shape[:2]
    if width > MAX_FRAME_WIDTH:
        scaled_height = max(1, round(height * MAX_FRAME_WIDTH / width))
        frame = cv2.resize(frame, (MAX_FRAME_WIDTH, scaled_height))
    frame = draw_slot_bboxes(frame, slot_data)

    quality = JPEG_QUALITY
    while True:
        encoded, jpeg = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, quality],
        )
        if not encoded:
            raise RuntimeError("Could not encode the CCTV preview frame")
        if len(jpeg) <= MAX_JPEG_BYTES:
            return jpeg.tobytes()
        if quality > 40:
            quality -= 8
            continue
        height, width = frame.shape[:2]
        if width <= 160 or height <= 90:
            raise RuntimeError("CCTV preview frame exceeds the configured size limit")
        frame = cv2.resize(frame, (max(1, width * 3 // 4), max(1, height * 3 // 4)))
        quality = JPEG_QUALITY


def _write_frame(frame_bytes: bytes) -> None:
    output = sys.stdout.buffer
    output.write(
        b"--frame\r\n"
        b"Content-Type: image/jpeg\r\n"
        + f"Content-Length: {len(frame_bytes)}\r\n\r\n".encode("ascii")
        + frame_bytes
        + b"\r\n"
    )
    output.flush()


def _write_status(online: bool, message: str = "") -> None:
    sys.stdout.buffer.write(
        json.dumps(
            {"online": online, "message": message},
            separators=(",", ":"),
        ).encode("utf-8")
        + b"\n"
    )
    sys.stdout.buffer.flush()


def main() -> int:
    request = json.load(sys.stdin)
    rtsp_url = str(request.get("rtspUrl", "")).strip()
    slot_data = request.get("parkingSlotData")
    if not rtsp_url:
        _write_status(False, "RTSP link is missing.")
        return 0

    capture = open_capture(rtsp_url, read_wait_timeout=5.0)
    try:
        if not capture.isOpened():
            _write_status(False, "Camera stream could not be opened.")
            return 0
        received, frame = capture.read()
        if not received or frame is None:
            _write_status(False, "Camera did not return a video frame.")
            return 0

        first_frame = _preview_frame(frame, slot_data)
        _write_status(True)
        _write_frame(first_frame)
        frame_interval = 1.0 / PREVIEW_FPS
        next_frame_at = time.monotonic() + frame_interval

        while True:
            delay = next_frame_at - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            received, frame = capture.read()
            if not received or frame is None:
                continue
            _write_frame(_preview_frame(frame, slot_data))
            next_frame_at = time.monotonic() + frame_interval
    except (BrokenPipeError, KeyboardInterrupt):
        return 0
    finally:
        capture.release()


if __name__ == "__main__":
    raise SystemExit(main())
