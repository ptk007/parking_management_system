"""Export final parking-monitor results without touching the inference loop."""

import csv
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional


def _json_value(value: Any) -> Any:
    """Convert common NumPy/Python values into JSON-safe values."""
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


def _plate_for(info: Optional[Mapping[str, Any]]) -> str:
    if not info:
        return ""
    return str(info.get("stable_text") or info.get("text") or "")


def _car_rows(car_memory: Mapping[Any, Mapping[str, Any]]) -> Iterable[Dict[str, Any]]:
    for car_id, info in sorted(car_memory.items(), key=lambda item: int(item[0])):
        yield {
            "car_id": int(car_id),
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
        state = parking_state[name]
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
        for visit in parking_state[slot_name].get("parking_history", []):
            yield {"slot": slot_name, **visit}


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
) -> Path:
    """Write one timestamped JSON snapshot and CSV tables."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc)
    stem = timestamp.strftime("parking_result_%Y%m%d_%H%M%S_%fZ")

    cars = list(_car_rows(car_memory))
    slots = list(_slot_rows(parking_slots, parking_state, car_memory))
    history = list(_history_rows(parking_slots, parking_state))
    counts = {"available": 0, "occupied": 0, "parking": 0, "disable": 0}
    for row in slots:
        status = row["status"]
        counts[status] = counts.get(status, 0) + 1

    payload = {
        "exported_at_utc": timestamp.isoformat(),
        "source": str(source),
        "parking_enabled": bool(parking_enabled),
        "parking_zone": parking_zone,
        "frames_processed": int(frame_count),
        "car_count": len(cars),
        "parking_counts": counts,
        "cars": cars,
        "slots": slots,
        "parking_history": history,
    }

    json_path = output_dir / f"{stem}.json"
    json_path.write_text(
        json.dumps(_json_value(payload), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    with (output_dir / f"{stem}_cars.csv").open("w", newline="", encoding="utf-8") as file:
        rows = list(cars)
        writer = csv.DictWriter(file, fieldnames=list(rows[0]) if rows else ["car_id", "plate"])
        writer.writeheader()
        writer.writerows(rows)

    with (output_dir / f"{stem}_slots.csv").open("w", newline="", encoding="utf-8") as file:
        rows = list(slots)
        writer = csv.DictWriter(file, fieldnames=list(rows[0]) if rows else ["slot", "status"])
        writer.writeheader()
        writer.writerows(rows)

    with (output_dir / f"{stem}_history.csv").open("w", newline="", encoding="utf-8") as file:
        fieldnames = list(history[0]) if history else ["slot", "car_id", "plate"]
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(history)

    return json_path
