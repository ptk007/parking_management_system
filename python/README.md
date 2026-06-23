# CCTV RTSP Viewer

This folder contains a small Windows Python viewer for the RTSP links in:

`..\parking-backend\src\oldcctvinfo4.json`

and:

`..\parking-backend\src\cctvinfo2.json`

It can also read `oldcctv4.json` or `oldcctvinfo4.json` if you place either file directly in this `python` folder.

## Install

Open PowerShell or Command Prompt:

```bat
cd C:\Users\patta\Documents\GitHub\parking_management_system\python
install.bat
```

## List Cameras

```bat
run.bat --list
```

Use `cctvinfo2.json` instead:

```bat
run.bat --source cctvinfo2 --list
```

Search by name or IP:

```bat
run.bat --search AD1
run.bat --search 172.28.109.31
run.bat --source cctvinfo2 --search Guardhouse
```

## Watch One Camera

Use the camera `NO` from the JSON:

```bat
run.bat --camera 1
```

Use `cctvinfo2.json`:

```bat
run.bat --source cctvinfo2 --camera 1
```

Or use a camera name/IP:

```bat
run.bat --camera AD1-FL1-East
run.bat --camera 172.28.109.31
```

Press `q` or `Esc` to close the video window.

## Notes

- You must be on the same network or VPN that can reach the CCTV IP addresses.
- If a stream does not open, test the RTSP URL in VLC first.
- The JSON field used for RTSP is `ANPR&PTZ RTSP`.
- Cameras with an empty RTSP field are skipped in the list because there is no stream URL to open.
