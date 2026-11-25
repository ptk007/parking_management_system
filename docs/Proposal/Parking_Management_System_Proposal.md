# Parking Management System

## Senior Project Proposal

### A CCTV Based Parking Occupancy and Management System for Mae Fah Luang University

Tridsadate Greatsangthong  
Nantawut Panan  
Thanathip Pitaksin  
Pattakorn Jaijit

Bachelor of Engineering in Computer Engineering  
Mae Fah Luang University  
2026

## Abstract

This project presents the integration and evaluation of a CCTV-based parking management prototype for Mae Fah Luang University. The system combines a Vue 3 and TypeScript web application, a Node.js and Express API, MongoDB data storage, and a Python/OpenCV camera runtime. Configured camera views are associated with parking-space layouts. The runtime detects vehicles, tracks them across frames with BoT-SORT and appearance re-identification, estimates parking-space transitions, and can locate and read Thai license plates with a plate detector and EasyOCR. Administrators configure buildings, floors, cameras, and parking maps; staff monitor camera and parking information; and users can view available parking information through the application where the current interface supports it.

The project will be evaluated on approved footage from Mae Fah Luang University, initially targeting E4 Building, Floor 4. The evaluation will compare model output with manually labelled clips and report vehicle detection, tracking, parking-space state classification, update delay, event consistency, and plate reading as separate measures. Public parking datasets and published work provide context for dataset preparation and evaluation, but they do not establish the performance of this project on campus cameras. The supplied outline mentions facial recognition; it is not implemented in the inspected source and is excluded from the project scope. Model checkpoint generation, training provenance, camera authorization, and local accuracy remain to be verified. No performance result or operational benefit is claimed before measurement.

**Keywords:** parking management, computer vision, parking occupancy, CCTV, YOLO, BoT-SORT, license plate recognition, EasyOCR

## Contents

1. Chapter 1 Introduction
2. Chapter 2 Literature Review and Related Technology
3. Chapter 3 System Analysis and Methodology
4. Chapter 4 Experiment and Evaluation Plan
5. Chapter 5 Conclusion and Discussion
6. References
7. Appendix A Project Verification Checklist

# Chapter 1 Introduction

## 1.1 Background and rationale

Drivers arriving at a busy facility may spend time searching for a vacant space. A parking-management process can help operators organize space information, monitor demand, and show users where parking is available. Camera-based systems are one option: they interpret images of the parking area and associate the observations with defined spaces. Reusing CCTV may avoid installing a sensor in each space, but performance depends on the camera view, image quality, illumination, obstruction, network, and correctness of the space layout [1, 2].

This project develops a software system around the university's existing CCTV and web application. The repository contains a frontend for maps and dashboards, an API and database for facility and parking records, and a Python runtime that processes configured camera streams. The intended workflow connects a detected and tracked vehicle to a configured parking region, estimates whether that region is available or occupied, and sends state or parking-event updates to the application. A separate license-plate pipeline can add plate information when a plate is visible and legible. The system is intended to support parking operations; staff review and local evaluation remain necessary.

## 1.2 Problem statement

The project needs a reliable way to connect video from selected university cameras to named spaces on a parking map and make the resulting status understandable to users and operators. The technical challenge is to configure each camera's perspective and parking regions, follow vehicles over time, infer stable space-state changes, and keep the runtime, API, database, and user interface consistent. The research challenge is to measure how well and how quickly this pipeline works on approved campus footage under its observed conditions.

## 1.3 Objectives

1. Integrate camera configuration, parking-space maps, vehicle detection and tracking, parking-event storage, and web monitoring into a demonstrable prototype.
2. Prepare a documented, human-labelled sample from approved CCTV footage and evaluate vehicle detection, multi-object tracking, and parking-space state estimation.
3. Measure the delay and consistency of parking-state and event updates from the vision runtime through the API to the displayed application.
4. Evaluate license-plate detection and Thai plate-text recognition as a separate supporting capability, without using OCR failure as an occupancy decision.
5. Document the limits, privacy safeguards, and software changes required before use with real operational data.

## 1.4 Scope

### Included in the project

- Building, floor, vehicle-type, camera-preset, and parking-map configuration.
- CCTV stream preview and runtime status for configured cameras.
- Vehicle detection and persistent tracking using the current Ultralytics-based runtime and its configured BoT-SORT/ReID tracker.
- Parking-slot state estimation using camera-specific annotated regions, vehicle geometry, and temporal transition rules.
- API and MongoDB updates for current map status and parking-session events.
- User, staff, and administrator pages that are present in the current application, with current access behavior verified during the project.
- A separately evaluated license-plate detector and Thai OCR pipeline when allowed footage provides readable plate samples.
- Controlled evaluation for selected, approved camera views, initially E4 Building, Floor 4.

### Excluded or not established

- Facial recognition or biometric verification. The earlier outline mentions faces, but the inspected repository contains no face-recognition model or verification flow.
- Automated payment, reservations, barrier control, vehicle navigation, or enforcement decisions made solely by a model.
- A claim that the system has been deployed throughout the campus, has improved utilization, or has reduced congestion or emissions without deployment and measurement evidence.
- A guarantee that license plates can be read in every camera view or under all lighting, distance, angle, blur, or occlusion conditions.
- Production-grade security or role separation until backend authorization and data handling have been reviewed and validated.

## 1.5 Intended users

| User | Intended use |
| --- | --- |
| General user | View building/floor availability and use personal parking information if supported by the active account and interface. |
| Parking staff | Monitor maps, camera/runtime condition, and parking history; investigate inconsistencies and help resolve operational issues. |
| Administrator | Configure buildings, floors, cameras, maps, and staff-related records. |
| Vision runtime | Read enabled camera configuration, process video, and publish selected slot-state and parking events to the API. |

The repository has role-related UI and login flows, but the route and API authorization boundaries are incomplete in the current prototype. The table describes intended use, not a security guarantee.

## 1.6 Research questions

1. How accurately does the system classify configured parking spaces as available, incoming, occupied, or disabled on labelled university CCTV clips?
2. How do camera viewpoint, apparent vehicle size, lighting, and obstruction affect vehicle detection, tracking continuity, and parking-space classification?
3. How much time passes between a labelled vehicle/space transition and the corresponding stable map or parking-event update?
4. On visible plate samples, what are the plate localization rate and the separate exact-read rates for Thai plate characters/numbers and province text?
5. Are camera, map, and parking-session records consistent across the runtime, API, database, and web interface during controlled runs?

## 1.7 Expected outcomes

- An integrated prototype demonstrating camera configuration, mapped parking spaces, runtime status updates, and parking-history records.
- A repeatable sampling and annotation method for authorized university footage.
- Measured results and error analysis for vehicle detection, tracking, occupancy state, system-update delay, and event consistency.
- Separate plate-detection and text-reading measurements where sample size and visibility permit.
- A documented assessment of limitations and a practical list of improvements needed before operational deployment.

These are proposed deliverables. Accuracy, latency, utilization, congestion, and security improvements are not assumed; the final report must replace expectations with observed evidence.

## 1.8 Place, hardware, and software

**Proposed site:** Mae Fah Luang University, E4 Building, Floor 4. Use of cameras or footage requires authorization from the responsible university unit.

| Resource | Use in the project |
| --- | --- |
| CCTV and RTSP network | Video input for selected views; camera credentials must remain restricted. |
| Windows development computer, preferably GPU-capable | Runs the web stack and current Python vision runtime; record the actual CPU/GPU configuration during evaluation. |
| Vue 3, TypeScript, Vite, Pinia | Frontend views, map interaction, and application state. |
| Node.js, Express, MongoDB, Mongoose | HTTP API, runtime coordination, and persistence of facility and parking records. |
| Python, OpenCV, Ultralytics, BoT-SORT/ReID, EasyOCR | Video capture and processing, object detection/tracking, and Thai plate OCR. |
| JSON/COCO-style annotations | Camera-specific parking-region geometry and model inputs. |
| Visual Studio Code, Git, Figma | Development, source control, and interface design work. |
| Roboflow and Google Colab | Candidate tools for dataset annotation/export and model-training experiments; their use in training the current checkpoints must be verified. |

# Chapter 2 Literature Review and Related Technology

## 2.1 Related research

### 2.1.1 How parking management works

A parking-management workflow gathers information about a facility, estimates which spaces are available, communicates the status to operators or drivers, and records activity needed for monitoring and planning. Detection can be based on dedicated sensors, gate counts, or visual analysis. Vision-based approaches interpret camera images and map detections to individual spaces. A camera solution may reuse an installed surveillance network, but it does not automatically provide reliable counts or current status: the layout, camera coverage, processing delay, and detection errors matter [1, 2].

For this project, the operational cycle is: configure the building, floor, camera, and space layout; receive and process frames; estimate slot states; transmit updates to the API; show the current map and history; and allow staff to review discrepancies. The project evaluates this cycle as a prototype, rather than assuming every user receives a guaranteed real-time recommendation.

### 2.1.2 Why use YOLO-based multi-object tracking for parking

An object detector identifies vehicles in a frame. A multi-object tracker associates detections across successive frames and assigns temporary track identities. Tracking helps the system distinguish a vehicle moving through a view from one that has settled in a parking space. It also supplies temporal evidence for state transitions. A detector and a tracker are separate components: YOLO is the detection model family, while BoT-SORT is the tracking algorithm configured by this project [3, 4].

BoT-SORT combines motion and appearance cues to associate detections; its ReID component can help preserve identity when vehicle appearance or bounding-box overlap changes [4]. In the repository, `parking_botsort_reid.yaml` enables ReID, sets a 120-frame track buffer, and disables global-motion compensation for the fixed-view camera configuration. The runtime also applies additional identity recovery based on geometry, motion history, and plate memory. This design can reduce identity changes, but it cannot eliminate them. A held-out local evaluation is needed to establish its tracking quality.

The proposal sample names YOLOv8, and the repository uses Ultralytics with custom `.pt` vehicle and plate checkpoints. The installed package constraint is `ultralytics>=8.4,<9`, but that alone does not prove which YOLO architecture or version produced a checkpoint. Until checkpoint metadata and training records are inspected, this document describes it as an **Ultralytics YOLO-based detector**, not as a confirmed YOLOv8 or YOLO26 model.

### 2.1.3 Computer-vision parking management and prepared datasets

Computer-vision parking studies use both space-based classification and vehicle detection approaches. Public datasets such as PKLot contain manually labelled spaces and multiple camera views and weather conditions. PKLot research reports that performance can change when testing on a parking view not included during training [1]. A systematic review also finds that dataset choice and evaluation protocols vary across studies, limiting direct comparison and generalization claims [2].

This project should distinguish three data types: (1) the learned vehicle/plate training datasets, (2) parking-space geometry annotations that tell the runtime where a space lies, and (3) local human-labelled occupancy clips used as evaluation ground truth. A slot-definition JSON file is not, by itself, a dataset of occupied and empty examples. Roboflow can support image annotation, dataset versions, and export [14], while Colab can provide hosted notebooks and compute [15]; however, the repository weights' dataset provenance, licence, and any Colab training run are not presently verified.

To avoid overly optimistic estimates, split samples by recording session or day so adjacent frames from the same scene do not appear in both training and test data. Where footage allows, include different views and lighting conditions and report the results for each camera. Record labels, exclusions, annotation rules, software versions, and model settings. These practices address the evaluation gaps identified in the parking-dataset literature [1, 2].

### 2.1.4 What is license-plate recognition

License-plate recognition (LPR, also called automatic number-plate recognition) is a pipeline that locates a plate in an image, crops and prepares the plate region, recognizes its characters with OCR, and may combine evidence across multiple frames. Thai plate recognition presents particular challenges from character shapes, province text, image resolution, camera angle, and changing conditions. Thai-focused research evaluates plate detection and character recognition as separate steps and reports that camera conditions affect results [6, 7].

In this project, a plate detector finds the plate region in a vehicle crop; EasyOCR is then initialized for Thai text recognition. The runtime keeps OCR idle until a plate candidate is found and aggregates candidate readings over time. Plate text may be attached to parking events. The OCR pipeline is separate from the slot-occupancy decision: an unreadable plate does not make a space available. Plate images and text may identify a vehicle or person, so the team should use approved footage, restrict access, minimize retention, and redact examples in reports.

## 2.2 Related technology

### 2.2.1 Visual Studio Code

Visual Studio Code is a cross-platform code editor with project navigation, language support, debugging, source-control integration, and extension support [8]. It is a development tool used by the team; it is not part of the deployed parking application.

### 2.2.2 Figma

Figma Design supports the creation, sharing, and review of interface designs and prototypes [9]. In this project it can be used to communicate map, dashboard, and administration layouts before or during implementation. The live Vue pages are the implemented application; Figma files are design artefacts.

### 2.2.3 Vue.js and TypeScript

Vue is a JavaScript framework for building user interfaces with reusable components. Its single-file components combine template, script, and style for a page or interface element [10]. The repository uses Vue 3 and TypeScript for dashboards, parking maps, forms, and staff/admin views. The browser application calls the backend API to read and update application records.

### 2.2.4 Scalable Vector Graphics

Scalable Vector Graphics (SVG) is a web graphics format for two-dimensional shapes, text, and images. Vector shapes remain resolution-independent and can be styled and manipulated in the browser [11]. The parking-layout editor uses an SVG canvas to display a floor background, slot positions, and editable layout shapes. SVG is therefore a rendering and interaction technology in the map interface, not a detection model.

### 2.2.5 Node.js and Express

Node.js is an open-source, cross-platform JavaScript runtime designed for asynchronous network applications [12]. The project uses Node.js with Express to expose API routes, connect the frontend to MongoDB, and coordinate camera/model functions. It is the backend service layer; Python handles the vision runtime.

### 2.2.6 MongoDB and Mongoose

MongoDB is a document database that stores records as flexible, JSON-like documents [13]. Mongoose defines the project's data models and validation. Current records represent buildings and floors, embedded camera presets and parking maps, users and vehicles, and parking-session logs. The map stores current slot status; the log records parking-session events, so the two records answer different questions.

### 2.2.7 Roboflow

Roboflow provides tools for image annotation, dataset organization, versioning, and export [14]. It is relevant to preparing labelled vehicle or license-plate images. The current repository includes local model checkpoints and parking-space JSON, but does not establish from those files which Roboflow dataset/version trained each checkpoint. Dataset name, class labels, split, licence, and export version must be documented before attributing a model to a dataset.

### 2.2.8 Ultralytics YOLO and the YOLOv8 topic

YOLO is a family of object-detection models exposed through the Ultralytics Python package. Ultralytics also provides tracking and parking-management examples, including polygonal parking-region configuration [3, 5]. The supplied topic outline refers to YOLOv8; this is a suitable literature topic, but the checked-in custom checkpoints do not identify their generation clearly. The implementation chapter should use the version shown by checkpoint metadata once verified. The current code calls `model.track()` with a custom BoT-SORT configuration; it does not simply use the default Ultralytics parking-management example.

### 2.2.9 Python and OpenCV

Python is a general-purpose programming language with official tutorials and library documentation [16]. OpenCV supplies image and video processing functions used by the runtime. The repository's Python worker opens RTSP streams, samples frames, runs model inference, updates track and slot state, and sends selected events to the backend.

### 2.2.10 Google Colab

Google Colab is a hosted Jupyter Notebook service that can provide notebook runtimes and access to compute resources [15]. It can be used for model experimentation or training without making it part of the deployed runtime. The current code loads local `.pt` files; project records should verify whether Colab trained them and retain the notebook, dataset version, training settings, and resulting checkpoint information if so.

## 2.3 Related work and project workflow

### 2.3.1 Creating a parking-space map in the frontend

The parking map requires two connected descriptions: a visual floor layout and a list of named spaces whose current state is supplied by the backend/runtime. In the current frontend, an administrator can prepare a floor layout using an SVG editor, background image, shapes, and slot positions. The saved layout records coordinate boxes and zoom; map slots are separately assigned to camera annotation categories where applicable. The frontend validation and runtime mapping code should be treated as the authority for field names.

A reproducible setup procedure is: choose the camera view and matching floor plan; define stable slot identifiers; annotate camera-specific parking regions; map each region to the corresponding application slot; preview both the layout and camera assignment; and verify that state updates affect the intended slot. Ultralytics' parking guide similarly uses camera-frame regions stored in JSON and advises adapting them to the target lot [5]. This project's custom editor and data flow provide the local implementation rather than a claim that Ultralytics' sample code is used unchanged.

### 2.3.2 How an LPR CCTV pipeline works

The project's LPR-related processing follows these stages:

1. **Frame and vehicle detection:** The runtime obtains a camera frame and identifies a vehicle candidate.
2. **Plate localization:** The plate detector runs on the relevant vehicle crop and returns a plate region when the visual evidence is sufficient.
3. **Crop preparation and OCR:** The plate crop is prepared, and Thai EasyOCR is initialized on demand to produce text candidates.
4. **Temporal stabilization:** Multiple readings and track-level memory help select a stable candidate and associate it with the same vehicle where possible.
5. **Event and database update:** Plate text may be attached to a parking event; the backend updates the corresponding map/session records.

This is software-based recognition operating on a CCTV feed. The camera alone does not guarantee a readable plate. Published Thai LPR work separates localization from character recognition and discusses errors from image quality and viewing conditions [6, 7]. In the evaluation, measure plate detection, plate-number exact match, and province-text exact match separately.

### 2.3.3 How YOLO multi-object tracking works in this project

On sampled frames, the detector returns bounding boxes and confidence values. BoT-SORT associates these detections with previous tracks and returns IDs. ReID provides appearance-based evidence when a vehicle turns, is partially occluded, or has weaker box overlap. The project config uses `track_high_thresh=0.25`, `track_low_thresh=0.10`, `new_track_thresh=0.55`, `track_buffer=120`, `with_reid=True`, and `gmc_method=none`. A separate application-level recovery layer can merge raw track IDs into a canonical vehicle identity using geometry, motion, and historical plate information. These settings are implementation details to record and test, not accuracy claims [3, 4, 17].

### 2.3.4 How EasyOCR supports license-plate reading

EasyOCR is a text-recognition library. The project's Python source configures a Thai reader and initializes it only after the plate detector returns a candidate. The output therefore depends on successful plate localization as well as the OCR result. Image resizing, blur, glare, plate angle, and small province text can affect recognition; repeated frame voting may reduce unstable readings but does not guarantee a correct read. Evaluate OCR on labelled plate crops and compare exact reads rather than reporting a generic claim of high accuracy [6, 7].

# Chapter 3 System Analysis and Methodology

## 3.1 Existing system architecture

The current repository has three connected application layers:

1. **Frontend:** Vue 3 and TypeScript display parking maps, dashboards, vehicle/history pages, administrative setup, and camera previews.
2. **Backend and database:** An Express API and Mongoose models store buildings, floors, camera presets, maps, users, vehicles, and parking logs in MongoDB. The backend also exposes model-runtime controls and event endpoints.
3. **Vision runtime:** Python and OpenCV workers read configured RTSP streams, run the vehicle detector and BoT-SORT/ReID tracker, infer parking-slot transitions, optionally detect and read plates, and publish selected updates to the API.

The flow is: administrator configures a building/floor and camera; the camera configuration is associated with parking-space JSON and map slots; the backend enables the model worker; the worker processes frames and sends slot/event updates; the API persists them; the frontend displays the resulting map, camera status, and history. Current map states and parking-session statuses are distinct data: a map represents current space availability, while a log represents an event/session lifecycle.

## 3.2 System roles and use cases

| Actor | Main use cases |
| --- | --- |
| General user | Open the parking map, inspect building/floor availability, and view personal vehicle/history data where supported. |
| Staff | Sign in, monitor slot counts and maps, inspect camera/runtime status, review parking logs, and respond to reported issues. |
| Administrator | Manage staff-related records, configure buildings and floors, define parking layouts, add camera presets, and assign camera regions to map slots. |
| Vision service | Receive camera configuration, process frames, estimate vehicle/slot status, and publish runtime health and parking events. |

These use cases follow the active application structure and supplied role topics. Some earlier outline items describe face verification and a persisted support chat; those functions are not confirmed in the current source. Access-control enforcement and the support API require separate verification before real accounts or personal data are used.

## 3.3 Detailed workflow

### 3.3.1 Sign-in and role routing

The frontend has login and role-oriented views. A signed-in user is routed to a user, staff, or administrator area according to the application role. The backend includes login and token handling, but current source documentation identifies gaps in role enforcement and demo authentication. Therefore role routing describes the interface workflow, not proof that each endpoint is protected.

### 3.3.2 Real-time parking-space checking

The user or staff view displays a building/floor map and available, incoming, occupied, or disabled states. The Python runtime detects vehicles and evaluates their geometry and temporal state against camera-specific parking regions. Runtime state changes are translated to backend map states and shown by the frontend. The current system does not guarantee a navigation route or redirect a driver to another space; such behavior would require additional interface and operational design.

### 3.3.3 Parking-time and event collection

As a vehicle enters a camera's monitored view, the runtime detects and tracks it. When track and slot evidence meet transition rules, the runtime can send a parking event and slot update. A detected plate may be attached if the plate detector and Thai OCR produce a usable result. The backend stores parking-session information such as the assigned slot and event times. The earlier sample's exact fixed five-second capture interval and face capture are not represented as guaranteed behavior in the current code and are not used as claims in this proposal.

### 3.3.4 Data collection and display

The application stores facility configuration and map state separately from parking history. The runtime may use per-frame detections, tracks, plate candidates, and overlap information internally, while only selected slot and event updates are sent to the backend. The dashboard reads stored map and log information through the API. For evaluation, human labels and test identifiers should be kept in a separate evaluation dataset where practical.

### 3.3.5 Exit and history management

When the runtime observes that an associated vehicle leaves a monitored slot, it can publish an exit transition. The backend updates the parking session and current map status; staff can review the history view. The inspected runtime does not perform face matching between entrance and exit cameras. Guest-versus-account history access should be confirmed against the current UI and API behavior before it is described as a guaranteed function.

## 3.4 Parking-map and UI design

The map interface combines a floor-plan background, SVG shapes, positioned spaces, and status styling. Administrators edit the layout and configure camera presets; staff dashboards focus on slot totals, CCTV/runtime condition, and parking logs; user pages focus on map availability and vehicle/history information. The exact screens and actions should be illustrated using current repository UI captures during the final report.

The support/chat panel appears in the frontend, but the backend support endpoint is not currently implemented for persistence. It should be described as an interface element or future extension unless the API is completed and verified. Similarly, facial-recognition images or placeholders in old design notes are not evidence of a face-recognition feature.

## 3.5 Methodology

### Phase 1: Requirements and source review

Confirm the target building/floor, available camera views, users, administrative workflow, map/slot identifiers, and API data flow. Inspect the current models, tracker settings, and UI. Document missing or unverified behaviors.

### Phase 2: Camera and data authorization

Confirm permission from the camera owner for the selected feed and recording period. Define which video and plate-derived data may be accessed, who may view them, how long they may be retained, and how reports will redact identifiers. Use test accounts and synthetic examples during development where feasible.

### Phase 3: Annotation and data preparation

Select representative clips from approved views. Define operational labels for available, incoming, occupied, and disabled states, plus rules for transition times, occlusion, ambiguous cases, unreadable plates, and missed frames. Have a second reviewer label a subset where practical and resolve disagreements. Keep all adjacent frames from a clip/session in a single partition. Record counts by camera and condition.

### Phase 4: Controlled integration runs

Configure the building, floor, camera preset, parking-space JSON, and map assignments. Verify that each annotation region maps to the intended slot and that the API and UI display the runtime state. Record model-file hashes or metadata, Ultralytics version, tracker configuration, thresholds, hardware, frame sampling, and camera settings.

### Phase 5: Evaluation and analysis

Run unchanged configurations on held-out clips, align predictions with manual labels, calculate the metrics in Chapter 4, and review errors by camera and viewing condition. Report false-available and false-occupied errors separately. Do not present public-dataset metrics as local system performance.

### Phase 6: Reporting and presentation

Present the system architecture, role workflows, map editor, camera/runtime integration, measured results, privacy and security limits, and recommended future work. Label every proposed feature and every measured result accurately.

# Chapter 4 Experiment and Evaluation Plan

## 4.1 Evaluation data and units

Use authorized video from the selected campus cameras. The occupancy unit is a labelled slot at a timestamp or defined time interval. The detection unit is a vehicle instance in a frame. The tracking unit is a vehicle identity across a clip. The event unit is an annotated parking/exit transition. The OCR unit is a visible plate instance with separate text labels for plate number and province. Record sample counts and exclusions for every metric.

Public datasets such as PKLot are relevant for comparing methodological choices, but they cannot replace local testing because parking geometry, viewpoint, and appearance differ [1, 2].

## 4.2 Measures

| System part | Measures to report | Why it matters |
| --- | --- | --- |
| Vehicle detector | Precision, recall, and mAP at stated IoU thresholds | Shows missed and false vehicle detections. |
| Multi-object tracker | HOTA and/or IDF1; ID switches per 1,000 frames | Measures identity continuity and detection-association quality [17]. |
| Parking occupancy | Per-state precision, recall, F1, confusion matrix, macro-F1, false-available and false-occupied rates | Shows which map states are confused and the operational direction of errors. |
| Update delay | Median and 95th percentile from labelled transition to stable map/API update | Measures whether the displayed state is timely. Define transition/stability rules before scoring. |
| Event consistency | Missing, duplicated, delayed, or incorrectly associated parking events | Checks runtime/API/database integration separately from frame accuracy. |
| Plate pipeline | Plate localization rate; exact plate-number read; exact province read; unreadable rate | Separates detector and OCR performance and exposes visibility limits. |
| Stream operation | Successful stream minutes divided by planned minutes; failed/restarted streams | Describes camera coverage during tests, not model accuracy. |

HOTA is a multi-object tracking measure intended to balance detection and association accuracy [17]. Report the matching rules, confidence thresholds, sample sizes, annotation process, and software/model versions so results can be interpreted and repeated.

## 4.3 Test conditions and reporting

Include multiple camera views, distances, and lighting conditions where authorization and sample availability permit. Record occlusion and camera outages. If enough data exist, hold out a full camera view or later recording session for a generalization check. Do not randomly split adjacent frames because nearly identical frames can leak between training and testing. Report per-view and overall findings.

No measurements are available in this proposal. The final results chapter should include the data-selection flow, confusion matrices, detection/tracking scores, update-delay distributions, event-consistency counts, plate results by visibility condition, and representative redacted failure cases. A small or single-camera result must not be generalized to the whole university.

## 4.4 Work plan

The following semester outline is adapted from the supplied proposal. The team should align it with the current departmental calendar and actual project progress.

| Activity | Senior Project I (Jan–May) | Senior Project II (Aug–Oct) | Senior Project II (Nov–Dec) |
| --- | --- | --- | --- |
| Proposal preparation and defense | Jan–Feb |  |  |
| Literature review and requirements | Jan–Mar |  |  |
| Source audit and system analysis | Feb–Mar | Aug |  |
| Design and integration | Mar–May | Aug–Sep |  |
| Annotation guide and data preparation |  | Aug–Oct |  |
| System development and refinement | Mar–May | Aug–Oct |  |
| Controlled evaluation and analysis |  | Sep–Oct | Nov |
| Final report and presentation |  |  | Nov–Dec |

## 4.5 Risks and mitigations

| Risk | Effect on project | Response |
| --- | --- | --- |
| CCTV access is unavailable or restricted | Evaluation scope may shrink or shift | Seek approval early and use only authorized views and times. |
| Camera angle or image quality is poor | Vehicles or plates may be missed | Report by view and condition; adjust the camera/map only with owner approval. |
| Training data/checkpoint provenance is unknown | Limits reproducibility and claims about YOLO version | Inspect metadata, training records, class list, and dataset licence; disclose gaps. |
| Adjacent-frame leakage or unclear labels | Inflated or ambiguous evaluation | Split by recording session and define annotation rules before measuring. |
| Plate or video data are exposed | Privacy and security impact | Restrict access, minimize retention, redact screenshots, and use synthetic presentation data. |
| Application access controls are incomplete | Unauthorized viewing or editing risk | Keep tests isolated and verify server-side authorization before real users or data. |

# Chapter 5 Conclusion and Discussion

This proposal develops the supplied topic list into a source-aligned study of parking management, camera-based occupancy, YOLO-based detection, multi-object tracking, LPR, prepared datasets, and the technologies used by the application. The inspected project combines an SVG-based parking-map editor, Vue frontend, Express/MongoDB backend, and Python runtime using Ultralytics, BoT-SORT with ReID, and Thai EasyOCR. Its distinct contribution for the senior project is the integration of these components for a university workflow and a local, documented evaluation.

The evaluation will determine whether the selected camera views and slot annotations provide timely and dependable state information. The project will report limitations alongside results. Facial recognition, guaranteed campus-wide operation, and unmeasured improvements are excluded from claims. The team should verify camera permissions, model provenance, UI/API access control, and data-retention arrangements before a demonstration using real footage or identifiers.

# References

[1] P. R. L. de Almeida, L. S. Oliveira, A. S. Britto Jr., E. J. Silva Jr., and A. L. Koerich, “PKLot—A robust dataset for parking lot classification,” *Expert Systems with Applications*, vol. 42, no. 11, pp. 4937–4949, 2015. https://doi.org/10.1016/j.eswa.2015.02.009

[2] P. R. L. de Almeida, J. H. Alves, R. S. Parpinelli, and J. P. Barddal, “A systematic review on computer vision-based parking lot management applied on public datasets,” *Expert Systems with Applications*, vol. 198, article 116731, 2022. https://doi.org/10.1016/j.eswa.2022.116731

[3] Ultralytics, “Track mode,” *Ultralytics Documentation*. https://docs.ultralytics.com/modes/track/ (accessed November 24, 2026).

[4] N. Aharon, R. Orfaig, and B.-Z. Bobrovsky, “BoT-SORT: Robust associations multi-pedestrian tracking,” arXiv:2206.14651, 2022. https://arxiv.org/abs/2206.14651

[5] Ultralytics, “Parking management with Ultralytics YOLO,” *Ultralytics Documentation*. https://docs.ultralytics.com/guides/parking-management/ (accessed November 24, 2026).

[6] S. Musor et al., “Automatic vehicle license plate recognition system using computer vision,” *PNU Journal of Applied Science, Engineering & Technology*, 2025. https://www.tci-thaijo.org/en/articles/physical05-317

[7] Jaided AI, “EasyOCR,” GitHub repository and README. https://github.com/JaidedAI/EasyOCR (accessed November 24, 2026).

[8] Microsoft, “Core editor features,” *Visual Studio Code Documentation*. https://code.visualstudio.com/docs/editing/getting-started/overview (accessed November 24, 2026).

[9] Figma, “What is Figma?,” *Figma Learn Help Center*. https://help.figma.com/hc/en-us/articles/14563969806359-What-is-Figma (accessed November 24, 2026).

[10] Vue.js, “Introduction,” *Vue.js Guide*. https://vuejs.org/guide/introduction (accessed November 24, 2026).

[11] World Wide Web Consortium, “Scalable Vector Graphics (SVG) 2: Introduction.” https://www.w3.org/TR/SVG/intro.html (accessed November 24, 2026).

[12] OpenJS Foundation, “Introduction to Node.js,” *Node.js Learn*. https://nodejs.org/learn/getting-started/introduction-to-nodejs (accessed November 24, 2026).

[13] MongoDB, “What is MongoDB?,” *MongoDB Manual*. https://www.mongodb.com/docs/manual/introduction/ (accessed November 24, 2026).

[14] Roboflow, “Features,” including image annotation and dataset export. https://roboflow.com/features (accessed November 24, 2026).

[15] Google Research, “Google Colaboratory FAQ.” https://research.google.com/colaboratory/faq.html (accessed November 24, 2026).

[16] Python Software Foundation, “Python.” https://www.python.org/ (accessed November 24, 2026).

[17] J. Luiten et al., “HOTA: A higher order metric for evaluating multi-object tracking,” *International Journal of Computer Vision*, vol. 129, pp. 548–578, 2021. https://doi.org/10.1007/s11263-020-01375-2

[18] Parking Management System repository, source code and runtime configuration, 2026. Files consulted include `parking-front/src/components/parking/ParkingLayoutEditor.vue`, `parking-front/src/components/parking/parkingLayout.ts`, `parking-front/src/views/admin/`, `parking-front/src/views/staff/`, `parking-back/server.js`, `parking-back/api/models/`, `parking-back/api/controllers/`, `python-v2/parkng_model.py`, `python-v2/parking_model_events.py`, `python-v2/tracker/parking_botsort_reid.yaml`, and `python-v2/requirements.txt`.

# Appendix A Project Verification Checklist

Before submitting the final senior project report, confirm each item using project files and evidence:

- [ ] Verify CCTV owner approval, selected cameras, time period, retention, and permitted use.
- [ ] Inspect car and plate checkpoint metadata to establish model family/version, classes, training data, and licence.
- [ ] Confirm whether Roboflow and Google Colab were used; preserve dataset versions, exports, notebooks, and training settings if applicable.
- [ ] Record the runtime software versions, camera resolution, frame sampling, hardware, detector thresholds, and tracker parameters.
- [ ] Define slot-state/event labels, transition timestamps, and rules for unreadable plates and ambiguous clips.
- [ ] Split evaluation data by clip/session and report sample counts per view and condition.
- [ ] Confirm region-to-map assignments and runtime/API/database/UI state consistency.
- [ ] Verify server-side role authorization and remove demo credentials before use with real users.
- [ ] Agree video/plate access, retention, and redaction practices with the camera owner and advisor.
- [ ] Replace expectations with measured results and report uncertainty and failures.
- [ ] Confirm institutional style, student contribution statements, citations, and any required AI-use disclosure with the advisor.
