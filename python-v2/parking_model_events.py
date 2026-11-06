"""Send parking state transitions to the parking-management backend."""

from __future__ import annotations

import json
import os
import queue
import threading
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Any, Dict, Optional


class ParkingModelEventPublisher:
    def __init__(
        self,
        endpoint: str,
        api_key: str,
        camera_no: str,
        cctv_file_name: str,
    ) -> None:
        self.endpoint = endpoint
        self.api_key = api_key
        self.camera_no = camera_no
        self.cctv_file_name = cctv_file_name
        self._events: queue.Queue[Optional[Dict[str, Any]]] = queue.Queue(maxsize=128)
        self._closing = threading.Event()
        self._worker = threading.Thread(
            target=self._run,
            name=f"parking-events-{camera_no or 'camera'}",
            daemon=True,
        )
        self._worker.start()

    @classmethod
    def from_environment(
        cls,
        camera_no: str,
        cctv_file_name: str,
    ) -> Optional["ParkingModelEventPublisher"]:
        endpoint = os.environ.get("PARKING_MODEL_EVENTS_URL", "").strip()
        api_key = os.environ.get("PARKING_MODEL_API_KEY", "").strip()
        if not endpoint and not api_key:
            print(
                "[Parking API] Sync disabled. Set PARKING_MODEL_EVENTS_URL and "
                "PARKING_MODEL_API_KEY to update parking maps and logs."
            )
            return None
        if not endpoint or not api_key:
            raise ValueError(
                "PARKING_MODEL_EVENTS_URL and PARKING_MODEL_API_KEY must both be configured."
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
        plate = license_plate.strip()
        if not plate:
            print(f"[Parking API] Cannot send {event}: license plate is not available.")
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

    def close(self, timeout: float = 10.0) -> None:
        self._closing.set()
        self._worker.join(timeout=max(0.0, timeout))
        if self._worker.is_alive():
            print("[Parking API] Event publisher is still retrying; pending events may not be sent.")

    def _post(self, payload: Dict[str, Any]) -> None:
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
        with urlopen(request, timeout=6.0) as response:
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(f"backend returned HTTP {response.status}")
            response.read()

    def _send_with_retry(self, payload: Dict[str, Any]) -> None:
        for attempt in range(3):
            try:
                self._post(payload)
                return
            except HTTPError as error:
                if 400 <= error.code < 500:
                    details = error.read().decode("utf-8", errors="replace").strip()
                    print(
                        f"[Parking API] {payload['event']} event rejected "
                        f"(HTTP {error.code}): {details or 'no error details returned'}"
                    )
                    return
                status = f"HTTP {error.code}"
            except (URLError, TimeoutError, OSError, RuntimeError, ValueError) as error:
                status = str(error)

            if attempt < 2:
                time.sleep(0.5 * (2**attempt))
        print(
            f"[Parking API] Could not send {payload['event']} event after 3 attempts "
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
