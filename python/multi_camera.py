"""Run one isolated parking-model worker per CCTV camera."""

import argparse
import signal
import subprocess
import sys
import json
from pathlib import Path
from typing import List

from cctv_viewer import RTSP_FIELD, camera_label, load_cameras, select_camera


PROJECT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = PROJECT_DIR.parent
DEFAULT_CCTV_JSON = PROJECT_DIR / "oldcctvinfo4.json"
DEFAULT_EXPORT_DIR = PROJECT_ROOT / "results"
PROFILE_DIR = PROJECT_ROOT / "cctv" / "parking-cam"
ACTIVE_PROFILE = PROFILE_DIR / "active.json"


def _resolve_profile_path(value: str, kind: str) -> Path:
    path = Path(value)
    if path.is_absolute() or path.exists():
        return path

    candidates = [PROJECT_ROOT / path, PROJECT_DIR / path]
    if kind == "cctv":
        candidates.append(PROJECT_ROOT / "cctv" / path)
    elif kind == "parking":
        candidates.append(PROJECT_ROOT / "json_file" / "parking_slots" / "E4_cars" / path)

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the parking model on multiple CCTV cameras."
    )
    parser.add_argument(
        "--cameras",
        help="Comma-separated camera NO, list index, name, or IP values."
    )
    parser.add_argument(
        "--profiles",
        help="Comma-separated saved profile names; overrides --cameras."
    )
    parser.add_argument(
        "--active",
        action="store_true",
        help="Run the confirmed profile from cctv/parking-cam/active.json."
    )
    parser.add_argument(
        "--cctv-json",
        type=Path,
        default=DEFAULT_CCTV_JSON,
        help="CCTV JSON file containing RTSP URLs."
    )
    parser.add_argument(
        "--parking",
        choices=("on", "off"),
        default="on",
        help="Enable or disable parking-slot detection."
    )
    parser.add_argument(
        "--parking-json",
        type=Path,
        help="Same parking annotation JSON for every selected camera."
    )
    parser.add_argument(
        "--export-dir",
        type=Path,
        default=DEFAULT_EXPORT_DIR,
        help="Parent directory; each camera gets its own result folder."
    )
    parser.add_argument(
        "--max-frames",
        type=int,
        default=0,
        help="Stop every worker after this many frames; 0 means keep running."
    )
    parser.add_argument(
        "--no-export",
        action="store_true",
        help="Disable final result export in every worker."
    )
    return parser.parse_args()


def _camera_key(camera: dict, index: int) -> str:
    raw = str(camera.get("NO", "")).strip() or str(index)
    return "".join(char if char.isalnum() or char in "-_" else "_" for char in raw)


def _build_command(args: argparse.Namespace, camera: dict, export_dir: Path) -> List[str]:
    command = [
        sys.executable,
        str(PROJECT_DIR / "parkng_model.py"),
        "--video",
        str(camera[RTSP_FIELD]),
        "--camera",
        str(camera.get("NO", "")),
        "--cctv-json",
        str(args.cctv_json),
        "--parking",
        args.parking,
        "--export-dir",
        str(export_dir),
    ]
    if args.parking_json:
        command.extend(["--parking-json", str(args.parking_json)])
    if args.max_frames:
        command.extend(["--max-frames", str(args.max_frames)])
    if args.no_export:
        command.append("--no-export")
    return command


def _load_profile(name: str) -> dict:
    path = PROFILE_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Profile not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _profile_command(args: argparse.Namespace, profile: dict) -> List[str]:
    camera_json = _resolve_profile_path(profile["cctv_json"], "cctv")
    cameras = load_cameras(camera_json)
    camera = select_camera(cameras, str(profile["camera"]))
    command = _build_command(
        args,
        camera,
        args.export_dir / f"camera_{_camera_key(camera, 1)}_{profile['name']}"
    )
    command[command.index("--cctv-json") + 1] = str(camera_json)
    parking_json = _resolve_profile_path(profile["parking_json"], "parking")
    command.extend(["--parking-json", str(parking_json)])
    selected_slots = profile.get("parking_slots", [])
    if selected_slots:
        command.extend(["--parking-slots", ",".join(selected_slots)])
    return command


def main() -> int:
    args = parse_args()
    jobs = []
    if args.active:
        if not ACTIVE_PROFILE.exists():
            raise SystemExit(
                "No confirmed profile found. Create one first:\n"
                "  parking_profiles.bat create\n"
                "  parking_profiles.bat list\n"
                "  parking_profiles.bat confirm\n"
                "Then run: run_multi_camera.bat --active"
            )
        active_profiles = json.loads(ACTIVE_PROFILE.read_text(encoding="utf-8"))
        if isinstance(active_profiles, dict):
            active_profiles = [active_profiles]
        jobs = [
            (profile, _profile_command(args, profile))
            for profile in active_profiles
        ]
    elif args.profiles:
            jobs = [
                (profile, _profile_command(args, _load_profile(profile.strip())))
                for profile in args.profiles.split(",")
                if profile.strip()
            ]
    else:
        if not args.cameras:
            raise SystemExit("Provide --profiles PROFILE1,PROFILE2 or --cameras 1,2,3")
        cameras = load_cameras(args.cctv_json)
        requested = [value.strip() for value in args.cameras.split(",") if value.strip()]
        selected = [select_camera(cameras, value) for value in requested]
        jobs = [(camera, _build_command(args, camera, args.export_dir / f"camera_{_camera_key(camera, index)}")) for index, camera in enumerate(selected, start=1)]

    processes = []
    try:
        for owner, command in jobs:
            print(f"Starting camera: {owner.get('name', camera_label(owner)) if isinstance(owner, dict) else owner}")
            processes.append(subprocess.Popen(command, cwd=PROJECT_DIR))

        while processes:
            processes = [process for process in processes if process.poll() is None]
            if processes:
                signal.pause() if hasattr(signal, "pause") else processes[0].wait()
    except KeyboardInterrupt:
        print("Stopping all camera workers...")
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
