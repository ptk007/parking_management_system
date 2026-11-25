# Backend API System

The Express backend owns account and parking data, camera configuration, and the model integration. It validates browser requests, binds model events to saved slots, and reads and writes MongoDB through Mongoose.

## Entry point and access

- [server.js](../../parking-back/server.js) mounts the API under `/api`, serves uploads under `/images`, initializes database indexes and migrations, and starts the Windows Python supervisor after the API is listening.
- Browser routes use `Authorization: Bearer <JWT>` where marked. Login verifies a bcrypt password, rejects disabled accounts, and issues a JWT. Protected routes recheck account status, and management actions enforce the current database role.
- Runtime routes use the `x-model-api-key` header. For local startup the backend generates and reuses `parking-back/.model-api-key` and `parking-back/.jwt-secret` when their environment values are absent. A configured key takes precedence. Production needs an explicit JWT secret and an explicit model key if model sync is used.
- `PORT` defaults to `3000`. `MONGODB_URI` defaults to `mongodb://127.0.0.1:27017/parking_management_system`.
- The examples below show paths relative to `/api`, except the root health check `GET /`.

## Account, staff, vehicle, and support routes

| Method and path | Access | Request and behavior |
| --- | --- | --- |
| `POST /auth/register` | Public | Accepts `accountType` (`public` or `student`), `name`, `username`, and `password`. A student is saved with role `user`. |
| `POST /auth/login` | Public | Accepts `username` and `password`. Returns the user and bearer token, and marks the account online. |
| `GET /auth/verify`, `POST /auth/logout` | JWT | Reads the current account or marks it offline. |
| `GET /users`, `GET /users/:id`, `GET /users/check-duplicate` | Admin JWT | Lists staff, gets a staff account, or checks username duplication. |
| `POST /users`, `PUT /users/:id` | Admin JWT | Creates or edits a staff account. Staff profiles must be disabled before editing. Supports multipart image field `user_image` and stores images under `images/user/`. |
| `PATCH /users/:id/status`, `DELETE /users/:id` | Admin JWT | Change a staff account's enablement or delete it under the controller's staff rules. |
| `GET /vehicles`, `GET /vehicles/:id`, `GET /vehicles/user/:userId`, `GET /vehicles/check-duplicate` | See implementation note | Reads vehicles or checks duplicate registration. |
| `POST /vehicles`, `PUT /vehicles/:id`, `DELETE /vehicles/:id` | See implementation note | Manages vehicle records. Creation uses `name` as an existing owner ID and enforces unique `license_num`. |
| `GET /support/tickets`, `GET /support/tickets/:id`, `POST /support/tickets` | JWT, support participant rules | Lists or opens tickets. Requesters see their own tickets. Staff see the support queue. |
| `POST /support/tickets/:id/claim` | Staff JWT | Claims an open ticket and marks it `in_progress`. |
| `POST /support/tickets/:id/messages` | JWT, ticket requester or assigned staff | Adds a message to an open conversation. |
| `PATCH /support/tickets/:id/status`, `POST /support/tickets/:id/read` | JWT, ticket access and action rules | Resolves or reopens the ticket, or records the viewer's last read position. Assigned staff can resolve it. |

**Vehicle API implementation note:** [vehicleRoutes.js](../../parking-back/api/routes/vehicleRoutes.js) currently mounts vehicle CRUD without a JWT/owner middleware. The controller validates owner and record IDs. Frontend ownership checks do not secure those routes. Account parking history is a separate JWT-protected endpoint. Treat server-side access control for vehicle CRUD as a deployment requirement.

## Buildings, floors, and dashboard

Building paths are under `/admin/system/buildings`. Floor paths are under `/admin/system/floors`.

| Method and relative path | Access | Behavior |
| --- | --- | --- |
| Buildings `GET /`, `GET /:id`, `GET /check-duplicate`, `GET /camera-summary` | Admin JWT | Queries buildings, duplicate names, and camera counts derived from floor presets. |
| Buildings `POST /`, `PATCH /:id`, `DELETE /:id` | Admin JWT | Manages buildings and building images. Deletion also removes their floors and eligible local files. |
| Floors `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` | Admin JWT | Manages a building/floor/vehicle-type combination. The floor document embeds the map and camera presets. |
| Floors `PUT /:id/map` | Admin JWT | Validates and saves the map. Layout edits are blocked while a floor is `Available`. |
| Floors `PATCH /:id/map/slot-assignment` | Admin JWT | Assignment API for saved slots. A category must belong to the selected preset and be unique on the map for that preset. The dashboard has no assignment UI. The editor saves its layout and assignments through the map save path. |
| Floors `GET /catalog` | JWT | Returns dashboard maps. Admins and staff receive occupied vehicle details and limited preset summaries. The catalog strips camera connection credentials. |
| Floors `GET /catalog/cameras` | JWT | Reads saved presets for query `buildingName`, `floor`, and `veh_type` for dashboard CCTV playback. This serializer spreads stored preset fields. Review its response fields and access rules before wider deployment. |
| Floors `PATCH /catalog/:id/slot-statuses` | Admin/staff JWT | Accepts `{ keys, status }`. Each key encodes `[zone, number]`. Sets `available` or `disabled` only on eligible empty slots. Returns `{ map, changedSlots }` and writes actual changes to Slot Status Log. |
| Floors `GET /slot-status-logs?roles=staff,admin` | Admin/staff JWT | Reads audit entries newest first. Accepts one or both operator roles. |
| Floors `PATCH /catalog/:id/slot-vehicle-details` | Admin/staff JWT | Accepts `{ key, license_num, province }` for a single occupied slot. Updates the map and applicable active log. |
| Floors `POST /catalog/:id/reset-slot-statuses` | Admin/staff JWT | Resets all slots to `available` when the floor has presets and they are all disabled. Audits eligible empty slot changes. |
| Floors `POST /catalog/:id/update-slot-statuses` | Admin/staff JWT | Queues a fresh evaluation by using enabled Detection presets with assignments. |

Older `parking_slot_files` metadata moves to `parking_source_files` during startup migration, retaining IDs and paths before removal of the embedded array. The optional legacy singular `parking_slot_file` remains distinct from the saved map.

## CCTV and shared source library

All paths below are relative to `/admin/system/floors`.

| Method and relative path | Access | Behavior |
| --- | --- | --- |
| `GET /source-files`, `POST /source-files`, `GET /source-files/:fileId` | Admin JWT | Lists shared source metadata, imports original JSON, or downloads the original file. Entries can be classified as `cctv` or `parking-slot` and report file availability. |
| `POST /source-files/:fileId/cameras/search` | Admin JWT | Finds an exact source match by supported camera fields. An ambiguous result requires choosing a record. |
| `POST /source-files/:fileId/cameras/:recordIndex/probe` or `/preview` | Admin JWT | Checks or streams the selected stored source. These paths use a backend camera lookup. |
| `POST /:id/cameras`, `PATCH /:id/cameras/:cameraId`, `DELETE /:id/cameras/:cameraId` | Admin JWT | Creates, edits, or deletes a CCTV preset. Parking annotation JSON may be embedded or supplied through a shared file reference. A preset without usable annotation data can show the original stream and keeps Detection off. |
| `PATCH /:id/cameras/:cameraId/status`, `PATCH /:id/cameras/:cameraId/model` | Admin JWT | Changes preset status or requested Detection state independently. |
| `GET /:id/cameras/:cameraId/parking-slot-categories` | Admin JWT | Lists category names assigned under the `parking-slot` supercategory. |
| `GET /:id/cameras/:cameraId/model-preview`, `GET /catalog/:floorId/cameras/:cameraId/model-preview` | Admin JWT for setup; JWT for catalog | Supplies the latest worker JPEG when Detection and the worker are ready. |
| `POST /catalog/:floorId/cameras/:cameraId/preview` | JWT | Opens the saved original camera stream for dashboard preview. |

A new enabled preset with an online source and usable annotations can start with Detection enabled. Disabling the preset suspends the worker while retaining the Detection preference. Re-enabling the preset can resume the worker. Editing the camera or slot-file identity can turn Detection off and disconnect removed assignments.

## Parking logs and model runtime

| Method and path | Access | Behavior |
| --- | --- | --- |
| `GET /parking-logs` | Admin/staff JWT | Lists parking logs filtered by building, floor, and vehicle type if supplied. The dashboard list includes all active sessions and recent Exited or Not parking records within the configured 24-hour window. |
| `GET /parking-logs/me` | JWT | Lists only the caller's owner-linked history. |
| `GET /parking-logs/export`, `POST /parking-logs/export-sample` | Admin/staff JWT | Exports real rows for one location or submitted sample rows to Excel. Uses sequential `No` in place of database IDs. Stores a copy under `logs/`. |
| `POST /parking-logs/model-slot-status` | Model key | Accepts camera identity, `parkingSlotName`, `slotStatus` (`incoming`, `occupied`, `available`), optional `licensePlateDetected`, and optional `occurredAt`. |
| `POST /parking-logs/model-events` | Model key | Accepts camera identity, `event` (`Parking`, `Exited`, `Not parking`), `license_plate`, optional `province`, applicable `parkingSlotName`, and optional `occurredAt`. |
| `GET /model-runtime/profiles`, `POST /model-runtime/sync` | Model key | Shares preset inventory, records worker heartbeat and status, and returns desired worker commands, mapped or disabled categories, and eligible manual vehicle corrections. |

Camera identity is either the pair `floorId` and `cameraPresetId` or the pair `cameraNo` and `cctvFileName`. Slot updates resolve the category to exactly one saved map slot. A protected runtime request without the correct key is rejected.

### Session rules

- An `incoming` slot report updates the map without opening a parking session.
- An occupied assigned slot without a stable plate starts one Guest session with `Unknown` for both plate and province. A known plate can open an identified session. A late plate read can fill the existing unknown log without changing its ID or original entry time.
- A match against registered vehicles uses the plate and vehicle type and uses province when supplied. The backend can infer a missing province from the registered record. Matching sessions are linked by `parking_log.owner`. Unmatched sessions remain Guests.
- An available report closes the active session and clears current map details. Parking logs also support a plate-based exit event.
- Admin or staff can correct the active log from an occupied slot. The correction can change its owner link and takes precedence over later OCR for that session.
- Map-disabled slots preserve the disabled display state. A camera can still observe a vehicle and write a session for that slot.

## Database and evidence

The nine collections and embedded records are defined in [api/models/](../../parking-back/api/models/). [Docs.md](../docs/Docs.md) gives the full dictionary and logical ER diagram. See [the floor routes](../../parking-back/api/routes/parkingFloorRoutes.js), [the log controller](../../parking-back/api/controllers/parkingLogController.js), and [the runtime controller](../../parking-back/api/controllers/modelRuntimeController.js) for exact payload validation.
