1501418 | SELECTED TOPICS IN DATA SCIENCE AND AI

# Computer-Vision Parking Detection and Occupancy Model

Project report grounded in the parking management system repository

| Cover item | Information |
| --- | --- |
| Course | 1501418 Selected Topics in Data Science and AI |
| Project topic | Model detection for a parking management system |
| Prepared | 12 November 2026 |

Problem → Existing CCTV → Detection and tracking → Occupancy decision → Action

# Executive Summary

As a senior computer engineering project, this work asks a practical question: how much more useful can the university’s existing parking CCTV and CCTV code become when they are connected to a parking management workflow? The current repository already combines car and licence-plate YOLO detectors, BoT-SORT tracking with ReID, Thai EasyOCR, annotated parking-space geometry, temporal occupancy rules, and backend event updates. The goal is to understand that implementation, identify what still needs improvement, and assess what would be required for a system staff could use in practice.

The detection model is one part of a larger decision-support pipeline. YOLO locates cars and plates, tracking links detections across frames, and the slot-state logic uses each car’s position over time to update the parking map. The repository shows a working prototype, but it does not include a labelled evaluation set or verified accuracy and latency results. This report therefore separates implemented features from proposed evaluation work.

> Evidence boundary: implementation facts are from supplied project files; external research supports method rationale. Evaluation values below are proposed targets, not achieved results. CCTV and plate data require owner authorization and privacy safeguards.

# 1. Part 1 — Problem Identification and Justification

## 1.1 Case and problem definition

The project case is the university parking area and the CCTV equipment and code that are already available there, as described by the student. The software in this repository is designed to read camera presets and parking-space geometry, display detections over CCTV frames, and publish parking-state changes and history to the backend.

The practical problem is that camera footage by itself does not give staff a convenient, current view of every mapped space. Checking multiple feeds manually takes time, and a state can become stale when a vehicle is hidden or the tracker assigns it a new ID. A parking-management workflow can turn the existing video into slot-level information that staff can review. Research on vision-based parking systems also cautions that results depend on the dataset and evaluation protocol, so performance needs to be checked on the university’s camera views (de Almeida et al., 2022).

> Decision statement: The proposed model will help parking staff and administrators decide which mapped parking spaces are available, receiving a vehicle, occupied, or disabled by using authorized CCTV frames, parking-slot annotations, vehicle tracks, and time-stamped events.

## 1.2 Justification and stakeholders

The need is operational: a current shared view of slot availability and a traceable record of parking/exit transitions. Vision can reuse installed cameras, but findings from public datasets cannot be assumed to transfer to this facility. The solution is useful only if its output is accurate and timely enough for the local decision (de Almeida et al., 2022).

| Stakeholder | Role | Information / decision required |
| --- | --- | --- |
| Parking administrator | Decision maker | Camera/zone health, mapped status, event history and exceptions |
| Attendant / staff | Operational user | Which space needs checking; whether a car entered, parked, or exited |
| Drivers / visitors | Affected users | Reliable availability information and fair parking records |
| System operator | Maintains cameras/model | Feed health, quality, thresholds, errors, safe updates |
| Facility / data owner | Authorizes data | Purpose, retention, access control, privacy requirements |

## 1.3 What the current system already does and what needs work

The repository already provides a useful starting point. It reuses CCTV feeds, supports one or more camera workers, draws detections over the live view, maps cars to configured parking spaces, updates the backend map, and keeps parking history. These features can reduce repeated manual checking and give staff one place to review status across zones.

The code and available files also show areas that need improvement before the system can be treated as a reliable university service:

| Current strength or gap | Why it matters for a practical system |
| --- | --- |
| Existing cameras and CCTV runtime are already part of the project context | Reusing this infrastructure can reduce additional hardware and avoid building a separate camera pipeline. Camera owner approval and feed stability still need to be confirmed. |
| The runtime has detection, tracking, mapped slot states, backend updates, and persistent event history | The system connects visual evidence to a real parking workflow, rather than stopping at drawing boxes around cars. |
| The repository contains no documented held-out evaluation for university camera feeds | Staff need evidence about occupancy errors, stale states, and update delay before depending on the map. |
| Existing model weights do not include verified training provenance in the inspected package | The team must check whether the selected Roboflow datasets were used, confirm versions and licences, and keep model lineage reproducible. |
| Parking-space geometry is camera-specific and must match the correct view | A mismatch between camera, image resolution, or slot polygon can mark the wrong space; overlay inspection and calibration are needed. |
| The car confidence constant is 0.80 while nearby comments describe 0.60 | Configuration and documentation should agree before evaluation so results can be reproduced. |
| Plate reading and storing plate text introduce accuracy and privacy concerns | Check Thai plate suitability and OCR quality; limit plate use and access it only when operationally needed. |
| Runtime depends on a working stream, GPU environment, backend connection, and mapping | Add clear stale-feed/worker health indicators and a staff fallback when a dependency fails. |

## 1.4 Project objectives and questions

The project has two main objectives:

1. Make the best practical use of the CCTV cameras already installed in the university parking area and the CCTV source code the university already has. The project will connect those resources to the detection and parking-status workflow and demonstrate how they can support staff.

2. Study the advantages of having a parking management system and identify weaknesses in the current parking process that should be improved. Use those findings to define requirements for a system that could work in practice.

To make these objectives assessable, the project will document which existing camera feeds and code components are reused, describe the current workflow and its pain points with evidence from the project context, and evaluate a prototype against labelled clips using occupancy accuracy and update delay. These are planned measurements; the report does not claim results that have not yet been collected.

### Project questions

- How reliably does the car detector find vehicles across local camera views, lighting, and occlusion?

- How accurately do slot polygons, tracking, and persistence rules distinguish available, entering, parked, exiting, and disabled states?

- Does BoT-SORT with ReID reduce ID switches enough to improve parking-session continuity?

- What is the error/latency trade-off at current inference cadence, and when should staff verify the result?

# 2. Part 2 — Dataset and Data Model

## 2.1 Dataset description and sources

The project combines three kinds of visual data with the university’s existing camera feeds: labelled car images, labelled licence-plate images, and parking-space annotations. The project identifies the following Roboflow sources for this work. A separate, site-specific evaluation sample should be collected from authorized university CCTV because public image datasets cannot show by themselves whether the model works on the university’s own camera angles, lighting, and occlusions.

The selected licence-plate source is Roboflow Universe version 12. Its public page reports 10,125 images, a 70/20/10 train-validation-test split, object-detection labels, and a CC BY 4.0 licence. The version-5 car page and parking-slot annotation workspace are the supplied project links; their image counts, export versions, annotation classes, and licence/usage terms need to be confirmed from the workspace or exported dataset metadata. The local parking-slot JSON files should also be matched to the Roboflow project before claiming they were exported from it.

| Dataset / source | Intended use and verified details |
| --- | --- |
| [Car Detection, version 5](https://app.roboflow.com/joeys-workspace-ygf73/car-detection-qzvuh/5) | Student-provided Roboflow source for car bounding-box detection. Version 5 is indicated in the URL. Dataset size, class names, split, licence, and export settings need confirmation in the workspace. |
| [License Plate Recognition, version 12](https://universe.roboflow.com/roboflow-universe-projects/license-plate-recognition-rxg4e/dataset/12) | Roboflow object-detection dataset for plate localization. Public page reports 10,125 images (7,057 train / 2,048 validation / 1,020 test), auto-orient preprocessing, no augmentations, and CC BY 4.0. Check whether plate appearance and script match Thai plates and the university cameras before training or evaluation. |
| [Parking slot E4 annotation workspace](https://app.roboflow.com/joeys-workspace-ygf73/parking_slot-e4/annotate) | Student-provided Roboflow workspace for parking-slot boxes. This is an annotation-page link; exported dataset version, label schema, image count, and usage terms need confirmation. |
| University CCTV | Existing university parking cameras and CCTV source code, per the student's project context. Use only with facility authorization; record camera scope and collection period. |
| Runtime outputs | JSON/CSV snapshots and parking history under `python-v2/results/`; backend camera, zone/slot mappings, map states, and events. These are system outputs, not independent ground-truth labels. |
| Local slot annotations | Four E4 zone JSON files are present. Each has one reference image and 6, 6, 5, and 8 annotations respectively (including a generic parent class), or 21 slot-specific annotations after excluding `parking-slot`. Confirm whether these files were exported from the Roboflow workspace above. |
| Target / evaluation labels | Human-verified slot state over time (available / entering / parked / exiting / disabled), plus car and plate boxes for detector evaluation. Slot geometry alone is not an occupancy label. |
| Collection period and date accessed | Stream/history extraction window is not recorded in the repository. Project files were reviewed on 12 November 2026; record actual collection dates for the evaluation extract. |
| Licences and conditions | The plate dataset page lists CC BY 4.0. Terms for the car and slot projects, university CCTV, and local weights remain to be confirmed. Follow source licences and obtain CCTV owner approval before use or redistribution. |

## 2.2 Relevance, representativeness, and limitations

- Relevance: camera frames show vehicles in the exact mapped spaces. Zone JSON gives fixed geometry/names; runtime records preserve status and event times.

- Coverage: multiple cameras/zones are supported, but the repository does not establish labelled hours/days, light, weather, occupancy classes, or viewpoint diversity.

- Bias risks: one view may dominate; night, glare, rain, occlusion, unusual vehicles, and changed camera position may be underrepresented. Random adjacent-frame splits leak near-duplicate scenes.

- Privacy: video and plate text can identify people or movement. Restrict access, redact exports, minimize plate retention, and follow the owner-approved purpose.

- Weight provenance: trained_car_detector.pt and best_license_plate_detector.pt are expected by the runtime, but their training data, model generation, date, and licenses are not documented here. Verify metadata before claiming them.

## 2.3 Data dictionary

| Variable | Type | Description / example | Role |
| --- | --- | --- | --- |
| camera_id | String | Stable preset camera ID | Key / group |
| frame_timestamp | Datetime | Capture or event time | Time index |
| frame_id | Integer | Frame sequence | Metadata |
| car_bbox | 4 numbers | x1,y1,x2,y2 | Detection output |
| car_confidence | Float | YOLO confidence | Output / QA |
| canonical_car_id | Integer/string | Track ID with alias recovery | Track key |
| plate_bbox / confidence | Box / float | Plate crop detection | Output / optional sensitive |
| plate_text | String | Thai OCR text if read | Sensitive; exclude from occupancy features |
| slot_name | String | e.g., zoneB_slot07 | Slot key |
| slot_polygon | Coordinates | COCO annotated slot region | Geometry |
| overlap / anchor | Numbers / boolean | Car-to-slot geometric signals | Rule features |
| slot_status | Category | available, occupied, parking, disable | Target / decision output |
| parking_started_at / exited_at | Datetime | Session boundaries | Outcome/event fields |
| license_plate | String | Stable OCR plate, when sent | Sensitive join key; restrict |

## 2.4 Data quality and preprocessing

| Issue | Check and treatment |
| --- | --- |
| Missing/interrupted frames | Log read failures and timestamps; exclude unreadable frames and report coverage. |
| Duplicate events | Deduplicate by slot, start, exit, car and plate; compare run ID and time. |
| Geometry mismatch | Validate COCO categories, polygons, image dimensions, camera-zone mapping and overlay against actual view. |
| Ambiguous labels | Define entering vs parked vs exiting; dual-review sample and adjudicate conflicts. |
| Class imbalance | Report each state and macro-F1; collect rare transitions; class weighting only if training a classifier. |
| Outliers | Flag invalid confidence, impossible boxes, negative durations, unknown slots and time disorder. |
| Leakage | Split by day/session; hold out a camera where feasible; do not randomly split neighboring frames. |
| Sensitive data | Restrict raw video/plates; redact examples and separate test IDs from identities. |
| Category mismatch | Normalize status names and version the mapping to backend terms. |

## 2.5 Exploratory analysis and visualizations

The repository has no verified labelled CCTV evaluation extract or EDA notebook. The three analyses below are the plan for the report’s charts. Add the actual plots and observations after an authorized sample has been labelled; do not treat a Roboflow train/test split or a slot-geometry file as proof of university-camera performance.

| Analysis / chart | Axes / groups | Interpretation and decision relevance |
| --- | --- | --- |
| 1. State distribution by zone/hour | x: hour/zone; y: count or share of verified available, entering, parked, disabled states | Shows demand patterns and rare classes; stratify evaluation and choose monitoring periods. |
| 2. Detection quality by condition | x: day/night, glare/occlusion, camera; y: car precision/recall and occupancy macro-F1 | Finds weak views hidden by overall averages; may motivate camera or threshold changes. |
| 3. Transition timeline / update delay | x: seconds since labelled arrival/exit; y: observed slot state, by zone | Shows stale-state duration, false transitions, and whether updates are timely for staff. |

## 2.6 Data model

This logical model separates static camera/slot configuration, frame-level inference, and event history. Exact backend collection names and constraints should be confirmed against the API schema.

| CCTV Frame (camera, time) | SlotGeometry (slot, polygon) | CarDetection (box, score) | VehicleTrack (ID, time) | SlotState (status, features) | ParkingEvent (start, exit) |
| --- | --- | --- | --- | --- | --- |

Relationships: one Camera has many Frames; one Zone has many Slots; one Frame has many CarDetections; one Track links detections over time; each SlotState references a Slot and timestamp; each ParkingEvent references camera, mapped slot, track, and optional restricted plate token. Data flow: validate frame → detect → track and canonical-ID recovery → car/slot geometry → temporal state machine → backend map/history and JSON/CSV audit snapshot.

# 3. Part 3 — Proposed Decision Model

## 3.1 Model choice and alternatives

Selected approach: a hybrid computer-vision decision model. Separate YOLO detectors locate cars and plates; BoT-SORT with appearance ReID links car detections over time; EasyOCR reads Thai plate crops; deterministic polygon/anchor overlap and temporal persistence rules infer slot state. This fits the task because detection finds a vehicle, tracking links it over time, and rules translate evidence into an operational map state. BoT-SORT associates objects using motion and appearance cues (Aharon et al., 2022); Ultralytics describes tracking as inference-time association applied with a detection model (Ultralytics, n.d.).

A per-image occupancy classifier is a useful baseline but does not inherently preserve identity or event continuity. Compare configured BoT-SORT to ByteTrack, a lighter tracker without appearance ReID. Sensor-only systems require new hardware. Regression, clustering, RAG, or generative AI do not answer real-time spatial occupancy and add no clear benefit here.

## 3.2 Decision-model components

| Component | Project description |
| --- | --- |
| Users | Parking administrators and staff; operators review health and exceptions. |
| Input | Authorized video, camera/zone config, COCO slot polygons, tracked car boxes, optional plate crops and prior slot state. |
| Processing | Car YOLO each 8th frame at image size 960; car confidence constant 0.80. Plate YOLO at size 640, threshold 0.30; Thai EasyOCR. BoT-SORT ReID, software ID recovery, polygon overlap, lower-middle anchor and temporal state rules. |
| Output | Annotated frame, tracks, per-slot state/counts, overlap diagnostics, events, latest JSON/CSV and backend updates. |
| Decision | What status to show for each mapped slot; whether staff should inspect stale/uncertain state. |
| Action | Staff view map/preview, verify uncertain cases, correct status, review history. |
| Feedback | Log human correction and adjudicated label; tune/version thresholds and evaluate before deploying model changes. |

> Code detail to reconcile: CAR_CONF_THRESHOLD is set to 0.80, but nearby comments describe a 0.60 application filter. The actual frame filter uses the constant. Confirm intended value, update comments/code consistently, and freeze the tested value before evaluation.

## 3.3 Model workflow and architecture

| 1 Collect CCTV + map | 2 Validate feed, time, geometry | 3 Prepare frame + privacy | 4 Detect car/plate YOLO | 5 Track BoT-SORT + ReID | 6 Infer slot geometry + time | 7 Evaluate held-out labels | 8 Decide map/action | 9 Record event + feedback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

The runtime uses a latest-frame RTSP reader to reduce stale backlog. Backend presets can start/stop camera workers; model state events are queued for asynchronous publication. Model “occupied” (car arriving) maps to backend “incoming”; model “parking” (settled) maps to backend “occupied”; “available” remains available. Parking and Exited transitions create history events (project runtime README and event publisher).

## 3.4 Technical design

| Element | Specification |
| --- | --- |
| Learned models | Weights: models/trained_car_detector.pt and models/best_license_plate_detector.pt. Exact YOLO generation, classes, training data/parameters and licenses are undocumented in this package; inspect metadata. |
| Inputs / outputs | Frame → car boxes/confidence; car crop → plate box/confidence → Thai OCR candidates/votes. Slot polygons + tracked boxes feed temporal logic. |
| Tracker | BoT-SORT config: ReID on, track buffer 120, high/low/new thresholds 0.25/0.10/0.55; camera-motion compensation off for fixed CCTV. Additional ID recovery uses spatial/motion and stable-plate memory. |
| Cadence / device | Car image size 960; inference every 8 frames. Plate size 640. CUDA requested by default; CPU fallback is explicit opt-in. |
| Occupancy target | Slot states over time: available, incoming/occupied transition, parked, disabled. The backend mapping is explicitly versioned; slot geometry is not an occupancy label. |
| Baseline | Per-slot last-state persistence plus simple per-frame car/slot overlap. Compare BoT-SORT and ByteTrack using identical detector outputs. |
| Split | No training dataset is documented in repo. Label clips across days; tune on train/validation days; hold out later days and a zone/camera if feasible. Split by camera/date before augmentation. |
| Parameter selection | Freeze confidence thresholds, sizes, cadence, tracker settings, overlap/persistence rules. Choose operating point on validation using false-available cost and recall; lock before test. |
| Expected output | Status, transition time, contributing track, overlap/coverage, confidence diagnostics, event. OCR is not proof of occupancy and is not required for availability. |

## 3.5 Evaluation and success criteria

Evaluate object detection, identity tracking, slot decision, and end-to-end behavior separately using independently labelled held-out clips. Report per-camera/condition metrics and session-level confidence intervals where feasible. Temporal neighbors must stay in one split.

| Level | Measures | Proposed target — not yet measured |
| --- | --- | --- |
| Car detection | IoU-matched precision/recall, mAP@0.5:0.95, by camera and lighting | Recall ≥0.90 and precision ≥0.90 at selected operating point |
| Tracking | IDF1, HOTA or ID switches/1,000 frames; compare ByteTrack | IDF1 ≥0.80 and fewer ID switches than baseline |
| Slot decision | Macro-F1, confusion matrix, false-available rate | Macro-F1 ≥0.90; false-available ≤2% on held-out slot-time samples |
| Events / runtime | Arrival-to-map latency, missed/duplicate events, feed uptime | ≥95% of valid transitions within 2 seconds; ≥99% event uniqueness |
| Staff usefulness | Reviewer usefulness, correction rate and task completion | ≥80% rate map output useful; define users and questionnaire |

These are proposed project targets, not results. With imbalanced states, macro-F1 and false-available rate are more useful than overall accuracy. Object detection uses IoU-based measures; tracking uses identity metrics; occupancy requires end-to-end state/latency checks because good boxes can still yield a wrong slot state.

## 3.6 Translating output into decisions

| Output | Decision | Action / record |
| --- | --- | --- |
| Available; stable, camera healthy | Normal | Show available; retain timestamp and camera/slot ID. |
| Incoming transition | Verify if needed | Show incoming while maneuvering, then occupied when persistence confirms; preview is available. |
| Parked / stable | Normal | Show occupied; record parking start and mapped slot. Restrict plate access. |
| Exit candidate | Verify if ambiguous | Wait for exit evidence before releasing; record exit and history event. |
| Low-quality, stale, disagreement, unknown slot | Uncertain | Do not confidently advertise available; flag needs-check and ask staff to verify. |
| Disabled | Unavailable by configuration | Do not assign or advertise free; show disabled. |

Results appear in the admin CCTV preview with car boxes/tracks, plate-box confidence, OCR labels and slot overlays; the map shows backend status and event history. Human approval is recommended for uncertain states and all overrides. Record operator, time, old/new state, reason and camera/slot; do not expose plate text in general dashboards.

## 3.7 Proof of concept

The repository already includes python-v2/parkng_model.py and a multi-camera supervisor. It loads car/plate weights, reads CCTV, tracks objects, loads zone polygons, infers parking states, renders annotations, persists latest.json / cars_latest.csv / slots_latest.csv / parking_history.csv, and can publish events to the backend. Demonstrate one authorized clip: (1) car box and track ID; (2) slot overlay; (3) incoming-to-parked-to-available transition; (4) backend event/history; (5) an occlusion case that triggers human review.

Reproducible demo: pin code/model versions and thresholds, use a short consented clip and its zone JSON, save output frame/state/event log, and compare with a hand-labelled timeline. Label simulated tests as simulated; do not present them as deployment results.

## 3.8 Benefits, limitations, ethics and risks

| Area | Assessment and mitigation |
| --- | --- |
| Benefits | Faster shared availability view; fewer repeated checks; time-stamped history; multi-camera workflow; reuse of installed cameras. |
| Limitations | Camera-specific polygons; occlusion/light changes; network/GPU dependence; OCR errors; no verified model metrics or training provenance; four JSONs are geometry examples, not an occupancy dataset. |
| Bias / fairness | Audit zones, time, vehicle types and occlusion. Missing plate OCR alone must not alter occupancy or trigger adverse action. |
| Privacy | Approved purpose; minimize plate retention; restrict footage/plate access; redact identifiers; set retention/deletion rules and audit access. |
| Explainability | Show slot polygon, car box, track ID, confidence, overlap/anchor signals and transition reason; retain threshold/version metadata. |
| Incorrect output | False available misdirects drivers; false occupied wastes capacity. Use persistence, stale-feed alarms, “needs check”, staff correction and rollback. |
| Security / resilience | Keep API keys server-side; restrict event endpoints; mask stream credentials; retry queued events; monitor worker health; avoid stale frames as live data. |
| Oversight | Staff can verify uncertain states and override with a reason. Do not use model-only output as basis for enforcement or penalties. |

# 4. Conclusion

The implementation is a hybrid vision system, not just one YOLO detector. It combines vehicle/plate detection, tracking, site-specific slot geometry, temporal occupancy rules, and backend actions. Code and zone annotations support a proof of concept; the next essential academic step is an authorized, labelled and time-aware evaluation. Until that is completed, no university-camera accuracy or latency result is claimed. The one dataset count reported here is the public Roboflow plate version’s published image count; the other Roboflow project metadata still needs checking.

# References

Roboflow. (n.d.). *Car Detection* (version 5) [Object-detection dataset]. Roboflow. https://app.roboflow.com/joeys-workspace-ygf73/car-detection-qzvuh/5

Roboflow Universe Projects. (2026). *License Plate Recognition* (version 12) [Object-detection dataset]. Roboflow Universe. https://universe.roboflow.com/roboflow-universe-projects/license-plate-recognition-rxg4e/dataset/12

Roboflow. (n.d.). *Parking slot E4* [Annotation workspace]. Roboflow. https://app.roboflow.com/joeys-workspace-ygf73/parking_slot-e4/annotate

Aharon, N., Orfaig, R., & Bobrovsky, B.-Z. (2022). BoT-SORT: Robust associations multi-pedestrian tracking. arXiv. https://arxiv.org/abs/2206.14651

Research paper on motion and appearance association.

de Almeida, P. R. L., Alves, J. H., Parpinelli, R. S., & Barddal, J. P. (2022). A systematic review on computer vision-based parking lot management applied on public datasets. Expert Systems with Applications, 198, 116731. https://doi.org/10.1016/j.eswa.2022.116731

Supports attention to dataset dependence and evaluation protocols.

Ultralytics. (n.d.). Multi-object tracking. Ultralytics documentation. Retrieved November 12, 2026, from https://docs.ultralytics.com/modes/track/

Official documentation on inference-time tracking.

Parking Management System repository. (2026). Python CCTV runtime, parking-slot annotations, event publisher, and runtime documentation [Source code]. Local project files.

Implementation sources: python-v2/README.md, parkng_model.py, parking_config.py, parking_model_events.py, parking_export.py, tracker/parking_botsort_reid.yaml and python-v2/parking_slots/*.json.

# Appendix A — Finalization items

Complete these items with the project group before formal submission; repository contents alone cannot verify them.

- Add student names and honest contribution statement for each member.

- Confirm CCTV owner, permission, camera scope, retention and evaluation date range.

- Inspect weight metadata/license; document model generation, classes, training data and version.

- Resolve the 0.80 confidence constant versus 0.60 comments; freeze config.

- Generate the three EDA charts from approved labels and state observed counts.

- Run held-out evaluation; replace targets with measured results and per-camera confusion matrices/latency.

- Verify backend state mapping and human override against deployed UI/API.

- Review citations, AI-use disclosure and privacy handling with group/instructor.

> Suggested AI-use acknowledgment (edit to match actual use and course rules): “Generative AI helped draft and organize this report. The project team reviewed claims against the repository, verified measurements and references, and remains responsible for the submitted work.”
