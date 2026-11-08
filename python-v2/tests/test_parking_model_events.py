import hashlib
import json
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import MagicMock, patch

from multi_camera import _profile_parking_inventory, _runtime_frame_path
from parking_model_events import (
    ModelRuntimeClient,
    ParkingModelEventPublisher,
    write_worker_status,
)


class ParkingModelEventPublisherTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
