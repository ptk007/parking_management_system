import argparse
import json
from pathlib import Path
from typing import Any

import cv2


RTSP_FIELD = "ANPR&PTZ RTSP"
NAME_FIELD = "CAMERA NAME_NEW"
IP_FIELD = "IP ADDRESS"
SOURCES = {
    "old": ("oldcctv4.json", "oldcctvinfo4.json"),
    "oldcctv": ("oldcctv4.json", "oldcctvinfo4.json"),
    "oldcctvinfo4": ("oldcctvinfo4.json", "oldcctv4.json"),
    "cctv2": ("cctvinfo2.json",),
    "cctvinfo2": ("cctvinfo2.json",),
}


def find_json_path(source: str = "old") -> Path:
    here = Path(__file__).resolve().parent
    filenames = SOURCES.get(source.lower())
    if not filenames:
        choices = ", ".join(sorted(SOURCES))
        raise SystemExit(f"Unknown source: {source}. Choose one of: {choices}")

    candidates = [
        folder / filename
        for folder in (here, here.parent / "parking-backend" / "src")
        for filename in filenames
    ]

    for path in candidates:
        if path.exists():
            return path

    return candidates[0]


def load_cameras(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8-sig") as file:
        cameras = json.load(file)

    return [
        camera
        for camera in cameras
        if isinstance(camera, dict) and str(camera.get(RTSP_FIELD, "")).strip()
    ]


def camera_label(camera: dict[str, Any]) -> str:
    number = str(camera.get("NO", "")).strip()
    name = str(camera.get(NAME_FIELD, "")).strip()
    ip = str(camera.get(IP_FIELD, "")).strip()
    return f"{number:>3}  {name:<35}  {ip}"


def list_cameras(cameras: list[dict[str, Any]], search: str | None = None) -> None:
    needle = search.lower() if search else None
    for index, camera in enumerate(cameras, start=1):
        label = camera_label(camera)
        if needle and needle not in label.lower():
            continue
        print(f"{index:>3}. {label}")


def select_camera(cameras: list[dict[str, Any]], camera_arg: str) -> dict[str, Any]:
    if camera_arg.isdigit():
        selected = int(camera_arg)
        for camera in cameras:
            if str(camera.get("NO", "")).strip() == camera_arg:
                return camera
        if 1 <= selected <= len(cameras):
            return cameras[selected - 1]

    needle = camera_arg.lower()
    matches = [
        camera
        for camera in cameras
        if needle in str(camera.get(NAME_FIELD, "")).lower()
        or needle in str(camera.get("Location", "")).lower()
        or needle in str(camera.get(IP_FIELD, "")).lower()
    ]

    if not matches:
        raise SystemExit(f"No camera found for: {camera_arg}")

    if len(matches) > 1:
        print("Multiple cameras matched. Use the NO or exact camera name:")
        list_cameras(matches)
        raise SystemExit(2)

    return matches[0]


def watch_camera(camera: dict[str, Any], width: int | None = None) -> None:
    name = str(camera.get(NAME_FIELD, "CCTV")).strip() or "CCTV"
    rtsp_url = str(camera.get(RTSP_FIELD, "")).strip()

    print(f"Opening: {camera_label(camera)}")
    print("Press q or Esc to close.")

    capture = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    if not capture.isOpened():
        raise SystemExit(
            "Could not open RTSP stream. Check network/VPN, camera IP, username/password, "
            "and whether the camera allows RTSP."
        )

    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                print("Frame read failed. Reconnecting...")
                capture.release()
                capture = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
                continue

            if width and frame.shape[1] > width:
                height = int(frame.shape[0] * (width / frame.shape[1]))
                frame = cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)

            cv2.imshow(name, frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                break
    finally:
        capture.release()
        cv2.destroyAllWindows()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Watch CCTV RTSP streams from CCTV JSON files.")
    parser.add_argument(
        "--source",
        default="old",
        help="Named CCTV source: old, oldcctvinfo4, cctv2, or cctvinfo2.",
    )
    parser.add_argument(
        "--json",
        type=Path,
        help="Path to a CCTV JSON file. Overrides --source.",
    )
    parser.add_argument("--list", action="store_true", help="List cameras with RTSP links.")
    parser.add_argument("--search", help="Filter camera list by name, IP, or location.")
    parser.add_argument("--camera", help="Camera NO, list index, IP, or name to watch.")
    parser.add_argument("--width", type=int, default=1280, help="Resize display width.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    json_path = args.json or find_json_path(args.source)
    cameras = load_cameras(json_path)

    if args.list or args.search:
        list_cameras(cameras, args.search)
        return

    if not args.camera:
        print(f"Loaded {len(cameras)} cameras with RTSP links from {json_path}")
        print("Use --list to see cameras, then use --camera NO to watch one.")
        print("Example: python cctv_viewer.py --source cctvinfo2 --camera 1")
        return

    watch_camera(select_camera(cameras, args.camera), args.width)


if __name__ == "__main__":
    main()
