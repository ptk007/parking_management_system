"""Probe a single RTSP source and return one bounded, unannotated JPEG frame."""

import base64
import json
import sys

import cv2
import numpy as np

from cctv_viewer import open_capture

MAX_FRAME_WIDTH = 1280
MAX_JPEG_BYTES = 1_000_000


def encode_frame(frame: np.ndarray) -> str:
    height, width = frame.shape[:2]
    if width > MAX_FRAME_WIDTH:
        scaled_height = max(1, round(height * MAX_FRAME_WIDTH / width))
        frame = cv2.resize(frame, (MAX_FRAME_WIDTH, scaled_height))

    while True:
        encoded, jpeg = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, 80],
        )
        if not encoded:
            raise RuntimeError("Could not encode the captured CCTV frame")
        if len(jpeg) <= MAX_JPEG_BYTES:
            return base64.b64encode(jpeg).decode("ascii")

        height, width = frame.shape[:2]
        if width <= 160 or height <= 90:
            raise RuntimeError("Captured CCTV frame exceeds the preview size limit")
        frame = cv2.resize(
            frame,
            (max(1, round(width * 0.8)), max(1, round(height * 0.8))),
        )


def main() -> int:
    request = json.load(sys.stdin)
    rtsp_url = str(request.get("rtspUrl", "")).strip()
    if not rtsp_url:
        print(json.dumps({"online": False}, separators=(",", ":")))
        return 0

    capture = open_capture(rtsp_url, read_wait_timeout=5.0)
    try:
        if not capture.isOpened():
            print(json.dumps({"online": False}, separators=(",", ":")))
            return 0
        received, frame = capture.read()
        if not received or frame is None:
            print(json.dumps({"online": False}, separators=(",", ":")))
            return 0
        print(
            json.dumps(
                {"online": True, "frameBase64": encode_frame(frame)},
                separators=(",", ":"),
            )
        )
        return 0
    finally:
        capture.release()


if __name__ == "__main__":
    raise SystemExit(main())
