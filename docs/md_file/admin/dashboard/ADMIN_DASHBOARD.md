# MFU Parking Management - Admin Dashboard

## Overview
The Admin Dashboard is the central control panel for system administrators. Built with **Vue.js** (frontend), **Node.js / Express** (backend), and **MongoDB** (database), it provides monitoring, management, and configuration tools across the parking system.

## Table of Contents
- [Features](#features)
- [System Architecture](#system-architecture)
- [Frontend Components](#frontend-components)
- [Backend API Endpoints](#backend-api-endpoints)
- [Database Schema](#database-schema)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Security & Best Practices](#security--best-practices)

---

## Features
- Global statistics: total slots, available, incoming, occupied, disabled, active staff
- Parking slots management (enable/disable, edit slots)
- Staff management (create, update, deactivate staff accounts)
- System setup (manage buildings, floors, parking zones, maps)
- CCTV management (add/edit cameras, check status)
- Audit logs and history (slot changes, staff actions)
- Exportable reports and CSV downloads
- Role-based access control with admin-only sections

---

## System Architecture

High-level architecture:
```
User (Admin) -> Vue.js Admin Dashboard
               -> API requests (/api/admin/*)
               -> Node.js / Express backend
               -> MongoDB collections (users, parking_slots, parking_logs, cctv_cameras, parking_zones, slot_history)
```
Include the flow diagram from the system design for operational flows.

---

## Frontend Components

### Project structure (suggested)
```
parking-front/src/
├── components/
│   └── admin/
│       ├── AdminDashboardView.vue
│       ├── SlotManager.vue
│       ├── StaffManager.vue
│       ├── SystemSetup.vue
│       ├── CCTVManager.vue
│       └── ReportsPanel.vue
├── views/
│   └── admin/
│       └── DashboardView.vue
├── stores/
│   └── admin.ts
├── services/
│   └── adminApi.ts
└── types/
    └── admin.d.ts
```

### `AdminDashboardView.vue`
Main admin page showing header, filters and statistics cards and panels.
- Header: app title, admin name, online status
- Filters: Building, Floor, Vehicle Type
- Stats: Total slots, Available, Incoming, Occupied, Disable, Active Staff
- Panels: Slot map, Staff Manager, CCTV Manager, System Setup, Logs

### `SlotManager.vue`
- Visual map of parking slots
- Select slots and bulk actions: Enable / Disable / Maintenance
- Edit slot metadata: `slot_num`, `veh_type`, `zone`
- Real-time status refresh (WebSocket or polling)

### `StaffManager.vue`
- CRUD for staff accounts
- Role assignment (staff, admin)
- Status: online/offline/disabled
- Reset PIN, change password, deactivate account
- Activity audit links to `slot_history`

### `SystemSetup.vue`
- Configure buildings, floors and parking zones
- Upload or select parking map images
- Manage zone active/inactive state

### `CCTVManager.vue`
- List of cameras with status (online/offline)
- Edit camera metadata: name, IP, RTSP
- Quick preview (thumbnail) and test RTSP

### `ReportsPanel.vue`
- Export parking logs and staff activity
- Date range filters and CSV/JSON downloads

### Types (admin.d.ts)
```ts
export interface AdminStats {
  totalSlots: number;
  available: number;
  incoming: number;
  occupied: number;
  disabled: number;
  activeStaff: number;
}

export interface StaffUser { _id: number; username: string; name: string; role: 'staff'|'admin'; status: string; }
```

### Store (Pinia) - `stores/admin.ts` (snippet)
```ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { adminApi } from '@/services/adminApi';

export const useAdminStore = defineStore('admin', () => {
  const stats = ref<AdminStats | null>(null);
  const slots = ref([]);
  const staff = ref<StaffUser[]>([]);
  const loading = ref(false);

  async function fetchAdminData() {
    loading.value = true;
    const [s, sl, st] = await Promise.all([
      adminApi.getStats(),
      adminApi.getParkingSlots(),
      adminApi.getStaff()
    ]);
    stats.value = s;
    slots.value = sl;
    staff.value = st;
    loading.value = false;
  }

  return { stats, slots, staff, loading, fetchAdminData };
});
```

---

## Backend API Endpoints
Base path: `/api/admin`

### Statistics
- `GET /api/admin/stats` — return `AdminStats` for selected building/floor

### Parking Slots
- `GET /api/admin/parking-slots` — list slots (filters: building, floor, veh_type)
- `PATCH /api/admin/parking-slots/:id` — update slot metadata or status
- `PUT /api/admin/parking-slots/bulk` — bulk update slot statuses

### Staff Management
- `GET /api/admin/staff` — list staff accounts
- `POST /api/admin/staff` — create staff account (hash password server-side)
- `PATCH /api/admin/staff/:id` — update staff profile or status
- `DELETE /api/admin/staff/:id` — deactivate staff account

### System Setup
- `GET /api/admin/zones` — list parking zones
- `POST /api/admin/zones` — create or update zones
- `POST /api/admin/park-map` — upload parking map image

### CCTV Management
- `GET /api/admin/cctv` — list cameras
- `POST /api/admin/cctv` — add camera
- `PATCH /api/admin/cctv/:id` — update camera
- `POST /api/admin/cctv/:id/test` — test RTSP connectivity

### Logs & Reports
- `GET /api/admin/slot-history` — retrieve `slot_history` with filters
- `GET /api/admin/parking-logs/export` — export logs as CSV or JSON

---

## Database Schema
Focus on collections used by admin features (existing collections described here for clarity).

### `users` (existing)
- fields: `_id, username, password, pin_code, name, role, status, date_add, time_add`
- index: `username` unique

### `parking_slots`
- fields: `_id, slot_num, slot_status, building, floor, veh_type, zone`
- indexes: `{ building:1, floor:1, veh_type:1 }`, `{ slot_status:1 }`

### `slot_history`
- stores staff changes and audits
- fields: `_id, role, name, building, floor, slot_num, date_edit, time_edit, change_to`
- index: `{ date_edit:-1 }`, `{ building:1, floor:1 }`

### `cctv_cameras`
- fields: `_id, cctv_file, create_name, CAMERA_NAME_NEW, IP_Address, ANPR_PTZ_RTSP, status, date_add, time_add, building, floor, veh_type`
- index: `{ status:1 }`

### `parking_zones`
- fields: `_id, building, floor, veh_type, parking_status, park_map`

---

## Installation & Setup
Follow the general project setup in the root README. Admin features are part of the existing `parking-front` and `parking-backend` projects.

### Quick backend run
```bash
cd parking-backend
npm install
# ensure .env has MONGODB_URI and PORT
npm start
```

### Quick frontend run
```bash
cd parking-front
npm install
# ensure .env.local has VITE_API_URL
npm run dev
```

---

## Usage Guide
- Login as an admin user and navigate to Admin Dashboard
- Use filters to narrow building/floor/vehicle types
- Review stats and open panels to manage slots, staff, CCTV and zones
- Use `Reports` to export parking logs for a time range

---

## Security & Best Practices
- Protect admin routes with role-check middleware on the backend
- Use HTTPS and secure cookies or JWTs with proper expiry
- Validate all uploaded map images and RTSP inputs
- Log admin actions to `slot_history` for auditing
- Enforce strong password policies and rotate credentials

---

## Diagrams
- Embed or reference your system flow diagram here for admin operations. Example file path:
  - [docs/UI/cctv/flow_diagram.png](docs/UI/cctv/flow_diagram.png) (replace with your diagram path)

---

**Last Updated**: 2026-07-02

