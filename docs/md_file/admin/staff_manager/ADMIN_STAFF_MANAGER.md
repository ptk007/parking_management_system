# MFU Parking Management - Admin Staff Manager

## Overview
The Admin Staff Manager page is part of the Admin Dashboard and enables system administrators to manage staff accounts, assign roles, and monitor staff status. Built with **Vue.js** front-end, **Node.js / Express** backend, and **MongoDB** storage, this page is designed for secure staff administration.

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
The Staff Manager page is used by administrators to:
- add new staff users
- view current staff list and account status
- edit existing staff profiles
- disable or delete staff accounts
- ensure only valid team members have access to staff and admin functions

---

## Features
- **Staff list** with status indicators: Online, Offline, Disable
- **Add staff form** for creating new staff accounts
- **Edit staff form** for updating username, password, and status
- **Role awareness** to distinguish admin vs staff accounts
- **Password validation** and secure hashing on the backend
- **Activity timestamps** for date added and time added
- **Conditional edit rules** such as only offline or disabled staff may be updated

---

## Frontend Components

### `StaffManagerView.vue`
Main interface for staff management.

**UI structure:**
- top title and button to add new staff
- list of staff cards with profile summary
- edit and delete actions on each card
- inline status color labels

**Example layout:**
```vue
<template>
  <div class="staff-manager-page">
    <div class="header-row">
      <h1>Staff List</h1>
      <button @click="showAddStaff = true" class="btn-add">Add Staff</button>
    </div>

    <div v-for="staff in staffList" :key="staff._id" class="staff-card">
      <div class="profile-info">
        <div class="avatar"></div>
        <div>
          <p><strong>Staff Name :</strong> {{ staff.name }}</p>
          <p><strong>Username :</strong> {{ staff.username }}</p>
          <p><strong>Date added :</strong> {{ staff.date_add }}</p>
          <p><strong>Time added :</strong> {{ staff.time_add }}</p>
          <p><strong>Status :</strong> <span :class="statusClass(staff.status)">{{ staff.status }}</span></p>
        </div>
      </div>
      <div class="actions">
        <button @click="editStaff(staff)">Edit</button>
        <button @click="deleteStaff(staff._id)">Delete</button>
      </div>
    </div>

    <StaffForm v-if="showAddStaff" @saved="reloadStaff" @close="showAddStaff = false" />
    <StaffForm v-if="editingStaff" :staff="editingStaff" @saved="reloadStaff" @close="closeEdit" />
  </div>
</template>
```

### `StaffForm.vue`
Reusable form for adding or editing staff.

**Form fields:**
- Name
- Username
- Password
- Confirm Password
- Role (`admin` or `staff`)
- Status (`online`, `offline`, `disable`)

**Validation:**
- password and confirm password must match
- username must be unique
- required fields cannot be empty

**Example script:**
```ts
<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue';
import { adminApi } from '@/services/adminApi';

const props = defineProps<{ staff?: StaffUser }>();
const emit = defineEmits(['saved', 'close']);

const name = ref(props.staff?.name || '');
const username = ref(props.staff?.username || '');
const password = ref('');
const confirmPassword = ref('');
const role = ref(props.staff?.role || 'staff');
const status = ref(props.staff?.status || 'offline');
const error = ref('');

const submit = async () => {
  if (password.value !== confirmPassword.value) {
    error.value = 'Passwords do not match';
    return;
  }

  const payload = {
    name: name.value,
    username: username.value,
    password: password.value,
    role: role.value,
    status: status.value,
  };

  if (props.staff) {
    await adminApi.updateStaff(props.staff._id, payload);
  } else {
    await adminApi.createStaff(payload);
  }
  emit('saved');
};
</script>
```

### Store / State
A Pinia store can manage staff list state and refresh logic.

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { adminApi } from '@/services/adminApi';

export const useStaffStore = defineStore('staff', () => {
  const staffList = ref<StaffUser[]>([]);
  const loading = ref(false);
  const error = ref('');

  const loadStaff = async () => {
    loading.value = true;
    staffList.value = await adminApi.getStaff();
    loading.value = false;
  };

  return { staffList, loading, error, loadStaff };
});
```

---

## Backend API Endpoints
Base path: `/api/admin/staff`

### `GET /api/admin/staff`
Retrieve list of staff users.

**Response:**
```json
[
  {
    "_id": 2,
    "username": "somsri_staff",
    "name": "สมศรี รักดี",
    "role": "staff",
    "status": "offline",
    "date_add": "2026-06-29",
    "time_add": "09:15:00"
  }
]
```

### `POST /api/admin/staff`
Create new staff user.

**Request body:**
```json
{
  "username": "new_staff",
  "password": "securePass123",
  "name": "New Staff",
  "role": "staff",
  "status": "offline"
}
```

### `PATCH /api/admin/staff/:id`
Update existing staff user.

**Request body:**
```json
{
  "name": "Updated Name",
  "password": "newSecurePass",
  "status": "offline"
}
```

### `DELETE /api/admin/staff/:id`
Disable or remove staff user.

**Response:**
```json
{ "success": true, "message": "Staff disabled" }
```

---

## Database Schema

### `user` Collection Example

```json
[
  {
    "_id": 1,
    "username": "somchai_admin",
    "password": "$2b$10$hashedpasswordhere...",
    "pin_code": "123456",
    "name": "สมชาย ใจดี",
    "role": "admin",
    "status": "online",
    "date_add": "2026-06-29",
    "time_add": "08:30:00"
  },
  {
    "_id": 2,
    "username": "somsri_staff",
    "password": "$2b$10$hashedpasswordhere...",
    "pin_code": "654321",
    "name": "สมศรี รักดี",
    "role": "staff",
    "status": "offline",
    "date_add": "2026-06-29",
    "time_add": "09:15:00"
  },
  {
    "_id": 3,
    "username": "user_test01",
    "password": "$2b$10$hashedpasswordhere...",
    "pin_code": "000000",
    "name": "นายกิตติ เรียนดี",
    "role": "user",
    "status": "disable",
    "date_add": "2026-06-29",
    "time_add": "10:00:00"
  }
]
```

### Recommended Collections and Indexes
- `user` collection holds all accounts including admin and staff
- Unique index on `username`
- Optional index on `role` for quick filtering
- Optional index on `status` for status-based dashboard views

---

## Installation & Setup

### Backend
- Ensure `parking-backend` is installed
- Add or update `.env` with MongoDB connection
- Run backend with `npm start`

### Frontend
- Ensure `parking-front` dependencies are installed
- Add `VITE_API_URL` to `.env.local`
- Run frontend with `npm run dev`

### Database
- Use MongoDB collection `user`
- Seed sample staff and admin accounts as shown above

---

## Usage Guide

### Admin actions
- Open the Admin Staff Manager page
- Click **Add Staff** to create a new account
- Review existing staff cards and their online status
- Click **Edit** to update details for offline/disabled staff
- Click **Delete** to disable the user if needed

### Recommended workflow
- Use a unique username for each staff member
- Set default status to `offline` after creation
- Use strong password rules and require confirmation
- Keep the `admin` account reserved for system administration only

---

## Security Considerations
- Hash passwords with `bcrypt` before storing in MongoDB
- Validate user input server-side
- Use admin-only authorization middleware for all `/api/admin/staff` routes
- Do not return password hashes in API responses
- Consider writing audit entries to `slot_history` or activity logs when staff accounts change

---

**Last Updated**: 2026-07-02
