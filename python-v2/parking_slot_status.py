"""Helpers for keeping live model display status aligned with parking maps."""

import json
from pathlib import Path


def read_parking_slot_state(status_file):
    payload = json.loads(Path(status_file).read_text(encoding="utf-8"))
    names = payload.get("disabledParkingSlotNames", [])
    disabled = {
        name.strip()
        for name in (names if isinstance(names, list) else [])
        if isinstance(name, str) and name.strip()
    }
    details = payload.get("manualVehicleDetails", [])
    overrides = {}
    for row in details if isinstance(details, list) else []:
        if not isinstance(row, dict):
            continue
        name, plate, province = (row.get(key) for key in ("parkingSlotName", "license_num", "province"))
        if all(isinstance(value, str) and value.strip() for value in (name, plate, province)):
            overrides[name.strip()] = (plate.strip(), province.strip())
    return disabled, overrides


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
