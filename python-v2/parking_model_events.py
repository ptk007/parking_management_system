"""Send parking state transitions to the parking-management backend."""

from __future__ import annotations

import json
import os
import queue
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Any, Dict, Optional


class ModelRuntimeClient:
    def __init__(self, endpoint: str, api_key: str) -> None:
        self.endpoint = endpoint
        self.api_key = api_key
        self._last_error_at = 0.0

    @classmethod
    def from_environment(cls) -> Optional["ModelRuntimeClient"]:
        endpoint = os.environ.get("PARKING_MODEL_RUNTIME_URL", "").strip()
        api_key = os.environ.get("PARKING_MODEL_API_KEY", "").strip()
        if not endpoint:
            print(
                "[YOLO control] Remote ON/OFF is disabled. Set "
                "PARKING_MODEL_RUNTIME_URL to enable it."
            )
            return None
        if not api_key:
            raise ValueError(
                "PARKING_MODEL_API_KEY must be configured when remote YOLO control is enabled."
            )
        return cls(endpoint, api_key)

    def sync(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = Request(
            self.endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-model-api-key": self.api_key,
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=6.0) as response:
                result = json.loads(response.read().decode("utf-8"))
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"backend returned HTTP {response.status}")
                if not isinstance(result, dict) or not isinstance(
                    result.get("commands"), list
                ):
                    raise ValueError("backend returned an invalid runtime command response")
                self._last_error_at = 0.0
                return result
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace").strip()
            message = f"HTTP {error.code}: {details or 'no error details returned'}"
        except (URLError, TimeoutError, OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
            message = str(error)

        now = time.monotonic()
        if now - self._last_error_at >= 30.0:
            print(f"[YOLO control] Runtime sync failed: {message}")
            self._last_error_at = now
        return None

    def fetch_profiles(self) -> Dict[str, Any]:
        runtime_endpoint = self.endpoint.rstrip("/")
        profiles_url = (
            runtime_endpoint[:-5] + "/profiles"
            if runtime_endpoint.endswith("/sync")
            else runtime_endpoint + "/profiles"
        )
        request = Request(
            profiles_url,
            headers={"x-model-api-key": self.api_key},
            method="GET",
        )
        try:
            with urlopen(request, timeout=10.0) as response:
                result = json.loads(response.read().decode("utf-8"))
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(f"backend returned HTTP {response.status}")
                if not isinstance(result, dict) or not isinstance(result.get("profiles"), list):
                    raise ValueError("backend returned an invalid CCTV profile response")
                return result
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace").strip()
            raise RuntimeError(
                f"Could not load backend CCTV presets (HTTP {error.code}): "
                f"{details or 'no error details returned'}"
            ) from error
        except (URLError, TimeoutError, OSError, ValueError, json.JSONDecodeError) as error:
            raise RuntimeError(f"Could not load backend CCTV presets: {error}") from error


def write_worker_status(status: str, message: str = "") -> None:
    status_path = os.environ.get("PARKING_RUNTIME_STATUS_FILE", "").strip()
    if not status_path:
        return
    path = os.path.abspath(status_path)
    temporary_path = f"{path}.{os.getpid()}.tmp"
    payload = {
        "status": status,
        "message": str(message)[:500],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        with open(temporary_path, "w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False)
        os.replace(temporary_path, path)
    except OSError as error:
        print(f"[YOLO control] Could not write worker status: {error}")


class ParkingModelEventPublisher:
    def __init__(
        self,
        endpoint: str,
        api_key: str,
        camera_no: str,
        cctv_file_name: str,
    ) -> None:
        self.endpoint = endpoint
        self.slot_status_endpoint = (
            endpoint.rsplit("/", 1)[0] + "/model-slot-status"
        )
        self.api_key = api_key
        self.camera_no = camera_no
        self.cctv_file_name = cctv_file_name
        raw_mapped_slots = os.environ.get("PARKING_RUNTIME_MAPPED_SLOT_NAMES")
        self.mapped_slot_state_file = os.environ.get(
            "PARKING_RUNTIME_DISABLED_SLOT_FILE", ""
        ).strip()
        self.mapped_parking_slots = None
        if raw_mapped_slots is not None:
            try:
                mapped_slots = json.loads(raw_mapped_slots)
                if isinstance(mapped_slots, list):
                    self.mapped_parking_slots = {
                        str(name).strip() for name in mapped_slots if str(name).strip()
                    }
                else:
                    self.mapped_parking_slots = set()
            except json.JSONDecodeError:
                self.mapped_parking_slots = set()
        self._unmapped_slot_notices = set()
        self._events: queue.Queue[Optional[Dict[str, Any]]] = queue.Queue(maxsize=128)
        self._closing = threading.Event()
        self._worker = threading.Thread(
            target=self._run,
            name=f"parking-events-{camera_no or 'camera'}",
            daemon=True,
        )
        self._worker.start()

    def _refresh_mapped_parking_slots(self) -> None:
        if not self.mapped_slot_state_file:
            return
        try:
            payload = json.loads(
                Path(self.mapped_slot_state_file).read_text(encoding="utf-8")
            )
        except (OSError, json.JSONDecodeError):
            return
        names = payload.get("mappedParkingSlotNames", [])
        if isinstance(names, list):
            self.mapped_parking_slots = {
                str(name).strip() for name in names if str(name).strip()
            }

    @classmethod
    def from_environment(
        cls,
        camera_no: str,
        cctv_file_name: str,
    ) -> Optional["ParkingModelEventPublisher"]:
        endpoint = os.environ.get("PARKING_MODEL_EVENTS_URL", "").strip()
        api_key = os.environ.get("PARKING_MODEL_API_KEY", "").strip()
        if not endpoint:
            print(
                "[Parking API] Event sync is disabled. Set PARKING_MODEL_EVENTS_URL "
                "to update parking maps and logs."
            )
            return None
        if not api_key:
            raise ValueError(
                "PARKING_MODEL_API_KEY must be configured when model event sync is enabled."
            )
        if not camera_no:
            raise ValueError(
                "A camera number is required for model events."
            )
        if not cctv_file_name:
            raise ValueError(
                "The CCTV source filename is required for model events."
            )
        return cls(endpoint, api_key, camera_no, cctv_file_name)

    def publish_not_parking(self, license_plate: str, occurred_at: str) -> None:
        plate = license_plate.strip()
        if not plate:
            return
        self.publish("Not parking", plate, occurred_at=occurred_at)

    def publish(
        self,
        event: str,
        license_plate: str,
        *,
        parking_slot_name: str = "",
        occurred_at: str = "",
    ) -> None:
        self._refresh_mapped_parking_slots()
        plate = license_plate.strip()
        if not plate:
            print(f"[Parking API] Cannot send {event}: license plate is not available.")
            return
        if self.mapped_parking_slots is not None and not self.mapped_parking_slots:
            notice_key = "__no_mapped_parking_slots__"
            if notice_key not in self._unmapped_slot_notices:
                print(
                    "[Parking API] No parking-map slots are assigned to this preset; "
                    "parking-log sync is disabled."
                )
                self._unmapped_slot_notices.add(notice_key)
            return
        if (
            event in {"Parking", "Exited"}
            and self.mapped_parking_slots is not None
            and parking_slot_name not in self.mapped_parking_slots
        ):
            if parking_slot_name not in self._unmapped_slot_notices:
                print(
                    f"[Parking API] Slot {parking_slot_name or '-'} has no backend map assignment; "
                    f"{event} events for it will not be sent."
                )
                self._unmapped_slot_notices.add(parking_slot_name)
            return

        payload: Dict[str, Any] = {
            "event": event,
            "license_plate": plate,
            "occurredAt": occurred_at or datetime.now(timezone.utc).isoformat(),
        }
        payload.update(
            {
                "cameraNo": self.camera_no,
                "cctvFileName": self.cctv_file_name,
            }
        )
        if parking_slot_name:
            payload["parkingSlotName"] = parking_slot_name
        try:
            self._events.put_nowait(payload)
        except queue.Full:
            print(f"[Parking API] Event queue full; {event} event was not sent.")

    def publish_slot_status(
        self,
        slot_status: str,
        parking_slot_name: str,
        occurred_at: str = "",
        license_plate_detected: Optional[bool] = None,
    ) -> None:
        self._refresh_mapped_parking_slots()
        parking_slot_name = str(parking_slot_name or "").strip()
        if slot_status not in {"incoming", "occupied", "available"} or not parking_slot_name:
            return
        if (
            self.mapped_parking_slots is not None
            and parking_slot_name not in self.mapped_parking_slots
        ):
            if parking_slot_name not in self._unmapped_slot_notices:
                print(
                    f"[Parking API] Slot {parking_slot_name} has no backend map assignment; "
                    "slot status was not sent."
                )
                self._unmapped_slot_notices.add(parking_slot_name)
            return

        payload: Dict[str, Any] = {
            "slotStatus": slot_status,
            "parkingSlotName": parking_slot_name,
            "occurredAt": occurred_at or datetime.now(timezone.utc).isoformat(),
            "cameraNo": self.camera_no,
            "cctvFileName": self.cctv_file_name,
            "_endpoint": self.slot_status_endpoint,
        }
        if isinstance(license_plate_detected, bool):
            payload["licensePlateDetected"] = license_plate_detected
        try:
            self._events.put_nowait(payload)
        except queue.Full:
            print("[Parking API] Event queue full; slot status was not sent.")

    def close(self, timeout: float = 10.0) -> None:
        self._closing.set()
        self._worker.join(timeout=max(0.0, timeout))
        if self._worker.is_alive():
            print("[Parking API] Event publisher is still retrying; pending events may not be sent.")

    def _post(self, payload: Dict[str, Any]) -> None:
        endpoint = payload.get("_endpoint", self.endpoint)
        body = json.dumps(
            {key: value for key, value in payload.items() if key != "_endpoint"},
            ensure_ascii=False,
        ).encode("utf-8")
        request = Request(
            endpoint,
            data=body,
            headers={
                "Content-Type": "application/json",
                "x-model-api-key": self.api_key,
            },
            method="POST",
        )
        with urlopen(request, timeout=6.0) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"backend returned HTTP {response.status}")
            response.read()

    def _send_with_retry(self, payload: Dict[str, Any]) -> None:
        label = payload.get("event", "Slot status")
        for attempt in range(3):
            try:
                self._post(payload)
                return
            except HTTPError as error:
                if 400 <= error.code < 500:
                    details = error.read().decode("utf-8", errors="replace").strip()
                    print(
                        f"[Parking API] {label} event rejected "
                        f"(HTTP {error.code}): {details or 'no error details returned'}"
                    )
                    return
                status = f"HTTP {error.code}"
            except (URLError, TimeoutError, OSError, RuntimeError, ValueError) as error:
                status = str(error)

            if attempt < 2:
                time.sleep(0.5 * (2**attempt))
        print(
            f"[Parking API] Could not send {label} event after 3 attempts "
            f"({status})."
        )

    def _run(self) -> None:
        while True:
            try:
                payload = self._events.get(timeout=0.25)
            except queue.Empty:
                if self._closing.is_set():
                    return
                continue
            try:
                if payload is not None:
                    self._send_with_retry(payload)
            finally:
                self._events.task_done()
