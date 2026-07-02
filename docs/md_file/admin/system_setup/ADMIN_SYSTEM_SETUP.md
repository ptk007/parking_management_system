# MFU Parking Management - Admin System Setup

## Overview
The Admin System Setup page enables administrators to configure parking zones, buildings, floors, and CCTV infrastructure. It is built with **Vue.js** on the frontend, **Node.js / Express** backend, and **MongoDB** for storing setup metadata and operational configuration.

## Table of Contents
- [Purpose](#purpose)
- [Features](#features)
- [Frontend Components](#frontend-components)
- [Backend API Endpoints](#backend-api-endpoints)
- [Database Schema](#database-schema)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [Security Considerations](#security-considerations)

---

## Purpose
The System Setup page is designed for admins to:
- create and manage buildings and floors
- configure parking zones and active status
- upload and monitor parking maps
- manage CCTV devices and RTSP links
- ensure the parking system reflects the real-world facility layout

---

## Features
- **Parking configuration** with building, floor, and vehicle type
- **Add / edit buildings and floors** from a single page
- **Parking map upload** and visualization
- **CCTV management** for camera setup and status verification
- **Flexible status controls** including `Available`, `Disable`, and `Active`
- **Quick camera panel** for online/offline detection
- **Filter by building, floor, and vehicle type** for focused administration

---

## Frontend Components

### `SystemSetupView.vue`
Main page for system configuration.

**UI structure:**
- top tabs: Parking and CCTV
- action buttons: Add Building, Add Floor, Add CCTV
- dynamic list of floor/building rows with edit buttons
- status labels and map links

**Components:**
- `ParkingSetupPanel.vue`
- `CCTVSetupPanel.vue`
- `BuildingFormOverlay.vue`
- `FloorFormOverlay.vue`
- `CCTVFormOverlay.vue`

### `ParkingSetupPanel.vue`
Displays a list of building/floor configurations.

**Example template:**
```vue
<template>
  <div class="parking-setup-panel">
    <div class="controls">
      <button @click="openAddBuilding">+ Add Building</button>
      <button @click="openAddFloor">+ Add Floor</button>
    </div>

    <div v-for="zone in zones" :key="zone._id" class="zone-card">
      <div class="zone-header">
        <img :src="zone.imageUrl" alt="Building image" />
        <div>
          <p>Building : {{ zone.building }}</p>
          <p>All Floor : {{ zone.floor }}</p>
          <p>Last Date added : {{ zone.date_add }}</p>
          <p>Last Time added : {{ zone.time_add }}</p>
        </div>
      </div>
      <div class="zone-actions">
        <button @click="viewFloor(zone)">View Floor</button>
        <button @click="editZone(zone)">Edit</button>
      </div>
    </div>
  </div>
</template>
```

### `BuildingFormOverlay.vue`
Form used to add or edit building details.

**Fields:**
- Building Name
- Building Image (optional)
- Confirm button

### `FloorFormOverlay.vue`
Form used for adding or editing a floor.

**Fields:**
- Building dropdown
- Floor number
- Vehicle type
- Status dropdown
- Parking map import
- Confirm button

### `CCTVSetupPanel.vue`
Displays CCTV card(s) with current online/offline status and edit actions.

**Fields:**
- CCTV file selection
- Camera name
- IP address
- RTSP link
- Status
- Create/edit buttons

### `CCTVFormOverlay.vue`
Form used to add or edit a camera setup.

**Fields:**
- CCTV file selector
- Search camera name
- IP address
- RTSP link
- Status
- Confirm / Cancel buttons

---

## Backend API Endpoints
Base path: `/api/admin/system`

### Parking configuration
- `GET /api/admin/system/zones` — list parking zones and setup records
- `POST /api/admin/system/zones` — create a new parking zone
- `PATCH /api/admin/system/zones/:id` — update zone settings
- `DELETE /api/admin/system/zones/:id` — delete or disable a zone

### Building/floor setup
- `GET /api/admin/system/buildings` — list buildings
- `POST /api/admin/system/buildings` — add a building
- `PATCH /api/admin/system/buildings/:id` — edit building details
- `GET /api/admin/system/floors` — list floors and status
- `POST /api/admin/system/floors` — add a floor configuration
- `PATCH /api/admin/system/floors/:id` — edit floor settings

### CCTV management
- `GET /api/admin/system/cctv` — list CCTV cameras
- `POST /api/admin/system/cctv` — add new camera
- `PATCH /api/admin/system/cctv/:id` — update camera metadata
- `POST /api/admin/system/cctv/:id/test` — test camera connection

---

## Database Schema

### `parking_zones` Collection
Stores parking zone metadata and map references.

**Example document:**
```json
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
```

### `parking_cctv` Collection
Stores camera configuration for admin setup.

**Example document:**
```json
{
  "_id": 1,
  "cctv_file": "cctv_files/cctvinfo2.json",
  "create_name": "System_Importer",
  "CAMERA_NAME_NEW": "Guardhouse-ANPR-01",
  "IP Address": "172.30.36.11",
  "ANPR&PTZ RTSP": "rtsp://mfustream:Mediamfu2025@172.30.36.11:554/Streaming/Channels/101/",
  "status": "online",
  "date_add": "2026-07-01",
  "time_add": "09:00:00",
  "building": "E4",
  "floor": "1",
  "veh_type": "car"
}
```

### Recommended validation and indexes
- `parking_zones`: index on `building`, `floor`, `veh_type`
- `parking_cctv`: index on `status`, `building`, `floor`
- ensure `park_map` references valid file paths or URLs

---

## Installation & Setup

### Backend
- Install dependencies in `parking-backend`
- Configure `.env` for MongoDB URI and server port
- Run `npm start`

### Frontend
- Install dependencies in `parking-front`
- Add `VITE_API_URL` to `.env.local`
- Start local server with `npm run dev`

### Database
- Use MongoDB collections for `parking_zones` and `parking_cctv`
- Seed example documents using the provided JSON

---

## Usage Guide

### Parking tab
- Click **Add Building** to create a new building record
- Click **Add Floor** to attach a new floor configuration under a building
- Use edit buttons to change building names or floor statuses
- Upload parking maps and confirm vehicle type for each floor

### CCTV tab
- Click **Add CCTV** to bring a new camera into the system
- Use the camera file dropdown and search box to select the correct source
- Validate IP and RTSP link status before confirming
- Edit existing cameras to update offline links or reposition images

---

## Security Considerations
- Validate uploaded files and file names when importing parking maps
- Sanitize all input fields, especially RTSP URL and IP address
- Restrict `/api/admin/system` routes to admin role only
- Ensure uploaded map images and camera metadata are stored securely

---

## Screenshots and Layout Notes
The admin system setup includes:
- building/floor cards with dates and status
- modal overlays for add/edit forms
- a CCTV configuration page with live preview and status checks

---

**Last Updated**: 2026-07-02
