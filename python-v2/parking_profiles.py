"""Create, edit, select, confirm, and inspect CCTV parking profiles.

The interactive flow is intentionally the same for one or many cameras:
create/edit -> select saved profile(s) -> confirm -> run active profile(s).
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from cctv_viewer import camera_label, load_cameras, select_camera
from project_paths import (
    ACTIVE_FILE,
    CCTV_SOURCE_DIR,
    DEFAULT_CCTV_JSON,
    PARKING_SLOT_DIR,
    PROFILE_DIR,
    PROJECT_ROOT,
    SELECTION_FILE,
    resolve_project_path,
)

_RESERVED_FILES = {ACTIVE_FILE.name, SELECTION_FILE.name}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip())
    if not value:
        raise ValueError("Profile name cannot be empty.")
    return value


def _read_json(path: Path) -> Any:
    with Path(path).open("r", encoding="utf-8-sig") as file:
        return json.load(file)


def _write_json(path: Path, payload: Any) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return path


def _portable_path(path: Path) -> str:
    """Store project-local paths relatively so the whole folder can move."""
    path = Path(path).resolve()
    try:
        return path.relative_to(PROJECT_ROOT.resolve()).as_posix()
    except ValueError:
        return str(path)


def _resolve_cctv_path(value: str) -> Path:
    return resolve_project_path(value, preferred_dir=CCTV_SOURCE_DIR)


def _resolve_parking_path(value: str) -> Path:
    return resolve_project_path(value, preferred_dir=PARKING_SLOT_DIR)


def _profile_entries() -> List[Tuple[int, Path, Dict[str, Any]]]:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    paths = [
        path
        for path in sorted(PROFILE_DIR.glob("*.json"), key=lambda item: item.name.lower())
        if path.name not in _RESERVED_FILES
    ]
    entries = []
    for index, path in enumerate(paths, start=1):
        try:
            profile = _read_json(path)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"[WARN] Skipping invalid profile {path.name}: {exc}")
            continue
        if isinstance(profile, dict):
            entries.append((index, path, profile))
    return entries


def load_profiles() -> List[Dict[str, Any]]:
    return [profile for _, _, profile in _profile_entries()]


def _camera_summary(profile: Dict[str, Any]) -> str:
    cctv_value = str(profile.get("cctv_json", ""))
    camera_value = str(profile.get("camera", ""))
    try:
        cctv_path = _resolve_cctv_path(cctv_value)
        cameras = load_cameras(cctv_path)
        camera = select_camera(cameras, camera_value)
        return camera_label(camera, show_source=True)
    except (Exception, SystemExit):
        return f"camera={camera_value or '-'} | cctv={cctv_value or '-'}"


def _print_profile_rows(entries: Sequence[Tuple[int, Path, Dict[str, Any]]]) -> None:
    if not entries:
        print("No saved CCTV profiles.")
        return
    for index, path, profile in entries:
        print(
            f"  [{index}] {profile.get('name', path.stem)}"
            f" | {_camera_summary(profile)}"
            f" | file={path.name}"
        )


def _read_state(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"version": 2, "profiles": []}
    data = _read_json(path)
    if isinstance(data, dict) and isinstance(data.get("profiles"), list):
        return data
    # Legacy active.json: one profile dict or a raw list of profile dicts.
    if isinstance(data, list):
        profiles = data
    elif isinstance(data, dict):
        profiles = [data]
    else:
        profiles = []
    normalized = []
    for index, profile in enumerate(profiles, 1):
        if isinstance(profile, dict):
            item = dict(profile)
            item.setdefault("selection_index", index)
            item.setdefault("profile_file", f"{_safe_name(str(item.get('name', index)))}.json")
            normalized.append(item)
    return {"version": 2, "profiles": normalized}


def load_active_profiles() -> List[Dict[str, Any]]:
    return list(_read_state(ACTIVE_FILE).get("profiles", []))


def load_selected_profiles() -> List[Dict[str, Any]]:
    return list(_read_state(SELECTION_FILE).get("profiles", []))


def print_active() -> None:
    profiles = load_active_profiles()
    print("\n=== CONFIRMED ACTIVE CCTV ===")
    if not profiles:
        print("  none")
        return
    for order, profile in enumerate(profiles, 1):
        source_index = profile.get("selection_index", order)
        print(
            f"  [{order}] saved-index={source_index}"
            f" | {profile.get('name', '-')}"
            f" | {_camera_summary(profile)}"
        )


def print_pending_selection() -> None:
    profiles = load_selected_profiles()
    print("\n=== PENDING SELECTION (not confirmed yet) ===")
    if not profiles:
        print("  none")
        return
    for order, profile in enumerate(profiles, 1):
        print(
            f"  [{order}] saved-index={profile.get('selection_index', '-')}"
            f" | {profile.get('name', '-')}"
            f" | {_camera_summary(profile)}"
        )


def _prompt(label: str, current: str = "") -> str:
    suffix = f" [{current}]" if current else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or current


def _select_slots(parking_json: Path, current: Optional[Sequence[str]] = None) -> List[str]:
    data = _read_json(parking_json)
    categories = {
        int(item["id"]): item.get("name", "")
        for item in data.get("categories", [])
        if item.get("name", "").lower() != "parking-slot"
    }
    names = [name for _, name in sorted(categories.items()) if name]
    print("Available parking slots:")
    for index, name in enumerate(names, 1):
        marker = " *" if current and name in current else ""
        print(f"  {index}. {name}{marker}")
    selected = input("Select slots by number/prefix, 'all', or Enter to keep current: ").strip()
    if not selected:
        return list(current or [])
    if selected.lower() == "all":
        return []
    if selected.isdigit() or "," in selected:
        result = []
        for value in selected.split(","):
            value = value.strip()
            if value.isdigit() and 1 <= int(value) <= len(names):
                result.append(names[int(value) - 1])
            elif value and value in names:
                result.append(value)
        return list(dict.fromkeys(result))
    return [name for name in names if name.lower().startswith(selected.lower())]


def create_profile(existing: Optional[Dict[str, Any]] = None) -> Path:
    profile = dict(existing or {})
    old_name = str(profile.get("name", ""))
    profile["name"] = _safe_name(_prompt("Profile name", old_name))

    default_cctv = _portable_path(DEFAULT_CCTV_JSON)
    cctv_value = _prompt("CCTV JSON path", str(profile.get("cctv_json", default_cctv)))
    cctv_path = _resolve_cctv_path(cctv_value)
    if not cctv_path.exists():
        raise FileNotFoundError(f"CCTV JSON not found: {cctv_path}")
    profile["cctv_json"] = _portable_path(cctv_path)

    cameras = load_cameras(cctv_path)
    camera_value = _prompt("Camera NO/name/IP", str(profile.get("camera", "")))
    camera = select_camera(cameras, camera_value)
    # Store the stable camera NO if available; otherwise keep the selector.
    profile["camera"] = str(camera.get("NO", "")).strip() or camera_value
    profile["camera_name"] = str(camera.get("CAMERA NAME_NEW", "")).strip()
    profile["camera_ip"] = str(camera.get("IP ADDRESS", "")).strip()
    print("Selected CCTV:", camera_label(camera, show_source=True))

    parking_current = str(profile.get("parking_json", ""))
    parking_value = _prompt("Parking slots JSON path", parking_current)
    if parking_value:
        parking_path = _resolve_parking_path(parking_value)
        if not parking_path.exists():
            raise FileNotFoundError(f"Parking JSON not found: {parking_path}")
        profile["parking_json"] = _portable_path(parking_path)
        profile["parking_slots"] = _select_slots(
            parking_path,
            current=profile.get("parking_slots", []),
        )
        profile["parking"] = "on"
    else:
        profile["parking_json"] = ""
        profile["parking_slots"] = []
        profile["parking"] = "off"

    profile["updated_at"] = _utc_now()
    profile.setdefault("created_at", profile["updated_at"])
    path = PROFILE_DIR / f"{profile['name']}.json"
    _write_json(path, profile)

    # If editing renamed a profile, remove only the old profile file.
    if old_name and old_name != profile["name"]:
        old_path = PROFILE_DIR / f"{_safe_name(old_name)}.json"
        if old_path.exists() and old_path != path:
            old_path.unlink()
    return path


def _parse_profile_selection(value: str) -> List[Dict[str, Any]]:
    entries = _profile_entries()
    if not entries:
        raise FileNotFoundError("No saved profiles found. Create one first.")

    by_index = {index: (path, profile) for index, path, profile in entries}
    by_name = {
        str(profile.get("name", path.stem)).lower(): (index, path, profile)
        for index, path, profile in entries
    }
    tokens = [token.strip() for token in value.split(",") if token.strip()]
    if not tokens:
        raise ValueError("No profile selected.")

    selected = []
    used_files = set()
    for token in tokens:
        if token.isdigit() and int(token) in by_index:
            index = int(token)
            path, profile = by_index[index]
        else:
            match = by_name.get(token.lower())
            if match is None:
                raise ValueError(f"Unknown saved profile: {token}")
            index, path, profile = match
        if path.name in used_files:
            continue
        item = dict(profile)
        item["selection_index"] = index
        item["profile_file"] = path.name
        selected.append(item)
        used_files.add(path.name)
    return selected


def select_saved_profiles(value: Optional[str] = None) -> Path:
    entries = _profile_entries()
    print("\n=== SAVED CCTV PROFILES ===")
    _print_profile_rows(entries)
    if not entries:
        raise FileNotFoundError("No saved profiles found.")
    if value is None:
        value = input("Select one or more saved profile numbers (example 1 or 1,3): ").strip()
    selected = _parse_profile_selection(value)
    payload = {
        "version": 2,
        "selected_at": _utc_now(),
        "profiles": selected,
    }
    _write_json(SELECTION_FILE, payload)
    print_pending_selection()
    return SELECTION_FILE


def confirm_selection(*, confirm_all: bool = False) -> Path:
    if confirm_all:
        entries = _profile_entries()
        if not entries:
            raise FileNotFoundError("No saved profiles found.")
        selected = []
        for index, path, profile in entries:
            item = dict(profile)
            item["selection_index"] = index
            item["profile_file"] = path.name
            selected.append(item)
    else:
        selected = load_selected_profiles()
        if not selected:
            raise FileNotFoundError(
                "No pending selection. Use option 3 (load/select saved CCTV) first."
            )

    payload = {
        "version": 2,
        "confirmed_at": _utc_now(),
        "profiles": selected,
    }
    _write_json(ACTIVE_FILE, payload)
    print("Confirmed active CCTV selection ->", ACTIVE_FILE)
    print_active()
    return ACTIVE_FILE


def edit_profile(value: Optional[str] = None) -> Path:
    entries = _profile_entries()
    print("\n=== EDIT SAVED PROFILE ===")
    _print_profile_rows(entries)
    if not entries:
        raise FileNotFoundError("No saved profiles found.")
    if not value:
        value = input("Choose profile number or name to edit: ").strip()
    selected = _parse_profile_selection(value)
    if len(selected) != 1:
        raise ValueError("Edit exactly one profile at a time.")
    return create_profile(selected[0])


def interactive_menu() -> str:
    """Return 'start' when the caller should launch active CCTV workers."""
    while True:
        print("\n" + "=" * 72)
        print("PARKING CCTV SETUP")
        print("=" * 72)
        print_active()
        print("\n1. Create CCTV profile")
        print("2. Edit saved CCTV profile")
        print("3. Load / select saved CCTV profile(s)")
        print("4. Confirm selected CCTV profile(s)")
        print("5. Start confirmed CCTV profile(s)")
        print("0. Exit")
        choice = input("Choose: ").strip()

        try:
            if choice == "1":
                print("Saved:", create_profile())
            elif choice == "2":
                print("Saved:", edit_profile())
            elif choice == "3":
                select_saved_profiles()
            elif choice == "4":
                confirm_selection()
            elif choice == "5":
                if not load_active_profiles():
                    print("No confirmed CCTV. Complete option 3 and 4 first.")
                    continue
                return "start"
            elif choice == "0":
                return "exit"
            else:
                print("Invalid option.")
        except (OSError, ValueError, json.JSONDecodeError, SystemExit) as exc:
            print(f"[ERROR] {exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage CCTV parking profiles.")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("menu", help="Open the interactive setup menu.")
    sub.add_parser("list", help="List saved profiles and active selection.")
    sub.add_parser("create", help="Create a CCTV parking profile.")
    edit = sub.add_parser("edit", help="Edit a saved profile by index or name.")
    edit.add_argument("profile", nargs="?")
    select = sub.add_parser("select", help="Stage saved profile(s) for confirmation.")
    select.add_argument("profiles", nargs="?", help="Comma-separated saved indexes or names.")
    confirm = sub.add_parser("confirm", help="Write the staged selection to active.json.")
    confirm.add_argument("--all", action="store_true")
    sub.add_parser("active", help="Show confirmed active CCTV profile(s).")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    command = args.command or "menu"
    if command == "menu":
        return 0 if interactive_menu() == "exit" else 10
    if command == "list":
        _print_profile_rows(_profile_entries())
        print_active()
    elif command == "create":
        print("Saved:", create_profile())
    elif command == "edit":
        print("Saved:", edit_profile(args.profile))
    elif command == "select":
        select_saved_profiles(args.profiles)
    elif command == "confirm":
        confirm_selection(confirm_all=args.all)
    elif command == "active":
        print_active()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
