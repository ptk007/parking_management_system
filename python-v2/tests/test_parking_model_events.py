import json
import unittest
from unittest.mock import MagicMock, patch

from parking_model_events import ParkingModelEventPublisher


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


if __name__ == "__main__":
    unittest.main()
