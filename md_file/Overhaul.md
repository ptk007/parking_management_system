# Parking Management System Overview

The MFU Parking Management System uses existing CCTV to estimate parking occupancy. A Windows Python runtime reads camera streams and publishes slot and plate events. An Express API stores the resulting map state and parking sessions in MongoDB. A Vue frontend shows availability, CCTV, parking history, and tools for staff and admins.

## Documentation index

| Document | Contents |
| --- | --- |
| [Frontend](front/Frontend.md) | Pages, roles, UI actions, and frontend data flows |
| [Backend](back/Backend.md) | Mounted API routes, access checks, status rules, and database updates |
| [Model](model/Model.md) | Dataset inventory, YOLO, tracking, OCR, and CCTV runtime |
| [Proposal material](docs/Docs.md) | Data dictionary, system flowchart, user diagram, ER diagram, and data flow diagram |

## Repository structure

| Path | Responsibility |
| --- | --- |
| [parking-front/](../parking-front/) | Vue 3 and TypeScript SPA. Vue Router handles pages, Pinia stores client state, and Axios calls the API. |
| [parking-back/](../parking-back/) | Node.js and Express API. Mongoose models describe the MongoDB collections. |
| [python-v2/](../python-v2/) | Windows CCTV supervisor, camera workers, YOLO weights, tracker configuration, and local result files. |
| [json_file/](../json_file/) | Repository JSON storage, including uploaded CCTV and parking-slot source files. |
| [images/](../images/) | Uploaded account and building images served by the backend under `/images`. |
| [docs/](../docs/) | Existing project proposal, report, and other research or design material. |
| `logs/` | Generated Excel exports of parking logs. |
| [md_file/](./) | Implementation documentation and proposal material. |

## Main flows

1. **Configure a location.** Admin creates a building and floor, imports CCTV data, selects a camera, and adds its parking-area annotations. Admin saves a map and links a displayed slot to a preset and one category in Parking Map Editor. The floor editor uses the pairing of building, floor number, and vehicle type to distinguish maps.
2. **Run detection.** On Windows, starting the backend starts `python-v2/run.bat` in standby. The Python supervisor reads the saved presets and starts one worker for each runnable preset with Detection enabled. The worker can show a YOLO preview before any map assignment exists.
3. **Update occupancy.** The worker sends the detected state for assigned categories. The backend resolves the preset/category to a saved slot and updates its status. An occupied report can create a Guest session with an unknown plate. A later plate read or a manual correction can identify the same session.
4. **Show and manage results.** Dashboards load maps and, for staff and admins, parking logs and CCTV. A logged-in owner sees their parking history. In Slot Details, staff and admins can correct vehicle information for an occupied slot or change the enabled state of an empty slot. Each effective enable or disable change is recorded in Slot Status Log.
5. **Support users.** A logged-in requester opens a support ticket. Staff claim, reply to, and resolve tickets. Message history and read positions are stored with the ticket.

## State glossary

| Record | Values | Meaning |
| --- | --- | --- |
| Floor `status` | `Available`, `Disable` | Whether the floor is displayed as available in the dashboard and whether its layout can be edited. |
| Map slot `status` | `available`, `incoming`, `occupied`, `disabled` | Whether a slot is empty, being approached, occupied, or administratively disabled. |
| Map slot `connectionStatus` | `Connect`, `None`, `Disconnect` | Assignment is complete, absent or incomplete, or broken. An intentionally disabled or temporarily offline camera can still have a valid assignment. |
| Preset `status` | `Enable`, `Disable` | Whether the camera preset is enabled. |
| Preset `sourceStatus` | `Online`, `Offline`, `Unknown` | Connectivity of the original camera source. |
| `modelEnabled` | `true`, `false` | Requested Detection state. |
| `modelRuntimeStatus` | `Offline`, `Starting`, `Online`, `Stopping`, `Error` | Status reported by the Python supervisor. |
| Parking log `park_status` | `Parking`, `Exited`, `Not parking` | Session is active, has ended, or records a plate detection outside a parking session. |

## Local startup

1. Start MongoDB. The backend defaults to `mongodb://127.0.0.1:27017/parking_management_system`.
2. In `parking-back/`, install the declared dependencies and run `npm run dev`. The backend defaults to port `3000`. Locally generated JWT and model keys are kept in Git ignored files and reused on restart. A configured key takes precedence.
3. In `parking-front/`, install dependencies and run `npm run dev`. The frontend uses `VITE_API_BASE_URL` or `http://localhost:3000/api`.
4. For live detection, install the Windows Python virtual environment with `python-v2/install.bat` and verify NVIDIA CUDA, the weight files, and authorized camera access. The normal Windows backend startup launches the runtime. Manual `run.bat` is useful for diagnosis.

A health response from `GET /` confirms that the API is listening. It does not establish CCTV reachability or successful Detection. When `run.bat` exits with code `1`, the preceding terminal lines identify the failed check. Examples include a missing virtual environment, an import failure, unavailable CUDA, or model authentication setup.

## Proposal scope

The implementation separates parking occupancy from vehicle identification. The proposal can describe the implemented flow and database schema. CCTV access and evaluation samples require authorization. Training provenance, field accuracy, and end-to-end latency require separate evidence. See the [proposal material](docs/Docs.md) for figures and tables ready to place in Chapter 3.
