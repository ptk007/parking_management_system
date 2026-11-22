1501418 | SELECTED TOPICS IN DATA SCIENCE AND AI

# Car Detection and Parking-Slot Occupancy Using Existing CCTV

Project report grounded in the parking management system repository

| Cover item | Information |
| --- | --- |
| Course | 1501418 Selected Topics in Data Science and AI |
| Project topic | Car detection and parking-slot occupancy for a parking management system |
| Prepared | 12 November 2026 |

Problem → Existing CCTV → Detection and tracking → Occupancy decision → Action

# Executive Summary

This project reuses university CCTV/code to detect cars and estimate mapped-slot occupancy. Plate detection and OCR are supporting features, not occupancy requirements. The prototype needs local evaluation; no verified CCTV accuracy or latency results are available.

The pipeline tracks cars against camera-specific slot geometry. Plate detection loads on demand; OCR starts only after a plate box is found. The report distinguishes implementation, qualitative plate observations, and planned evaluation.

> Evidence boundary: implementation facts are from supplied project files; external research supports method rationale. Evaluation values below are proposed targets, not achieved results. CCTV and plate data require owner authorization and privacy safeguards.

# 1. Part 1 — Problem Identification and Justification

## 1.1 Case and problem definition

The case is the university parking area and its existing CCTV/code, as described by the student. The repository reads camera presets and slot geometry, overlays detections, and publishes status changes and history to the backend.

Video alone may not provide staff with a current slot-level view; checking feeds takes time, and occlusion or track-ID changes can leave stale states. The system aims to turn existing footage into reviewable parking information. Public-dataset results may not transfer to local views, so local evaluation is needed (de Almeida et al., 2022).

> Decision statement: The proposed model will help parking staff and administrators decide which mapped parking spaces are available, receiving a vehicle, occupied, or disabled by using authorized CCTV frames, parking-slot annotations, vehicle tracks, and time-stamped events.

## 1.2 Justification and stakeholders

The intended benefit is a shared, timely slot view and traceable parking/exit history using installed cameras. Its value depends on local accuracy and update speed (de Almeida et al., 2022).

| Stakeholder | Role | Information / decision required |
| --- | --- | --- |
| Parking administrator | Decision maker | Camera/zone health, mapped status, event history and exceptions |
| Attendant / staff | Operational user | Which space needs checking; whether a car entered, parked, or exited |
| Drivers / visitors | Affected users | Reliable availability information and fair parking records |
| System operator | Maintains cameras/model | Feed health, quality, thresholds, errors, safe updates |
| Facility / data owner | Authorizes data | Purpose, retention, access control, privacy requirements |

## 1.3 What the current system already does and what needs work

The prototype integrates with the current application: `parking-back` stores building/floor setup, CCTV presets, the parking map, and parking history; `parking-front` configures cameras and displays maps/logs (Parking Management System, 2026a, 2026b). Before operational use, it needs:

| Current strength or gap | Why it matters for a practical system |
| --- | --- |
| Existing CCTV/runtime | Reuse may reduce hardware and setup; confirm owner approval and feed stability. |
| Detection-to-backend workflow | Tracking, slot mapping, updates, and event history are implemented in the prototype. |
| No held-out local evaluation | Measure occupancy errors, stale states, and update delay before relying on the map. |
| Unverified weight provenance | Confirm dataset/version, training metadata, and licences for both weights. |
| Camera-specific geometry | Validate each slot polygon against its camera, resolution, and view. |
| Car confidence threshold 0.80 | Freeze and record the threshold used in evaluation. |
| Plate OCR and storage | Check Thai OCR quality; minimize and restrict plate data. |
| Stream/GPU/backend dependencies | Add health indicators and a staff fallback for failures. |

### Research context and the project's local contribution

Camera-based parking management is already an established research topic, including university deployments. Elomiya et al. (2023) studied camera-supported recommendations at the University of Pardubice. Cruz et al. (2024) described a university parking monitor using CCTV or recorded video, YOLOv8, and a web application backed by MongoDB. These examples mean this project should not claim to be the first university smart-parking system. A more defensible contribution is to adapt the university's existing CCTV, Python runtime, and parking application to its own mapped spaces, then evaluate occupancy transitions and plate/province readability under the actual local camera views.

The local gap still needs confirmation with parking staff: whether current operations have a timely slot-level view, how often staff check cameras, and which errors cause the most rework. The repository demonstrates camera presets, map status, and event history, but it does not establish how the university currently operates or quantify time saved. Treat benefits such as quicker availability checks and more useful utilization records as expected benefits to measure, not proven outcomes (Cruz et al., 2024; Elomiya et al., 2023).

This applied focus is consistent with the wider literature. A systematic review found that parking-vision studies can over-rely on particular public datasets and use evaluation protocols that do not reflect repeated vehicles across nearby frames; it recommends more varied conditions and stronger testing across datasets/views (de Almeida et al., 2022). The proposed local, time-separated and camera-aware evaluation therefore addresses a practical generalization question rather than claiming a new detection algorithm.

## 1.4 Project scope and assumptions

The primary scope is car detection and mapping tracked cars to configured slots over time. Plate detection/OCR are secondary: readable text may aid association, but OCR failure must not affect occupancy. The project does not claim campus-wide deployment, automatic enforcement, or reliable plate reading at every distance.

The current prototype and planned evaluation rely on these assumptions, which should be confirmed with the university or project supervisor:

| Assumption | Why it is needed / how to check it |
| --- | --- |
| CCTV/code use is authorized. | Confirm owner, purpose, cameras, access, and retention before collection. |
| Selected views include the evaluated spaces. | Check camera-zone mapping, resolution, and overlays. |
| Slot polygons remain aligned during evaluation. | Recheck after camera, zoom, or resolution changes. |
| Occupancy is primary; OCR is optional. | Evaluate occupancy without OCR; report plate/province reading separately. |
| Staff can verify uncertain/stale states. | Confirm workflow and fallback for feed, network, or model failure. |
| Clips can be labelled consistently. | Define states, review labels, and hold out sessions/views. |

These assumptions require confirmation with the university or supervisor.

## 1.5 Project objectives and questions

1. Reuse existing university CCTV/code to demonstrate car detection and mapped-slot status estimation.
2. Study parking-management benefits and current workflow limitations, using available evidence or consultation to define practical requirements.

Document reused cameras/code and evidence for workflow claims; evaluate car detection and occupancy on labelled clips. Report plate-number and province readability separately. Add numerical results only after defining and measuring the sample and metrics.

### Project questions

- How reliably does the car detector find vehicles across local camera views, lighting, and occlusion?

- How accurately do slot polygons, tracking, and persistence rules distinguish available, incoming, occupied, and disabled states, and how are these mapped to backend terms?

- Under what camera distance and image conditions can the plate detector and OCR read plate numbers and province text, and how often does this happen before a car occupies its slot?

- What is the error/latency trade-off at current inference cadence, and when should staff verify the result?

# 2. Part 2 — Dataset and Data Model

## 2.1 Dataset description and sources

The project uses labelled car/plate images and parking-space annotations for development. Evaluate separately on authorized university CCTV because public datasets do not represent local views, lighting, and occlusion. Established occupancy benchmarks illustrate both the value and limits of public data: PKLot contains 695,899 labeled space images from two car parks and three camera views; CNRPark+EXT contains about 150,000 labeled space patches from 164 spaces and nine cameras, with varied viewpoints, lighting, and partial occlusion. These are useful comparators in the literature, but they are not the project's active Roboflow training datasets and cannot substitute for local CCTV evaluation (de Almeida et al., 2015; Amato et al., 2017).

Roboflow Universe plate v12 reports 10,125 images, a 70/20/10 split, detection labels, and CC BY 4.0. Confirm car v5 and slot-workspace metadata, terms, and whether the local slot JSONs came from that workspace.

| Dataset / source | Intended use and verified details |
| --- | --- |
| [Car Detection, version 5](https://app.roboflow.com/joeys-workspace-ygf73/car-detection-qzvuh/5) | Car boxes. Confirm size, classes, split, licence, and export settings. |
| [License Plate Recognition, version 12](https://universe.roboflow.com/roboflow-universe-projects/license-plate-recognition-rxg4e/dataset/12) | Plate localization; 10,125 images (7,057/2,048/1,020), auto-orient, no augmentations, CC BY 4.0. Check Thai-script and camera fit. |
| [Parking slot E4 annotation workspace](https://app.roboflow.com/joeys-workspace-ygf73/parking_slot-e4/annotate) | Slot boxes. Confirm export version, labels, size, and terms. |
| University CCTV | Existing feeds/code; authorize use and record cameras/period. |
| Runtime outputs | `python-v2/results/` JSON/CSV/history and backend maps/events; outputs, not ground truth. |
| Local slot annotations | Four E4 JSONs: one reference image each, 6/6/5/8 annotations (21 slots excluding parent class). Verify Roboflow provenance. |
| Evaluation labels | Human-labelled slot states + car/plate boxes. Map runtime (`available`, `occupied` arriving, `parking`, `disable`) to backend (`available`, `incoming`, `occupied`, `disabled`). Geometry alone is not occupancy truth. |
| Collection / access | CCTV extraction dates absent; files reviewed 12 Nov 2026. Record actual dates. |
| Licences / conditions | Plate set: CC BY 4.0. Confirm car/slot terms, CCTV approval, and local-weight licences before use or sharing. |

## 2.2 Relevance, representativeness, and limitations

- Relevance: CCTV shows mapped spaces; zone JSON stores geometry; runtime records statuses and event times.

- Coverage: multiple views are supported, but labelled hours, weather, lighting, states, and viewpoints are undocumented.

- Bias: night, glare, rain, occlusion, vehicle types, or changed views may be underrepresented; random neighboring-frame splits can leak similar scenes.

- Privacy: restrict video/plate access, redact exports, minimize retention, and follow the approved purpose.

- Provenance: runtime expects both `.pt` weights, but their generation, training data, date, and licences are undocumented; verify metadata.

## 2.3 Data dictionary

The current MongoDB schemas are the authority for persisted fields. Front-end API types and per-frame model variables are not automatically database fields (Parking Management System, 2026a, 2026b).

| Current record | Fields and meaning |
| --- | --- |
| `parking_building` | `building_name`, `building_image`, `date_updated`, `time_updated`. The migration removes legacy `building_status`, `date_add`, and `time_add`. |
| `parking_floor` | `building` reference, `floor`, `veh_type`, `parking_slot_file(s)`, `parking_map`, embedded `camera_presets`, `status`, `date_updated`, `time_updated`. |
| Embedded `camera_presets` | Camera name/number, source filename, IP/RTSP fields, `status`, `sourceStatus`, `modelEnabled`, runtime status/message/time/ID, slot data/file ID, and refresh version. These are subdocuments, not a separate collection. |
| `parking_map.slots` | `number`, `zone`, `status` (`available`, `incoming`, `occupied`, `disabled`); optional `name`, `cameraPresetId`, `parkingSlotName`, `licensePlateDetected`. Map layout holds background, shapes, positions, and zoom. |
| `parking_log` | Building/floor/preset IDs, vehicle type, optional owner/name, slot name/number, brand/model/color, `license_num`, province, `date_enter`, `park_time`, `date_exit`, `exit_time`, `park_status`, and timestamps. `park_status` is `Parking`, `Exited`, or `Not parking`. |
| `vehicle` | Registered vehicle type, owner reference, brand/model/color, `license_num`, and province. Logs match registered vehicles by plate, province, and vehicle type; the log has no `vehicleId` field. |
| Runtime-only values | Frame IDs/timestamps, car boxes/scores, track IDs, plate boxes/OCR candidates, and overlap/anchor signals are inference or diagnostic values, not fields in these MongoDB schemas. |

Use the current names above: parking sessions use `license_num`, `cameraPresetId`, `date_enter`/`park_time`, and `date_exit`/`exit_time`. `parking_started_at`, `exited_at`, `camera_id`, and `license_plate` are not current fields in `parking_log`; `slot_status` is an import/API term, while persisted map slots use `status`. The front-end API record mirrors the backend log schema, but older type-only fields such as `ParkingLog.faceRecognition`, `ParkingSlot.currentVehicle`, and `lastUpdated` are not stored by the current backend.

The following dictionary focuses on attributes used to interpret occupancy and parking events. Mongoose types and allowed values follow the current backend; example plate and location values are synthetic and are not observations from the university.

| Attribute | Current type / allowed values | Synthetic example | Role in this study |
| --- | --- | --- | --- |
| `parking_floor.floor` | Integer (`Number`) | `1` | Groups spaces by level. |
| `parking_floor.veh_type` | String: `car` or `motorcycle` | `car` | Identifies the configured vehicle category. |
| `parking_map.slots[].status` | String: `available`, `incoming`, `occupied`, `disabled` | `occupied` | Primary mapped-slot state to compare with labelled ground truth. |
| `parking_map.slots[].licensePlateDetected` | Optional Boolean | `true` | Indicates that a plate was detected for a slot; not the OCR text itself. |
| `parking_log.license_num` | Required trimmed String | `AB 1234` | Plate identifier stored with a parking event; sensitive personal data. |
| `parking_log.province` | Required trimmed String | `Chonburi` | Province text stored with the event; assess OCR separately from plate-number reading. |
| `parking_log.date_enter`, `park_time` | Required Strings | `2026-11-16`, `08:30` | Entry date and time used to order event history. |
| `parking_log.date_exit`, `exit_time` | Nullable Strings | `2026-11-16`, `09:10` | Exit date/time; null while the session has not ended. |
| `parking_log.park_status` | String: `Parking`, `Exited`, `Not parking` | `Parking` | Session lifecycle value; distinct from a slot's map status. |
| `camera_presets.modelRuntimeStatus` | String: `Offline`, `Starting`, `Online`, `Stopping`, `Error` | `Online` | Camera-model worker health, not an occupancy label. |

Do not put real plates in report examples or public charts. Use synthetic examples or pseudonymous test IDs, and keep any identity mapping separate from evaluation data.

## 2.4 Data quality and preprocessing

| Issue | Check and treatment |
| --- | --- |
| Missing frames | Log failures/time; exclude unreadable frames and report coverage. |
| Duplicate events | Deduplicate by slot, times, car, plate; compare run ID. |
| Geometry mismatch | Check COCO labels, dimensions, camera-zone mapping, and overlay. |
| Ambiguous states | Define arrival/park/exit; map runtime/backend labels; review and adjudicate samples. |
| Imbalance | Report per-state counts/macro-F1; collect rare cases; weight only if training a classifier. |
| Outliers | Flag invalid scores/boxes, negative durations, unknown slots, and time disorder. |
| Leakage / generalization | Split by session/day; keep adjacent frames together; hold out a camera or view where feasible. Public parking datasets show performance can drop on an unseen lot/view, and review work flags repeated nearby frames as a source of unrealistic evaluation (de Almeida et al., 2015, 2022). |
| Sensitive data | Restrict raw video/plates; redact exports and separate test IDs from identities. |
| Category mismatch | Normalize and version backend status mapping. |

## 2.5 Preliminary observations and planned analysis

Preliminary tests show plate numbers and province text can be read from selected test images. In a clear live view, numbers are sometimes readable, but province text is often too small or distant; some plates are unreadable until the car parks. This is a plausible operating limitation: a prior Thai CCTV plate study treats localization and character recognition as separate stages on low-quality images, but it does not validate this project's model (Fooprateepsiri, 2014). Sample counts/conditions are unrecorded, so these remain qualitative observations, not accuracy results.

No labelled CCTV evaluation extract or EDA notebook is in the repository; the analyses below are planned, not completed results. For plate reading, record box detection, number/province exact reads, and arrival-to-parking timing by camera, apparent plate size/distance, parking phase, occlusion, and lighting. For occupancy, label states over time and compare update timing. Public splits and slot geometry do not prove local performance.

| Analysis / chart | Axes / groups | Interpretation and decision relevance |
| --- | --- | --- |
| 1. Status by zone/hour | x: zone/hour; y: verified status counts/shares | Demand and rare states; guides sampling. |
| 2. Quality by condition | x: camera, light, glare/occlusion; y: car precision/recall, occupancy macro-F1 | Reveals weak views for targeted fixes; report held-out views separately. |
| 3. Transition/update timeline | x: time since arrival/exit; y: labelled and system states | Measures stale time and update delay from timestamped sequences. |
| 4. Plate readability (secondary) | x: camera, apparent plate size/distance/parking phase; y: box, number, province exact-read rates | Separates localization and OCR; tests readability before and after parking. |

The reported EDA must be generated from approved, labelled samples. Until those samples are collected, these chart definitions are an analysis plan, not evidence of local demand, accuracy, or OCR success.

## 2.6 Data model

This model follows the current backend schema; `parking_map` and camera settings are embedded in a floor document, while session history is stored separately (Parking Management System, 2026a).

| Record | Relationship / role |
| --- | --- |
| `parking_building` → `parking_floor` | One building has many floors (`building` reference). |
| `parking_floor.camera_presets[]` | CCTV presets are embedded in their floor; each has connection/model settings and slot annotation data. |
| `parking_floor.parking_map.slots[]` | Map slots store geometry/layout separately from status; an assigned slot links to a preset with `cameraPresetId` and its annotation category with `parkingSlotName`. |
| `parking_log` | Each session refers to building, floor, and camera preset IDs and stores slot/plate/time/status values. `vehicle` matching is by plate + province + type, not a direct log foreign key. |
| Per-frame inference | Car/plate detections and tracks support decisions in the Python runtime; the current Mongo schemas do not persist those frame-level records. |

The Python model sends slot-state updates and parking events through separate backend endpoints. The backend updates `parking_floor.parking_map.slots[].status` and `licensePlateDetected`; it creates or updates a `parking_log` session for `Parking`, `Exited`, or `Not parking` events. These map states and session statuses are different fields with different purposes (Parking Management System, 2026a, 2026c).

# 3. Part 3 — Proposed Decision Model

## 3.1 Model choice and alternatives

Use a hybrid vision model: sampled-frame car YOLO, BoT-SORT/ReID tracking, and polygon/anchor overlap with temporal rules for occupancy. Load plate YOLO only at the plate stage and Thai EasyOCR only after a plate box is found. OCR may aid car association but does not determine occupancy. BoT-SORT combines motion/appearance cues (Aharon et al., 2022); Ultralytics applies tracking during inference (Ultralytics, n.d.). HOTA is a suitable primary tracking measure because it balances detection and association accuracy; IDF1 can remain a familiar secondary measure (Luiten et al., 2021).

Compare against per-image occupancy and ByteTrack baselines; neither provides BoT-SORT’s appearance ReID continuity. Sensor-only approaches need new hardware; regression, clustering, RAG, and generative AI do not directly solve real-time spatial occupancy.

## 3.2 Decision-model components

| Component | Project description |
| --- | --- |
| Users | Parking staff/admins; operators monitor health/exceptions. |
| Input | Authorized video, camera/zone config, slot polygons, car boxes/tracks, prior state; optional plate crops. |
| Processing | Car YOLO: every 8th frame, size 960, conf. 0.80. Plate YOLO: size 640, conf. 0.30, on demand; OCR starts after a plate box. BoT-SORT/ReID, ID recovery, overlap/anchor, temporal rules. |
| Output | White car box expanded 10% for display, track label, optional plate/OCR, slot states, diagnostics, events, JSON/CSV, backend updates. |
| Decision / action | Show slot status; staff check stale/uncertain cases, correct status, and review history. |
| Feedback | Log corrections/labels; version and evaluate rule or threshold changes. |

The white `Car {track_id}` box is expanded 10% from the prior inset box for display only; tracking, plate crops, and slot matching are unchanged. Car confidence is 0.80.

## 3.3 Model workflow and architecture

| 1 Collect CCTV + map | 2 Validate feed, time, geometry | 3 Prepare frame + privacy | 4 Detect car with YOLO | 5 Track BoT-SORT + ReID | 6 Infer slot state from geometry + time | 7 Optionally detect plate and run OCR | 8 Evaluate / decide map action | 9 Record event + feedback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Each worker reads the latest RTSP frame, loads the car detector at startup, and queues backend updates asynchronously; presets can start/stop workers. Plate YOLO/OCR stay idle until needed. Runtime `occupied` (arriving) maps to map `incoming`; runtime `parking` (settled) maps to map `occupied`; `available` stays `available`. The model sends slot updates (`slotStatus`, slot/preset identity, event time, optional plate-detected flag) separately from parking-log events (event type, plate, time, and slot). `parking-front` reads the saved map and log APIs; map statuses (`available`/`incoming`/`occupied`/`disabled`) are distinct from log statuses (`Parking`/`Exited`/`Not parking`) (Parking Management System, 2026a, 2026b, 2026c).

## 3.4 Technical design

| Element | Specification |
| --- | --- |
| Learned models | `trained_car_detector.pt` loads at startup; `best_license_plate_detector.pt` loads on demand; Thai EasyOCR starts after a plate box. YOLO generation/classes, training, and licences are undocumented. |
| Inputs / outputs | Frame→car boxes/scores; car crop→plate box→Thai OCR votes; polygons/tracks→temporal rules. |
| Tracker | BoT-SORT ReID; buffer 120; high/low/new 0.25/0.10/0.55; camera-motion compensation off. ID recovery uses spatial/motion and plate memory. |
| Cadence / device | Car size 960, every 8 frames; plate size 640; CUDA default, CPU opt-in. |
| Occupancy target | Time-based available/incoming/occupied/disabled; version backend mapping. Geometry alone is not ground truth. |
| Baseline | Last-state persistence + box/slot overlap; compare BoT-SORT/ByteTrack on identical detections. |
| Split | Training data undocumented. Label multiple days; tune on train/validation, hold out later days and a view where possible; split before augmentation. |
| Parameters | Freeze thresholds, sizes, cadence, tracker and temporal rules; choose validation operating point for false-available cost/recall, then lock test. |
| Output | Status/time/track, overlap, confidence, event. OCR is optional; report number and province readability separately, including long-distance failures. |

## 3.5 Evaluation and success criteria

Evaluate detection, tracking, occupancy, and end-to-end behavior on labelled held-out clips. Report by camera/condition with session-level confidence intervals where feasible; keep neighboring frames in one split.

| Level | Measures | Proposed target — not yet measured |
| --- | --- | --- |
| Car detection | IoU-matched precision/recall, mAP@0.5:0.95, by camera and lighting | Recall ≥0.90 and precision ≥0.90 at selected operating point |
| Plate reading (secondary) | Plate-box detection rate; plate-number exact-read rate; province exact-read rate; report separately by camera, apparent size/distance, lighting, and whether the car has parked | Set targets after collecting a labelled sample; do not combine number and province into one success measure |
| Tracking | HOTA as the primary combined detection/association measure; also report IDF1 and ID switches/1,000 frames; compare ByteTrack | Proposed HOTA/IDF1 target ≥0.80 and fewer ID switches than baseline; finalize thresholds after validation (Luiten et al., 2021) |
| Slot decision | Macro-F1, confusion matrix, false-available rate | Macro-F1 ≥0.90; false-available ≤2% on held-out slot-time samples |
| Events / runtime | Arrival-to-map latency, missed/duplicate events, feed uptime | ≥95% of valid transitions within 2 seconds; ≥99% event uniqueness |
| Staff usefulness | Reviewer usefulness, correction rate and task completion | ≥80% rate map output useful; define users and questionnaire |

Car/occupancy targets are proposed, not measured. Plate observations are qualitative; set exact-read targets after defining a sample. For imbalance, report macro-F1 and false-available rate; use IoU metrics for detection, identity metrics for tracking, and end-to-end state/latency for occupancy.

## 3.6 Translating output into decisions

| Output | Decision | Action / record |
| --- | --- | --- |
| Stable, healthy, available | Normal | Show status with camera/slot and timestamp. |
| Incoming | Transition | Show `incoming` while maneuvering; set `occupied` after persistence confirms. |
| Parked | Occupied | Record start/slot; restrict plate access. |
| Exit candidate | Verify if unclear | Wait for exit evidence; record event/history. |
| Stale, low quality, conflict, unknown slot | Uncertain | Flag for staff; do not advertise as free. |
| Disabled | Unavailable | Do not assign or show as free. |

Preview shows car tracks, optional plate/OCR, and slot overlays; the map shows status/history. Staff verify uncertain states and log overrides (operator, time, old/new state, reason, camera/slot). Keep plate text off general dashboards.

## 3.7 Proof of concept

The multi-camera prototype writes `latest.json`, `cars_latest.csv`, `slots_latest.csv`, and parking history, and can publish events. Demo an authorized clip and zone JSON showing the white expanded car box/ID, slot overlay, incoming-to-parked-to-available states, backend history, and an occlusion needing review. Show number and province reading separately, including an unreadable distant plate. Pin code/weights/thresholds; save frames, state, and event logs; compare with a hand-labelled timeline. Mark simulations clearly.

## 3.8 Benefits, limitations, ethics and risks

| Area | Assessment and mitigation |
| --- | --- |
| Benefits | Shared availability, fewer checks, event history, multi-camera support, existing-camera reuse. |
| Limitations | View-specific polygons, occlusion/light, network/GPU dependence, OCR errors, unverified metrics/provenance; four JSONs are geometry, not occupancy labels. |
| Bias / fairness | Audit views, time, vehicle types, occlusion; OCR failure alone must not change occupancy or trigger penalties. |
| Privacy | Approved purpose, limited retention/access, redacted examples, deletion rules, access audit. |
| Explainability | Show slot/car geometry, track, confidence, overlap/anchor, transition reason, threshold/version. |
| Errors | False-free misdirects; false-occupied wastes capacity. Use persistence, stale alarms, staff checks, correction, rollback. |
| Security / resilience | Keep API keys server-side; mask stream credentials; restrict endpoints; retry events; monitor workers; reject stale frames as live. |
| Oversight | Staff verify/override with reason; no model-only enforcement. |

# 4. Conclusion

The prototype combines car/plate detection, tracking, slot geometry, temporal rules, and backend actions. Since university camera-based parking projects already exist, this project should be presented as a local integration and evaluation effort using the university's existing CCTV and application, not as the first campus parking model. Next, evaluate it on authorized, labelled CCTV; no local accuracy or latency is claimed. Only the plate dataset count is verified; confirm metadata for the other Roboflow sources. Confirm the local workflow gap with parking staff before stating that the university has no comparable system.

# References

Aharon, N., Orfaig, R., & Bobrovsky, B.-Z. (2022). BoT-SORT: Robust associations multi-pedestrian tracking. arXiv. https://arxiv.org/abs/2206.14651

Amato, G., Carrara, F., Falchi, F., Gennaro, C., Meghini, C., & Vairo, C. (2017). Deep learning for decentralized parking lot occupancy detection. *Expert Systems with Applications, 72*, 327–334. https://doi.org/10.1016/j.eswa.2016.10.055

Cruz, A., Villaruel, I. A., Hamo, D. J., Ruiz, J. B., & Suarez, K. J. (2024). Vehicle parking area monitoring and management system using computer vision. *11th International Scholars Conference, 11*(5), 1452–1462. https://doi.org/10.35974/isc.v11i5.3570

de Almeida, P. R. L., Oliveira, L. S., Britto, A. S., Silva, E. J., & Koerich, A. L. (2015). PKLot—A robust dataset for parking lot classification. *Expert Systems with Applications, 42*(11), 4937–4949. https://doi.org/10.1016/j.eswa.2015.02.009

de Almeida, P. R. L., Alves, J. H., Parpinelli, R. S., & Barddal, J. P. (2022). A systematic review on computer vision-based parking lot management applied on public datasets. *Expert Systems with Applications, 198*, 116731. https://doi.org/10.1016/j.eswa.2022.116731

Elomiya, A., Křupka, J., & Jovčić, S. (2023). A smart parking system using surveillance cameras and fuzzy logic: A case study at Pardubice University's campus. *Procedia Computer Science, 225*, 4881–4890. https://doi.org/10.1016/j.procs.2023.10.488

Fooprateepsiri, R. (2014). A detection and recognition system for Thai car license plate under traffic CCTV issue. *Kasetsart Engineering Journal, 27*(90). https://ph01.tci-thaijo.org/index.php/kuengj/article/view/79423

Luiten, J., Osep, A., Dendorfer, P., Torr, P., Geiger, A., Leal-Taixé, L., & Leibe, B. (2021). HOTA: A higher order metric for evaluating multi-object tracking. *International Journal of Computer Vision, 129*, 548–578. https://doi.org/10.1007/s11263-020-01375-2

Parking Management System repository. (2026a). Backend models, controllers, routes, and map validation [Source code]. Local project files. Files consulted: `parking-back/api/models/parkingBuildingModel.js`, `parkingFloorModel.js`, `parkingLogModel.js`, `vehicleModel.js`; `parking-back/api/controllers/parkingLogController.js`; `parking-back/api/routes/parkingLogRoutes.js`; `parking-back/api/utils/parkingMap.js`; and `parking-back/api/utils/migrateParkingBuildingFields.js`.

Parking Management System repository. (2026b). Frontend API types, parking map, camera configuration, and staff dashboard [Source code]. Local project files. Files consulted: `parking-front/src/services/api.ts`, `parking-front/src/types/index.ts`, `parking-front/src/components/parking/parkingMapPreview.ts`, `parking-front/src/components/parking/DashboardMap.vue`, `parking-front/src/views/admin/cctvForm.ts`, and `parking-front/src/views/staff/DashboardView.vue`.

Parking Management System repository. (2026c). Python CCTV runtime, parking-slot annotations, event publisher, and runtime documentation [Source code]. Local project files.

Implementation sources: `python-v2/README.md`, `python-v2/parkng_model.py`, `python-v2/parking_config.py`, `python-v2/parking_model_events.py`, `python-v2/parking_export.py`, `python-v2/tracker/parking_botsort_reid.yaml`, and `python-v2/parking_slots/*.json`.

Roboflow. (n.d.-a). *Car Detection* (version 5) [Object-detection dataset]. Roboflow. https://app.roboflow.com/joeys-workspace-ygf73/car-detection-qzvuh/5

Roboflow. (n.d.-b). *Parking slot E4* [Annotation workspace]. Roboflow. https://app.roboflow.com/joeys-workspace-ygf73/parking_slot-e4/annotate

Roboflow Universe Projects. (2026). *License Plate Recognition* (version 12) [Object-detection dataset]. Roboflow Universe. https://universe.roboflow.com/roboflow-universe-projects/license-plate-recognition-rxg4e/dataset/12

Ultralytics. (n.d.). Multi-object tracking. Ultralytics documentation. Retrieved November 12, 2026, from https://docs.ultralytics.com/modes/track/

# Appendix A — Finalization items

Complete these items with the project group before formal submission; repository contents alone cannot verify them.

- Add student names and honest contribution statement for each member.

- Confirm CCTV owner, permission, camera scope, retention and evaluation date range.

- Inspect weight metadata/license; document model generation, classes, training data and version.

- Record camera/sample conditions and counts for preliminary plate-number and province-reading observations; report these separately from occupancy results.

- Generate the three core EDA charts and optional plate-readability chart from approved labels; report observed counts.

- Run held-out evaluation; replace targets with measured results and per-camera confusion matrices/latency.

- Verify backend state mapping and human override against deployed UI/API.

- Review citations, AI-use disclosure and privacy handling with group/instructor.

> Suggested AI-use acknowledgment (edit to match actual use and course rules): “Generative AI helped draft and organize this report. The project team reviewed claims against the repository, verified measurements and references, and remains responsible for the submitted work.”
