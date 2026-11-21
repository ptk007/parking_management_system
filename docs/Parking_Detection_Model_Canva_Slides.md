# Canva Slide Content

**Project:** Car Detection and Parking-Slot Occupancy Using Existing CCTV  
**Format:** 15 main slides for a 15-minute presentation  
**Language:** English, matching the current project report  

Keep each slide visual and brief. Treat the presenter notes as spoken explanation, not text to crowd onto the slide. Add the group's names and replace bracketed items before presenting.

---

## Slide 1 — Title

**Car Detection and Parking-Slot Occupancy Using Existing CCTV**

1501418 Selected Topics in Data Science and AI  
[Group members] · [Department / University] · [Presentation date]

**Visual:** One authorized, anonymized parking-camera still with a sample car box and parking-slot overlay.

**Say:** This project adapts the university's existing CCTV and parking application to detect cars and estimate the status of configured parking spaces.

---

## Slide 2 — Problem Background

- Parking staff need a current view of space availability.
- Checking multiple camera feeds and keeping slot information up to date can take time.
- Camera angle, occlusion, and stale detections can produce incorrect slot status.
- The current local workflow and its time cost still need confirmation with parking staff.

**Visual:** CCTV feeds → manual checking / current map → decision point. Label unverified local assumptions as questions, not facts.

**Say:** We are investigating whether existing camera footage can make slot-level information easier to review. We have not yet measured the university's current checking time or error rate.

---

## Slide 3 — Why This Project and What Is New Locally

- Camera-based parking systems have already been studied and built, including at universities.
- Prior campus examples include Pardubice University and Adventist University of the Philippines.
- This project does **not** claim to be the first campus smart-parking system.
- Its contribution is local integration and evaluation using the university's existing CCTV, model runtime, parking map, and application.

**Visual:** Prior research → local system integration → evaluation on local camera views.

**Footer citations:** Elomiya et al. (2023); Cruz et al. (2024); de Almeida et al. (2022).

**Say:** The research gap is local fit and evidence. We need to confirm with staff which operational problem remains and test how well the existing camera views support it.

---

## Slide 4 — Stakeholders and Decision

**Users and stakeholders**

- Parking staff: check available, entering, occupied, or disabled spaces.
- Administrators: review camera health, space use, and event history.
- System operators: monitor streams, model workers, and errors.
- Data owners and drivers: expect authorized and privacy-conscious handling.

**Decision question:** Which mapped spaces can be shown as available, transitioning, occupied, or unavailable based on current camera evidence?

**Visual:** Stakeholder icons around a central parking map.

---

## Slide 5 — Objectives and Research Questions

**Objectives**

1. Reuse existing university CCTV and source code for car detection and mapped-slot status estimation.
2. Study the benefits and limitations of the current parking workflow and identify improvements needed for practical use.

**Questions**

- How well does car detection work across local cameras and conditions?
- How reliably do tracking and slot rules estimate occupancy over time?
- When can the system read plate numbers and province text, especially before the vehicle parks?
- What are the update delay and multi-camera performance?

**Visual:** Objectives connected to four evaluation questions.

---

## Slide 6 — Data and Sources

| Source | Project use | Current evidence / caveat |
|---|---|---|
| Roboflow Car Detection v5 | Car bounding boxes | Verify dataset metadata, classes, split, and licence |
| Roboflow License Plate Recognition v12 | Plate-box detection | 10,125 images; CC BY 4.0; verify Thai-script fit |
| Parking-slot E4 workspace and local JSONs | Slot annotations | Four local JSONs contain 21 slot annotations; confirm workspace provenance and terms |
| University CCTV | Local evaluation | Obtain approval and record camera/date/condition details |
| Runtime and backend outputs | Current states and event history | System outputs are not ground truth |

**Visual:** Dataset/source cards with small example crops; use authorized and anonymized images only.

---

## Slide 7 — Data Quality and Preparation

- Public images may not match local camera angles, lighting, weather, or occlusion.
- Adjacent video frames can be too similar; random frame splitting may overstate performance.
- Check slot geometry against each camera view and resolution.
- Label ground-truth car boxes, track IDs, slot states, and visible plate text.
- Split by session/day and hold out a camera or view where feasible.
- Restrict raw video and plate access; use masked examples in public slides.

**Visual:** Collection → quality checks → labeling → grouped train/validation/test split.

**Footer citation:** de Almeida et al. (2015, 2022).

---

## Slide 8 — Exploratory Data Analysis

**Planned charts**

1. Slot status by zone and hour.
2. Car detection and occupancy quality by camera and lighting condition.
3. Timeline of labelled versus system slot transitions.
4. Plate-number and province readability by camera, distance, and parking phase.

**Current status:** No labelled local CCTV evaluation extract is available in the repository. These charts are planned; no local trend or accuracy result is claimed yet.

**Visual:** Show four small chart mockups labelled **Planned**, or replace with measured charts once authorized labels are collected.

---

## Slide 9 — Data Model

**Relationship diagram**

`parking_building` → `parking_floor` → embedded `camera_presets`  
`parking_floor` → embedded `parking_map.slots[]`  
`parking_log` → building, floor, camera preset, slot, plate, and event times  
`vehicle` records are matched by plate + province + vehicle type; the log has no direct `vehicleId` field.

**Key distinction:** A map slot stores `status` (`available`, `incoming`, `occupied`, `disabled`). A parking session stores `park_status` (`Parking`, `Exited`, `Not parking`).

**Visual:** Draw building/floor as database entities; draw camera presets and map slots inside the floor; connect parking history to the relevant building/floor/preset.

---

## Slide 10 — Proposed Model

**Occupancy path**

Authorized frame → Car YOLO → BoT-SORT + ReID → Slot geometry and time rules → Slot-state update

**Optional plate path**

Detected car → Plate YOLO → Plate crop → Thai EasyOCR → Optional event association

- Car detection and occupancy are primary.
- OCR is optional and must not determine whether a space is occupied.
- The displayed car box is expanded by 10%; this is a visual change only.

**Visual:** Two connected paths, with the plate/OCR branch shown as optional.

---

## Slide 11 — Workflow and Current Settings

1. Read the configured CCTV stream and slot map.
2. Detect cars at 960 input size, every 8th frame; application acceptance threshold: 0.80.
3. Track cars with BoT-SORT/ReID.
4. Estimate slot status from geometry, overlap, and persistence.
5. Run plate detection at size 640 and confidence 0.30 when needed; start Thai OCR after a plate box is found.
6. Send slot-state updates and parking events to the backend; display map and history in the frontend.

**Important setting distinction:** Tracker input confidence is 0.10; later application decisions filter cars at 0.80. Report both accurately.

**Visual:** CCTV → per-camera worker → model stages → backend → frontend. Show separate slot-status and parking-event arrows.

---

## Slide 12 — Evaluation Plan and Success Criteria

| Task | Measures | Proposed target / status |
|---|---|---|
| Car detection | Precision, recall, mAP | Precision and recall ≥ 0.90; not measured locally |
| Tracking | HOTA, IDF1, ID switches | IDF1 ≥ 0.80; proposed, not measured |
| Slot decision | Confusion matrix, macro-F1, false-available rate | Macro-F1 ≥ 0.90; false-available ≤ 2%; proposed |
| Events/runtime | Transition delay, missed/duplicate events, uptime | ≥ 95% of valid transitions within 2 seconds; proposed |
| Plate reading | Plate-box rate, plate-number exact read, province exact read | Set targets after collecting labelled local samples |

**Visual:** Metric table plus a note: **Targets are proposed; no local held-out scores are available yet.**

---

## Slide 13 — From Output to Action

| System output | Staff-facing meaning | Action |
|---|---|---|
| `available` | Space appears free | Show as available if feed and state are current |
| `incoming` | Vehicle is entering or manoeuvring | Show as a transition |
| `occupied` | Vehicle appears parked | Show occupied and record the session event |
| `disabled` | Space is not assignable | Do not show as free |
| Stale, unclear, or conflicting | Model evidence is uncertain | Flag for staff review; do not advertise as free |

**Mapping:** Runtime `occupied` while arriving → map `incoming`; runtime `parking` when settled → map `occupied`. Parking-log states are separate.

**Visual:** Status colors plus a staff-review branch for uncertain cases.

---

## Slide 14 — Proof of Concept and Preliminary Observation

**Demo sequence**

- Show a configured camera and matching slot overlay.
- Show the white car box, class label, and track ID.
- Show a slot transition and confirm it appears in the frontend/backend.
- Show plate-box detection and OCR only when a plate is detected.
- If available, show two cameras running and each worker's status.

**Preliminary observation:** Selected test images can show readable plate numbers and province text. On real camera views, plate numbers are sometimes readable; province text is often too small or distant, and some plates become readable only after parking.

**Evidence note:** Sample counts and conditions were not recorded. This is qualitative observation, not an accuracy result. Insert actual screenshots or a short authorized demo clip here.

---

## Slide 15 — Benefits, Limitations, and Next Steps

**Expected benefits**

- Reuse existing cameras and application.
- Give staff a shared slot-status view and event history.
- Support review of space use and camera/model issues.

**Limitations**

- Performance depends on camera view, lighting, occlusion, and slot geometry.
- Local accuracy, latency, and OCR rates are not yet measured.
- Plate/province recognition is secondary and may fail at distance.

**Next steps:** Confirm the local workflow need with staff → authorize CCTV collection → label test clips → run camera-aware evaluation → report measured results and a demo.

**Closing:** The contribution is local system integration and evaluation, not a claim to have invented campus smart parking.

**Visual:** Three next-step milestones and a small “What is measured / what remains” summary.

---

## Optional Backup Slide — References

Use as a backup slide or put short citations in the footer of relevant slides.

- Amato et al. (2017). *Deep learning for decentralized parking lot occupancy detection.* https://doi.org/10.1016/j.eswa.2016.10.055
- Cruz et al. (2024). *Vehicle parking area monitoring and management system using computer vision.* https://doi.org/10.35974/isc.v11i5.3570
- de Almeida et al. (2015). *PKLot—A robust dataset for parking lot classification.* https://doi.org/10.1016/j.eswa.2015.02.009
- de Almeida et al. (2022). *A systematic review on computer vision-based parking lot management applied on public datasets.* https://doi.org/10.1016/j.eswa.2022.116731
- Elomiya et al. (2023). *A smart parking system using surveillance cameras and fuzzy logic: A case study at Pardubice University's campus.* https://doi.org/10.1016/j.procs.2023.10.488
- Fooprateepsiri (2014). *A detection and recognition system for Thai car license plate under traffic CCTV issue.* https://ph01.tci-thaijo.org/index.php/kuengj/article/view/79423
- Luiten et al. (2021). *HOTA: A higher order metric for evaluating multi-object tracking.* https://doi.org/10.1007/s11263-020-01375-2

Use the full References section in the report for APA-style citations. Do not shrink this slide's text to fit; split it into two backup slides if needed.
