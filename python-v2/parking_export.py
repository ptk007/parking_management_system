"""Persistent result storage for the realtime parking monitor.

Unlike the old timestamp-per-run exporter, this module keeps stable filenames:
- latest.json                overwritten with the newest snapshot
- cars_latest.csv            overwritten with current car state
- slots_latest.csv           overwritten with current slot state
- parking_history.csv        APPENDED with new completed parking visits

The history file survives program restarts and receives date/time metadata.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence
from urllib.parse import urlsplit, urlunsplit


def _json_value(value: Any) -> Any:
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, set)):
        return [_json_value(item) for item in value]
    return value


def _safe_source(value: Any) -> str:
    """Remove RTSP/HTTP username/password before writing logs/results."""
    text = str(value or "")
    try:
        parts = urlsplit(text)
    except ValueError:
        return text
    if not parts.scheme or not parts.netloc or "@" not in parts.netloc:
        return text
    host = parts.netloc.rsplit("@", 1)[-1]
    return urlunsplit((parts.scheme, f"***:***@{host}", parts.path, parts.query, parts.fragment))


def _plate_for(info: Optional[Mapping[str, Any]]) -> str:
    if not info:
        return ""
    return str(info.get("stable_text") or info.get("text") or "")


def _car_rows(car_memory: Mapping[Any, Mapping[str, Any]]) -> Iterable[Dict[str, Any]]:
    def _sort_key(item):
        try:
            return int(item[0])
        except (TypeError, ValueError):
            return str(item[0])

    for car_id, info in sorted(car_memory.items(), key=_sort_key):
        yield {
            "car_id": car_id,
            "plate": _plate_for(info),
            "stable_memory": bool(info.get("has_stable_memory", False)),
            "locked": bool(info.get("is_locked", False)),
            "digits_locked": bool(info.get("digits_locked", False)),
            "ocr_score": float(info.get("score", 0.0)),
            "car_confidence": info.get("car_conf"),
            "plate_confidence": info.get("plate_conf"),
            "stable_frame": info.get("stable_frame_idx"),
            "observations": len(info.get("observations", [])),
            "last_seen_frame": info.get("last_seen_frame"),
        }


def _slot_rows(
    parking_slots: Iterable[Mapping[str, Any]],
    parking_state: Mapping[str, Mapping[str, Any]],
    car_memory: Mapping[Any, Mapping[str, Any]],
) -> Iterable[Dict[str, Any]]:
    for slot in parking_slots:
        name = str(slot["name"])
        state = parking_state.get(name, {})
        owner_id = state.get("car_id")
        owner_info = car_memory.get(owner_id) if owner_id is not None else None
        yield {
            "slot": name,
            "status": state.get("status", "available"),
            "car_id": owner_id,
            "plate": _plate_for(owner_info) or state.get("owner_plate_text", ""),
            "overlap_score": float(state.get("overlap_score", 0.0)),
            "slot_coverage": float(state.get("slot_coverage", 0.0)),
            "car_coverage": float(state.get("car_coverage", 0.0)),
            "stationary_hits": int(state.get("stationary_hits", 0)),
            "inside_hits": int(state.get("inside_hits", 0)),
            "deep_hits": int(state.get("deep_hits", 0)),
            "inferred_parking": bool(state.get("inferred_parking", False)),
            "date_parking": state.get("date_parking"),
            "parking_time": state.get("parking_time"),
            "date_exited": state.get("date_exited"),
            "exited_time": state.get("exited_time"),
            "parking_started_at": state.get("parking_started_at"),
            "exited_at": state.get("exited_at"),
            "parking_duration_seconds": state.get("parking_duration_seconds"),
        }


def _history_rows(
    parking_slots: Iterable[Mapping[str, Any]],
    parking_state: Mapping[str, Mapping[str, Any]],
) -> Iterable[Dict[str, Any]]:
    for slot in parking_slots:
        slot_name = str(slot["name"])
        state = parking_state.get(slot_name, {})
        for visit in state.get("parking_history", []):
            if isinstance(visit, Mapping):
                yield {"slot": slot_name, **dict(visit)}


def _write_csv_snapshot(path: Path, rows: Sequence[Dict[str, Any]], fallback_fields) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0].keys()) if rows else list(fallback_fields)
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _event_key(row: Mapping[str, Any]) -> tuple:
    return tuple(
        str(row.get(field, "") or "")
        for field in ("slot", "parking_started_at", "exited_at", "car_id", "plate")
    )


def _append_unique_history(path: Path, rows: Sequence[Dict[str, Any]]) -> int:
    """Append only unseen completed visits; preserve existing rows and headers."""
    path.parent.mkdir(parents=True, exist_ok=True)
    existing_rows = []
    existing_keys = set()
    existing_fields = []

    if path.exists() and path.stat().st_size > 0:
        with path.open("r", newline="", encoding="utf-8-sig") as file:
            reader = csv.DictReader(file)
            existing_fields = list(reader.fieldnames or [])
            for row in reader:
                existing_rows.append(dict(row))
                existing_keys.add(_event_key(row))

    new_rows = [dict(row) for row in rows if _event_key(row) not in existing_keys]
    if not new_rows:
        return 0

    all_fields = list(existing_fields)
    for row in [*existing_rows, *new_rows]:
        for key in row.keys():
            if key not in all_fields:
                all_fields.append(key)

    # Rewrite only when needed so schema upgrades are safe, then keep the same file.
    combined = [*existing_rows, *new_rows]
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=all_fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(combined)
    return len(new_rows)


def export_results(
    output_dir: Path,
    *,
    source: Any,
    parking_enabled: bool,
    parking_zone: str,
    frame_count: int,
    car_memory: Mapping[Any, Mapping[str, Any]],
    parking_slots: Iterable[Mapping[str, Any]],
    parking_state: Mapping[str, Mapping[str, Any]],
    profile_name: str = "",
    camera_id: str = "",
    run_id: str = "",
    run_started_at: str = "",
) -> Path:
    """Persist latest state and append newly completed parking history."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    local_timestamp = datetime.now().astimezone()
    exported_at = timestamp.isoformat()

    parking_slots = list(parking_slots)
    cars = list(_car_rows(car_memory))
    slots = list(_slot_rows(parking_slots, parking_state, car_memory))
    history = list(_history_rows(parking_slots, parking_state))

    for row in history:
        row.setdefault("profile_name", profile_name)
        row.setdefault("camera_id", camera_id)
        row.setdefault("run_id", run_id)
        row["recorded_at_utc"] = exported_at
        row["recorded_at_local"] = local_timestamp.isoformat()
        row["recorded_date"] = local_timestamp.strftime("%Y-%m-%d")
        row["recorded_time"] = local_timestamp.strftime("%H:%M:%S %Z")

    counts = {"available": 0, "occupied": 0, "parking": 0, "disable": 0}
    for row in slots:
        status = str(row.get("status", "available"))
        counts[status] = counts.get(status, 0) + 1

    payload = {
        "exported_at_utc": exported_at,
        "run_id": run_id,
        "run_started_at_utc": run_started_at,
        "profile_name": profile_name,
        "camera_id": camera_id,
        "source": _safe_source(source),
        "parking_enabled": bool(parking_enabled),
        "parking_zone": parking_zone,
        "frames_processed": int(frame_count),
        "car_count": len(cars),
        "parking_counts": counts,
        "cars": cars,
        "slots": slots,
        "parking_history_count_in_memory": len(history),
    }

    latest_path = output_dir / "latest.json"
    latest_path.write_text(
        json.dumps(_json_value(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    _write_csv_snapshot(output_dir / "cars_latest.csv", cars, ["car_id", "plate"])
    _write_csv_snapshot(output_dir / "slots_latest.csv", slots, ["slot", "status"])
    appended = _append_unique_history(output_dir / "parking_history.csv", history)

    status_path = output_dir / "runtime_status.json"
    status_path.write_text(
        json.dumps(
            {
                "updated_at_utc": exported_at,
                "profile_name": profile_name,
                "camera_id": camera_id,
                "run_id": run_id,
                "frames_processed": int(frame_count),
                "history_rows_appended": appended,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return latest_path
