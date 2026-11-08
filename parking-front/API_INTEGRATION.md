# Frontend API Integration

This guide documents current frontend/backend integration points. The running
backend implementation is authoritative; older mockups or proposed `/staff/*`
paths are not supported unless mounted in `parking-back/server.js`.

## API client and authentication

- API services live in `src/services/api.ts`.
- The shared Axios client uses `VITE_API_BASE_URL`, defaulting to
  `http://localhost:3000/api`.
- The client attaches the bearer token stored as `localStorage.token`.
- Use `floorService`, `parkingLogService`, and other existing service objects
  instead of adding independent URLs or exposing credentials in browser code.
- The backend route/role/request reference is
  [`parking-back/md_file/skill.md`](../parking-back/md_file/skill.md).

## CCTV preset and YOLO preview

The admin CCTV setup card has two distinct preview modes:

1. **YOLO enabled:** `Show YOLO preview` polls the authenticated model-frame
   endpoint and displays the annotated frame produced by the Python worker.
   The frame may include car detections/tracks, detected plate boxes and
   confidence, OCR labels, and parking-slot overlays.
2. **YOLO disabled:** `Show live preview` opens the on-demand raw CCTV stream.
   That stream can draw parking-slot JSON bounding boxes, but it does not run
   either YOLO model or EasyOCR.

CCTV connection status and YOLO worker status are separate. CCTV `Online`
indicates a successful camera connection check; YOLO `Online` comes from a
recent Python runtime heartbeat. The frontend displays an enabled worker as
`Offline` when the heartbeat is missing or older than 20 seconds.

### Preset controls

| Method and path | Use |
|---|---|
| `PATCH /admin/system/floors/:floorId/cameras/:cameraId/model` | Admin request body `{ enabled: boolean }`; persists the desired YOLO state and returns `{ success, floor }`. ON requires a non-disabled preset, unique camera/source identity, parking-slot categories, and map assignments. |
| `GET /admin/system/floors/:floorId/cameras/:cameraId/model-preview` | Admin-only. Returns the latest worker-produced annotated JPEG. Returns `503` while the worker heartbeat/frame is not ready, and `409` if the model is disabled. |

`floorService.setCameraModelEnabled` and `floorService.getCameraModelFrame` in
`src/services/api.ts` implement these calls. The camera card polls the frame at
about 5 FPS while its YOLO preview is active and stops polling when the preview
is stopped, the floor changes, or the component unmounts.

### Runtime prerequisites

- The backend must be running and connected to MongoDB.
- `PARKING_MODEL_RUNTIME_URL` must point to the backend
  `/api/model-runtime/sync` endpoint.
- `PARKING_MODEL_API_KEY` must be configured for both backend and Python
  supervisor. The value is private and must never be placed in frontend
  environment variables or committed.
- The camera must have a matching confirmed profile in Python's
  `cctv/parking-cam/active.json`. Camera number and CCTV source filename must
  match the preset.
- Python must be able to open the RTSP camera and load the configured car and
  license-plate models. Parking-enabled profiles must also satisfy the mapped
  parking-category requirements.

Python publishes annotated frames under `python-v2/results/runtime_frames/`
only when remote runtime control is configured. The backend reads these
worker-created files and serves them through the authenticated model-preview
route; the browser never supplies an RTSP URL to that endpoint.

## Other verified API areas

- Authentication: `/api/auth`.
- User and vehicle CRUD: `/api/users` and `/api/vehicles` (check current route
  middleware before assuming authorization).
- Admin buildings and floors: `/api/admin/system/buildings` and
  `/api/admin/system/floors`.
- Support tickets: `/api/support/tickets`.
- Parking logs: `/api/parking-logs`; model event ingestion is authenticated
  separately with the private `x-model-api-key`.
- Python runtime commands/status: `/api/model-runtime/sync`, authenticated
  with the same private model API key.

The current backend does not mount legacy draft paths such as
`/api/staff/dashboard`, `/api/staff/parking/*`, `/api/staff/cctv/*`,
`/api/staff/history`, or `/api/staff/profile`. Do not add frontend calls to
those paths without first implementing their backend routes.

## Validation

For frontend integration changes, run from `parking-front`:

```powershell
npm run build
npx vitest run src/__tests__/cctvPreset.spec.ts
```

For backend endpoint changes, also run `npm test` from `parking-back`. For
Python worker/runtime changes, run the focused Python unit tests and compile
the changed runtime modules.
