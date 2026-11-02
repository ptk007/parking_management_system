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
| `camera_presets` (embedded in `parking_floor`) | `_id`, `name`, `cctvFileName`, `cameraSelector`, `ipAddress`, `rtspLink`, `status`, `createAt`, `updateAt`, `parkingSlotFileId`, `parkingSlotData`. Preset statuses: `Online`, `Offline`, `Disable`, `Unknown`. The API does not provide detector-stream operations in this repository; manual status updates accept only `Disable` and `Unknown`. |
| `parking_source_files` | `_id`, `original_name`, `path`, `size`, `fileType` (`cctv` or `parking-slot`), `createdAt`, `updatedAt`. This is the shared source-file registry. |
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
| `POST /admin/system/floors/:id/cameras` | JSON or multipart; required `name` and valid parking-slot data. Provide multipart `parking_slot_file`, JSON `parkingSlotData`, or `parkingSlotFileId` referencing a shared `parking-slot` source; optional `cctvFileName`, `cameraSelector`, `ipAddress`, `rtspLink` | `{ success: true, floor }`; initial status is `Unknown`. File upload is stored in the shared source registry; embedded `parkingSlotData` is supported by the backend. The current frontend add/edit form uses file upload and does not provide pasted JSON input. |
| `PATCH /admin/system/floors/:id/cameras/:cameraId` | Same fields and options as camera creation | `{ success: true, floor }`; updates the preset and resets status to `Unknown` unless it was `Disable`. |
| `PATCH /admin/system/floors/:id/cameras/:cameraId/status` | JSON `{ status: "Disable" \| "Unknown" }` | `{ success: true, floor }`; detector-driven `Online`/`Offline` statuses are not manually set by this endpoint. |
| `GET /admin/system/floors/:id/cameras/:cameraId/parking-slot-categories` | None | `{ categories: string[] }`; contains only category names whose `supercategory` is `parking-slot`. |
| `POST /admin/system/floors/source-files` | Multipart repeated `files` fields; JSON files; at most 20 files and 5 MB combined | 201 `{ success: true }`; files are stored as shared CCTV sources with `fileType: "cctv"`. |
| `GET /admin/system/floors/source-files` | None | `{ files }`; each shared source includes `fileType` (`cctv` or `parking-slot`). |
| `GET /admin/system/floors/source-files/:fileId` | None | Downloads original file bytes. |
| `POST /admin/system/floors/:id/slot-files` | Multipart repeated `files` fields | 201 `{ success: true, floor }`; stores JSON file references on this floor. Combined files for a floor may not exceed 5 MB; duplicate original names are rejected. |
| `GET /admin/system/floors/:id/slot-files/:fileId` | None | Downloads a file attached to that floor. |

Floor document fields are `_id`, `building`, `floor`, `veh_type`, `status`, `date_updated`, `time_updated`, `camera_presets`, `parking_slot_file`, `parking_slot_files`, and `parking_map`. Floor vehicle types: `car`, `motorcycle`; floor status: `Available`, `Disable`. There is no floor-level `zone`. `building` is a `parking_building` ObjectId. Legacy `parking_slot_file` is a separate optional single-file path; `parking_slot_files` is the plural file list; neither is the `parking_map`. Parking-map slot `zone` values are still part of map slot identity and are unrelated to the removed floor field.

Camera preset fields are `_id`, `name`, `cctvFileName`, `cameraSelector`, `ipAddress`, `rtspLink`, `status`, `createAt`, `updateAt`, `parkingSlotFileId`, and `parkingSlotData`. `cctvFileName` is the original CCTV filename; `parkingSlotFileId` identifies an optional uploaded/shared parking-slot JSON file and is `null` for embedded-only slot data; `parkingSlotData` contains the validated Roboflow JSON. To create a preset without a parking-slot file, send `parkingSlotData` as JSON in the request body and omit `parking_slot_file`/`parkingSlotFileId`. The API validates that `categories` includes at least one named category with `supercategory: "parking-slot"`. Statuses are `Online`, `Offline`, `Disable`, and `Unknown`. New presets start as `Unknown`; only `Disable` and `Unknown` are accepted by the manual status endpoint. The original CCTV filename is selected from shared sources with `fileType: "cctv"`. Do not send camera secrets to an endpoint that does not need them.

Floor timestamps are refreshed on floor edits, map changes, camera preset changes/status updates, and floor slot-file imports. Map slot statuses remain lowercase (`available`, `incoming`, `occupied`, `disabled`) and are separate from title-case floor and camera preset statuses.

The parking map has `slots` (maximum 5,000) and `layout` (maximum 300 shapes), with bounded geometry, allowed statuses, and optional embedded PNG/JPEG/WebP data URL background. A map slot may include `cameraPresetId` to associate it with a CCTV preset on the same floor. `parkingSlotName` is optional; when provided it must be a `parking-slot` category belonging to that preset. A parking slot name without a CCTV preset is invalid. The frontend hides names already assigned to another map slot for the same preset; the backend validates preset/category membership but does not enforce map-wide uniqueness of assignments. Follow `parking-front/src/components/parking/parkingMapJson.ts` and `parkingLayout.ts` for frontend types/serialization; backend validation is in `api/utils/parkingMap.js`.

There are no camera-preset delete, source-file delete, or slot-file delete routes in the current route modules. Do not call or assume these operations exist.

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

The current frontend `api.ts` also has helpers for paths such as `/staff/dashboard`, `/staff/parking/...`, `/staff/cctv/...`, `/staff/history`, `/staff/profile`, `/parking-zones`, and `/parking-logs`. The current `parking-back/server.js` does not mount route modules for these paths. Treat them as unimplemented/unverified in this backend, not as working APIs. Before wiring a new screen to one, confirm the intended backend endpoint with the project owner or add and test the backend route.

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
