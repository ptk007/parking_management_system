"""Helpers for keeping live model display status aligned with parking maps."""

import json
from pathlib import Path


def read_disabled_parking_slot_names(status_file):
    payload = json.loads(Path(status_file).read_text(encoding="utf-8"))
    names = payload.get("disabledParkingSlotNames", [])
    if not isinstance(names, list):
        return set()
    return {
        name.strip()
        for name in names
        if isinstance(name, str) and name.strip()
    }


def consume_slot_status_refresh_request(request_file, last_version):
    """Return a newer one-shot refresh version, if a request file is present."""
    path = Path(request_file)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        version = int(payload.get("version", 0))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return None
    if version <= last_version:
        return None
    try:
        path.unlink()
    except OSError:
        pass
    return version


def resolve_slot_display(status, map_disabled):
    if map_disabled:
        label = "disabled (Parking)" if status == "parking" else "disabled"
        return label, "disable"

    label = {
        "available": "available",
        "occupied": "incoming",
        "parking": "occupied",
        "disable": "disabled",
    }.get(status, status)
    return label, status
