# MFU Parking Management - Staff History Page

## Overview
The Staff History Page is designed for staff members to track parking slot changes, review historical updates, and monitor maintenance or status modifications in the parking management system. It is built with **Vue.js** for the frontend, **Node.js** for the backend, and **MongoDB** for persistent storage.

## Table of Contents
1. [Features](#features)
2. [System Flow](#system-flow)
3. [Frontend Components](#frontend-components)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [Database Schema](#database-schema)
6. [Installation & Setup](#installation--setup)
7. [Usage Guide](#usage-guide)

---

## Features
- **Staff history log** showing slot edits and maintenance changes
- **Role-based tracking** for staff actions
- **Building and floor context** for each change
- **Detailed edit records** including timestamp and status change
- **Simple and clean UI** for rapid review

---

## System Flow

### History Page Workflow
1. Staff navigates to the **History** page.
2. The frontend requests parking slot history data from the backend.
3. The backend queries MongoDB for maintenance log entries.
4. The response is returned as JSON.
5. The Vue.js UI renders each history card with details.

### Flow Diagram (Text)
```
User (Staff) -> Vue.js History Page
                 -> API request /api/slot-history
                 -> Node.js Express Backend
                 -> MongoDB slot_history collection
                 <- history documents
                 <- HTTP response
                 -> UI render
```

---

## Frontend Components

### `HistoryView.vue`
Primary staff history page component.

**Responsibilities:**
- Fetch history records from the backend
- Render card-style history entries
- Display staff name, location, time, and slot changes
- Support clean and accessible layout

**Template Example:**
```vue
<template>
  <div class="history-page">
    <section class="history-list">
      <div v-for="entry in historyEntries" :key="entry._id" class="history-card">
        <h2>Staff Name: {{ entry.name }}</h2>
        <p>Building: {{ entry.building }}</p>
        <p>Floor: {{ entry.floor }}</p>
        <p>Parking Slot: {{ entry.slot_num }}</p>
        <p>Date edited: {{ entry.date_edit }}</p>
        <p>Time edited: {{ entry.time_edit }}</p>
        <p>Status changed to: <span :class="statusClass(entry.change_to)">{{ entry.change_to }}</span></p>
      </div>
    </section>
  </div>
</template>
```

**Reactive Logic:**
- `historyEntries` state from the pinia store or local component
- fetched using the API service
- computed classes for status colors

### Example CSS Approach
```css
.history-page { padding: 24px; }
.history-card { background: white; border-radius: 16px; padding: 20px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
.history-card p { margin: 8px 0; }
.history-card .status-enabled { color: #22c55e; }
.history-card .status-disabled { color: #ef4444; }
```

### Store Integration
Use a Pinia store or local composable to keep the history state.

```typescript
// stores/history.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { historyApi } from '@/services/api';

export const useHistoryStore = defineStore('history', () => {
  const historyEntries = ref([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchHistory = async () => {
    loading.value = true;
    error.value = null;
    try {
      historyEntries.value = await historyApi.getSlotHistory();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unable to load history';
    } finally {
      loading.value = false;
    }
  };

  return { historyEntries, loading, error, fetchHistory };
});
```

---

## Backend API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Slot History Endpoint

#### GET /slot-history
Retrieves staff parking slot history and maintenance logs.

**Response Example:**
```json
[
  {
    "_id": 1,
    "role": "staff",
    "name": "สมศรี รักดี",
    "building": "E4",
    "floor": "1",
    "slot_num": "A02",
    "date_edit": "2026-06-29",
    "time_edit": "14:25:30",
    "change_to": "Changed slot_status from Available to Disable due to maintenance"
  }
]
```

**Backend Controller:**
- Query MongoDB `slot_history`
- Sort records by `date_edit` / `time_edit`
- Return JSON list

**Recommended route handling:**
```js
app.get('/api/slot-history', async (req, res) => {
  const history = await db.collection('slot_history').find().sort({ date_edit: -1, time_edit: -1 }).toArray();
  res.json(history);
});
```

---

## Database Schema

### `slot_history` Collection
Stores staff editing history for parking slots.

**Sample Document:**
```json
{
  "_id": 1,
  "role": "staff",
  "name": "สมศรี รักดี",
  "building": "E4",
  "floor": "1",
  "slot_num": "A02",
  "date_edit": "2026-06-29",
  "time_edit": "14:25:30",
  "change_to": "Changed slot_status from Available to Disable due to maintenance"
}
```

### Recommended Validation
```javascript
db.createCollection('slot_history', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['role', 'name', 'building', 'floor', 'slot_num', 'date_edit', 'time_edit', 'change_to'],
      properties: {
        role: { bsonType: 'string' },
        name: { bsonType: 'string' },
        building: { bsonType: 'string' },
        floor: { bsonType: 'string' },
        slot_num: { bsonType: 'string' },
        date_edit: { bsonType: 'string' },
        time_edit: { bsonType: 'string' },
        change_to: { bsonType: 'string' }
      }
    }
  }
});
```

### Indexes
- `building` and `floor` for filtered queries
- `date_edit` descending for recent history

---

## Installation & Setup

### Frontend
1. Open `parking-front`
2. Install dependencies: `npm install`
3. Ensure environment uses `VITE_API_URL=http://localhost:3000/api`
4. Run: `npm run dev`

### Backend
1. Open `parking-backend`
2. Install dependencies: `npm install`
3. Configure `.env` with `MONGODB_URI`
4. Run: `npm start`

### Database
1. Open `mongosh`
2. Use database: `use parking_management`
3. Import `slot_history` data

---

## Usage Guide

### Accessing Staff History Page
- Navigate to staff dashboard and click **History** in the sidebar
- The page displays recent status changes and slot updates
- Each entry includes staff name, building, floor, slot number, edit timestamp, and details

### Typical Use Cases
- Review maintenance changes for disabled or enabled slots
- Verify slot status updates made by staff
- Audit parking slot activity by date and time

---

## Notes
- The history page is useful for operational auditing and staff accountability.
- Use the backend API to filter or paginate large history data sets.
- This page is designed for staff role access; guest users should not access historical audit logs.

---

**Last Updated**: 2026-07-01
