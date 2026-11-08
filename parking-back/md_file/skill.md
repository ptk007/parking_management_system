# Parking Backend API to Frontend Blueprint

This is the repository-specific reference for connecting the Vue frontend to the Express/Mongoose backend. It records behavior visible in the current source; it is not an API promise beyond that source.

> **Skill discovery:** This file is in `parking-back/md_file` as requested. VS Code does not normally auto-discover skills from this directory. To use it as an automatically loaded agent skill, copy/adapt it to `.github/skills/<skill-name>/SKILL.md` with YAML frontmatter.

## Rules for using this blueprint

- Check the current backend route, controller, model, and existing frontend service before adding or changing an API call. Source code is authoritative; update this reference when behavior changes.
- Do not invent endpoints, request properties, response properties, roles, status values, or fallback behavior. If the required operation is not defined below or in source, ask the project owner before implementing it.
- Keep API calls in `parking-front/src/services/api.ts`; use the shared Axios client so the configured base URL and stored bearer token are applied.
- Use the backend response shape as written. Some older/newer endpoints do not use a consistent `{ success: true }` envelope.
- Do not expose `.env` values, JWT secrets, MongoDB credentials, or camera stream credentials in frontend code, examples, logs, or this file.
- For uploads, use `FormData` with the exact field names below. Do not JSON-encode file uploads.
- Check HTTP status and display backend `message` where provided. Handle loading, empty, success, and error states in the UI.
- After editing, run the focused frontend tests and type-check; run backend tests when backend behavior or the endpoint contract changed.

## Starting the project

Prerequisites:

- Install Node.js and npm. The backend package does not declare a Node.js engine range.
- Have a reachable MongoDB instance and its connection URI.
- Prepare `parking-back/.env` locally with `MONGODB_URI` and a private `JWT_SECRET`. `PORT` is optional (backend default: `3000`). Do not commit the real `.env` or copy its values into frontend files or documentation.
- Install dependencies in each project folder if they are not installed yet.

PowerShell commands from the repository root:

```powershell
Set-Location .\parking-back
npm install
npm run dev
```

In another terminal:

```powershell
Set-Location .\parking-front
npm install
npm run dev
```

Backend scripts: `npm start` starts `server.js`; `npm run dev` starts it with Nodemon; `npm test` runs Node's test suite. Frontend scripts include `npm run dev`, `npm run type-check`, `npm run build`, and `npm run test:unit -- --run`.

The backend defaults to `http://localhost:3000` and mounts APIs under `/api`. The frontend Axios base URL is `VITE_API_BASE_URL` when set, otherwise `http://localhost:3000/api`. Set the frontend variable to the API base ending in `/api`, not to an individual resource path.

On backend startup, `server.js` connects to MongoDB and runs migrations for `parking_building` and `parking_floor`. Building migration renames old timestamps and removes `building_status`. Floor migration removes the old floor-level `zone`, renames timestamps, normalizes floor and camera-preset statuses, classifies shared source files, and migrates legacy camera-preset file references. Where legacy presets contain parsed slot JSON, migration writes a corresponding file under `json_file/parking_slots`. These operations modify existing database documents and local files. Back up the database before first startup against important data.

## Frontend request conventions

- Shared client: `parking-front/src/services/api.ts`.
- Auth header: `Authorization: Bearer <token>` is attached from `localStorage` key `token` when present.
- JSON requests use the shared client's JSON content type. The service methods for image/file uploads use `FormData`.
- IDs in the route paths are MongoDB document IDs unless the endpoint says otherwise.
- Backend JSON parser limit is 6 MB. Multer limits vary by upload route and are noted below.
- Static images are served by the backend at `/images/...`; building/user API image fields contain relative paths, not full URLs.

## Backend folder and data model

The backend is CommonJS. The following directories/files are relevant to frontend integration:

- `server.js`: environment loading, Express middleware, route mounting, startup migrations, MongoDB connection, and static image serving.
- `api/routes/`: URL paths, upload middleware, and route-level authentication/authorization.
- `api/controllers/`: request validation, business rules, database operations, and JSON responses.
- `api/models/`: Mongoose schemas and MongoDB collection names.
- `api/utils/`: Bangkok timestamp generation, parking-map validation, and startup migrations.
- `tests/`: Node test-runner API/model regression tests.
- `md_file/skill.md`: this frontend API blueprint.
- `parking_slots/README.txt`: example naming and location guidance for parking-slot JSON.

`node_modules/`, `package-lock.json`, and `.env` are not API specifications. The `.env` file may contain private credentials; never copy its contents into this document. The application stores image files in the repository-level `images/` folder and parking JSON in the repository-level `json_file/parking_slots/` folder.

### MongoDB collections and document fields

| Collection | Fields and behavior |
|---|---|
| `user` | `_id`, `username`, `password` (bcrypt hash; excluded from normal reads), `name`, `role`, `status`, `date_updated`, `time_updated`, `date_add`, `time_add`, `user_image`. Roles: `user`, `staff`, `admin`; statuses: `online`, `offline`, `disable`. Creation initializes `date_updated`/`time_updated` to the creation time and stores immutable `date_add`/`time_add`. |
| `vehicle` | `_id`, `veh_type`, `name` (owner User ObjectId), `brand`, `model`, `color`, `license_num`, `province`. Vehicle types: `car`, `motorcycle`; `license_num` is unique. |
| `parking_building` | `_id`, `building_name` (unique), `building_image`, `date_updated`, `time_updated`. There is no `building_status`. |
| `parking_floor` | `_id`, `building` (ParkingBuilding ObjectId), `floor` (integer), `veh_type`, `status`, `date_updated`, `time_updated`, `parking_slot_file` (legacy single-file path), `parking_slot_files` (array of `{ _id, original_name, path, size }`), `camera_presets`, `parking_map`. Floor status: `Available`, `Disable`; vehicle type: `car`, `motorcycle`. There is no floor-level `zone`. |
| `camera_presets` (embedded in `parking_floor`) | `_id`, `name`, `cctvFileName`, `cameraSelector`, `cameraNo`, `ipAddress`, `sourceCameraName`, `rtspLink`, `status`, `createAt`, `updateAt`, `parkingSlotFileId`, `parkingSlotData`, `modelEnabled`, `modelRuntimeStatus`, `modelRuntimeMessage`, `modelRuntimeUpdatedAt`, `modelRuntimeId`. Preset connection statuses: `Online`, `Offline`, `Disable`, `Unknown`; manual status updates accept only `Disable` and `Unknown`. YOLO desired state (`modelEnabled`) and Python worker status (`Offline`, `Starting`, `Online`, `Stopping`, `Error`) are separate from CCTV connection status. |
| `parking_source_files` | `_id`, `original_name`, `path`, `size`, `fileType` (`cctv` or `parking-slot`), `createdAt`, `updatedAt`. This is the shared source-file registry. |
| `parking_log` | `_id`, `owner` (matched vehicle owner's User ObjectId, nullable), `name`, `building`, `buildingId`, `floor`, `floorId`, `veh_type`, `cameraPresetId`, `parkingSlotName`, `brand`, `model`, `color`, `license_num`, `province`, `date_enter`, `park_time`, `date_exit`, `exit_time`, `park_slot` (map slot number), `park_status`, `createdAt`, `updatedAt`. Statuses: `Parking`, `Exited`, `Not parking`. One partial unique index prevents multiple active logs for the same plate, province, building, floor, and vehicle type. |
| `parking_log_counters` | `_id` counter key and `sequence`; the `guest` counter allocates sequential names (`Guest 1`, `Guest 2`, ...) to unmatched detections. |
| `support_ticket` | `_id`, `ticketNumber`, `owner`, `subject`, `category`, `location`, `status`, `assignedSupport`, `messages`, `readAt`, `createdAt`, `updatedAt`. Message records contain sender ID/name/type, message text, and timestamp. |

The building camera-summary endpoint reads existing documents from `parking_cctv`; that collection has no Mongoose model or CRUD routes in this backend. The summary endpoint returns counts only. Do not infer a supported camera CRUD API from that collection.

## Endpoint index

Paths below are relative to `/api` except the health endpoint, which is mounted at the server root. Auth requirements describe middleware and controller checks actually installed on each route.

### Health

| Method and path | Auth | Operation / response |
|---|---|---|
| `GET /` (server root) | None | Returns `{ "message": "Parking management API is running" }`. This is not under `/api`. |

### Authentication — `/auth`

| Method and path | Auth | Request | Success response |
|---|---|---|---|
| `POST /auth/login` | None | JSON `{ username, password }` | `{ success: true, token, user }`; token expires in 8 hours. Sets user status to `online`. |
| `POST /auth/logout` | Bearer JWT | No body | `{ success: true, message: "Logged out" }`; sets status to `offline`. |
| `GET /auth/verify` | Bearer JWT | No body | `{ success: true, user }`. Disabled or missing users are rejected. |

Login errors include 400 for missing credentials, 401 for invalid credentials, 403 for a disabled account, and 500 if `JWT_SECRET` is not configured.

### Users — `/users`

The current `userRoutes.js` does not install auth middleware. Do not assume these routes are protected.

| Method and path | Request | Success response / operation |
|---|---|---|
| `POST /users` | JSON fields `username`, `password`, `name`, `role`; optional multipart field `user_image` | 201 `{ success: true, user }`. Password is hashed and omitted from returned user. |
| `GET /users` | None | `{ success: true, count, users }`; password is omitted. |
| `GET /users/check-duplicate?username=...` | Query `username` | `{ success: true, duplicate }`. |
| `GET /users/:id` | None | `{ success: true, user }`. |
| `PUT /users/:id` | JSON or multipart; editable fields `username`, `password`, `name`, `role`, `status`; optional `user_image` | `{ success: true, user }`; refreshes `date_updated`/`time_updated`. |
| `DELETE /users/:id` | None | `{ success: true, message: "User deleted" }`. |

User `role`: `user`, `staff`, `admin`. User `status`: `online`, `offline`, `disable`. Image upload accepts JPG/JPEG, PNG, WebP, up to 5 MB; field name is exactly `user_image`.

### Vehicles — `/vehicles`

The current `vehicleRoutes.js` does not install auth middleware. Do not assume these routes are protected.

| Method and path | Request | Success response / operation |
|---|---|---|
| `POST /vehicles` | JSON `{ veh_type, name, brand, model, color, license_num, province }`; `name` is the owner's user ObjectId | 201 `{ success: true, vehicle }`; owner is populated with `_id`, `username`, `name`. |
| `GET /vehicles` | None | `{ success: true, count, vehicles }`; owner is populated. |
| `GET /vehicles/check-duplicate?license_num=...` | Query `license_num` | `{ success: true, duplicate }`. |
| `GET /vehicles/user/:userId` | None | `{ success: true, count, vehicles }` for that owner. |
| `GET /vehicles/:id` | None | `{ success: true, vehicle }`. |
| `PUT /vehicles/:id` | JSON subset of create fields | `{ success: true, vehicle }`. |
| `DELETE /vehicles/:id` | None | `{ success: true, message: "Vehicle deleted" }`. |

`veh_type`: `car` or `motorcycle`. `license_num` is unique. Invalid IDs/owner references return 400, missing records 404, duplicates 409.

### Parking buildings — `/admin/system/buildings`

All building routes require a valid Bearer JWT and current database role `admin`.

| Method and path | Request | Success response / operation |
|---|---|---|
| `POST /admin/system/buildings` | Multipart `building_name`; optional `building_image` | 201 `{ success: true, building }`. |
| `GET /admin/system/buildings` | None | `{ success: true, count, buildings }`, newest updated first. |
| `GET /admin/system/buildings/check-duplicate?building_name=...` | Query `building_name` | `{ success: true, duplicate }`. |
| `GET /admin/system/buildings/camera-summary` | None | `{ success: true, summaries }`, keyed by building ID; each summary has `total`, `online`, `offline`, `disabled`, `unknown`. It exposes counts only, not camera connection details. |
| `GET /admin/system/buildings/:id` | None | `{ success: true, building }`. |
| `PATCH /admin/system/buildings/:id` | Multipart; optional `building_name` and/or `building_image` | `{ success: true, building }`; refreshes building update date/time. |
| `DELETE /admin/system/buildings/:id` | None | `{ success: true, message: "Building deleted" }`; also deletes its floors and eligible local files. |

Image field is exactly `building_image`, accepts JPG/JPEG, PNG, WebP up to 5 MB. Current building document fields: `_id` ObjectId, `building_name` String, `building_image` String or null, `date_updated` String, `time_updated` String. There is no `building_status`.

### Parking floors — `/admin/system/floors`

All floor routes require a valid Bearer JWT. `GET /catalog` allows any authenticated token; `PATCH /catalog/:id/slot-statuses` additionally requires the current role `admin` or `staff`; all other floor routes require `admin`.

| Method and path | Request | Success response / operation |
|---|---|---|
| `GET /admin/system/floors/catalog` | None | `{ floors }`; floor map/dashboard fields, populated building ID/name only. |
| `PATCH /admin/system/floors/catalog/:id/slot-statuses` | JSON `{ keys: string[], status: "available" \| "disabled" }`; keys encode `[zone, number]` | `{ map }`; updates only slots currently `available` or `disabled`, preserving occupied/incoming slots. |
| `POST /admin/system/floors` | JSON `{ building, floor, veh_type, status? }`; optional multipart `parking_slot_file` (legacy single JSON file) | 201 `{ success: true, floor }`. |
| `GET /admin/system/floors` | None | `{ success: true, count, floors }`. |
| `GET /admin/system/floors/:id` | None | `{ success: true, floor }`. |
| `PATCH /admin/system/floors/:id` | JSON fields `building`, `floor`, `veh_type`, `status`; optional multipart `parking_slot_file` | `{ success: true, floor }`. |
| `DELETE /admin/system/floors/:id` | None | `{ success: true, message: "Floor deleted" }`. |
| `PUT /admin/system/floors/:id/map` | JSON map document | `{ floor }`; map must satisfy backend validation. Editing layout on an `Available` floor is rejected with 409. |
| `POST /admin/system/floors/:id/cameras` | JSON or multipart; required `name` and valid parking-slot data. Provide multipart `parking_slot_file`, JSON `parkingSlotData`, or `parkingSlotFileId` referencing a shared `parking-slot` source; optional `cctvFileName`, `cameraSelector`, `cameraNo`, `ipAddress`, `sourceCameraName`, `rtspLink`, and connection-check `status` | `{ success: true, floor }`; default status is `Unknown`. File upload is stored in the shared source registry; embedded `parkingSlotData` is supported by the backend. |
| `PATCH /admin/system/floors/:id/cameras/:cameraId` | Same fields and options as camera creation | `{ success: true, floor }`; updates the preset and uses the submitted connection-check status (`Online`, `Offline`, or `Unknown`), unless the preset is `Disable`. |
| `PATCH /admin/system/floors/:id/cameras/:cameraId/status` | JSON `{ status: "Disable" \| "Unknown" }` | `{ success: true, floor }`; detector-driven `Online`/`Offline` statuses are not manually set by this endpoint. |
| `GET /admin/system/floors/:id/cameras/:cameraId/parking-slot-categories` | None | `{ categories: string[] }`; contains only category names whose `supercategory` is `parking-slot`. |
| `POST /admin/system/floors/source-files` | Multipart repeated `files` fields; JSON files; at most 20 files and 5 MB combined | 201 `{ success: true }`; files are stored as shared CCTV sources with `fileType: "cctv"`. |
| `GET /admin/system/floors/source-files` | None | `{ files }`; each shared source includes `fileType` (`cctv` or `parking-slot`) and `available` to indicate whether its on-disk file exists. Missing sources can be re-imported using the same filename. |
| `GET /admin/system/floors/source-files/:fileId` | None | Downloads original file bytes; returns 404 with a re-import message if the registry record exists but the file is missing. |
| `POST /admin/system/floors/source-files/:fileId/cameras/search` | JSON `{ query }`; exact case-insensitive match against `NO`, `IP ADDRESS`, `CAMERA NAME_NEW`, and `ANPR&PTZ RTSP` | `{ matches, camera?, status, message }`; search does not open an RTSP connection. A unique match can be previewed; multiple matches require selection; missing/invalid RTSP returns `Unknown`; missing source files return 404 and must be re-imported. Admin-only. |
| `POST /admin/system/floors/source-files/:fileId/cameras/:recordIndex/preview` | Source record index from a prior search; optional JSON `{ parkingSlotData }` | Authenticated `multipart/x-mixed-replace` MJPEG stream. The RTSP URL is read from the selected stored CCTV source, never accepted from the browser. The preview is capped at 1280 pixels wide, 5 FPS, and 1 MB per JPEG; smaller camera frames are not upscaled. At most two preview workers may run simultaneously. The worker exits when the client disconnects. Valid COCO `annotations[].bbox` boxes are scaled using the corresponding `images` width and height and drawn over the raw frames; records without usable boxes are not drawn. Missing source files return 404. Admin-only. |
| `GET /admin/system/floors/:id/cameras/:cameraId/model-preview` | Admin JWT (the floor router applies admin authorization) | None | Latest JPEG frame annotated by the active Python YOLO worker. Requires the preset model to be enabled and the worker status heartbeat to be fresh and `Online`; returns 503 while the worker/frame is not ready, or 409 when YOLO is disabled. |
| `POST /admin/system/floors/source-files/:fileId/cameras/:recordIndex/probe` | Source record index from a prior search | Legacy one-shot check returning `{ camera, status, message, frameData? }`; checks the selected stored record's RTSP URL and includes one bounded JPEG frame when `Online`. The Add/Edit form uses the live preview endpoint instead. Admin-only. |
| `POST /admin/system/floors/:id/slot-files` | Multipart repeated `files` fields | 201 `{ success: true, floor }`; stores JSON file references on this floor. Combined files for a floor may not exceed 5 MB; duplicate original names are rejected. |
| `GET /admin/system/floors/:id/slot-files/:fileId` | None | Downloads a file attached to that floor. |

Floor document fields are `_id`, `building`, `floor`, `veh_type`, `status`, `date_updated`, `time_updated`, `camera_presets`, `parking_slot_file`, `parking_slot_files`, and `parking_map`. Floor vehicle types: `car`, `motorcycle`; floor status: `Available`, `Disable`. There is no floor-level `zone`. `building` is a `parking_building` ObjectId. Legacy `parking_slot_file` is a separate optional single-file path; `parking_slot_files` is the plural file list; neither is the `parking_map`. Parking-map slot `zone` values are still part of map slot identity and are unrelated to the removed floor field.

Camera preset fields are `_id`, `name`, `cctvFileName`, `cameraSelector`, `cameraNo`, `ipAddress`, `sourceCameraName`, `rtspLink`, `status`, `createAt`, `updateAt`, `parkingSlotFileId`, and `parkingSlotData`. `cameraNo`, `ipAddress`, `sourceCameraName`, and `rtspLink` are read from the selected CCTV JSON source; `cameraSelector` retains the stable runtime selector (normally `cameraNo`). `cctvFileName` is the original CCTV filename; `parkingSlotFileId` identifies an optional uploaded/shared parking-slot JSON file and is `null` for embedded-only slot data; `parkingSlotData` contains the validated Roboflow JSON. To create a preset without a parking-slot file, send `parkingSlotData` as JSON in the request body and omit `parking_slot_file`/`parkingSlotFileId`. The API validates that `categories` includes at least one named category with `supercategory: "parking-slot"`. Statuses are `Online`, `Offline`, `Disable`, and `Unknown`. Add/Edit CCTV and the CCTV setup card can open a live backend-hosted OpenCV preview at up to 5 FPS and 1280 pixels wide (roughly 720p for 16:9 streams), with a 1 MB per-frame JPEG cap; smaller camera frames are not upscaled. The setup card preview is started on demand from its camera tile and permits only one active tile preview at a time. The expanded overlay reuses the same stream and does not create another RTSP connection. Higher resolution increases network bandwidth and backend encoding work; it does not start YOLO or EasyOCR. The preview stops when closed or changed, and the backend allows at most two active preview workers. When `parkingSlotData` contains valid COCO `annotations[].bbox` values, the boxes are scaled using the corresponding image dimensions and overlaid; no boxes are drawn if there are no usable bbox annotations. The preview uses the selected stored CCTV source record and does not accept a browser-provided stream URL. Python defaults on Windows to `C:\\py_venv\\.venv\\Scripts\\python.exe`, matching `python-v2/run.bat`; set the private backend environment variable `PARKING_PYTHON_EXECUTABLE` to override it.

YOLO fields on a camera preset are independent of its connection `status`: `modelEnabled` stores the requested switch state; `modelRuntimeStatus`, `modelRuntimeMessage`, `modelRuntimeUpdatedAt`, and `modelRuntimeId` hold the latest Python worker report. Editing a preset's camera/source/parking-slot identity or disabling the preset resets its requested model state to OFF. See the YOLO runtime section for the control endpoint and prerequisites.

Floor timestamps are refreshed on floor edits, map changes, camera preset changes/status updates, and floor slot-file imports. Map slot statuses remain lowercase (`available`, `incoming`, `occupied`, `disabled`) and are separate from title-case floor and camera preset statuses.

The parking map has `slots` (maximum 5,000) and `layout` (maximum 300 shapes), with bounded geometry, allowed statuses, and optional embedded PNG/JPEG/WebP data URL background. A map slot may include `cameraPresetId` to associate it with a CCTV preset on the same floor. `parkingSlotName` is optional; when provided it must be a `parking-slot` category belonging to that preset. A parking slot name without a CCTV preset is invalid. The frontend hides names already assigned to another map slot for the same preset; the backend validates preset/category membership but does not enforce map-wide uniqueness of assignments. Follow `parking-front/src/components/parking/parkingMapJson.ts` and `parkingLayout.ts` for frontend types/serialization; backend validation is in `api/utils/parkingMap.js`.

There are no camera-preset delete, source-file delete, or slot-file delete routes in the current route modules. Do not call or assume these operations exist.

### Parking logs — `/parking-logs`

| Method and path | Auth | Request | Success response / operation |
|---|---|---|---|
| `POST /parking-logs/model-events` | `x-model-api-key` header matching the private `PARKING_MODEL_API_KEY` environment variable | JSON `{ event, floorId?, cameraPresetId?, cameraNo?, cctvFileName?, license_plate, province?, parkingSlotName?, occurredAt? }` | `{ success: true, log, matchedVehicle, created? }`; applies `Parking`, `Exited`, or `Not parking` events to the associated map slot and log. |
| `GET /parking-logs/me` | Valid user JWT | None | `{ logs }`; only the authenticated user's matched vehicle logs. |
| `GET /parking-logs` | Valid JWT; current database role `admin` or `staff` | Optional `buildingId`, `floorId`, `veh_type` query filters | `{ logs }`; management log list. |

Configure a private, high-entropy `PARKING_MODEL_API_KEY` in the backend environment before sending model events. Do not put its value in source code or frontend configuration. The model endpoint returns 503 when the key is not configured and 401 for a missing/incorrect key.

`event` must be `Parking`, `Exited`, or `Not parking`. Identify the CCTV preset either with both `floorId` and `cameraPresetId`, or with the exact `cameraNo` and `cctvFileName` pair stored on one preset. If source identity matches multiple presets, the endpoint returns `409` instead of selecting one. `license_plate` is required. `province` is optional: when omitted, the backend uses the province of a registered vehicle matching the plate and floor vehicle type, or `Unknown` for a Guest. `occurredAt` is an optional ISO-8601 timestamp (defaults to server time). `parkingSlotName` is required for `Parking` and `Exited` and must match a `parking-slot` category in that preset's data; it is optional for `Not parking`. The backend resolves the parking-map slot from the preset/category association and stores that map slot number as `park_slot`.

A matched registered vehicle gets an owner-scoped log. An unmatched detection immediately gets an unowned log named with the next sequential `Guest N` value; guest records appear in the staff dashboard but not a user's personal history. `Parking` marks a non-disabled slot occupied and creates a new log, or returns the same active log for a repeated event at the same slot. `Exited` marks a non-disabled slot available and changes the active log to `Exited`. A later `Parking` event after exit creates a new log `_id` and, for an unmatched vehicle, a new Guest number. Map slots with `disabled` status stay disabled. `Not parking` creates a log for matched or unmatched detections and does not change a map slot. Map writes use optimistic matching, but map and log writes are not a MongoDB transaction; if a database write fails between them, the map and log can temporarily disagree.

`GET /parking-logs` (staff/admin dashboard) returns active `Parking` logs indefinitely, `Exited` logs for 24 hours after exit, and `Not parking` logs for 24 hours after detection. `GET /parking-logs/me` (user parking history) returns all statuses without a 24-hour age limit. Dates and times in `date_enter`, `park_time`, `date_exit`, and `exit_time` use Bangkok time.

The Python runtime sends model events asynchronously so HTTP retries do not block video-frame processing. It sends `Not parking` when OCR first locks a plate, `Parking` when the slot state transitions to parking, and `Exited` when that slot is released. Dashboard maps refresh from the floor catalog every five seconds while the browser tab is visible.

### YOLO model control and Python runtime — `/model-runtime`

YOLO control is independent from CCTV connection checking. A preset's CCTV `status: "Online"` means its RTSP connection check succeeded; it does not mean the Python YOLO worker is running. The backend stores the requested state in `camera_presets.modelEnabled` and stores worker-reported state separately in `modelRuntimeStatus`, `modelRuntimeMessage`, `modelRuntimeUpdatedAt`, and `modelRuntimeId`.

| Method and path | Auth | Request | Success response / operation |
|---|---|---|---|
| `PATCH /admin/system/floors/:floorId/cameras/:cameraId/model` | Valid admin JWT | JSON `{ enabled: boolean }` | `{ success: true, floor }`; persists the desired state. ON is rejected unless the camera preset is not disabled, its camera number/source identity is unique, parking detection is enabled in the matching local profile, at least one map slot is assigned to the preset, and all mapped slots have parking-category names. OFF persists `modelEnabled: false`; a recent active worker is marked `Stopping` until the next runtime sync. |
| `POST /model-runtime/sync` | `x-model-api-key` header matching the private `PARKING_MODEL_API_KEY` environment variable | JSON `{ runtimeId, profiles, workers }` | `{ commands, issues }`; matches the local profile inventory to presets, returns each matched preset's desired `enabled` state and whether it is `runnable`, and persists reported worker status/heartbeat. |

The Python supervisor calls the sync endpoint approximately every 3 seconds. `profiles` is the list of confirmed profiles from `python-v2/cctv/parking-cam/active.json`; each item contains `cameraNo`, `cctvFileName`, `profileName`, `parkingEnabled`, and `parkingSlotNames`. `workers` contains `cameraNo`, `cctvFileName`, `status`, and optional `message`. The runtime and preset are matched case-insensitively by trimmed camera number and CCTV source filename; ambiguous or duplicate matches are reported as issues rather than selecting a camera arbitrarily. The endpoint accepts at most 100 profiles/workers, a runtime ID up to 100 characters, and at most 5,000 slot names per profile (each up to 128 characters). Accepted worker statuses are `Offline`, `Starting`, `Online`, `Stopping`, and `Error`.

Each command contains `{ cameraNo, cctvFileName, floorId, cameraPresetId, enabled, runnable, message }`. A missing active profile marks an enabled preset `Error`; an incompatible profile (parking disabled, no usable slot categories, no map assignment, or a mapped category missing locally) is not runnable. Preset ON/OFF is remembered in MongoDB across Python supervisor restarts. Disabling a preset or changing its camera/source/parking-slot identity turns its model off.

To enable frontend-controlled YOLO, set `PARKING_MODEL_RUNTIME_URL` to the backend sync URL (for example `http://localhost:3000/api/model-runtime/sync`) and set `PARKING_MODEL_API_KEY` in the environment inherited by `python-v2/run.bat`. The key must match the backend's private value. The backend `parking-back/.env` is loaded by the Node.js server only; it is not automatically loaded by the separate Python process. `run.bat` checks CUDA before launching and warns if the Python runtime URL or key is missing. Without `PARKING_MODEL_RUNTIME_URL`, Python keeps its legacy behavior of starting every confirmed profile, but it does not receive ON/OFF commands or report runtime status. If the URL is configured without the key, Python exits with a configuration error; backend authentication failures or network errors are printed by the runtime client.

When remote control is enabled, `multi_camera.py` passes each worker a `PARKING_RUNTIME_FRAME_FILE` under `python-v2/results/runtime_frames`. The worker writes an atomic JPEG of its annotated display frame at up to 5 FPS (downscaled to the existing 1280×720 display bounds). The admin CCTV preset's preview polls the model-preview endpoint while YOLO is enabled; its frame includes car boxes, detected plate boxes/confidence, OCR label, and parking-slot overlays. When YOLO is off, the existing on-demand raw CCTV stream remains available. The frame endpoint does not start a worker and does not accept a stream URL from the browser.

The admin UI refreshes runtime data every 4 seconds and displays an enabled worker as `Offline` when its last backend heartbeat is missing or older than 20 seconds. Check the Python supervisor console, URL/port, matching private API key, confirmed active profile identity, and parking-map/category assignments before treating CCTV `Online` as evidence that YOLO is running. A live CCTV preview only verifies camera streaming and does not start the YOLO worker.

### Support tickets — `/support`

Every route requires a Bearer token and a current non-disabled user. A regular `user` can access only their own tickets; `staff` can see tickets and claim/reply to tickets under the controller rules; `admin` is not treated as support staff by this controller.

| Method and path | Request | Success response / operation |
|---|---|---|
| `GET /support/tickets` | None | `{ tickets }`; owner sees own tickets, staff sees all. |
| `POST /support/tickets` | JSON `{ subject, message, category?, location? }` | 201 `{ ticket }`; owner and initial message come from authenticated user. Staff cannot create tickets. |
| `GET /support/tickets/:id` | None | `{ ticket }` with messages; only owner or staff. |
| `POST /support/tickets/:id/messages` | JSON `{ message }` | 201 `{ ticket }`; messages limited to 4,000 characters; staff must have claimed the ticket. |
| `POST /support/tickets/:id/claim` | None | `{ ticket }`; staff only; only an open unassigned ticket can be claimed. |
| `PATCH /support/tickets/:id/status` | JSON `{ status: "open" \| "done" }` | `{ ticket }`; only assigned staff closes; owner can reopen; staff reopening must be the assignee. |
| `POST /support/tickets/:id/read` | JSON `{ messageId }` | `{ success: true }`; marks up to that message as read for the authenticated viewer. |

Category: `parking`, `vehicle`, `account`, `other`. Ticket status: `open`, `in_progress`, `done`. Responses include `ticketNumber`, participant summaries, timestamps, `lastMessage`, `unreadCount`; the full ticket endpoint includes `messages`.

## Frontend paths that are not confirmed backend endpoints

The current frontend `api.ts` also has helpers for paths such as `/staff/dashboard`, `/staff/parking/...`, `/staff/cctv/...`, `/staff/history`, `/staff/profile`, and `/parking-zones`. The current `parking-back/server.js` does not mount route modules for these paths. Treat them as unimplemented/unverified in this backend, not as working APIs. `/parking-logs` is mounted and documented above.

## CRUD integration workflow

1. Identify the screen and exact operation; check whether its route is already in this file and the backend route/controller.
2. Confirm request fields, content type, auth/role, response shape, and error cases from source. Ask if any intended behavior is not specified.
3. Add or update a typed interface and a focused method in `parking-front/src/services/api.ts`. Use the shared client; do not add a separate base URL or hard-code credentials.
4. Connect the view to the service. Add loading/error/empty states, disable duplicate submissions while pending, and update/reload local state only after success.
5. Add/update a focused Vitest test for request method, URL, payload/form fields, and user-visible outcomes.
6. Validate with `npm run type-check`, focused `npx vitest run <test-file>`, and `npm run build` when relevant. If backend code changed, run `npm test` from `parking-back`.
7. Update this document only from verified implementation. Report missing backend routes or unknown behavior instead of guessing.

## Source of truth

- Server and mounted route prefixes: `parking-back/server.js`
- Routes: `parking-back/api/routes/`
- Request validation, permissions, and response bodies: `parking-back/api/controllers/`
- MongoDB collection schemas: `parking-back/api/models/`
- Shared frontend HTTP client/services: `parking-front/src/services/api.ts`
- Frontend domain types: `parking-front/src/types/index.ts`
- Map validation: `parking-back/api/utils/parkingMap.js`
- Backend tests: `parking-back/tests/`
- Frontend tests: `parking-front/src/__tests__/`
