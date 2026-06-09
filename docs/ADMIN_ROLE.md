# MFU Parking Management System - Admin Role Documentation

## Overview
The Admin role in the MFU Parking Management System provides comprehensive control over parking operations, staff management, and system configuration. Admins have full access to monitor parking facilities, manage CCTV systems, track vehicle activities, and oversee staff operations.

---

## System Architecture

### Tech Stack
- **Frontend:** Vue.js 3 (Modern reactive UI framework)
- **Backend:** Node.js (Express.js for API endpoints)
- **Database:** MongoDB (Replaced from PostgreSQL for flexibility)
- **AI/ML:** Python with YOLO (Vehicle detection and license plate recognition)

---

## Admin Dashboard Features

### 1. Dashboard Overview

#### Dashboard Tabs
- **Slots Tab:** Real-time parking slot availability and statistics
- **CCTV Tab:** Live camera feeds and vehicle detection
- **Log Tab:** Historical parking activity and audit logs

#### Key Metrics Display
- example
- **Total Slots:** 124 (Building E4, Floor 4)
- **Available:** 47 slots
- **Incoming:** 6 vehicles (expected entries)
- **Occupied:** 74 slots
- **Disabled:** 3 inaccessible slots
- **Active Staff:** 6 staff members on duty

#### Dashboard Filters
- **Building Selection:** Filter by building (e.g., E4)
- **Floor Selection:** Choose specific floor level
- **Vehicle Type:** Filter by vehicle class (Cars, Motorcycles, etc.)

---

## 2. Parking Management

### Parking Slots View
The Parking Slots tab displays real-time parking availability with:
- Live vehicle detection from CCTV cameras using YOLO
- Slot-by-slot status (Available/Occupied/Disabled)
- Floor mapping with vehicle location visualization
- Date and timestamp of last update

### Parking Setup (System Setup)
Admins can configure the parking structure:

#### Building Management
- **Add New Building:** Create new parking facilities
- **Edit Building Details:** Update building information
- **View Building Stats:** Total floors and current capacity
- **Building Image Upload:** Display building layout/thumbnail

#### Floor Configuration
- **Add Floors:** Create new floor levels within buildings
- **Floor Capacity:** Define slot counts per floor
- **Vehicle Type Assignment:** Assign slot types (Cars, Motorcycles, etc.)
- **Edit Floor Settings:** Modify floor parameters
- **Status Management:** Enable/disable floors as needed

#### Parking Map Visualization
- Interactive floor map showing:
  - Individual slot locations
  - Real-time slot status (Available/Occupied/Reserved)
  - Vehicle information overlays
  - Navigate between floors

---

## 3. CCTV Monitoring System

### CCTV Dashboard
Real-time video monitoring with:
- **Live Feed Display:** Multiple camera streams simultaneously
- **Building Filter:** Select building for CCTV view
- **Floor Filter:** Choose specific floor cameras
- **Vehicle Type Filter:** Filter cameras by monitored vehicle types

### CCTV Integration
- **Vehicle Detection:** YOLO AI detects vehicles entering/exiting
- **Bounding Boxes:** Highlighted detected vehicles in real-time
- **Timestamp Overlay:** Date/time on each camera feed
- **Status Indicator:** Online/Offline camera status

### CCTV Setup
Admins manage camera infrastructure:

#### Add Camera
- Configure new CCTV cameras
- Assign to specific building and floor
- Set camera name and ID
- Input IP address for network access

#### Camera Management
- **View Camera Details:** example
  - Camera Name: e.g., "Floor4 B6"
  - IP Address: e.g., 172.28.113.103
  - Status: Online/Offline
  - Last Update: Date and time synchronized
  
- **Edit Camera Settings:**
  - Update camera configuration
  - Modify assignment location
  - Adjust streaming parameters

- **Camera List View:**
  - All configured cameras in system
  - Quick status check
  - Bulk management options

---

## 4. Parking Activity Log

### Log Tab Features
The Log tab provides detailed parking history:

#### Entry/Exit Records
- **Vehicle Information:**
  - Owner name and contact
  - License plate number
  - Vehicle description (Make, Model, Color)
  - Province/Region information

- **Parking Details:**
  - Parking slot number assigned
  - Entry date and time
  - Exit date and time (if completed)
  - Total parking duration
  - Parking status (Parking/Exited/Not Parking)

- **Face Recognition:**
  - Driver photo (Entry capture)
  - Driver photo (Exit capture)
  - Face detection validation

#### Log Filters
- **Time Range:** Filter by date/period
- **Building/Floor:** Search by location
- **Vehicle Type:** Filter by vehicle class
- **Status Filter:** View by parking status

#### Data Display
- **24-Hour Reset:** Exited car log resets after 24 hours
- **Export Options:** Download log data for reporting
- **Search Functionality:** Find specific entries quickly

#### History Tab
- Separate history view for detailed audit trails
- Access to archived parking records
- Historical analysis capability

---

## 5. Staff Management

### Staff Manager Section
Admins oversee all parking facility staff:

#### Staff List View
Displays all staff members with:
- Staff profile photo/avatar
- Staff name (Full name)
- Username (Login ID)
- Password (Masked display)
- Date added to system
- Time added (Timestamp)
- Current status (Online/Offline/Disabled)

#### Add Staff
Create new staff accounts with:
- Full name input
- Username creation
- Initial password setup
- Role assignment (Parking Attendant, etc.)
- Floor/Building assignment
- Status activation

#### Edit Staff
Modify existing staff records:
- Update staff information
- Change assigned location
- Reset/change password
- Modify status
- Can only edit when staff is offline or disabled

#### Staff Status Control
- **Online:** Staff actively monitoring/working
- **Offline:** Staff not currently active
- **Disabled:** Staff account disabled by admin

#### Staff Actions
- Edit button: Modify staff details
- Delete button: Remove staff from system

---

## 6. System Setup Management

### System Configuration
The System Setup section provides administrative controls:

#### Core Settings
- Building and floor configuration
- CCTV camera management
- Staff user management
- System preferences

#### Configuration Workflow
1. Add buildings to the system
2. Configure floors per building
3. Set parking slot capacity
4. Deploy and configure CCTV cameras
5. Register staff members
6. Assign staff to specific areas

---

## 7. Authentication & Security

### Login System
- Username/password authentication
- Secure session management
- Role-based access control (RBAC)
- Admin role verification

### Session Management
- Real-time online/offline status
- Activity logging and audit trails
- Session timeout controls
- Password security policies

---

## 8. Real-Time Notifications

### Admin Notifications
- New vehicle entry alerts
- Camera offline notifications
- Slot capacity warnings
- Unauthorized access attempts
- Staff status changes

### Notification Preferences
- Alert configuration
- Priority level settings
- Notification delivery method

---

## 9. Reporting & Analytics

### Dashboard Analytics
- Real-time statistics
- Occupancy trends
- Vehicle traffic patterns
- Peak usage times
- Revenue analysis (if applicable)

### Report Generation
- Daily parking reports
- Monthly activity summaries
- CCTV incident reports
- Staff performance metrics
- Export to PDF/CSV formats

---

## 10. Data Models (MongoDB)

### Building Collection
```javascript
{
  _id: ObjectId,
  name: String,           // e.g., "Building E4"
  location: String,
  totalFloors: Number,
  image: String,          // Image URL/path
  createdAt: Date,
  updatedAt: Date
}
```

### Floor Collection
```javascript
{
  _id: ObjectId,
  buildingId: ObjectId,
  floorNumber: Number,
  totalSlots: Number,
  vehicleTypes: [String],  // ["Cars", "Motorcycles"]
  imageMap: String,
  status: String,         // "Active" / "Inactive"
  createdAt: Date
}
```

### ParkingSlot Collection
```javascript
{
  _id: ObjectId,
  floorId: ObjectId,
  slotNumber: String,
  vehicleType: String,
  status: String,        // "Available" / "Occupied" / "Disabled"
  currentVehicle: ObjectId,
  lastUpdated: Date
}
```

### Vehicle Collection
```javascript
{
  _id: ObjectId,
  ownerName: String,
  licenseNumber: String,
  vehicleType: String,
  description: String,
  province: String,
  entryTime: Date,
  exitTime: Date,
  parkingSlot: String,
  parkingStatus: String,  // "Parking" / "Exited"
  driverPhoto: {
    entry: String,        // Image URL
    exit: String
  },
  facialData: Object,
  createdAt: Date
}
```

### CCTV Camera Collection
```javascript
{
  _id: ObjectId,
  name: String,
  ipAddress: String,
  buildingId: ObjectId,
  floorId: ObjectId,
  status: String,        // "Online" / "Offline"
  streamUrl: String,
  lastUpdate: Date,
  configData: Object
}
```

### Staff Collection
```javascript
{
  _id: ObjectId,
  fullName: String,
  username: String,
  password: String,      // Hashed
  role: String,         // "Admin" / "Staff"
  assignedFloor: ObjectId,
  assignedBuilding: ObjectId,
  status: String,       // "Online" / "Offline" / "Disabled"
  createdAt: Date,
  updatedAt: Date
}
```

---

## 11. API Endpoints (Node.js Backend)

### Parking Management
```
GET    /api/parking/buildings
POST   /api/parking/buildings
GET    /api/parking/buildings/:id
PUT    /api/parking/buildings/:id
DELETE /api/parking/buildings/:id

GET    /api/parking/floors/:buildingId
POST   /api/parking/floors
PUT    /api/parking/floors/:id
DELETE /api/parking/floors/:id

GET    /api/parking/slots/:floorId
GET    /api/parking/slots/status/:slotId
PUT    /api/parking/slots/:id
```

### CCTV Management
```
GET    /api/cctv/cameras
POST   /api/cctv/cameras
GET    /api/cctv/cameras/:id
PUT    /api/cctv/cameras/:id
DELETE /api/cctv/cameras/:id
GET    /api/cctv/cameras/:id/stream
```

### Vehicle Tracking
```
GET    /api/vehicles
POST   /api/vehicles/entry
POST   /api/vehicles/exit
GET    /api/vehicles/logs
GET    /api/vehicles/history
```

### Staff Management
```
GET    /api/staff
POST   /api/staff
GET    /api/staff/:id
PUT    /api/staff/:id
DELETE /api/staff/:id
```

### Authentication
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/verify
POST   /api/auth/refresh
```

---

## 12. YOLO Integration (Python Backend)

### Vehicle Detection
- Real-time vehicle detection from CCTV streams
- Bounding box generation
- Vehicle type classification (Cars, Motorcycles, etc.)
- Confidence scoring

### License Plate Recognition
- OCR (Optical Character Recognition)
- License plate extraction from vehicle images
- Database matching with registered vehicles
- Alert generation for unregistered vehicles

### Processing Pipeline
1. Frame capture from CCTV stream
2. YOLO model inference
3. Object detection and classification
4. License plate extraction
5. OCR processing
6. Database validation
7. Alert notification

---

## 13. User Interface Components

### Navigation Sidebar
- Dashboard (Main overview)
- Staff Manager (Personnel management)
- System Setup (Configuration)
- History (Audit logs)

### Color Scheme
- **Primary Red:** #A64253 (Branding)
- **Gold Accent:** #C4A747 (Logo/highlights)
- **Green Action Buttons:** #4CAF50 (Add/Create)
- **Blue Edit Buttons:** #2196F3 (Modify)
- **Status Colors:** 
  - Green: Available/Active/Online
  - Red: Occupied/Offline/Disabled
  - Gray: Unknown/Inactive

### Responsive Design
- Mobile-compatible dashboard
- Tablet optimization
- Desktop full-feature view
- Touch-friendly controls

---

## 14. Permissions & Access Control

### Admin Permissions
- ✅ View all dashboards
- ✅ Manage buildings and floors
- ✅ Configure CCTV systems
- ✅ View all parking logs
- ✅ Manage staff accounts
- ✅ Generate reports
- ✅ System configuration
- ✅ Edit and delete records

### Staff Permissions (Limited)
- ✅ View assigned area dashboard
- ✅ View parking status for assigned floor
- ✅ Record entry/exit manually
- ❌ Cannot modify system setup
- ❌ Cannot manage other staff
- ❌ Cannot delete records

---

## 15. Security Considerations

### Data Protection
- Password hashing (bcrypt or similar)
- JWT token-based authentication
- HTTPS/SSL encryption
- Role-based access control (RBAC)
- Audit logging of all admin actions

### CCTV Security
- Secure IP camera access
- RTSP stream encryption
- IP whitelist management
- Camera credential protection

### Database Security
- MongoDB user authentication
- Collection-level permissions
- Backup and recovery procedures
- Data encryption at rest

---

## 16. Performance & Scalability

### Real-Time Updates
- WebSocket connection for live data
- Real-time slot status updates
- Live CCTV feed streaming
- Push notifications for alerts

### Scalability
- Horizontal scaling for Node.js backend
- MongoDB sharding for large datasets
- Load balancing for CCTV streams
- Caching layer for frequently accessed data

---

## 17. Deployment & Environment

### Development Stack
- **Frontend:** Vue.js 3, Vite, TypeScript
- **Backend:** Node.js, Express.js, MongoDB
- **ML:** Python, YOLO, OpenCV
- **Containerization:** Docker (recommended)
- **CI/CD:** GitHub Actions or similar

### Environment Configuration
- Development environment setup
- Staging/production deployment
- Environment variables management
- Database connection strings

---

## 18. Support & Maintenance

### Regular Maintenance Tasks
- Database optimization
- CCTV camera calibration
- Software updates
- Security patches
- Backup verification

### Troubleshooting Guide
- Camera offline resolution
- Database connection issues
- Authentication problems
- System performance optimization
- Error log analysis

---

## Appendix: UI Screenshots

### Key Screens
1. **Login Screen:** Authentication entry point
2. **Dashboard (Slots):** Parking slot visualization and statistics
3. **Dashboard (CCTV):** Live camera feeds with vehicle detection
4. **Dashboard (Log):** Parking activity history
5. **Parking Setup:** Building and floor configuration
6. **CCTV Setup:** Camera management and configuration
7. **Staff Manager:** Personnel management interface
8. **Staff List:** Overview of all staff members

---

## Document Version
- **Version:** 1.0
- **Last Updated:** June 2026
- **Status:** Active
- **System:** MFU Parking Management System
- **Role:** Admin

---

**For questions or updates to this documentation, please contact the system administrator.**
