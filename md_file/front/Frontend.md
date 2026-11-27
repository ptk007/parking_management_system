# Frontend System

The Vue frontend provides a role-based parking dashboard, vehicle history, staff management, parking configuration, and support chat. It reads and changes operational data through the backend API.

## Source layout

| Source | Responsibility |
| --- | --- |
| [src/router/index.ts](../../parking-front/src/router/index.ts) | Routes, authentication redirects, and role guards |
| [src/stores/auth.ts](../../parking-front/src/stores/auth.ts) | Login and guest state, stored session, and role checks |
| [src/services/api.ts](../../parking-front/src/services/api.ts) | Axios base URL, token attachment, and API service functions |
| [src/views/staff/DashboardView.vue](../../parking-front/src/views/staff/DashboardView.vue) | Shared live dashboard for parking, CCTV, and log tabs |
| [src/components/parking/DashboardMap.vue](../../parking-front/src/components/parking/DashboardMap.vue) | Location selection, map/stats, and dashboard Slot Details |
| [src/components/parking/ParkingLayoutEditor.vue](../../parking-front/src/components/parking/ParkingLayoutEditor.vue) | SVG slot rendering, selection, and layout interaction |
| [src/components/parking/ParkingSlotDetails.vue](../../parking-front/src/components/parking/ParkingSlotDetails.vue) | Shared slot preview, status actions, and occupied vehicle form |
| [src/views/admin/ParkingMapView.vue](../../parking-front/src/views/admin/ParkingMapView.vue) | Parking Map Editor, import/export, layout save, CCTV assignments |
| [src/views/admin/DashboardView.vue](../../parking-front/src/views/admin/DashboardView.vue) | Admin shell for the shared dashboard, Staff Manager, and Parking Setup |
| [src/views/staff/HistoryView.vue](../../parking-front/src/views/staff/HistoryView.vue) | Slot Status Log with Staff and Admin filters |
| [src/views/user/MyVehicleView.vue](../../parking-front/src/views/user/MyVehicleView.vue) | Registered vehicles and account parking history |
| [src/components/chat/ChatWidget.vue](../../parking-front/src/components/chat/ChatWidget.vue) | Requester and staff support ticket interface |

## Roles and routes

| Role | Important screens and actions |
| --- | --- |
| Guest User | Uses a local sample dashboard session from `/login`. Loading live authenticated data requires a valid backend JWT. A guest web session is separate from a Guest parking log. |
| Public User, Student | Register or log in from `/login`. Public accounts use database role `public`. Student accounts use `user`. Access the parking map at `/dashboard`, My Vehicles and personal history at `/my-vehicle`, and requester support as an authenticated account. |
| Staff | Uses `/dashboard` for the map, CCTV, parking logs and export. Opens `/history` for Slot Status Log. Claims and answers support tickets. |
| Admin | Signs in using the Staff/Admin option and opens `/admin/dashboard`. Uses `/admin/staff`, `/admin/setup`, `/admin/history`, and `/admin/setup/floors/:floorId/parking-map`. Admin permissions control setup and the Parking Map Editor. |

The router checks the client session before opening a page. The API is responsible for server-side authorization. Route names and service stubs outside the mounted API should be verified against [Backend.md](../back/Backend.md).

## Dashboard parking map

1. Choose **Building → Floor → Vehicle**. Changing an earlier choice clears the later choices. The same location is passed to the CCTV and parking-log tabs.
2. The map uses the floor's saved layout and slot states. It refreshes the catalog every five seconds while the page is visible. Sample maps are separate from real floors and cannot be changed through management actions.
3. Admin and staff can select slots, including a group with Shift-click. Both roles see **Enable** and **Disable** only inside **Slot Details**. Only eligible empty slots change. `occupied` and `incoming` are controlled by the camera. The server writes actual changes to Slot Status Log.
4. A single occupied slot displays the plate and province, with `Unknown` for missing details. Both roles can save a corrected plate and province. The backend updates the active parking log if one exists, matches registered owners when possible, and synchronizes the correction to the camera worker.
5. **Select CCTV** and **Select Parking Slot** appear only in Parking Map Editor layout mode for admins. Dashboard Slot Details can show connection state to managers and has no assignment controls.
6. **Update slot status** requests a fresh model evaluation when an eligible preset has mapped slots. **Reset parking slot status** requires all floor presets to be disabled and asks for confirmation before restoring availability.

## Parking Map Editor

The editor provides a preview and a layout mode. The floor must be `Disable` for layout edits. Admins can add, position, and name slots, edit drawing elements, import or export map JSON, and save the layout manually or through autosave. To link a map slot, choose a CCTV preset and an annotation category in Slot Details. Category options already assigned to another slot are excluded. A saved slot uses the audited status endpoint for manual enable or disable actions.

Map identity is the pair `[zone, number]`. A slot can have an optional display name and assignment fields `cameraPresetId` and `parkingSlotName`. The dashboard renders the saved positions through the same map component.

## CCTV, logs, and management

| Area | User workflow |
| --- | --- |
| Parking Setup | Manage buildings and floors, check camera counts, and open the editor or CCTV setup. Camera counts come from each floor's embedded presets. |
| CCTV setup | Manage original CCTV source files in the shared library. Create/edit/delete a preset, preview the original stream, and manage the independent CCTV and Detection switches. The YOLO preview displays the worker's annotated frames when available. |
| Dashboard CCTV | Choose a location, then open a saved CCTV card and request its live view. Source status is displayed independently from Detection. |
| Parking logs | Show Parking, Exited, and Not parking records for the chosen location. Use **View sample logs** to try example data and **Export log** to download an Excel workbook. Export reports when a location has no eligible records. The unresolved-plate count comes from occupied map slots whose `licensePlateDetected` is `false`. |
| Staff Manager | Admin creates staff accounts, changes their status, and edits profiles when the staff account is disabled. The form can upload a profile image. |
| My Vehicles | Owner registers/edits a vehicle and sees account parking history. History is read from `GET /parking-logs/me` under the user's JWT. |
| Slot Status Log | Lists manual status changes newest first. Staff and Admin role filters can be selected together. |
| Support chat | Public and student accounts can open and follow their own tickets. Staff can claim and reply. The UI displays status and unread feedback from the support API. |

## Frontend configuration

Use `npm run dev` in `parking-front/`. Set `VITE_API_BASE_URL` if the API is hosted away from `http://localhost:3000/api`. Browser Axios requests attach the stored JWT for authenticated API calls. Streaming requests use the corresponding authenticated fetch path.

See [Overhaul.md](../Overhaul.md) for system scope and [Docs.md](../docs/Docs.md) for the user diagram.
