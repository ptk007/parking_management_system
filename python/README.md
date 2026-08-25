# CCTV RTSP Viewer

This folder contains a small Windows Python viewer for the RTSP links in:

`..\parking-backend\src\oldcctvinfo4.json`

and:

`..\parking-backend\src\cctvinfo2.json`

It can also read `oldcctv4.json` or `oldcctvinfo4.json` if you place either file directly in this `python` folder.

The viewer supports Python 3.8 and newer. The installer selects a compatible
OpenCV package for the installed Python version.

## Install

Open PowerShell or Command Prompt:

```bat
cd C:\Users\patta\Documents\GitHub\parking_management_system\python
install.bat
```

## List Cameras

Older CCTV file:

```bat
run.bat --source old --list
```

Newer CCTV file:

```bat
run.bat --source new --list
```

Both files:

```bat
run.bat --source all --list
```

Automatically use the first available CCTV file:

```bat
run.bat --source auto --list
```

Search by name or IP:

```bat
run.bat --search AD1
run.bat --search 172.28.109.31
run.bat --source new --search Guardhouse
run.bat --source all --search ANPR
```

## Watch One Camera

Use the camera `NO` from the JSON:

```bat
run.bat --camera 1
```

Use the newer `cctvinfo2.json`:

```bat
run.bat --source new --camera 1
```

Use the older `oldcctvinfo4.json`:

```bat
run.bat --source old --camera 344
```

Or use a camera name/IP:

```bat
run.bat --camera AD1-FL1-East
run.bat --camera 172.28.109.31
```

Press `q` or `Esc` to close the video window.

## Realtime Parking Monitor

The parking monitor reads the selected CCTV RTSP stream, uses the YOLO models
from `..\yolo_models`, and uses the Zone A parking annotations by default.

```bat
run_parking.bat --camera 1 --parking on
```

Disable parking-slot detection while keeping car and plate recognition:

```bat
run_parking.bat --camera 1 --parking off
```

Useful options:

```bat
run_parking.bat --camera Guardhouse-ANPR-01 --parking on
run_parking.bat --video "rtsp://user:password@camera/stream" --parking off
python parkng_model.py --help
```

Press `q` or `Esc` in the `Parking CCTV` window to stop the realtime monitor.

## Notes

- You must be on the same network or VPN that can reach the CCTV IP addresses.
- If a stream does not open, test the RTSP URL in VLC first.
- The JSON field used for RTSP is `ANPR&PTZ RTSP`.
- Cameras with an empty RTSP field are skipped in the list because there is no stream URL to open.
- Newer JSON files may use aliases such as `rtspUrl`, `streamUrl`, `cameraName`, or `ipAddress`.
- With `--source all`, duplicate camera numbers must be selected by camera name or IP address.
