# Parking CCTV Runtime v2

Production-oriented Windows runtime for:

- CCTV RTSP input
- YOLO car detection
- BoT-SORT + ReID tracking
- YOLO license-plate detection
- EasyOCR Thai plate reading
- Parking-slot state tracking
- Persistent parking history

## Project layout

```text
parking_runtime_v2/
├─ run.bat                    # starts backend-configured CCTV presets
├─ run_multi_camera.bat       # direct runner for confirmed active CCTV(s)
├─ install.bat
├─ launcher.py
├─ parkng_model.py            # one isolated camera worker
├─ multi_camera.py            # supervisor for one or many workers
├─ parking_model_events.py    # asynchronous backend parking-event publisher
├─ parking_profiles.py        # create/edit/select/confirm CCTV profiles
├─ cctv_viewer.py             # CCTV JSON + low-latency RTSP reader
├─ parking_config.py
├─ parking_export.py
├─ project_paths.py           # central path definitions
├─ check_gpu.py
├─ requirements.txt
│
├─ models/
│  ├─ trained_car_detector.pt
│  └─ best_license_plate_detector.pt
│
├─ tracker/
│  └─ parking_botsort_reid.yaml
│
├─ cctv/
│  ├─ sources/
│  │  ├─ oldcctvinfo4.json
│  │  └─ cctvinfo2.json
│  └─ parking-cam/
│     ├─ active.json          # confirmed CCTV selection
│     ├─ selection.json       # temporary selection before confirmation
│     └─ <profile>.json       # saved CCTV profiles
│
├─ parking_slots/
│  └─ <zone>.json
│
├─ results/
└─ logs/
```

Everything is kept under one project root. Move the whole folder together; do
not depend on `..\yolo_models`, `..\json_file`, or another repository folder.

## First install

1. Copy the two trained `.pt` files into `models/`.
2. Configure CCTV presets in the frontend admin setup, including their RTSP source and parking-slot JSON.
3. Set `PARKING_MODEL_API_KEY` in `parking-back/.env` to the same private key as the backend.
4. Run:

```bat
install.bat
```

The installer is GPU-first. It will not silently install/run CPU PyTorch for the
realtime parking application. The default PyTorch wheel index is CUDA 12.6 and
can be overridden with `PARKING_TORCH_INDEX_URL` before running `install.bat`.

## Normal startup sequence

On Windows, starting the backend API automatically launches `run.bat` after the
API is listening. The supervisor stays open in standby even when there are no
CCTV presets, and refreshes the preset list every two seconds. Create a CCTV
preset, then use **Enable Detection** as needed; the supervisor starts the
worker when the backend reports the preset is enabled and its source and
parking-slot annotation data are valid. Parking-map assignment is optional.
Without assignments, the preview still works but the model does not update the
map or create parking logs/history.

To start the supervisor manually for debugging, run:

```bat
run.bat
```

`run.bat` starts the backend-driven supervisor directly. It fetches CCTV presets
and their stream and parking-slot data from the backend; no local profile
selection or confirmation is needed. When all detections are OFF, camera workers
stop and the supervisor remains in standby for a later ON command or new preset.
The backend stops the supervisor when the backend process shuts down.

### Backend-controlled YOLO and parking-log sync

The Python supervisor can accept per-camera YOLO ON/OFF commands from the
backend, and workers can send stable plate detections and parking/exit
transitions. Set these environment variables in the same Windows environment
that starts `run.bat` (child camera workers inherit them):

`run.bat` now defaults both API URLs to the backend at `http://localhost:3000`
(or the `PORT` in `parking-back/.env`) and reads `PARKING_MODEL_API_KEY` from
that private backend `.env` when it is not already set in the environment.
You can override the URLs or key in the command environment before starting.
Keep the key private; do not commit it or place it in frontend configuration.
If the key is missing, backend preset startup stops with a clear notice.

The backend preset inventory is the camera source of truth. The backend ON
command is remembered in MongoDB, so the supervisor starts enabled cameras
after `run.bat` starts again. An ON request is rejected if the preset is
disabled, lacks parking-slot categories/map assignments, or has an ambiguous
camera identity. If a preset has no RTSP source or usable parking-slot JSON,
the runtime reports it and does not start that worker.

When `PARKING_MODEL_RUNTIME_URL` is configured, `multi_camera.py` waits for
backend commands and starts/stops each worker independently. Backend preset
mode requires this URL and the private API key. The supervisor checks for state
changes about twice per second.
`PARKING_MODEL_EVENTS_URL` enables database event updates; `run.bat` configures
both URLs by default so YOLO control and parking map/history updates share the
backend contract. The runtime fetches each preset's `cameraNo`, `cctvFileName`,
RTSP source, and full parking-slot COCO JSON directly from the backend. The model
loads all annotated slots in that file; only parking and exit events for categories
assigned to the backend parking map are sent to the log API. Model slot-state transitions
also update map status without writing history: model `occupied` (car entering) becomes
map `incoming`, model `parking` (settled) becomes map `occupied`, and model `available`
becomes map `available`. Existing `Parking` and `Exited` events continue to create and
close history records. Events are queued and retried outside the frame-processing thread;
API/configuration failures are printed to
the worker or supervisor console. Worker status is written under that camera's
results directory and reported to the backend on each supervisor heartbeat.
When remote control is enabled, `multi_camera.py` gives each worker a
`PARKING_RUNTIME_FRAME_FILE` path under `results/runtime_frames/`; the filename
is derived from the normalized camera number and CCTV source filename. The
worker publishes its rendered frame atomically at no more than 5 FPS, bounded
by the existing 1280×720 display size. The supervisor removes the frame when
that worker stops or restarts, so a stopped camera does not keep showing an old
frame. The backend serves the latest frame to the authenticated admin CCTV
preset preview; it includes car boxes/tracks, detected license-plate
boxes/confidence, OCR labels, and parking-slot overlays. The browser preview
displays actual worker output; the separate raw RTSP preview is used when YOLO
is off. Frame publishing is enabled in backend preset mode, which is the
`run.bat` startup mode.

The interactive local profile menu remains available through
`parking_profiles.py` for standalone local runs. `run.bat` does not use that
menu; it reads configured presets from the backend.

### One camera and many cameras use the same runtime

There is no separate single-camera runtime anymore.

- One backend preset with YOLO ON -> `multi_camera.py` starts one worker.
- Multiple backend presets with YOLO ON -> `multi_camera.py` starts one
  isolated worker per camera.

For direct service/runtime start without opening the setup menu:

```bat
run_multi_camera.bat
```

With no arguments it runs `--active` automatically.

## Profile lifecycle

Creating a profile stores:

- profile name
- CCTV JSON file
- camera NO/name/IP selection
- resolved camera name/IP for display
- parking-slot JSON file
- optional selected parking slots

Option 3 stages one or more saved profiles into `selection.json`. Option 4 is the
explicit confirmation step that writes the confirmed ordered selection into
`active.json`.

## Result files

The old `parking_result_<timestamp>...` pattern is removed.

Each active camera/profile gets one stable result directory such as:

```text
results/E4-East__camera_12/
├─ latest.json
├─ cars_latest.csv
├─ slots_latest.csv
├─ parking_history.csv
└─ runtime_status.json
```

Behavior:

- `latest.json` is overwritten with the latest snapshot.
- `cars_latest.csv` is overwritten with current car state.
- `slots_latest.csv` is overwritten with current parking-slot state.
- `parking_history.csv` keeps the same filename and appends only new completed
  parking visits. Existing visits are deduplicated.
- Parking history includes event date/time plus `recorded_at_utc`,
  `recorded_at_local`, `recorded_date`, and `recorded_time`.
- Runtime data is persisted periodically (default every 15 seconds) and
  immediately after parking start/exit state changes, then once more at clean
  shutdown.

This avoids creating a new result file set every program run and reduces data
loss if a worker terminates unexpectedly.

## GPU behavior

`run.bat` and `run_multi_camera.bat` call `check_gpu.py` before starting.
If CUDA is unavailable, the CCTV workers do not start. This prevents the old
behavior where a broken/CPU-only PyTorch environment silently fell back to CPU
and produced severe realtime lag.

## Tracker configuration

`tracker/parking_botsort_reid.yaml` is now a real configuration file and is not
overwritten by `parkng_model.py` on every startup. Tune it deliberately and keep
it under version control.

## Low-latency CCTV input

`cctv_viewer.LatestFrameCapture` continuously drains RTSP in a background
thread and exposes the latest frame only, avoiding multi-second stale-frame
backlogs. The main worker no longer creates a second competing RTSP reconnect
loop.

## Files intentionally removed from the clean runtime

The clean package does not include:

- `.venv/` — recreate it per machine with `install.bat`.
- `__pycache__/` — generated automatically.
- `run_parking.bat` — redundant; single and multi CCTV now use the same
  `multi_camera.py` path.
- `parking_profiles.bat` — optional local profile setup for standalone runs.
- Timestamped result files — replaced by persistent stable files.

`cctv_viewer.py` is kept because it is both a useful diagnostic tool and the
shared camera/RTSP layer used by the actual parking workers.
