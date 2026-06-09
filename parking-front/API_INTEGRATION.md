# API Integration Guide

This guide explains how the Staff Portal frontend integrates with the backend API.

## Backend Setup Required

### Prerequisites
The Node.js backend must provide these API endpoints:

---

## Authentication Endpoints

### POST /api/auth/login
**Request:**
```json
{
  "username": "staff_username",
  "password": "password123"
}
```

**Response:** (200 OK)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "username": "thanatip",
    "fullName": "Thanatip P.",
    "role": "staff",
    "buildingId": "507f1f77bcf86cd799439012",
    "floorId": "507f1f77bcf86cd799439013",
    "status": "online",
    "avatar": "https://..."
  }
}
```

**Error Response:** (401 Unauthorized)
```json
{
  "message": "Invalid username or password"
}
```

### POST /api/auth/logout
**Request:** Headers with Authorization token
```
Authorization: Bearer {token}
```

**Response:** (200 OK)
```json
{
  "message": "Logged out successfully"
}
```

### GET /api/auth/verify
**Request:** Headers with Authorization token

**Response:** (200 OK)
```json
{
  "valid": true,
  "user": { ... }
}
```

---

## Dashboard Endpoints

### GET /api/staff/dashboard
**Query Parameters:**
```
?building=E4&floor=4&vehicleType=cars
```

**Response:** (200 OK)
```json
{
  "totalSlots": 124,
  "available": 47,
  "incoming": 6,
  "occupied": 74,
  "disabled": 3
}
```

---

## Parking Management Endpoints

### GET /api/staff/parking/slots
**Query Parameters:**
```
?buildingId=507f1f77bcf86cd799439012&floorId=507f1f77bcf86cd799439013
```

**Response:** (200 OK)
```json
[
  {
    "_id": "507f1f77bcf86cd799439014",
    "slotNumber": "A1",
    "floorId": "507f1f77bcf86cd799439013",
    "vehicleType": "cars",
    "status": "available",
    "currentVehicle": null,
    "lastUpdated": "2026-06-09T10:30:00Z"
  },
  {
    "_id": "507f1f77bcf86cd799439015",
    "slotNumber": "A2",
    "floorId": "507f1f77bcf86cd799439013",
    "vehicleType": "cars",
    "status": "occupied",
    "currentVehicle": "507f1f77bcf86cd799439016",
    "lastUpdated": "2026-06-09T10:25:00Z"
  }
]
```

### PUT /api/staff/parking/slots/:slotId
**Request Body:**
```json
{
  "status": "disabled",
  "action": "disable"
}
```

**Response:** (200 OK)
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "slotNumber": "A1",
  "status": "disabled",
  "lastUpdated": "2026-06-09T10:35:00Z"
}
```

### GET /api/staff/logs
**Query Parameters:**
```
?buildingId=507f...&floorId=507f...&vehicleType=cars&dateRange={...}
```

**Response:** (200 OK)
```json
[
  {
    "_id": "507f1f77bcf86cd799439020",
    "ownerName": "Mrs. Wilayporn Nonsila",
    "licenseNumber": "กง 1234",
    "province": "เชียงราย",
    "vehicleDescription": "Black Toyota Fortuner",
    "entryTime": "2026-06-09T12:00:34Z",
    "exitTime": null,
    "parkingSlot": "10",
    "parkingStatus": "parking",
    "faceRecognition": {
      "entryPhoto": "https://...",
      "exitPhoto": null
    }
  }
]
```

---

## CCTV Endpoints

### GET /api/staff/cctv/cameras
**Query Parameters:**
```
?buildingId=507f...&floorId=507f...
```

**Response:** (200 OK)
```json
[
  {
    "_id": "507f1f77bcf86cd799439030",
    "name": "Floor4 B6",
    "ipAddress": "172.28.113.103",
    "buildingId": "507f...",
    "floorId": "507f...",
    "status": "online",
    "streamUrl": "rtsp://172.28.113.103:554/stream",
    "lastUpdate": "2026-06-09T10:35:00Z"
  }
]
```

### GET /api/staff/cctv/cameras/:cameraId/stream
**Response:** RTSP stream URL or WebRTC endpoint

### GET /api/staff/cctv/cameras/:cameraId/snapshot
**Response:** Latest camera image (JPEG)

---

## Chat/Support Endpoints

### GET /api/staff/chat/tickets
**Response:** (200 OK)
```json
[
  {
    "_id": "507f1f77bcf86cd799439040",
    "ticketNumber": "TKT-001",
    "subject": "Camera offline on Floor 4",
    "status": "open",
    "messages": [...],
    "createdAt": "2026-06-09T09:00:00Z",
    "assignedSupport": {
      "id": "507f...",
      "name": "Support Staff",
      "avatar": "https://..."
    }
  }
]
```

### GET /api/staff/chat/tickets/:ticketId
**Response:** (200 OK)
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "ticketNumber": "TKT-001",
  "subject": "Camera offline on Floor 4",
  "status": "open",
  "messages": [
    {
      "_id": "507f...",
      "sender": "507f... (staff ID)",
      "senderType": "staff",
      "message": "Camera B6 is offline",
      "timestamp": "2026-06-09T09:00:00Z"
    },
    {
      "_id": "507f...",
      "sender": "507f... (support ID)",
      "senderType": "support",
      "message": "We'll send a technician",
      "timestamp": "2026-06-09T09:05:00Z"
    }
  ]
}
```

### POST /api/staff/chat/tickets
**Request Body:**
```json
{
  "subject": "Camera offline",
  "message": "Floor 4 CCTV camera B6 is not responding"
}
```

**Response:** (201 Created)
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "ticketNumber": "TKT-002",
  "status": "open"
}
```

### POST /api/staff/chat/messages/:ticketId
**Request Body:**
```json
{
  "message": "Still offline, please check"
}
```

**Response:** (201 Created)
```json
{
  "_id": "507f...",
  "ticketId": "507f1f77bcf86cd799439040",
  "sender": "507f... (staff ID)",
  "senderType": "staff",
  "message": "Still offline, please check",
  "timestamp": "2026-06-09T09:10:00Z"
}
```

### PUT /api/staff/chat/tickets/:ticketId
**Request Body:**
```json
{
  "status": "done"
}
```

**Response:** (200 OK)
```json
{
  "_id": "507f1f77bcf86cd799439040",
  "status": "done",
  "resolvedAt": "2026-06-09T10:00:00Z"
}
```

---

## History Endpoints

### GET /api/staff/history
**Query Parameters:**
```
?dateRange={start: "2026-06-01", end: "2026-06-09"}&staffId=507f...
```

**Response:** (200 OK)
```json
[
  {
    "_id": "507f1f77bcf86cd799439050",
    "staffName": "Thanathip Pitaksin",
    "building": "E4",
    "floor": "4",
    "parkingSlots": ["120", "121", "122", "123"],
    "dateEdited": "2026-06-09T11:04:00Z",
    "timeEdited": "13:00:23",
    "statusChangedTo": "disable"
  }
]
```

---

## Staff Profile Endpoints

### GET /api/staff/profile
**Response:** (200 OK)
```json
{
  "id": "507f1f77bcf86cd799439011",
  "username": "thanatip",
  "fullName": "Thanatip P.",
  "email": "thanatip@mfu.local",
  "role": "staff",
  "buildingId": "507f1f77bcf86cd799439012",
  "floorId": "507f1f77bcf86cd799439013",
  "status": "online",
  "avatar": "https://..."
}
```

### GET /api/staff/profile/assigned-area
**Response:** (200 OK)
```json
{
  "building": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "E4",
    "floors": 5
  },
  "floor": {
    "_id": "507f1f77bcf86cd799439013",
    "number": 4,
    "totalSlots": 124
  },
  "assignedSlots": ["A1", "A2", "B1", ...]
}
```

### PUT /api/staff/profile
**Request Body:**
```json
{
  "password": "newPassword123",
  "preferences": {
    "theme": "light",
    "notifications": true
  }
}
```

**Response:** (200 OK)
```json
{
  "message": "Profile updated successfully"
}
```

---

## Authentication Header

All requests (except login) must include JWT token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The frontend automatically adds this header via axios interceptor in `src/services/api.ts`.

---

## Error Responses

### 400 - Bad Request
```json
{
  "message": "Invalid request parameters",
  "errors": ["building is required"]
}
```

### 401 - Unauthorized
```json
{
  "message": "Invalid or expired token",
  "code": "INVALID_TOKEN"
}
```

### 403 - Forbidden
```json
{
  "message": "Access denied to this resource",
  "code": "FORBIDDEN"
}
```

### 404 - Not Found
```json
{
  "message": "Resource not found"
}
```

### 500 - Server Error
```json
{
  "message": "Internal server error",
  "code": "SERVER_ERROR"
}
```

---

## Implementation Checklist

- [ ] Setup Node.js backend with Express.js
- [ ] Setup MongoDB with collections:
  - [ ] users (staff)
  - [ ] buildings
  - [ ] floors
  - [ ] parking_slots
  - [ ] parking_logs
  - [ ] cctv_cameras
  - [ ] chat_tickets
  - [ ] history_logs
- [ ] Implement authentication endpoints
- [ ] Implement dashboard endpoints
- [ ] Implement parking management endpoints
- [ ] Implement CCTV endpoints
- [ ] Implement chat endpoints
- [ ] Implement history endpoints
- [ ] Add JWT token validation middleware
- [ ] Add CORS configuration
- [ ] Add error handling and logging
- [ ] Test all endpoints with Postman/Thunder Client
- [ ] Deploy backend to server
- [ ] Update `.env` with backend URL in frontend
- [ ] Test full integration with frontend

---

## Example Backend Setup (Node.js + Express)

```javascript
// Example: backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  // Validate credentials
  // Generate JWT token
  // Return token + user data
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  // Logout logic
  res.json({ message: 'Logged out' });
});

// Protected Routes
app.get('/api/staff/dashboard', authenticateToken, (req, res) => {
  // Return dashboard stats
});

// ... more routes

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## CORS Configuration

Frontend runs on `http://localhost:5173/`
Backend must allow this origin:

```javascript
// backend/cors.config.js
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://parking.mfu.local'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = corsOptions;
```

---

## Testing with Postman

1. **Create Collection:** MFU Parking API
2. **Set Variable:** `base_url` = `http://localhost:3000/api`
3. **Add Requests:**
   - POST `/auth/login` → Get token
   - GET `/staff/dashboard` with token
   - etc.
4. **Save Responses:** Use for testing

---

## Troubleshooting API Calls

### Check Network Tab (F12 Browser DevTools)
- View actual API requests
- Check response status codes
- View response body

### Enable API Logging
```javascript
// In src/services/api.ts
apiClient.interceptors.response.use(
  response => {
    console.log('API Response:', response);
    return response;
  },
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
```

### Test with cURL
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"staff1","password":"pass123"}'

# Get Dashboard (with token)
curl -X GET http://localhost:3000/api/staff/dashboard \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

---

**For more information, see [SETUP.md](./SETUP.md) and [STAFF_PORTAL.md](../docs/STAFF_PORTAL.md)**

*Last Updated: June 2026*
