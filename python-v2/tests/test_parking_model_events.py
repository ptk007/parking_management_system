import hashlib
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import MagicMock, patch

from multi_camera import (
    _profile_parking_inventory,
    _runtime_frame_path,
    _run_remote_controlled,
    _write_disabled_slot_state,
)
import multi_camera
from parking_model_events import (
    ModelRuntimeClient,
    ParkingModelEventPublisher,
    write_worker_status,
)
from parking_slot_status import (
    consume_slot_status_refresh_request,
    read_disabled_parking_slot_names,
    resolve_slot_display,
)


class ParkingModelEventPublisherTests(unittest.TestCase):
    def test_manual_slot_status_refresh_request_is_consumed_once(self):
        with tempfile.TemporaryDirectory() as directory:
            request_file = Path(directory) / "refresh.json"
            request_file.write_text(json.dumps({"version": 1}), encoding="utf-8")
            self.assertEqual(consume_slot_status_refresh_request(request_file, 0), 1)
            self.assertFalse(request_file.exists())
            self.assertIsNone(consume_slot_status_refresh_request(request_file, 1))

    def test_environment_requires_camera_identity(self):
        environment = {
            "PARKING_MODEL_EVENTS_URL": "http://localhost:5000/api/parking-logs/model-events",
            "PARKING_MODEL_API_KEY": "test-key",
        }
        with patch.dict("os.environ", environment, clear=True):
            with self.assertRaisesRegex(ValueError, "camera number"):
                ParkingModelEventPublisher.from_environment("", "camera.json")

    def test_publish_sends_camera_identity_and_parking_state(self):
        response = MagicMock()
        response.status = 201
        response.__enter__.return_value = response
        with patch("parking_model_events.urlopen", return_value=response) as urlopen:
            publisher = ParkingModelEventPublisher(
                "http://localhost:5000/api/parking-logs/model-events",
                "test-key",
                "CAM-1",
                "camera-source.json",
            )
            publisher.publish(
                "Parking",
                "กข1234",
                parking_slot_name="zoneA_slot01",
                occurred_at="2026-11-04T06:00:00+00:00",
            )
            publisher._events.join()
            publisher.close()

        request = urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.get_header("X-model-api-key"), "test-key")
        self.assertEqual(payload["event"], "Parking")
        self.assertEqual(payload["license_plate"], "กข1234")
        self.assertEqual(payload["parkingSlotName"], "zoneA_slot01")
        self.assertEqual(payload["cameraNo"], "CAM-1")
        self.assertEqual(payload["cctvFileName"], "camera-source.json")

    def test_no_map_assignment_suppresses_all_parking_log_events(self):
        with patch.dict(
            "os.environ",
            {"PARKING_RUNTIME_MAPPED_SLOT_NAMES": "[]"},
            clear=True,
        ), patch("parking_model_events.urlopen") as urlopen:
            publisher = ParkingModelEventPublisher(
                "http://localhost:3000/api/parking-logs/model-events",
                "test-key",
                "CAM-1",
                "camera-source.json",
            )
            publisher.publish_not_parking("PLATE-1", "2026-11-04T06:00:00Z")
            publisher.publish(
                "Parking",
                "PLATE-1",
                parking_slot_name="zoneA_slot01",
            )
            publisher.publish(
                "Exited",
                "PLATE-1",
                parking_slot_name="zoneA_slot01",
            )
            publisher.publish_slot_status("occupied", "zoneA_slot01")
            publisher._events.join()
            publisher.close()

        urlopen.assert_not_called()

    def test_publish_slot_status_uses_map_status_endpoint_without_plate_or_log_event(self):
        response = MagicMock()
        response.status = 200
        response.__enter__.return_value = response
        with patch.dict("os.environ", {}, clear=True), patch(
            "parking_model_events.urlopen", return_value=response
        ) as urlopen:
            publisher = ParkingModelEventPublisher(
                "http://localhost:3000/api/parking-logs/model-events",
                "test-key",
                "CAM-1",
                "camera-source.json",
            )
            publisher.publish_slot_status(
                "incoming",
                "zoneA_slot01",
                "2026-11-04T06:00:00+00:00",
            )
            publisher._events.join()
            publisher.close()

        request = urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "http://localhost:3000/api/parking-logs/model-slot-status")
        self.assertEqual(payload["slotStatus"], "incoming")
        self.assertEqual(payload["parkingSlotName"], "zoneA_slot01")
        self.assertEqual(payload["cameraNo"], "CAM-1")
        self.assertNotIn("license_plate", payload)
        self.assertNotIn("event", payload)

    def test_occupied_slot_status_reports_when_plate_was_not_detected(self):
        response = MagicMock()
        response.status = 200
        response.__enter__.return_value = response
        with patch.dict("os.environ", {}, clear=True), patch(
            "parking_model_events.urlopen", return_value=response
        ) as urlopen:
            publisher = ParkingModelEventPublisher(
                "http://localhost:3000/api/parking-logs/model-events",
                "test-key",
                "CAM-1",
                "camera-source.json",
            )
            publisher.publish_slot_status(
                "occupied",
                "zoneA_slot01",
                "2026-11-04T06:00:00+00:00",
                license_plate_detected=False,
            )
            publisher._events.join()
            publisher.close()

        payload = json.loads(urlopen.call_args.args[0].data.decode("utf-8"))
        self.assertEqual(payload["slotStatus"], "occupied")
        self.assertIs(payload["licensePlateDetected"], False)

    def test_runtime_client_posts_inventory_and_parses_commands(self):
        response = MagicMock()
        response.status = 200
        response.read.return_value = b'{"commands":[{"enabled":true}],"issues":[]}'
        response.__enter__.return_value = response
        with patch("parking_model_events.urlopen", return_value=response) as urlopen:
            client = ModelRuntimeClient("http://localhost/api/model-runtime/sync", "test-key")
            result = client.sync({"runtimeId": "runtime-1", "profiles": [], "workers": []})

        self.assertEqual(result["commands"], [{"enabled": True}])
        request = urlopen.call_args.args[0]
        self.assertEqual(request.get_header("X-model-api-key"), "test-key")
        self.assertEqual(
            json.loads(request.data.decode("utf-8"))["runtimeId"],
            "runtime-1",
        )

    def test_worker_status_is_written_without_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            status_path = Path(directory) / "worker-status.json"
            with patch.dict(
                "os.environ",
                {"PARKING_RUNTIME_STATUS_FILE": str(status_path)},
                clear=True,
            ):
                write_worker_status("Online")

            status = json.loads(status_path.read_text(encoding="utf-8"))
            self.assertEqual(status["status"], "Online")
            self.assertNotIn("apiKey", status)

    def test_profile_inventory_respects_selected_parking_slot_categories(self):
        with tempfile.TemporaryDirectory() as directory:
            parking_json = Path(directory) / "parking.json"
            parking_json.write_text(
                json.dumps(
                    {
                        "categories": [
                            {"name": "zoneA_slot01", "supercategory": "parking-slot"},
                            {"name": "zoneA_slot02", "supercategory": "parking-slot"},
                            {"name": "car", "supercategory": "vehicle"},
                        ]
                    }
                ),
                encoding="utf-8",
            )
            enabled, names = _profile_parking_inventory(
                Namespace(parking_json=None),
                {
                    "parking": "on",
                    "parking_json": str(parking_json),
                    "parking_slots": ["zoneA_slot02"],
                },
            )

        self.assertTrue(enabled)
        self.assertEqual(names, ["zoneA_slot02"])

    def test_runtime_preview_frame_name_uses_normalized_camera_identity(self):
        frame_path = _runtime_frame_path(" CAM-1 ", "Camera-Source.JSON")
        identity = "cam-1\0camera-source.json"
        expected_name = f"{hashlib.sha256(identity.encode('utf-8')).hexdigest()}.jpg"

        self.assertEqual(frame_path.name, expected_name)

    def test_disabled_map_slots_are_written_for_live_worker_refresh(self):
        with tempfile.TemporaryDirectory() as directory:
            status_path = Path(directory) / "runtime" / "disabled-slots.json"
            _write_disabled_slot_state(status_path, ["zoneA_slot01"])

            disabled_names = read_disabled_parking_slot_names(status_path)

        self.assertEqual(disabled_names, {"zoneA_slot01"})

    def test_disabled_slot_display_has_priority_and_marks_parking(self):
        self.assertEqual(
            resolve_slot_display("parking", map_disabled=True),
            ("disabled (Parking)", "disable"),
        )
        self.assertEqual(
            resolve_slot_display("available", map_disabled=True),
            ("disabled", "disable"),
        )
        self.assertEqual(
            resolve_slot_display("parking", map_disabled=False),
            ("occupied", "parking"),
        )

    def test_backend_supervisor_stays_alive_in_standby_without_presets(self):
        class EmptyBackend:
            def __init__(self):
                self.sync_payloads = []

            def fetch_profiles(self):
                return {"profiles": []}

            def sync(self, payload):
                self.sync_payloads.append(payload)
                return {"commands": [], "issues": []}

        backend = EmptyBackend()
        with tempfile.TemporaryDirectory() as directory, \
            patch.object(multi_camera, "_BACKEND_PROFILE_TEMP", None), \
            patch.object(multi_camera, "_NO_PROFILE_NOTICE_SHOWN", False), \
            patch.object(multi_camera, "BACKEND_PROFILE_REFRESH_SECONDS", 2.0), \
            patch("multi_camera.time.sleep", side_effect=KeyboardInterrupt):
            result = _run_remote_controlled(
                [],
                backend,
                Namespace(
                    export_dir=Path(directory),
                    max_restarts=0,
                    restart_delay=0.1,
                ),
            )
            if multi_camera._BACKEND_PROFILE_TEMP is not None:
                multi_camera._BACKEND_PROFILE_TEMP.cleanup()
                multi_camera._BACKEND_PROFILE_TEMP = None

        self.assertEqual(result, 0)
        self.assertGreaterEqual(len(backend.sync_payloads), 2)
        self.assertEqual(backend.sync_payloads[0]["profiles"], [])

    def test_backend_standby_loads_a_preset_created_after_startup(self):
        profile = {
            "floorId": "floor-1",
            "cameraPresetId": "camera-1",
            "name": "New camera",
            "cameraNo": "344",
            "cctvFileName": "source.json",
            "rtspLink": "rtsp://127.0.0.1/stream",
            "parkingSlotData": {
                "categories": [
                    {"id": 1, "name": "zoneA_slot01", "supercategory": "parking-slot"}
                ],
                "annotations": [{"category_id": 1}],
            },
            "mappedParkingSlotNames": ["zoneA_slot01"],
            "modelEnabled": False,
        }

        class ChangingBackend:
            def __init__(self):
                self.fetch_count = 0
                self.sync_payloads = []

            def fetch_profiles(self):
                self.fetch_count += 1
                return {"profiles": [] if self.fetch_count == 1 else [profile]}

            def sync(self, payload):
                self.sync_payloads.append(payload)
                return {
                    "commands": [
                        {
                            "cameraNo": "344",
                            "cctvFileName": "source.json",
                            "enabled": False,
                            "runnable": True,
                            "message": "",
                            "disabledParkingSlotNames": [],
                            "mappedParkingSlotNames": ["zoneA_slot01"],
                        }
                    ] if payload["profiles"] else [],
                    "issues": [],
                }

        backend = ChangingBackend()
        with tempfile.TemporaryDirectory() as directory, \
            patch.object(multi_camera, "_BACKEND_PROFILE_TEMP", None), \
            patch.object(multi_camera, "_NO_PROFILE_NOTICE_SHOWN", False), \
            patch.object(multi_camera, "BACKEND_PROFILE_REFRESH_SECONDS", 0), \
            patch("multi_camera.time.sleep", side_effect=KeyboardInterrupt):
            result = _run_remote_controlled(
                [],
                backend,
                Namespace(
                    export_dir=Path(directory),
                    parking_json=None,
                    max_frames=0,
                    no_export=True,
                    max_restarts=0,
                    restart_delay=0.1,
                ),
            )
            if multi_camera._BACKEND_PROFILE_TEMP is not None:
                multi_camera._BACKEND_PROFILE_TEMP.cleanup()
                multi_camera._BACKEND_PROFILE_TEMP = None

        self.assertEqual(result, 0)
        self.assertGreaterEqual(backend.fetch_count, 2)
        self.assertTrue(
            any(payload["profiles"] for payload in backend.sync_payloads)
        )


if __name__ == "__main__":
    unittest.main()
