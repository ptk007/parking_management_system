# CCTV Detection and Tracking Model

The runtime estimates slot occupancy from existing CCTV. Vehicle detection, track continuity, and slot geometry determine occupancy. Plate detection and Thai OCR provide vehicle identity when the image is readable.

## Data and dataset inventory

| Data | Local evidence | Use |
| --- | --- | --- |
| Live RTSP video | CCTV presets and authorized camera access | Inference input. Camera configuration contains private connection details. |
| Parking-space annotations | `python-v2/parking_slots/E4_zoneA_cars.json` through zone D | COCO-style annotations. The four files contain one reference image each and 6, 6, 5, and 8 parking-slot annotations respectively. These are 25 annotated spaces, not occupancy evaluation examples. |
| Car Detection v5 | Candidate Roboflow dataset recorded in the [research report](../../docs/Parking_Detection_Model_Project_Report.md#21-dataset-description-and-sources). | Vehicle detection training reference. Confirm the export and checkpoint provenance before citing it as the training set. |
| License Plate Recognition v12 | Candidate Roboflow Universe dataset recorded in the same report. | Plate localization reference. Confirm the checkpoint source, class list, split, and licence. |
| Small image diagnostic set | [python-v2/pic_test/](../../python-v2/pic_test/) | Checks individual sample images and saves detection summaries and annotated images. |
| Local labeled evaluation clips | Proposed in the [senior project proposal](../../docs/Proposal/Parking_Management_System_Proposal.md) | Authorized, manually labeled clips for measuring occupancy, tracking, and plate-read accuracy by condition. |

Annotation files use `categories[].id/name/supercategory`, `images[].id/width/height`, and `annotations[].image_id/category_id/bbox/segmentation`. The API uses named `parking-slot` categories for map assignments. A worker uses image dimensions, boxes, and polygons to scale geometry to the stream. The floor editor separately stores simplified map layout geometry in MongoDB.

## Models and tracking

| Stage | Implementation |
| --- | --- |
| Capture | [cctv_viewer.py](../../python-v2/cctv_viewer.py) resolves the configured RTSP source and reads frames using OpenCV. |
| Vehicle detection | `models/trained_car_detector.pt` loads at worker startup. The current code uses car confidence `0.80`, detector image size `960`, and detection every `8` frames. These are configuration values. |
| Multi-object tracking | Ultralytics `track` uses [parking_botsort_reid.yaml](../../python-v2/tracker/parking_botsort_reid.yaml). BoT-SORT has ReID enabled, `track_buffer: 120`, and `match_thresh: 0.80`. |
| Canonical vehicle IDs | [parkng_model.py](../../python-v2/parkng_model.py) keeps a stable ID across raw tracker ID changes. Same-frame uniqueness, movement and location checks, and slot-owner recovery help prevent two track IDs from claiming one parked car. |
| Occupancy | The model compares polygon/box overlap with a lower vehicle anchor and motion. Repeated detections establish entry, parking, and exit. Owner locking and hold rules reduce premature releases under short occlusions. |
| Plate detector | `models/best_license_plate_detector.pt` loads on demand when the plate-reading stage runs. This stage works on candidate vehicle crops. |
| Thai OCR | EasyOCR initializes lazily with `['th']`. The pipeline scores candidate reads and uses repeated evidence before publishing stable plate text. The backend can infer province from a registered vehicle if a province is absent. Unresolved values can remain `Unknown`. |

The repository contains the checkpoint files. It does not establish the exact model generation, full training settings, or evaluation accuracy. Use the checkpoint filenames and verified metadata when describing the project.

## Runtime workflow

1. Windows backend startup launches `run.bat`. Its virtual environment defaults to `C:\py_venv\.venv`. It checks imports and GPU availability, then invokes [launcher.py](../../python-v2/launcher.py).
2. [multi_camera.py](../../python-v2/multi_camera.py) reads backend profiles about every two seconds and sends runtime sync about every half second. It matches a profile by camera number and original CCTV source filename. Ambiguous bindings and invalid sources or annotations can prevent worker startup.
3. Each enabled runnable preset gets its own camera worker. A valid camera preset without map assignments can show YOLO preview. Parking-log and map updates depend on assignments.
4. The worker reads frames, detects and tracks vehicles, evaluates slot occupancy, and optionally reads a plate. It writes annotated preview frames to `python-v2/results/runtime_frames/` and keeps diagnostic output separately under the camera's results directory.
5. [parking_model_events.py](../../python-v2/parking_model_events.py) queues model events outside the frame processing loop. Slot messages use `POST /api/parking-logs/model-slot-status`. Plate events use `POST /api/parking-logs/model-events`. Both authenticate with the private model API key.
6. Runtime sync returns mapped/disabled slot names and corrected vehicle labels. Disabling one preset stops its worker. When all workers are off, the supervisor remains available for later commands.

## Status translation and session behavior

| Runtime observation | API result |
| --- | --- |
| Model `available` | Map `available`. An active session closes and the current vehicle details clear. |
| Model `occupied` while a car is entering | Map `incoming`. Entry movement alone does not open a parking session. |
| Model `parking` after a car settles | Map `occupied`. A recognized plate can create a known session. An unread plate can start a Guest log with `Unknown` plate and province. |
| Model reads a stable plate after parking | The backend can update the existing unknown session using its original ID and entry time. |
| Admin or staff corrects an occupied slot | Backend can update the log owner and sends the corrected values to the worker for the preview. |
| Slot administratively disabled on the map | The map status stays `disabled`. Python shows the disabled overlay and can indicate `disabled (Parking)` if a vehicle is present. |

## Evaluation outline

Measure vehicle/plate detection, tracking continuity, occupancy transitions, exact plate text, and end-to-end delay separately. Label arrival, settled parking, and departure times on authorized local video. Compare conditions such as daylight, low light, occlusion, and distant plates. Record the camera, weight versions, configuration, and annotation revision for each run. Keep nearby frames from the same parking session together when splitting evaluation data.

See [Docs.md](../docs/Docs.md) for the system flowchart and data flow diagram. [Backend.md](../back/Backend.md) documents the request contracts.
