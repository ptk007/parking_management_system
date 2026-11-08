"""Run the parking model with the same supervisor for one or many CCTV cameras."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Tuple

from cctv_viewer import camera_label, load_cameras, select_camera
from parking_model_events import ModelRuntimeClient
from parking_profiles import load_active_profiles
from project_paths import (
    DEFAULT_CCTV_JSON,
    PROFILE_DIR,
    PROJECT_ROOT,
    RESULTS_DIR,
    resolve_project_path,
    CCTV_SOURCE_DIR,
    PARKING_SLOT_DIR,
)

PROJECT_DIR = Path(__file__).resolve().parent


def _safe_component(value: str) -> str:
    value = str(value).strip()
    cleaned = "".join(char if char.isalnum() or char in "-_" else "_" for char in value)
    return cleaned or "camera"


def _resolve_profile_path(value: str, kind: str) -> Path:
    preferred = CCTV_SOURCE_DIR if kind == "cctv" else PARKING_SLOT_DIR
    return resolve_project_path(value, preferred_dir=preferred)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the parking model using one worker per CCTV camera."
    )
    parser.add_argument(
        "--active",
        action="store_true",
        help="Run confirmed profile(s) from cctv/parking-cam/active.json.",
    )
    parser.add_argument(
        "--profiles",
        help="Comma-separated saved profile names. Active profiles are preferred for normal use.",
    )
    parser.add_argument(
        "--cameras",
        help="Comma-separated camera NO/list-index/name/IP from --cctv-json.",
    )
    parser.add_argument("--cctv-json", type=Path, default=DEFAULT_CCTV_JSON)
    parser.add_argument("--parking", choices=("on", "off"), default="on")
    parser.add_argument("--parking-json", type=Path)
    parser.add_argument("--export-dir", type=Path, default=RESULTS_DIR)
    parser.add_argument("--max-frames", type=int, default=0)
    parser.add_argument("--no-export", action="store_true")
    parser.add_argument(
        "--restart-on-failure",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Restart a failed CCTV worker automatically (default: enabled).",
    )
    parser.add_argument("--restart-delay", type=float, default=3.0)
    parser.add_argument("--max-restarts", type=int, default=5)
    return parser.parse_args()


def _profile_from_file(name: str) -> Dict[str, Any]:
    path = PROFILE_DIR / f"{name}.json"
    if not path.exists():
        # Accept an exact file stem/case from the saved directory.
        candidates = [p for p in PROFILE_DIR.glob("*.json") if p.stem.lower() == name.lower()]
        if not candidates:
            raise FileNotFoundError(f"Profile not found: {path}")
        path = candidates[0]
    profile = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(profile, dict):
        raise ValueError(f"Invalid profile: {path}")
    profile.setdefault("profile_file", path.name)
    return profile


def _load_jobs(args: argparse.Namespace) -> List[Dict[str, Any]]:
    if args.profiles:
        return [
            _profile_from_file(value.strip())
            for value in args.profiles.split(",")
            if value.strip()
        ]

    if args.cameras:
        cctv_path = _resolve_profile_path(str(args.cctv_json), "cctv")
        cameras = load_cameras(cctv_path)
        jobs = []
        for index, value in enumerate(
            (part.strip() for part in args.cameras.split(",") if part.strip()),
            start=1,
        ):
            camera = select_camera(cameras, value)
            jobs.append(
                {
                    "name": f"camera_{_safe_component(camera.get('NO') or index)}",
                    "camera": str(camera.get("NO", "")).strip() or value,
                    "camera_name": str(camera.get("CAMERA NAME_NEW", "")).strip(),
                    "camera_ip": str(camera.get("IP ADDRESS", "")).strip(),
                    "cctv_json": str(cctv_path),
                    "parking": args.parking,
                    "parking_json": str(args.parking_json or ""),
                    "parking_slots": [],
                    "selection_index": index,
                }
            )
        return jobs

    # Normal runtime path: always use active.json, whether one or many cameras.
    active = load_active_profiles()
    if not active:
        raise SystemExit(
            "No confirmed CCTV profile. Run run.bat, then complete Select + Confirm first."
        )
    return active


def _resolve_camera(profile: Dict[str, Any]) -> Tuple[Path, Dict[str, Any]]:
    cctv_path = _resolve_profile_path(str(profile.get("cctv_json", DEFAULT_CCTV_JSON)), "cctv")
    cameras = load_cameras(cctv_path)
    camera = select_camera(cameras, str(profile.get("camera", "")))
    return cctv_path, camera


def _result_dir(parent: Path, profile: Dict[str, Any], camera: Dict[str, Any]) -> Path:
    profile_name = _safe_component(profile.get("name", "profile"))
    camera_no = _safe_component(camera.get("NO", "camera"))
    return Path(parent) / f"{profile_name}__camera_{camera_no}"


def _runtime_frame_path(camera_no: str, cctv_file_name: str) -> Path:
    identity = f"{camera_no.strip().lower()}\0{cctv_file_name.strip().lower()}"
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
    return Path(RESULTS_DIR) / "runtime_frames" / f"{digest}.jpg"


def _build_command(
    args: argparse.Namespace,
    profile: Dict[str, Any],
    cctv_path: Path,
    camera: Dict[str, Any],
) -> List[str]:
    export_dir = _result_dir(args.export_dir, profile, camera)
    command = [
        sys.executable,
        str(PROJECT_DIR / "parkng_model.py"),
        "--camera",
        str(camera.get("NO", "")).strip() or str(profile.get("camera", "")),
        "--cctv-json",
        str(cctv_path),
        "--parking",
        str(profile.get("parking", "on")),
        "--export-dir",
        str(export_dir),
        "--profile-name",
        str(profile.get("name", "")),
    ]

    parking_value = str(profile.get("parking_json", "")).strip()
    if parking_value:
        parking_path = _resolve_profile_path(parking_value, "parking")
        command.extend(["--parking-json", str(parking_path)])

    selected_slots = profile.get("parking_slots") or []
    if selected_slots:
        command.extend(["--parking-slots", ",".join(map(str, selected_slots))])

    if args.max_frames:
        command.extend(["--max-frames", str(args.max_frames)])
    if args.no_export:
        command.append("--no-export")
    return command


def _profile_parking_inventory(
    args: argparse.Namespace,
    profile: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    if str(profile.get("parking", "on")).lower() != "on":
        return False, []
    parking_value = str(profile.get("parking_json", "")).strip()
    parking_path = (
        _resolve_profile_path(parking_value, "parking")
        if parking_value
        else _resolve_profile_path(str(args.parking_json or ""), "parking")
        if args.parking_json
        else DEFAULT_PARKING_JSON
    )
    try:
        data = json.loads(parking_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return False, []
    categories = data.get("categories") if isinstance(data, dict) else None
    if not isinstance(categories, list):
        return False, []
    names = list(
        dict.fromkeys(
            category["name"].strip()
            for category in categories
            if isinstance(category, dict)
            and category.get("supercategory") == "parking-slot"
            and isinstance(category.get("name"), str)
            and category["name"].strip()
        )
    )
    selected = [str(name).strip() for name in profile.get("parking_slots", []) if str(name).strip()]
    if selected:
        names = [name for name in names if name in selected]
    return bool(names), names


def _prepare_jobs(args: argparse.Namespace):
    profiles = _load_jobs(args)
    prepared = []
    seen = set()
    for order, profile in enumerate(profiles, 1):
        cctv_path, camera = _resolve_camera(profile)
        unique = (str(cctv_path.resolve()).lower(), str(camera.get("NO", "")).strip())
        if unique in seen:
            print(f"[WARN] Duplicate CCTV skipped: {camera_label(camera, show_source=True)}")
            continue
        seen.add(unique)
        parking_enabled, parking_slot_names = _profile_parking_inventory(args, profile)
        export_dir = _result_dir(args.export_dir, profile, camera)
        prepared.append(
            {
                "order": order,
                "profile": profile,
                "camera": camera,
                "command": _build_command(args, profile, cctv_path, camera),
                "status_file": export_dir / "model-runtime-status.json",
                "runtime_frame_file": _runtime_frame_path(
                    str(camera.get("NO", "")).strip()
                    or str(profile.get("camera", "")).strip(),
                    cctv_path.name,
                ),
                "parking_enabled": parking_enabled,
                "parking_slot_names": parking_slot_names,
                "process": None,
                "restarts": 0,
                "next_start": 0.0,
                "desired_enabled": None,
                "runtime_status": "Offline",
                "runtime_message": "",
            }
        )
    return prepared


def _start_job(
    job: Dict[str, Any],
    runtime_id: str = "",
) -> None:
    profile = job["profile"]
    camera = job["camera"]
    print(
        f"Starting [{job['order']}] {profile.get('name', '-')}"
        f" -> {camera_label(camera, show_source=True)}"
    )
    environment = os.environ.copy()
    if runtime_id:
        status_file = Path(job["status_file"])
        frame_file = Path(job["runtime_frame_file"])
        status_file.parent.mkdir(parents=True, exist_ok=True)
        status_file.unlink(missing_ok=True)
        frame_file.parent.mkdir(parents=True, exist_ok=True)
        frame_file.unlink(missing_ok=True)
        environment["PARKING_RUNTIME_STATUS_FILE"] = str(status_file)
        environment["PARKING_RUNTIME_ID"] = runtime_id
        environment["PARKING_RUNTIME_FRAME_FILE"] = str(frame_file)
    job["process"] = subprocess.Popen(
        job["command"],
        cwd=PROJECT_DIR,
        env=environment,
    )
    job["runtime_status"] = "Starting"
    job["runtime_message"] = ""


def _job_runtime_status(job: Dict[str, Any]) -> Dict[str, str]:
    process = job.get("process")
    if process is not None and process.poll() is not None:
        code = process.returncode
        return {
            "status": "Error" if code else "Offline",
            "message": f"YOLO worker exited with code {code}" if code else "",
        }
    if process is None:
        status = job.get("runtime_status", "Offline")
        if job.get("desired_enabled") and status == "Offline":
            status = "Starting"
        return {"status": status, "message": job.get("runtime_message", "")}
    try:
        data = json.loads(Path(job["status_file"]).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"status": "Starting", "message": ""}
    except (OSError, json.JSONDecodeError) as error:
        return {"status": "Error", "message": f"Invalid worker status file: {error}"}
    status = data.get("status")
    if status not in {"Offline", "Starting", "Online", "Error"}:
        return {"status": "Error", "message": "Worker reported an invalid status"}
    return {
        "status": status,
        "message": str(data.get("message", ""))[:500],
    }


def _stop_job(job: Dict[str, Any]) -> None:
    process = job.get("process")
    if process is not None and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    job["process"] = None
    job["runtime_status"] = "Offline"
    job["runtime_message"] = ""
    try:
        Path(job["runtime_frame_file"]).unlink(missing_ok=True)
    except OSError as error:
        print(f"[YOLO control] Could not remove stale model preview frame: {error}")


def _runtime_identity(camera_no: str, cctv_file_name: str) -> Tuple[str, str]:
    return camera_no.strip().lower(), cctv_file_name.strip().lower()


def _run_remote_controlled(
    jobs: List[Dict[str, Any]],
    client: ModelRuntimeClient,
    args: argparse.Namespace,
) -> int:
    runtime_id = uuid.uuid4().hex
    profile_payload = []
    for job in jobs:
        camera = job["camera"]
        cctv_path, _ = _resolve_camera(job["profile"])
        profile_payload.append(
            {
                "cameraNo": str(camera.get("NO", "")).strip()
                or str(job["profile"].get("camera", "")).strip(),
                "cctvFileName": cctv_path.name,
                "profileName": str(job["profile"].get("name", "")),
                "parkingEnabled": job["parking_enabled"],
                "parkingSlotNames": job["parking_slot_names"],
            }
        )

    identities = {
        _runtime_identity(item["cameraNo"], item["cctvFileName"]): job
        for item, job in zip(profile_payload, jobs)
    }
    next_sync = 0.0
    print("\nYOLO remote control is enabled. Waiting for backend camera commands.")

    try:
        while True:
            now = time.monotonic()
            if now >= next_sync:
                workers = []
                for profile in profile_payload:
                    job = identities[
                        _runtime_identity(profile["cameraNo"], profile["cctvFileName"])
                    ]
                    state = _job_runtime_status(job)
                    job["runtime_status"] = state["status"]
                    job["runtime_message"] = state["message"]
                    workers.append(
                        {
                            "cameraNo": profile["cameraNo"],
                            "cctvFileName": profile["cctvFileName"],
                            **state,
                        }
                    )

                response = client.sync(
                    {
                        "runtimeId": runtime_id,
                        "profiles": profile_payload,
                        "workers": workers,
                    }
                )
                if response is not None:
                    commands = {
                        _runtime_identity(item.get("cameraNo", ""), item.get("cctvFileName", "")): item
                        for item in response["commands"]
                    }
                    for issue in response.get("issues", []):
                        print(
                            "[YOLO control] "
                            f"{issue.get('cameraNo', '-')}: {issue.get('message', 'Profile binding failed')}"
                        )
                    for key, job in identities.items():
                        command = commands.get(key)
                        previous_desired = job.get("desired_enabled")
                        if command is None:
                            desired = False
                            command_message = "No matching CCTV preset is configured"
                        else:
                            desired = bool(command.get("enabled") and command.get("runnable"))
                            command_message = str(command.get("message", ""))
                        if desired and previous_desired is not True:
                            job["restarts"] = 0
                            job["next_start"] = 0.0
                        job["desired_enabled"] = desired
                        if not desired:
                            _stop_job(job)
                            if command is None or (
                                command.get("enabled") and not command.get("runnable")
                            ):
                                job["runtime_status"] = "Error"
                                job["runtime_message"] = command_message
                        elif job.get("process") is None and job.get("next_start", 0.0) != float("inf"):
                            job["next_start"] = min(job.get("next_start", 0.0), now)
                next_sync = now + 3.0

            now = time.monotonic()
            for job in jobs:
                if not job.get("desired_enabled"):
                    continue
                process = job.get("process")
                if process is not None and process.poll() is not None:
                    code = process.returncode
                    job["process"] = None
                    try:
                        Path(job["runtime_frame_file"]).unlink(missing_ok=True)
                    except OSError as error:
                        print(f"[YOLO control] Could not remove stale model preview frame: {error}")
                    job["runtime_status"] = "Error" if code else "Offline"
                    job["runtime_message"] = (
                        f"YOLO worker exited with code {code}" if code else "YOLO worker stopped unexpectedly"
                    )
                    if job["restarts"] < max(0, args.max_restarts):
                        job["restarts"] += 1
                        job["next_start"] = now + max(0.1, args.restart_delay)
                        print(
                            f"[WARN] YOLO worker stopped: {job['profile'].get('name', '-')}; "
                            f"restart {job['restarts']}/{args.max_restarts} in {args.restart_delay:.1f}s"
                        )
                    else:
                        job["next_start"] = float("inf")
                        print(
                            f"[ERROR] YOLO worker restart limit reached: {job['profile'].get('name', '-')}"
                        )
                if (
                    job.get("process") is None
                    and job.get("next_start", 0.0) != float("inf")
                    and now >= job.get("next_start", 0.0)
                ):
                    try:
                        _start_job(job, runtime_id)
                    except OSError as error:
                        job["runtime_status"] = "Error"
                        job["runtime_message"] = f"Could not start YOLO worker: {error}"
                        job["restarts"] += 1
                        job["next_start"] = (
                            now + max(0.1, args.restart_delay)
                            if job["restarts"] < max(0, args.max_restarts)
                            else float("inf")
                        )
                        print(f"[YOLO control] {job['runtime_message']}")
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping all remotely controlled YOLO workers...")
    finally:
        for job in jobs:
            _stop_job(job)
        client.sync(
            {
                "runtimeId": runtime_id,
                "profiles": profile_payload,
                "workers": [
                    {
                        "cameraNo": item["cameraNo"],
                        "cctvFileName": item["cctvFileName"],
                        "status": "Offline",
                        "message": "Python runtime stopped",
                    }
                    for item in profile_payload
                ],
            }
        )
    return 0


def main() -> int:
    args = parse_args()
    jobs = _prepare_jobs(args)
    if not jobs:
        raise SystemExit("No CCTV jobs to run.")

    runtime_client = ModelRuntimeClient.from_environment()
    if runtime_client is not None:
        return _run_remote_controlled(jobs, runtime_client, args)

    print("\n=== ACTIVE CCTV WORKERS ===")
    for job in jobs:
        print(
            f"  [{job['order']}] {job['profile'].get('name', '-')}"
            f" | {camera_label(job['camera'], show_source=True)}"
        )

    for job in jobs:
        _start_job(job)

    try:
        while True:
            alive = 0
            now = time.monotonic()
            for job in jobs:
                process = job.get("process")
                if process is None:
                    next_start = job.get("next_start", 0.0)
                    if next_start == float("inf"):
                        continue
                    if now >= next_start:
                        _start_job(job)
                    alive += 1
                    continue

                code = process.poll()
                if code is None:
                    alive += 1
                    continue

                if code == 0:
                    print(
                        f"Worker stopped normally: {job['profile'].get('name', '-')}"
                    )
                    job["process"] = None
                    job["next_start"] = float("inf")
                    continue

                print(
                    f"[WARN] Worker exited with code {code}: "
                    f"{job['profile'].get('name', '-')}"
                )
                if (
                    args.restart_on_failure
                    and job["restarts"] < max(0, args.max_restarts)
                ):
                    job["restarts"] += 1
                    job["process"] = None
                    job["next_start"] = now + max(0.1, args.restart_delay)
                    alive += 1
                    print(
                        f"       restart {job['restarts']}/{args.max_restarts}"
                        f" in {args.restart_delay:.1f}s"
                    )
                else:
                    job["process"] = None
                    job["next_start"] = float("inf")

            if alive == 0:
                return 0
            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\nStopping all CCTV workers...")
    finally:
        for job in jobs:
            process = job.get("process")
            if process is not None and process.poll() is None:
                process.terminate()
        for job in jobs:
            process = job.get("process")
            if process is None or process.poll() is not None:
                continue
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
