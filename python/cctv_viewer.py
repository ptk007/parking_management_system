import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:
    import cv2
except ImportError as error:
    raise SystemExit("OpenCV is not installed. Run install.bat, then run this again.") from error


RTSP_FIELD = "ANPR&PTZ RTSP"
NAME_FIELD = "CAMERA NAME_NEW"
IP_FIELD = "IP ADDRESS"
NUMBER_FIELD = "NO"
LOCATION_FIELD = "Location"

FIELD_ALIASES = {
    NUMBER_FIELD: ("NO", "No", "no", "number", "camera_id", "cameraId", "id"),
    IP_FIELD: ("IP ADDRESS", "IP Address", "ip_address", "ipAddress", "ipc"),
    NAME_FIELD: (
        "CAMERA NAME_NEW",
        "CAMERA NAME",
        "Camera Name",
        "camera_name",
        "cameraName",
        "name",
    ),
    LOCATION_FIELD: ("Location", "LOCATION", "location", "position"),
    RTSP_FIELD: (
        "ANPR&PTZ RTSP",
        "RTSP",
        "rtsp",
        "rtsp_url",
        "rtspUrl",
        "stream_url",
        "streamUrl",
    ),
}

SOURCES = {
    "old": ("oldcctv4.json", "oldcctvinfo4.json"),
    "oldcctv": ("oldcctv4.json", "oldcctvinfo4.json"),
    "oldcctvinfo4": ("oldcctvinfo4.json", "oldcctv4.json"),
    "new": ("cctvinfo2.json",),
    "cctv2": ("cctvinfo2.json",),
    "cctvinfo2": ("cctvinfo2.json",),
}


def source_folders() -> Tuple[Path, Path]:
    here = Path(__file__).resolve().parent
    return here, here.parent / "parking-backend" / "src"


def find_json_path(source: str = "old") -> Path:
    filenames = SOURCES.get(source.lower())
    if not filenames:
        choices = ", ".join(sorted(SOURCES))
        raise SystemExit(f"Unknown source: {source}. Choose one of: {choices}")

    candidates = [
        folder / filename
        for folder in source_folders()
        for filename in filenames
    ]

    for path in candidates:
        if path.exists():
            return path

    return candidates[0]


def find_all_json_paths() -> List[Path]:
    paths = []
    for source in ("old", "new"):
        path = find_json_path(source)
        if path.exists() and path not in paths:
            paths.append(path)
    return paths


def first_value(record: Dict[str, Any], aliases: Sequence[str]) -> str:
    for key in aliases:
        value = record.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def normalize_camera(record: Dict[str, Any], source_name: str) -> Dict[str, Any]:
    camera = dict(record)
    for canonical_name, aliases in FIELD_ALIASES.items():
        camera[canonical_name] = first_value(record, aliases)
    camera["_source"] = source_name
    return camera


def extract_records(data: Any, path: Path) -> List[Dict[str, Any]]:
    if isinstance(data, list):
        records = data
    elif isinstance(data, dict):
        records = next(
            (
                data[key]
                for key in ("cameras", "data", "results", "items")
                if isinstance(data.get(key), list)
            ),
            [],
        )
    else:
        records = []

    if not records:
        raise SystemExit(f"No camera records found in {path}")

    return [record for record in records if isinstance(record, dict)]


def load_cameras(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        raise SystemExit(f"CCTV JSON file not found: {path}")

    with path.open("r", encoding="utf-8-sig") as file:
        try:
            data = json.load(file)
        except json.JSONDecodeError as error:
            raise SystemExit(f"Invalid JSON in {path}: {error}") from error

    return [
        normalized
        for normalized in (
            normalize_camera(camera, path.name)
            for camera in extract_records(data, path)
        )
        if normalized[RTSP_FIELD]
    ]


def load_camera_sources(paths: Sequence[Path]) -> List[Dict[str, Any]]:
    cameras = []
    for path in paths:
        cameras.extend(load_cameras(path))
    return cameras


def camera_label(camera: Dict[str, Any], show_source: bool = False) -> str:
    number = str(camera.get(NUMBER_FIELD, "")).strip()
    name = str(camera.get(NAME_FIELD, "")).strip()
    ip = str(camera.get(IP_FIELD, "")).strip()
    source = "  {}".format(camera.get("_source", "")) if show_source else ""
    return "{:>3}  {:<35}  {}{}".format(number, name, ip, source)


def list_cameras(
    cameras: List[Dict[str, Any]],
    search: Optional[str] = None,
    show_source: bool = False,
) -> None:
    needle = search.lower() if search else None
    for index, camera in enumerate(cameras, start=1):
        label = camera_label(camera, show_source)
        if needle and needle not in label.lower():
            continue
        print("{:>3}. {}".format(index, label))


def select_camera(
    cameras: List[Dict[str, Any]], camera_arg: str
) -> Dict[str, Any]:
    if camera_arg.isdigit():
        selected = int(camera_arg)
        number_matches = [
            camera
            for camera in cameras
            if str(camera.get(NUMBER_FIELD, "")).strip() == camera_arg
        ]
        if len(number_matches) == 1:
            return number_matches[0]
        if len(number_matches) > 1:
            print("Camera NO {} exists in multiple sources:".format(camera_arg))
            list_cameras(number_matches, show_source=True)
            raise SystemExit(2)
        if 1 <= selected <= len(cameras):
            return cameras[selected - 1]

    needle = camera_arg.lower()
    matches = [
        camera
        for camera in cameras
        if needle in str(camera.get(NAME_FIELD, "")).lower()
        or needle in str(camera.get(LOCATION_FIELD, "")).lower()
        or needle in str(camera.get(IP_FIELD, "")).lower()
        or needle in str(camera.get("_source", "")).lower()
    ]

    if not matches:
        raise SystemExit("No camera found for: {}".format(camera_arg))

    if len(matches) > 1:
        print("Multiple cameras matched. Use the NO or exact camera name:")
        list_cameras(matches, show_source=True)
        raise SystemExit(2)

    return matches[0]


def open_capture(rtsp_url: str) -> Any:
    capture = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    open_timeout = getattr(cv2, "CAP_PROP_OPEN_TIMEOUT_MSEC", None)
    read_timeout = getattr(cv2, "CAP_PROP_READ_TIMEOUT_MSEC", None)
    if open_timeout is not None:
        capture.set(open_timeout, 10000)
    if read_timeout is not None:
        capture.set(read_timeout, 10000)
    return capture


def watch_camera(
    camera: Dict[str, Any], width: Optional[int] = None
) -> None:
    name = str(camera.get(NAME_FIELD, "CCTV")).strip() or "CCTV"
    rtsp_url = str(camera.get(RTSP_FIELD, "")).strip()

    print("Opening: {}".format(camera_label(camera, show_source=True)))
    print("Press q or Esc to close.")

    capture = open_capture(rtsp_url)
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
                time.sleep(1)
                capture = open_capture(rtsp_url)
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
        help="CCTV source: old, new, auto, all, oldcctvinfo4, or cctvinfo2.",
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
    if sys.version_info < (3, 8):
        raise SystemExit("Python 3.8 or newer is required.")

    args = parse_args()
    show_source = args.source.lower() == "all"

    if args.json:
        paths = [args.json]
    elif args.source.lower() == "all":
        paths = find_all_json_paths()
    elif args.source.lower() == "auto":
        paths = find_all_json_paths()
        if paths:
            paths = [paths[0]]
    else:
        paths = [find_json_path(args.source)]

    cameras = load_camera_sources(paths)

    if args.list or args.search:
        list_cameras(cameras, args.search, show_source)
        return

    if not args.camera:
        source_names = ", ".join(path.name for path in paths)
        print(
            "Loaded {} cameras with RTSP links from {}".format(
                len(cameras), source_names
            )
        )
        print("Use --list to see cameras, then use --camera NO to watch one.")
        print("Example: python cctv_viewer.py --source cctvinfo2 --camera 1")
        return

    watch_camera(select_camera(cameras, args.camera), args.width)


if __name__ == "__main__":
    main()
