# MFU Parking Management - Login Page

## Overview
The Login Page provides secure access to the MFU Parking Management web application. It is built with **Vue.js** for the user interface, **Node.js** for API authentication, and **MongoDB** for credential and session storage.

## Table of Contents
1. [Purpose](#purpose)
2. [Features](#features)
3. [User Roles](#user-roles)
4. [Frontend Components](#frontend-components)
5. [Backend Authentication Flow](#backend-authentication-flow)
6. [API Endpoints](#api-endpoints)
7. [Database Schema](#database-schema)
8. [Installation & Setup](#installation--setup)
9. [Usage Guide](#usage-guide)

---

## Purpose
The Login Page enables registered users to sign in with credentials and access role-specific dashboards. It supports administrators, staff, and regular users while protecting sensitive operations behind authentication.

---

## Features
- **Username and password login**
- **Secure password hashing**
- **Role-based access control**
- **Session handling or token-based auth**
- **Error messages for invalid login**
- **Redirects to the correct dashboard**
- **Optional PIN code verification**

---

## User Roles
The system supports the following roles in `user` collection:

- `admin` — full system control, dashboard and management access
- `staff` — staff dashboard, parking management, history review
- `user` — regular parking user access and personal history

**Example user document**:
```json
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
}
```

---

## Frontend Components

### `LoginView.vue`
The login component provides user input fields and validation.

**Template Example:**
```vue
<template>
  <div class="login-page">
    <div class="login-card">
      <img src="/logo.png" alt="MFU Parking Logo" class="logo" />
      <h1>MFU Parking Management</h1>
      <form @submit.prevent="submitLogin">
        <label for="username">Username</label>
        <input id="username" v-model="username" placeholder="Username" required />

        <label for="password">Password</label>
        <input id="password" type="password" v-model="password" placeholder="Password" required />

        <button type="submit" :disabled="loading">Login</button>
      </form>
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>
  </div>
</template>
```

**Component Logic:**
- `username`, `password` state variables
- validation before request
- call authentication API
- handle success by redirecting to role-specific dashboard
- handle failure with message

**Example script:**
```ts
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@/services/api';

const username = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const router = useRouter();

const submitLogin = async () => {
  loading.value = true;
  error.value = '';
  try {
    const response = await authApi.login({ username: username.value, password: password.value });
    if (response.success) {
      const role = response.user.role;
      const route = role === 'admin' ? '/admin/dashboard' : role === 'staff' ? '/staff/dashboard' : '/user/dashboard';
      router.push(route);
    } else {
      error.value = response.message || 'Invalid credentials';
    }
  } catch (err) {
    error.value = 'Login failed, please try again.';
  } finally {
    loading.value = false;
  }
};
</script>
```

**UI Styling Notes:**
- Centered login card with logo and app title
- Rounded inputs and buttons
- Error states in red text
- Responsive mobile-friendly layout

---

## Backend Authentication Flow

### Flow Steps
1. User enters credentials and submits the login form.
2. Frontend sends a POST request to `/api/auth/login`.
3. Backend locates the user by `username` in MongoDB.
4. Password is verified using bcrypt.
5. If valid, backend creates a session or JWT token.
6. Response includes user profile and authentication token.
7. Frontend stores session/token and redirects by role.

### Security Notes
- Always store hashed passwords only.
- Use `bcrypt` for hashing/verification.
- Protect routes with middleware.
- Use HTTPS in production.

---

## API Endpoints

### POST `/auth/login`
Authenticate user credentials.

**Request Body:**
```json
{
  "username": "somsri_staff",
  "password": "userPassword"
}
```

**Response Example:**
```json
{
  "success": true,
  "token": "jwt.token.here",
  "user": {
    "_id": 2,
    "username": "somsri_staff",
    "name": "สมศรี รักดี",
    "role": "staff",
    "status": "online"
  }
}
```

**Failure Response:**
```json
{
  "success": false,
  "message": "Invalid username or password"
}
```

### POST `/auth/logout`
Invalidate session or revoke token.

**Request Body:**
```json
{ "token": "jwt.token.here" }
```

### GET `/auth/profile`
Retrieve currently authenticated user profile.

**Response Example:**
```json
{
  "_id": 2,
  "username": "somsri_staff",
  "name": "สมศรี รักดี",
  "role": "staff",
  "status": "online"
}
```

---

## Database Schema

### `user` Collection
Stores user login credentials, role, and status.

**Sample document:**
```json
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
```

### Recommended Validation
```js
db.createCollection('user', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'password', 'role', 'status'],
      properties: {
        username: { bsonType: 'string' },
        password: { bsonType: 'string' },
        pin_code: { bsonType: ['string', 'null'] },
        name: { bsonType: 'string' },
        role: { enum: ['admin', 'staff', 'user'] },
        status: { enum: ['online', 'offline', 'disable'] },
        date_add: { bsonType: 'string' },
        time_add: { bsonType: 'string' }
      }
    }
  }
});
```

### Indexes
- `username` should be unique for fast authentication.
- `role` can be indexed for admin/staff filtering.

---

## Installation & Setup

### Backend
1. Open `parking-backend`
2. Install dependencies: `npm install`
3. Configure `.env` with:
   - `PORT=3000`
   - `MONGODB_URI=mongodb://localhost:27017/parking_management`
4. Run the backend server: `npm start`

### Frontend
1. Open `parking-front`
2. Install dependencies: `npm install`
3. Configure `.env.local` with:
   - `VITE_API_URL=http://localhost:3000/api`
4. Run the app: `npm run dev`

### Database
1. Open MongoDB shell or GUI
2. Use `parking_management` database
3. Seed the `user` collection with admin/staff/user accounts

---

## Usage Guide

### Logging In
1. Open the app in a browser
2. Enter `username` and `password`
3. Click **Login**
4. Successful login redirects based on role:
   - `admin` → `/admin/dashboard`
   - `staff` → `/staff/dashboard`
   - `user` → `/user/dashboard`

### Error Handling
- Invalid credential message displayed
- Disabled account should return a specific status error
- Locked or offline users should be handled by backend logic

---

## Security Best Practices
- Use HTTPS in production
- Store auth tokens securely in cookies or local storage with proper flags
- Hash passwords with `bcrypt`
- Protect backend routes with middleware
- Implement rate limiting on login endpoint

---

## Notes
- The login page is the entry point for all application flows.
- Role checking should happen both on the frontend and backend.
- Consider adding optional multi-factor authentication (MFA) later.

---

**Last Updated**: 2026-07-01
