"""Run the parking model with the same supervisor for one or many CCTV cameras."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
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
_BACKEND_PROFILE_TEMP = None
_NO_PROFILE_NOTICE_SHOWN = False
_INVALID_PROFILE_NOTICES = set()
BACKEND_PROFILE_REFRESH_SECONDS = 2.0


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
        "--backend-presets",
        action="store_true",
        help="Use CCTV presets configured in the parking-management backend.",
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


def _prepare_jobs(args: argparse.Namespace, profiles: List[Dict[str, Any]] | None = None):
    profiles = profiles if profiles is not None else _load_jobs(args)
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
                "disabled_slot_file": export_dir / "disabled-parking-slots.json",
                "slot_status_refresh_file": export_dir / "refresh-parking-slot-status.json",
                "runtime_frame_file": _runtime_frame_path(
                    str(camera.get("NO", "")).strip()
                    or str(profile.get("camera", "")).strip(),
                    str(profile.get("cctvFileName") or cctv_path.name),
                ),
                "parking_enabled": parking_enabled,
                "parking_slot_names": parking_slot_names,
                "process": None,
                "restarts": 0,
                "next_start": 0.0,
                "desired_enabled": None,
                "runtime_status": "Offline",
                "runtime_message": "",
                "slot_status_refresh_version": int(profile.get("slotStatusRefreshVersion") or 0),
            }
        )
    return prepared


def _load_backend_profiles(client: ModelRuntimeClient) -> List[Dict[str, Any]]:
    global _BACKEND_PROFILE_TEMP, _NO_PROFILE_NOTICE_SHOWN
    remote_profiles = client.fetch_profiles()["profiles"]
    if _BACKEND_PROFILE_TEMP is None:
        _BACKEND_PROFILE_TEMP = tempfile.TemporaryDirectory(
            prefix="parking_backend_presets_"
        )
    runtime_dir = Path(_BACKEND_PROFILE_TEMP.name)
    profiles = []

    for item in remote_profiles:
        camera_no = str(item.get("cameraNo") or "").strip()
        source_name = str(item.get("cctvFileName") or "").strip()
        stream_url = str(item.get("rtspLink") or "").strip()
        slot_data = item.get("parkingSlotData")
        if isinstance(slot_data, str):
            try:
                slot_data = json.loads(slot_data)
            except json.JSONDecodeError:
                slot_data = None
        categories = slot_data.get("categories") if isinstance(slot_data, dict) else None
        annotations = slot_data.get("annotations") if isinstance(slot_data, dict) else None
        if (
            not camera_no
            or not source_name
            or not stream_url
            or not isinstance(slot_data, dict)
            or not isinstance(categories, list)
            or not isinstance(annotations, list)
            or not annotations
        ):
            if item.get("modelEnabled"):
                notice = (
                    f"[YOLO control] Preset {item.get('name') or camera_no or '-'} "
                    "is missing its camera number, CCTV source, RTSP link, or parking-slot JSON."
                )
                if notice not in _INVALID_PROFILE_NOTICES:
                    print(notice)
                    _INVALID_PROFILE_NOTICES.add(notice)
            continue

        source_filename = "cctv-source.json"
        folder = runtime_dir / (
            f"{_safe_component(item.get('floorId', 'floor'))}_"
            f"{_safe_component(item.get('cameraPresetId', camera_no))}"
        )
        folder.mkdir(parents=True, exist_ok=True)
        cctv_path = folder / source_filename
        parking_path = folder / "parking-slots.json"
        cctv_record = {
            "NO": camera_no,
            "IP ADDRESS": str(item.get("ipAddress") or ""),
            "CAMERA NAME_NEW": str(item.get("sourceCameraName") or item.get("name") or camera_no),
            "Location": str(item.get("name") or ""),
            "ANPR&PTZ RTSP": stream_url,
        }
        cctv_path.write_text(json.dumps([cctv_record], ensure_ascii=False), encoding="utf-8")
        parking_path.write_text(json.dumps(slot_data, ensure_ascii=False), encoding="utf-8")
        mapped_names = [
            str(name).strip()
            for name in item.get("mappedParkingSlotNames", [])
            if str(name).strip()
        ]
        profile_name = str(item.get("name") or f"camera_{camera_no}")
        profiles.append(
            {
                "name": profile_name,
                "camera": camera_no,
                "cctv_json": str(cctv_path),
                "cctvFileName": source_name,
                "parking": "on",
                "parking_json": str(parking_path),
                "parking_slots": [],
                "mapped_parking_slots": mapped_names,
                "floorId": str(item.get("floorId") or ""),
                "cameraPresetId": str(item.get("cameraPresetId") or ""),
                "slotStatusRefreshVersion": int(item.get("slotStatusRefreshVersion") or 0),
            }
        )

    if not profiles and not _NO_PROFILE_NOTICE_SHOWN:
        if remote_profiles:
            print(
                "[YOLO control] No usable backend CCTV presets yet; "
                "waiting for valid camera and parking-slot data."
            )
        else:
            print("[YOLO control] No backend CCTV presets yet; waiting for preset creation.")
        _NO_PROFILE_NOTICE_SHOWN = True
    elif profiles:
        _NO_PROFILE_NOTICE_SHOWN = False
    return profiles


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
        environment["PARKING_RUNTIME_DISABLED_SLOT_FILE"] = str(job["disabled_slot_file"])
        environment["PARKING_RUNTIME_SLOT_STATUS_REFRESH_FILE"] = str(job["slot_status_refresh_file"])
        environment["PARKING_RUNTIME_ID"] = runtime_id
        environment["PARKING_RUNTIME_FRAME_FILE"] = str(frame_file)
        if profile.get("cctvFileName"):
            environment["PARKING_RUNTIME_CCTV_FILE_NAME"] = str(profile["cctvFileName"])
        if "mapped_parking_slots" in profile:
            environment["PARKING_RUNTIME_MAPPED_SLOT_NAMES"] = json.dumps(
                profile["mapped_parking_slots"], ensure_ascii=False
            )
        else:
            environment.pop("PARKING_RUNTIME_MAPPED_SLOT_NAMES", None)
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


def _write_disabled_slot_state(
    path: Path,
    disabled_names: List[str],
    mapped_names: List[str] | None = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(
            {
                "disabledParkingSlotNames": disabled_names,
                "mappedParkingSlotNames": mapped_names or [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def _run_remote_controlled(
    jobs: List[Dict[str, Any]],
    client: ModelRuntimeClient,
    args: argparse.Namespace,
) -> int:
    runtime_id = uuid.uuid4().hex
    if not jobs:
        try:
            jobs = _prepare_jobs(args, _load_backend_profiles(client))
        except RuntimeError as error:
            print(f"[YOLO control] Initial preset load failed; entering standby: {error}")
            jobs = []

    def runtime_profile(job: Dict[str, Any]) -> Dict[str, Any]:
        camera = job["camera"]
        cctv_path, _ = _resolve_camera(job["profile"])
        return {
            "cameraNo": str(camera.get("NO", "")).strip()
            or str(job["profile"].get("camera", "")).strip(),
            "cctvFileName": str(job["profile"].get("cctvFileName") or cctv_path.name),
            "profileName": str(job["profile"].get("name", "")),
            "parkingEnabled": job["parking_enabled"],
            "parkingSlotNames": job["parking_slot_names"],
        }

    identities = {
        _runtime_identity(
            runtime_profile(job)["cameraNo"], runtime_profile(job)["cctvFileName"]
        ): job
        for job in jobs
    }
    last_inventory_refresh = time.monotonic()
    next_sync = 0.0
    print("\nYOLO runtime is online and waiting for backend CCTV presets.")

    try:
        while True:
            now = time.monotonic()
            if now >= next_sync:
                if now - last_inventory_refresh >= BACKEND_PROFILE_REFRESH_SECONDS:
                    try:
                        previous_keys = set(identities)
                        refreshed_jobs = _prepare_jobs(
                            args, _load_backend_profiles(client)
                        )
                        refreshed_by_identity = {}
                        for refreshed in refreshed_jobs:
                            profile = runtime_profile(refreshed)
                            key = _runtime_identity(
                                profile["cameraNo"], profile["cctvFileName"]
                            )
                            existing = identities.get(key)
                            if existing is not None:
                                for field in (
                                    "profile",
                                    "camera",
                                    "parking_enabled",
                                    "parking_slot_names",
                                ):
                                    existing[field] = refreshed[field]
                                refreshed_by_identity[key] = existing
                            else:
                                refreshed_by_identity[key] = refreshed

                        for key, old_job in identities.items():
                            if key not in refreshed_by_identity:
                                _stop_job(old_job)
                        identities = refreshed_by_identity
                        jobs = list(identities.values())
                        if set(identities) != previous_keys:
                            print(
                                f"[YOLO control] Backend preset inventory refreshed: {len(jobs)} usable preset(s)."
                            )
                    except (RuntimeError, OSError, ValueError) as error:
                        print(f"[YOLO control] Could not refresh backend presets: {error}")
                    last_inventory_refresh = now

                profile_payload = [runtime_profile(job) for job in jobs]
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
                        if command is not None:
                            try:
                                disabled_names = command.get("disabledParkingSlotNames", [])
                                if not isinstance(disabled_names, list):
                                    disabled_names = []
                                mapped_names = command.get("mappedParkingSlotNames", [])
                                if not isinstance(mapped_names, list):
                                    mapped_names = []
                                _write_disabled_slot_state(
                                    Path(job["disabled_slot_file"]),
                                    [str(name).strip() for name in disabled_names if str(name).strip()],
                                    [str(name).strip() for name in mapped_names if str(name).strip()],
                                )
                            except OSError as error:
                                print(
                                    f"[YOLO control] Could not update disabled parking slots: {error}"
                                )
                            try:
                                refresh_version = int(command.get("slotStatusRefreshVersion") or 0)
                                if refresh_version > job.get("slot_status_refresh_version", 0):
                                    marker = Path(job["slot_status_refresh_file"])
                                    marker.parent.mkdir(parents=True, exist_ok=True)
                                    temporary_marker = marker.with_suffix(marker.suffix + ".tmp")
                                    temporary_marker.write_text(
                                        json.dumps({"version": refresh_version}),
                                        encoding="utf-8",
                                    )
                                    temporary_marker.replace(marker)
                                    job["slot_status_refresh_version"] = refresh_version
                            except (OSError, TypeError, ValueError) as error:
                                print(f"[YOLO control] Could not request slot-status refresh: {error}")
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
                next_sync = now + 0.5

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
    runtime_client = ModelRuntimeClient.from_environment()
    if args.backend_presets and runtime_client is None:
        raise SystemExit("Backend CCTV mode requires PARKING_MODEL_API_KEY and API URLs.")
    if args.backend_presets:
        return _run_remote_controlled([], runtime_client, args)

    jobs = _prepare_jobs(args)
    if not jobs:
        raise SystemExit("No CCTV jobs to run.")

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
