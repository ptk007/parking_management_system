"""Create, edit, load, and confirm CCTV parking profiles."""

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROFILE_DIR = PROJECT_ROOT / "cctv" / "parking-cam"
ACTIVE_FILE = PROFILE_DIR / "active.json"


def _safe_name(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip())
    if not value:
        raise ValueError("Profile name cannot be empty.")
    return value


def _read_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8-sig") as file:
        return json.load(file)


def _write_profile(profile: Dict[str, Any]) -> Path:
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)
    path = PROFILE_DIR / f"{profile['name']}.json"
    path.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_profiles() -> List[Dict[str, Any]]:
    if not PROFILE_DIR.exists():
        return []
    return [
        _read_json(path)
        for path in sorted(PROFILE_DIR.glob("*.json"))
        if path.name != ACTIVE_FILE.name
    ]


def _prompt(label: str, current: str = "") -> str:
    suffix = f" [{current}]" if current else ""
    value = input(f"{label}{suffix}: ").strip()
    return value or current


def _select_slots(parking_json: Path) -> List[str]:
    data = _read_json(parking_json)
    categories = {
        int(item["id"]): item.get("name", "")
        for item in data.get("categories", [])
        if item.get("name", "").lower() != "parking-slot"
    }
    names = [name for name in categories.values() if name]
    print("Available parking slots:")
    for index, name in enumerate(names, 1):
        print(f"  {index}. {name}")
    selected = input("Select slots by number, prefix, or 'all': ").strip()
    if not selected or selected.lower() == "all":
        return []
    if selected.isdigit() or "," in selected:
        result = []
        for value in selected.split(","):
            value = value.strip()
            if value.isdigit() and 1 <= int(value) <= len(names):
                result.append(names[int(value) - 1])
            elif value:
                result.append(value)
        return result
    return [name for name in names if name.lower().startswith(selected.lower())]


def create_profile(existing: Optional[Dict[str, Any]] = None) -> Path:
    profile = dict(existing or {})
    profile["name"] = _safe_name(_prompt("Standalone profile name", profile.get("name", "")))
    profile["cctv_json"] = _prompt("CCTV JSON path", profile.get("cctv_json", "cctv/oldcctvinfo4.json"))
    profile["camera"] = _prompt("Camera NO/name/IP", str(profile.get("camera", "")))
    profile["parking_json"] = _prompt("Parking slots JSON path", profile.get("parking_json", ""))
    parking_json = Path(profile["parking_json"])
    if parking_json.exists():
        profile["parking_slots"] = _select_slots(parking_json)
    else:
        print(f"Warning: parking JSON not found: {parking_json}")
        profile["parking_slots"] = profile.get("parking_slots", [])
    profile["parking"] = "on"
    return _write_profile(profile)


def confirm_profile(name: str) -> Path:
    profile_path = PROFILE_DIR / f"{_safe_name(name)}.json"
    if not profile_path.exists():
        raise FileNotFoundError(f"Profile not found: {profile_path}")
    profile = _read_json(profile_path)
    ACTIVE_FILE.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Confirmed profile: {profile['name']}")
    return ACTIVE_FILE


def confirm_all_profiles() -> Path:
    profiles = load_profiles()
    if not profiles:
        raise FileNotFoundError("No saved profiles found.")
    ACTIVE_FILE.write_text(
        json.dumps(profiles, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Confirmed {len(profiles)} profiles.")
    return ACTIVE_FILE


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Manage CCTV parking profiles.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("list", help="List saved profiles and active profile.")
    subparsers.add_parser("create", help="Create a CCTV parking profile.")
    edit = subparsers.add_parser("edit", help="Edit an existing profile.")
    edit.add_argument("name")
    confirm = subparsers.add_parser("confirm", help="Select the profile used by the launcher.")
    confirm.add_argument("name", nargs="?", help="Profile name; omit to choose interactively.")
    confirm.add_argument("--all", action="store_true", help="Confirm all saved profiles.")
    subparsers.add_parser("active", help="Show the confirmed profile.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command == "list":
        active = _read_json(ACTIVE_FILE) if ACTIVE_FILE.exists() else {}
        active_names = {
            profile.get("name")
            for profile in (active if isinstance(active, list) else [active])
        }
        for profile in load_profiles():
            marker = " *active*" if profile.get("name") in active_names else ""
            print(f"{profile['name']}: camera={profile.get('camera')} parking={profile.get('parking_json')}{marker}")
    elif args.command == "create":
        print(f"Saved: {create_profile()}")
    elif args.command == "edit":
        path = PROFILE_DIR / f"{_safe_name(args.name)}.json"
        print(f"Saved: {create_profile(_read_json(path))}")
    elif args.command == "confirm":
        if args.all:
            confirm_all_profiles()
            return 0
        profile_name = args.name
        if not profile_name:
            profiles = load_profiles()
            if not profiles:
                raise SystemExit(
                    "No profiles found. Run: parking_profiles.bat create"
                )
            print("Saved profiles:")
            for index, profile in enumerate(profiles, 1):
                print(f"  {index}. {profile['name']}")
            selected = input("Choose profile number or name: ").strip()
            if selected.isdigit() and 1 <= int(selected) <= len(profiles):
                profile_name = profiles[int(selected) - 1]["name"]
            else:
                profile_name = selected
        confirm_profile(profile_name)
    elif args.command == "active":
        if not ACTIVE_FILE.exists():
            print("No active profile. Run: python parking_profiles.py confirm PROFILE_NAME")
            return 1
        print(json.dumps(_read_json(ACTIVE_FILE), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
