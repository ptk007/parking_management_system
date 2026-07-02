# MFU Parking Management - Staff Dashboard

## Overview
The Staff Dashboard is a comprehensive web application built with **Vue.js (Frontend)**, **Node.js (Backend)**, and **MongoDB (Database)** that enables staff members to monitor and manage parking facilities in real-time.

## Table of Contents
1. [Features](#features)
2. [System Architecture](#system-architecture)
3. [Frontend Components](#frontend-components)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [Database Schema](#database-schema)
6. [Data Flow](#data-flow)
7. [Installation & Setup](#installation--setup)
8. [Usage Guide](#usage-guide)

---

## Features

### Dashboard Features
- **Real-time Parking Slot Monitoring**: Visual parking map with slot status indicators
- **Multi-tab Interface**: 
  - **Slots**: Parking slot availability and status
  - **CCTV**: Live camera feeds and monitoring
  - **Log**: Parking history and vehicle records
- **Building/Floor/Vehicle Filtering**: Dynamic filtering by building, floor, and vehicle type
- **Quick Statistics**: Total slots, available slots, incoming, occupied, and disabled counts
- **Parking History**: Detailed vehicle entry/exit logs with facial recognition images
- **Live CCTV Feeds**: Display of multiple camera feeds with status indicators

---

## System Architecture

### Tech Stack
```
Frontend:    Vue 3 + TypeScript + Tailwind CSS + Vite
Backend:     Node.js + Express.js
Database:    MongoDB
Real-time:   WebSocket (optional for live updates)
Testing:     Vitest + Playwright
```

### Architecture Diagram
```
┌─────────────────────┐
│   Vue.js Frontend   │
│  (Staff Dashboard)  │
└──────────┬──────────┘
           │ HTTP/REST API
           ↓
┌─────────────────────┐
│  Node.js Express    │
│   Backend Server    │
└──────────┬──────────┘
           │ Database Queries
           ↓
┌─────────────────────┐
│      MongoDB        │
│    Collections      │
└─────────────────────┘
```

---

## Frontend Components

### Project Structure
```
parking-front/src/
├── components/
│   └── staff/
│       └── dashboard/
│           ├── DashboardView.vue
│           ├── SlotPanel.vue
│           ├── CCTVPanel.vue
│           └── LogPanel.vue
├── views/
│   └── staff/
│       ├── DashboardView.vue
│       ├── HistoryView.vue
│       └── LoginView.vue
├── services/
│   └── api.ts
├── stores/
│   └── dashboard.ts
└── types/
    └── index.ts
```

### Main Components

#### 1. **DashboardView.vue** (Staff Dashboard)
The main dashboard component displaying parking information with tab interface.

**Features:**
- Tab navigation (Slots, CCTV, Log)
- Building/Floor/Vehicle type filters
- Real-time statistics display
- Responsive layout

**Template Structure:**
```vue
<template>
  <div class="dashboard-container">
    <!-- Header with Logo and Status -->
    <div class="header">
      <h1>MFU Parking Management</h1>
      <span class="online-status">●Online</span>
    </div>

    <!-- Filter Panel -->
    <div class="filters">
      <select v-model="selectedBuilding">Building</select>
      <select v-model="selectedFloor">Floor</select>
      <select v-model="selectedVehicle">Vehicle Type</select>
    </div>

    <!-- Statistics Cards -->
    <div class="stats">
      <StatCard label="Total slots" :value="totalSlots" />
      <StatCard label="Available" :value="availableSlots" />
      <StatCard label="Incoming" :value="incomingSlots" />
      <StatCard label="Occupied" :value="occupiedSlots" />
      <StatCard label="Disable" :value="disabledSlots" />
    </div>

    <!-- Tab Navigation -->
    <div class="tabs">
      <button @click="activeTab = 'slots'" :class="{ active: activeTab === 'slots' }">
        Slots
      </button>
      <button @click="activeTab = 'cctv'" :class="{ active: activeTab === 'cctv' }">
        CCTV
      </button>
      <button @click="activeTab = 'log'" :class="{ active: activeTab === 'log' }">
        Log
      </button>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <SlotPanel v-if="activeTab === 'slots'" :slots="parkingSlots" />
      <CCTVPanel v-if="activeTab === 'cctv'" :cameras="cctvCameras" />
      <LogPanel v-if="activeTab === 'log'" :logs="parkingLogs" />
    </div>
  </div>
</template>
```

#### 2. **SlotPanel.vue** (Parking Slots)
Displays parking slot map with visual indicators.

**Features:**
- Parking slot grid visualization
- Color-coded status indicators:
  - 🟢 Available (Green)
  - 🔴 Occupied (Red)
  - 🟡 Incoming (Yellow)
  - ⚫ Disabled (Gray)
- Enable/Disable slot functionality
- Slot selection tracking

#### 3. **CCTVPanel.vue** (Live Camera Feeds)
Shows multiple camera feeds with status.

**Features:**
- Multiple camera display grid
- Status indicator (Live/Offline)
- Camera details (Name, IP, Building, Floor)
- RTSP stream integration
- Responsive layout

#### 4. **LogPanel.vue** (Parking History)
Displays detailed parking logs with vehicle information.

**Features:**
- Sortable parking history
- Vehicle information display
- Facial recognition images (entry/exit)
- Parking duration tracking
- Status indicators (Parking, Exited, Not Parking)

### Type Definitions

```typescript
// types/index.ts

export interface ParkingSlot {
  _id: number;
  slot_num: string;
  slot_status: 'Available' | 'Occupied' | 'Incoming' | 'Disable';
  building: string;
  floor: string;
  veh_type: 'car' | 'motorcycle';
}

export interface ParkingLog {
  _id: number;
  building: string;
  floor: string;
  veh_type: 'car' | 'motorcycle';
  name: string;
  license_num: string;
  province: string;
  veh_des: string;
  park_date: string;
  exit_date: string | null;
  park_time: string;
  exit_time: string | null;
  park_slot: string;
  park_status: 'Parking' | 'Exited' | 'Not Parking';
  face_entrance: string;
  face_exit: string | null;
}

export interface CCTVCamera {
  _id: number;
  cctv_file: string;
  create_name: string;
  CAMERA_NAME_NEW: string;
  IP_Address: string;
  ANPR_PTZ_RTSP: string;
  status: 'online' | 'offline';
  date_add: string;
  time_add: string;
  building: string;
  floor: string;
  veh_type: 'car' | 'motorcycle';
}

export interface ParkingZone {
  _id: number;
  building: string;
  floor: string;
  veh_type: 'car' | 'motorcycle';
  date_add: string;
  time_add: string;
  parking_status: 'Active' | 'Inactive';
  park_map: string;
}
```

### Store (Pinia - dashboard.ts)

```typescript
// stores/dashboard.ts

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ParkingSlot, ParkingLog, CCTVCamera, ParkingZone } from '@/types';
import { dashboardApi } from '@/services/api';

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const parkingSlots = ref<ParkingSlot[]>([]);
  const parkingLogs = ref<ParkingLog[]>([]);
  const cctvCameras = ref<CCTVCamera[]>([]);
  const parkingZones = ref<ParkingZone[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Filters
  const selectedBuilding = ref('E4');
  const selectedFloor = ref('1');
  const selectedVehicle = ref('car');

  // Computed - Statistics
  const totalSlots = computed(() => parkingSlots.value.length);
  const availableSlots = computed(() => 
    parkingSlots.value.filter(s => s.slot_status === 'Available').length
  );
  const occupiedSlots = computed(() => 
    parkingSlots.value.filter(s => s.slot_status === 'Occupied').length
  );
  const incomingSlots = computed(() => 
    parkingSlots.value.filter(s => s.slot_status === 'Incoming').length
  );
  const disabledSlots = computed(() => 
    parkingSlots.value.filter(s => s.slot_status === 'Disable').length
  );

  // Computed - Filtered Data
  const filteredSlots = computed(() =>
    parkingSlots.value.filter(slot =>
      slot.building === selectedBuilding.value &&
      slot.floor === selectedFloor.value &&
      slot.veh_type === selectedVehicle.value
    )
  );

  const filteredLogs = computed(() =>
    parkingLogs.value.filter(log =>
      log.building === selectedBuilding.value &&
      log.floor === selectedFloor.value &&
      log.veh_type === selectedVehicle.value
    )
  );

  const filteredCameras = computed(() =>
    cctvCameras.value.filter(cam =>
      cam.building === selectedBuilding.value &&
      cam.floor === selectedFloor.value &&
      cam.veh_type === selectedVehicle.value
    )
  );

  // Actions
  const fetchDashboardData = async () => {
    loading.value = true;
    error.value = null;
    try {
      const [slots, logs, cameras, zones] = await Promise.all([
        dashboardApi.getParkingSlots(),
        dashboardApi.getParkingLogs(),
        dashboardApi.getCCTVCameras(),
        dashboardApi.getParkingZones(),
      ]);

      parkingSlots.value = slots;
      parkingLogs.value = logs;
      cctvCameras.value = cameras;
      parkingZones.value = zones;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load dashboard data';
    } finally {
      loading.value = false;
    }
  };

  const updateSlotStatus = async (slotId: number, status: string) => {
    try {
      await dashboardApi.updateSlotStatus(slotId, status);
      const slot = parkingSlots.value.find(s => s._id === slotId);
      if (slot) slot.slot_status = status as any;
    } catch (err) {
      error.value = 'Failed to update slot status';
    }
  };

  return {
    // State
    parkingSlots,
    parkingLogs,
    cctvCameras,
    parkingZones,
    loading,
    error,
    selectedBuilding,
    selectedFloor,
    selectedVehicle,
    // Computed
    totalSlots,
    availableSlots,
    occupiedSlots,
    incomingSlots,
    disabledSlots,
    filteredSlots,
    filteredLogs,
    filteredCameras,
    // Actions
    fetchDashboardData,
    updateSlotStatus,
  };
});
```

### API Service (services/api.ts)

```typescript
// services/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const dashboardApi = {
  // Parking Slots
  getParkingSlots: async () => {
    const response = await fetch(`${API_BASE_URL}/parking-slots`);
    return response.json();
  },

  updateSlotStatus: async (slotId: number, status: string) => {
    const response = await fetch(`${API_BASE_URL}/parking-slots/${slotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot_status: status }),
    });
    return response.json();
  },

  // Parking Logs
  getParkingLogs: async () => {
    const response = await fetch(`${API_BASE_URL}/parking-logs`);
    return response.json();
  },

  // CCTV Cameras
  getCCTVCameras: async () => {
    const response = await fetch(`${API_BASE_URL}/cctv-cameras`);
    return response.json();
  },

  // Parking Zones
  getParkingZones: async () => {
    const response = await fetch(`${API_BASE_URL}/parking-zones`);
    return response.json();
  },
};
```

---

## Backend API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Parking Slots Endpoints

#### GET - Retrieve All Slots
```
GET /parking-slots
```

**Query Parameters:**
- `building`: Filter by building (e.g., "E4")
- `floor`: Filter by floor (e.g., "1")
- `vehicle_type`: Filter by vehicle type (e.g., "car")

**Response:**
```json
[
  {
    "_id": 1,
    "slot_num": "A01",
    "slot_status": "Occupied",
    "building": "E4",
    "floor": "1",
    "veh_type": "car"
  }
]
```

#### PATCH - Update Slot Status
```
PATCH /parking-slots/:slotId
```

**Request Body:**
```json
{
  "slot_status": "Available"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Slot status updated"
}
```

### Parking Logs Endpoints

#### GET - Retrieve Parking Logs
```
GET /parking-logs
```

**Query Parameters:**
- `building`: Filter by building
- `floor`: Filter by floor
- `status`: Filter by parking status (Parking, Exited, Not Parking)
- `limit`: Number of records (default: 50)
- `skip`: Pagination offset (default: 0)

**Response:**
```json
[
  {
    "_id": 1,
    "building": "E4",
    "floor": "1",
    "veh_type": "car",
    "name": "นายกิตติ เรียนดี",
    "license_num": "กข-1234",
    "province": "เชียงราย",
    "veh_des": "Toyota Camry สีดำ",
    "park_date": "2026-07-01",
    "exit_date": "2026-07-01",
    "park_time": "08:00:00",
    "exit_time": "12:00:00",
    "park_slot": "A01",
    "park_status": "Exited",
    "face_entrance": "storage/yolo_snapshots/in_log1.jpg",
    "face_exit": "storage/yolo_snapshots/out_log1.jpg"
  }
]
```

### CCTV Cameras Endpoints

#### GET - Retrieve All CCTV Cameras
```
GET /cctv-cameras
```

**Query Parameters:**
- `building`: Filter by building
- `floor`: Filter by floor
- `status`: Filter by status (online, offline)

**Response:**
```json
[
  {
    "_id": 1,
    "cctv_file": "cctv_files/cctvinfo2.json",
    "create_name": "System_Importer",
    "CAMERA_NAME_NEW": "Guardhouse-ANPR-01",
    "IP_Address": "172.30.36.11",
    "ANPR&PTZ_RTSP": "rtsp://...",
    "status": "online",
    "date_add": "2026-07-01",
    "time_add": "09:00:00",
    "building": "E4",
    "floor": "1",
    "veh_type": "car"
  }
]
```

### Parking Zones Endpoints

#### GET - Retrieve Parking Zones
```
GET /parking-zones
```

**Query Parameters:**
- `building`: Filter by building
- `floor`: Filter by floor
- `status`: Filter by parking status (Active, Inactive)

**Response:**
```json
[
  {
    "_id": 1,
    "building": "E4",
    "floor": "1",
    "veh_type": "car",
    "date_add": "2026-06-29",
    "time_add": "11:00:00",
    "parking_status": "Active",
    "park_map": "storage/maps/e4_floor1_map.png"
  }
]
```

---

## Database Schema

### MongoDB Collections

#### 1. **parking_slots** Collection

```javascript
db.createCollection("parking_slots", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["slot_num", "slot_status", "building", "floor", "veh_type"],
      properties: {
        _id: { bsonType: "int" },
        slot_num: { bsonType: "string", pattern: "^[A-Z][0-9]{2}$" },
        slot_status: { 
          enum: ["Available", "Occupied", "Incoming", "Disable"],
          description: "Current status of the parking slot"
        },
        building: { bsonType: "string" },
        floor: { bsonType: "string" },
        veh_type: { enum: ["car", "motorcycle"] }
      }
    }
  }
});

// Create Index for faster queries
db.parking_slots.createIndex({ building: 1, floor: 1, veh_type: 1 });
db.parking_slots.createIndex({ slot_status: 1 });
```

**Sample Document:**
```json
{
  "_id": 1,
  "slot_num": "A01",
  "slot_status": "Occupied",
  "building": "E4",
  "floor": "1",
  "veh_type": "car"
}
```

#### 2. **parking_logs** Collection

```javascript
db.createCollection("parking_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["license_num", "veh_type", "park_date", "park_time"],
      properties: {
        _id: { bsonType: "int" },
        building: { bsonType: "string" },
        floor: { bsonType: "string" },
        veh_type: { enum: ["car", "motorcycle"] },
        name: { bsonType: "string" },
        license_num: { bsonType: "string" },
        province: { bsonType: "string" },
        veh_des: { bsonType: "string" },
        park_date: { bsonType: "date" },
        exit_date: { bsonType: ["date", "null"] },
        park_time: { bsonType: "string" },
        exit_time: { bsonType: ["string", "null"] },
        park_slot: { bsonType: "string" },
        park_status: { enum: ["Parking", "Exited", "Not Parking"] },
        face_entrance: { bsonType: "string" },
        face_exit: { bsonType: ["string", "null"] }
      }
    }
  }
});

// Create Indexes
db.parking_logs.createIndex({ license_num: 1 });
db.parking_logs.createIndex({ park_date: 1 });
db.parking_logs.createIndex({ building: 1, floor: 1, park_date: 1 });

// TTL Index - Auto-delete records after 24 hours
db.parking_logs.createIndex({ "exit_date": 1 }, { expireAfterSeconds: 86400 });
```

**Sample Document:**
```json
{
  "_id": 1,
  "building": "E4",
  "floor": "1",
  "veh_type": "car",
  "name": "นายกิตติ เรียนดี",
  "license_num": "กข-1234",
  "province": "เชียงราย",
  "veh_des": "Toyota Camry สีดำ",
  "park_date": ISODate("2026-07-01"),
  "exit_date": ISODate("2026-07-01"),
  "park_time": "08:00:00",
  "exit_time": "12:00:00",
  "park_slot": "A01",
  "park_status": "Exited",
  "face_entrance": "storage/yolo_snapshots/in_log1.jpg",
  "face_exit": "storage/yolo_snapshots/out_log1.jpg"
}
```

#### 3. **cctv_cameras** Collection

```javascript
db.createCollection("cctv_cameras", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["CAMERA_NAME_NEW", "IP_Address", "status"],
      properties: {
        _id: { bsonType: "int" },
        cctv_file: { bsonType: "string" },
        create_name: { bsonType: "string" },
        CAMERA_NAME_NEW: { bsonType: "string" },
        IP_Address: { bsonType: "string" },
        ANPR_PTZ_RTSP: { bsonType: "string" },
        status: { enum: ["online", "offline"] },
        date_add: { bsonType: "date" },
        time_add: { bsonType: "string" },
        building: { bsonType: "string" },
        floor: { bsonType: "string" },
        veh_type: { enum: ["car", "motorcycle"] }
      }
    }
  }
});

// Create Indexes
db.cctv_cameras.createIndex({ status: 1 });
db.cctv_cameras.createIndex({ building: 1, floor: 1 });
db.cctv_cameras.createIndex({ IP_Address: 1 });
```

**Sample Document:**
```json
{
  "_id": 1,
  "cctv_file": "cctv_files/cctvinfo2.json",
  "create_name": "System_Importer",
  "CAMERA_NAME_NEW": "Guardhouse-ANPR-01",
  "IP_Address": "172.30.36.11",
  "ANPR_PTZ_RTSP": "rtsp://mfustream:Mediamfu2025@172.30.36.11:554/Streaming/Channels/101/",
  "status": "online",
  "date_add": ISODate("2026-07-01"),
  "time_add": "09:00:00",
  "building": "E4",
  "floor": "1",
  "veh_type": "car"
}
```

#### 4. **parking_zones** Collection

```javascript
db.createCollection("parking_zones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["building", "floor", "veh_type", "parking_status"],
      properties: {
        _id: { bsonType: "int" },
        building: { bsonType: "string" },
        floor: { bsonType: "string" },
        veh_type: { enum: ["car", "motorcycle"] },
        date_add: { bsonType: "date" },
        time_add: { bsonType: "string" },
        parking_status: { enum: ["Active", "Inactive"] },
        park_map: { bsonType: "string" }
      }
    }
  }
});

// Create Index
db.parking_zones.createIndex({ building: 1, floor: 1, veh_type: 1 });
```

**Sample Document:**
```json
{
  "_id": 1,
  "building": "E4",
  "floor": "1",
  "veh_type": "car",
  "date_add": ISODate("2026-06-29"),
  "time_add": "11:00:00",
  "parking_status": "Active",
  "park_map": "storage/maps/e4_floor1_map.png"
}
```

---

## Data Flow

### Complete Request Flow Diagram

```
User Action (UI)
    ↓
Vue Component (SlotPanel/LogPanel/CCTVPanel)
    ↓
Pinia Store (useDashboardStore)
    ↓
API Service (api.ts) - HTTP Request
    ↓
Node.js Express Server (Backend)
    ↓
Route Handler (parking-slots.route.ts, etc.)
    ↓
Controller Logic (parkingController)
    ↓
MongoDB Query (db.collection.find/updateOne/etc)
    ↓
Database Response
    ↓
Controller Response
    ↓
Express Response (JSON)
    ↓
API Service (api.ts) - HTTP Response
    ↓
Pinia Store - Update State
    ↓
Vue Component - Re-render with new data
```

### Example: Fetching Parking Slots

1. **User clicks Dashboard** → DashboardView mounts
2. **Component lifecycle** → `onMounted()` hook calls `fetchDashboardData()`
3. **Store action** → `useDashboardStore.fetchDashboardData()`
4. **API call** → `dashboardApi.getParkingSlots()`
5. **HTTP GET** → `/api/parking-slots`
6. **Backend processing** → Find all slots in MongoDB
7. **Response** → JSON array of slots
8. **Store update** → `parkingSlots.value = slots`
9. **Component update** → Reactive data triggers re-render
10. **UI display** → Slots shown in grid layout

---

## Installation & Setup

### Prerequisites
- Node.js (v16+)
- MongoDB (v5.0+)
- Vue.js (v3+)
- npm or yarn

### Backend Setup

```bash
cd parking-backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
PORT=3000
MONGODB_URI=mongodb://localhost:27017/parking_management
NODE_ENV=development
EOF

# Start server
npm start
```

### Frontend Setup

```bash
cd parking-front

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
VITE_API_URL=http://localhost:3000/api
EOF

# Development server
npm run dev

# Build for production
npm run build
```

### Database Setup

```bash
# Connect to MongoDB
mongosh

# Create database
use parking_management

# Create collections and indexes (see Database Schema section)
# Import sample data
db.parking_slots.insertMany([...])
db.parking_logs.insertMany([...])
db.cctv_cameras.insertMany([...])
db.parking_zones.insertMany([...])
```

---

## Usage Guide

### Staff Dashboard Access

1. **Login**: Navigate to `/staff/login` with credentials
2. **Dashboard**: After authentication, access `/staff/dashboard`
3. **Navigation**: Use sidebar to switch between Dashboard and History views

### Viewing Parking Slots

1. Select **Slots** tab
2. Use filters to narrow by:
   - Building (e.g., E4)
   - Floor (e.g., 1, 2, 3)
   - Vehicle Type (Cars, Motorcycles)
3. View parking map with color-coded slots
4. Click slots to enable/disable

### Monitoring CCTV

1. Select **CCTV** tab
2. View live camera feeds
3. Check camera status (Live/Offline)
4. See camera details (Name, IP Address, Building, Floor)
5. RTSP streams displayed with timestamp overlay

### Checking Parking Logs

1. Select **Log** tab
2. View filtered parking history
3. See vehicle details:
   - Driver name and license number
   - Vehicle description
   - Entry/exit times and dates
   - Parking slot number
   - Facial recognition images (Entered/Exited)
4. Sort by date, driver, or status

### Statistics Overview

- **Total Slots**: All available parking spaces
- **Available**: Ready for vehicles
- **Incoming**: Vehicle in process of entering
- **Occupied**: Currently has vehicle
- **Disabled**: Out of service

---

## Troubleshooting

### Common Issues

**Issue**: Dashboard won't load
- Check MongoDB connection
- Verify backend is running (`http://localhost:3000`)
- Check browser console for errors

**Issue**: Cameras show offline
- Verify IP addresses are accessible
- Check network connectivity
- Restart RTSP stream

**Issue**: Parking logs not updating
- Check backend is processing vehicle events
- Verify YOLO snapshot storage path exists
- Check MongoDB write permissions

**Issue**: Slot status not updating
- Ensure slot ID exists in database
- Check PATCH request headers
- Verify MongoDB update operations

---

## Performance Optimization Tips

1. **Index Strategy**: Use composite indexes for filtered queries
2. **Pagination**: Implement pagination for large log datasets
3. **Caching**: Cache building/floor dropdown data
4. **Lazy Loading**: Load CCTV feeds on demand
5. **WebSocket**: Consider real-time updates for live slots
6. **Compression**: Enable gzip compression on backend

---

## Future Enhancements

- Real-time WebSocket updates
- Advanced ANPR processing
- Vehicle tracking across cameras
- Predictive parking availability
- Mobile app companion
- Advanced analytics dashboard
- Payment integration
- Reservation system

---

## Support & Documentation

For more information, see:
- [Frontend Documentation](../../../parking-front/SETUP.md)
- [Backend API Documentation](../../../parking-backend/API.md)

---

**Last Updated**: 2026-07-01  
**Version**: 1.0.0  
**Maintained By**: Development Team
