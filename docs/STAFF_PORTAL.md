# MFU Parking Management System - Staff Portal Documentation

## Overview
The Staff Portal in the MFU Parking Management System provides parking attendants with essential tools to monitor assigned parking facilities, track vehicle activities, manage parking slots, view CCTV feeds, and communicate with support through a dedicated chat system. Staff members have limited permissions compared to admins and can only view and manage their assigned building and floor.

---

## System Architecture

### Tech Stack
- **Frontend:** Vue.js 3 (Modern reactive UI framework)
- **Backend:** Node.js (Express.js for API endpoints)
- **Database:** MongoDB (Replaced from PostgreSQL for flexibility)
- **AI/ML:** Python with YOLO (Vehicle detection and license plate recognition)

---

## Staff Portal Features Overview

### Permissions & Scope
- **View Access:** Limited to assigned building and floor only
- **Can:** Monitor parking status, view CCTV feeds, access parking logs, manage slot status manually
- **Cannot:** Modify system configuration, manage other staff, delete records, create buildings/floors
- **Status:** Online/Offline visibility for admin tracking

---

## 1. Authentication & Login

### Login Page

**Route:** `/login`

#### Layout
- Full-page background: MFU Red (#A93226)
- Centered login card with transparent/blended background
- MFU golden emblem logo: Top-right corner
- App branding icon: Center above title

#### Login Form Elements
| Element | Details |
|---|---|
| App Icon | Rounded square badge with golden car icon and "MFU Parking" label |
| Title | "MFU Parking Management" in gold/orange, large bold font |
| Username Field | Light gray rounded input, placeholder: "Username" |
| Password Field | Light gray rounded input, placeholder: "Password" (masked) |
| Login Button | Light gray rounded button, label: "Login" |

#### Authentication Features
- Form validation (both fields required)
- Error messaging for invalid credentials
- Session management with JWT tokens
- Automatic redirect to dashboard on successful login
- Secure password handling (never stored in plain text)

---

## 2. Main Dashboard Layout

### Sidebar Navigation (Left Panel)

**Position:** Fixed, left side
**Width:** ~160px
**Background:** MFU Red (#A93226)

#### Navigation Items
| Item | Icon | Details |
|---|---|---|
| Dashboard | Monitor/Screen | Default view, redirects to `/dashboard/slots` |
| History | Clock/History | Access audit trail at `/history` |

#### Active State
- Selected item: White background with red text and icon
- Provides clear visual feedback of current location

#### Logo
- MFU golden emblem at top of sidebar
- Links to dashboard on click

### Top Bar (Header)

**Position:** Fixed, across top
**Content Layout:** Title (left) → Status (right)

#### Left Section
| Element | Content |
|---|---|
| Title | "MFU Parking Management" |
| Subtitle | Staff member name (e.g., "Thanatip P.") |

#### Right Section
| Element | Details |
|---|---|
| Online Status | Green dot (●) with "Online" text |
| Notifications | Bell icon with unread badge count |
| Profile Avatar | Circular avatar with staff initials (e.g., "TP") |

### Tab Navigation

**Position:** Below top bar
**Active Tab Indicator:** Red/pink background with red text

Three main tabs available:

1. **Slots Tab** (`/dashboard/slots`)
   - Parking lot management and visualization
   - Slot status and selection tools

2. **CCTV Tab** (`/dashboard/cctv`)
   - Live camera feeds from assigned area
   - Real-time vehicle detection feeds

3. **Log Tab** (`/dashboard/log`)
   - Parking entry/exit records
   - Vehicle history and tracking

---

## 3. Filter Bar (Shared Across All Tabs)

### Filter Controls

Located below tab navigation, required filters marked with asterisk (*):

| Filter | Type | Options | Example |
|---|---|---|---|
| Building * | Dropdown | Assigned building(s) | E4 |
| Floor * | Dropdown | Floors in selected building | 4 |
| Vehicle * | Dropdown | Vehicle types | Cars, Motorcycles |

**Note:** Building is pre-populated based on staff assignment; staff can only see their assigned building.

---

## 4. Dashboard Statistics Bar

**Position:** Right side of filter bar
**Layout:** Five stat boxes displayed horizontally

### Statistics Displayed

| Stat | Color | Details |
|---|---|---|
| Total Slots | Red (#A93226) | Total parking capacity of selected building/floor |
| Available | Green (#4CAF50) | Unoccupied parking slots |
| Incoming | Yellow/Orange (#FFC107) | Vehicles expected to enter (reservation system) |
| Occupied | Orange (#FF9800) | Currently parked vehicles |
| Disabled | Gray (#9E9E9E) | Out-of-service or maintenance slots |

### Example Values
- Total: 124 slots
- Available: 47 slots
- Incoming: 6 vehicles
- Occupied: 74 vehicles
- Disabled: 3 slots

---

## 5. Slots Tab

**Route:** `/dashboard/slots`

### Parking Map Visualization

#### Layout Components
- Full-width floor plan image/diagram
- Overlaid colored slot indicators
- Directional flow arrows (salmon/pink color)
- Entry/Exit markers and row labels

#### Slot Status Colors
| Color | Status | Meaning |
|---|---|---|
| 🟩 Green | Available | Ready for parking |
| 🟥 Red | Occupied | Vehicle currently parked |
| 🟦 Blue | Selected | User has selected this slot |
| ⬜ Gray | Disabled | Slot out of service |

#### Floor Map Details (E4, Floor 4 Example)
- **Building:** E4 (5 floors total)
- **Floor:** 4
- **Layout:** Rows A–F on right edge
- **Slot Numbering:** 1–124 (sequential, color-coded)
- **Traffic Flow:** One-way arrows showing vehicle direction
- **Entry/Exit Points:** Marked as "in", "out", "up", "down"

#### Slot Selection Interface
- Click individual slot to select/deselect
- Visual checkmark indicator on selected slots
- **Selecting Counter:** Bottom display shows "Selecting : N" (count of selected)

#### Action Buttons (Bottom Bar)
Three buttons available for bulk slot management:

| Button | Color | Action |
|---|---|---|
| Edit | Blue (#2196F3) | Modify selected slot properties |
| Enable | Green (#4CAF50) | Mark selected slots as available |
| Disable | Red (#A93226) | Mark selected slots as out-of-service |

### Use Cases
- **Manual Slot Adjustment:** Staff can enable/disable specific slots if system detection fails
- **Maintenance Management:** Mark slots as disabled during maintenance
- **Capacity Control:** Temporarily reduce capacity for special events

---

## 6. CCTV Tab

**Route:** `/dashboard/cctv`

### Camera Feed Layout

**Grid Configuration:** 2×2 responsive grid (4 cameras per view)

#### Camera Feed Card Structure

Each card contains:

| Section | Content |
|---|---|
| **Header** | Camera label (e.g., "Enter", "Exit", "Floor4 B6", "Floor4 C3") |
| **Status Badge** | 🔴 "Live" indicator (red dot + text, top-right) |
| **Video Feed** | Live CCTV stream or snapshot image |
| **Timestamp** | Overlay on feed (e.g., "03-05-2026 Sun 00:44:46") |
| **License Plate** | Detected plate number overlay (e.g., "B-4CB17") |

### CCTV Features
- **Real-Time Streaming:** RTSP/WebRTC stream from cameras
- **Vehicle Detection:** YOLO AI highlights detected vehicles
- **Bounding Boxes:** Yellow/colored boxes around detected vehicles
- **Plate Recognition:** Automatic license plate detection and display
- **Multi-Camera Support:** Up to 4 simultaneous feeds displayed
- **Responsive Grid:** Adapts to screen size (mobile: 1×1, tablet: 1×2, desktop: 2×2)

### Camera Types Available

| Camera | Location | Purpose |
|---|---|---|
| Enter | Entrance/Exit gate | Vehicle entry tracking |
| Exit | Exit gate/ramp | Vehicle departure tracking |
| Floor4 B6 | Floor level | General parking area monitoring |
| Floor4 C3 | Floor level | General parking area monitoring |

---

## 7. Log Tab

**Route:** `/dashboard/log`

### Warning Banner
- Background: Yellow/Orange (#FFF3CD)
- Text: "Exited car log will reset after 24 hours" (in red)
- Display: Always visible at top of tab

### Parking Log Entry Cards

#### Card Layout Structure
Each parking entry displays in a card format with four sections:

#### Left Section: Vehicle Information
| Field | Example | Details |
|---|---|---|
| Name | Mrs. Wilayporn Nonsila | Owner/driver name |
| License Number | กง 1234 | License plate, Thai format |
| Province | เชียงราย | Province/region of registration |
| Vehicle Description | Black Toyota Fortuner | Make, Model, Color |

#### Center-Left Section: Time & Location Information
| Field | Example | Details |
|---|---|---|
| Date | 12/08/2569 | Parking date (Buddhist calendar) |
| Parking Time | 12:00:34 | Entry time with seconds |
| Exit Time | - | Exit time (dash if still parking) |
| Parking Slot | 10 | Assigned slot number |
| Parking Status | Parking | Current status with color coding |

#### Right Section: Face Recognition Data
- **Label:** "Face Driver"
- **Two Photo Sections:**
  - **Entered:** Driver face photo captured at entry
  - **Exited:** Driver face photo captured at exit
- **Placeholder Avatars:** Gray person icons if photo unavailable

#### Vehicle Icon
- Car icon on left of card
- Visual identifier for vehicle type

### Parking Status Types & Colors
| Status | Color | Meaning |
|---|---|---|
| Parking | Orange (#FF9800) | Vehicle currently parked |
| Exited | Red (#A93226) | Vehicle has departed |
| Not Parking | Gray (#9E9E9E) | Invalid or failed entry |

### Log Features
- **Automatic 24-Hour Reset:** Exited vehicle logs removed after 24 hours
- **Real-Time Updates:** New entries appear immediately
- **Filtering:** Filter by building, floor, and vehicle type from filter bar
- **Search Capability:** Find specific vehicles by license plate or owner name
- **Export Option:** Download log data for reporting

---

## 8. History Page

**Route:** `/history`

### Page Layout
- White content area with card-based list view
- No tabs — simplified list view of all staff actions
- Sidebar and top bar consistent with main layout

### History Entry Card

Each card displays staff's parking management action with the following fields:

| Field | Example | Details |
|---|---|---|
| Staff Name | Thanathip Pitaksin | Who performed the action |
| Building | E4 | Building identifier |
| Floor | 4 | Floor number |
| Parking Slot(s) | 120, 121, 122, 123 | Slots affected by action (comma-separated) |
| Date Edited | 11/4/2569 | Date action was performed |
| Time Edited | 13:00:23 | Time action was performed |
| Status Changed To | Disable / Enable | New status applied (color-coded) |

### Status Indicators
| Status | Color | Meaning |
|---|---|---|
| Enable | Green (#4CAF50) | Slots made available for parking |
| Disable | Red (#A93226) | Slots marked out-of-service |

### History Features
- **Audit Trail:** Complete record of all staff actions
- **Chronological Order:** Entries sorted by newest first
- **Search & Filter:** Find specific actions by date or staff member
- **Export:** Download history for compliance reporting

---

## 9. Support Chat System

### Chat Widget (Floating Button)

**Position:** Bottom-right corner, fixed
**Design:** Red circular button with chat icon
**Badge:** Shows unread message count (e.g., "3")

### Chat Panel

#### Chat List View

Shows all open support tickets/conversations:

| Column | Details |
|---|---|
| Avatar/Initials | Circle with staff initials (e.g., "EN", "TP") |
| Name & Message Preview | Support staff name + message snippet |
| Timestamp | Time since message (e.g., "3h", "4h", "5h") |
| Status Badge | "Open" (red) or "Done" (gray) |

#### Chat Detail View

**Header:**
- Ticket info: "Today Euro — Ticket#1234"
- Back button to return to list

**Message Thread:**
- Left-aligned bubbles: User/customer messages
- Right-aligned bubbles: Staff replies (e.g., "TP" avatar)
- Timestamp on each message

**Quick Reply Buttons:**
- Pre-defined responses: "Fixed!" (multiple buttons)
- Speed up common resolutions

**Input Section:**
- Text field: "Reply to [Name]..."
- Send button: Red arrow icon
- Attach file option (optional)

### Chat Features
- **Real-Time Messaging:** Instant message delivery
- **Ticket System:** Track issues with ticket numbers
- **Status Tracking:** Open/Done status for each ticket
- **Unread Badges:** Visual indicator of new messages
- **Quick Responses:** Predefined replies for efficiency

---

## 10. Real-Time Notifications

### Notification Types
- New vehicle entry alert
- Camera offline notification
- Slot capacity warning
- Urgent parking issues
- Admin assignments

### Notification Delivery
- In-app notifications (bell icon in top bar)
- Badge counter showing unread count
- Click bell to view notifications list

---

## 11. Data Models (MongoDB)

### ParkingLog Collection
```javascript
{
  _id: ObjectId,
  staffId: ObjectId,           // Assigned staff member
  buildingId: ObjectId,
  floorId: ObjectId,
  ownerName: String,           // Vehicle owner
  licenseNumber: String,
  province: String,
  vehicleDescription: String,
  entryTime: Date,
  exitTime: Date,              // Null if still parking
  parkingSlot: String,
  parkingStatus: String,       // "Parking" / "Exited" / "Not Parking"
  faceRecognition: {
    entryPhoto: String,        // Image URL
    exitPhoto: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### SlotStatusLog Collection
```javascript
{
  _id: ObjectId,
  staffId: ObjectId,           // Staff who made the change
  buildingId: ObjectId,
  floorId: ObjectId,
  slotNumbers: [String],       // Array of affected slots
  previousStatus: String,
  newStatus: String,           // "Available" / "Disabled" / "Occupied"
  reason: String,              // Edit reason
  action: String,              // "Enable" / "Disable" / "Edit"
  timestamp: Date,
  createdAt: Date
}
```

### ChatTicket Collection
```javascript
{
  _id: ObjectId,
  ticketNumber: String,        // Unique ticket ID
  staffId: ObjectId,           // Staff who opened ticket
  assignedSupport: ObjectId,   // Support staff assigned
  subject: String,
  messages: [{
    sender: ObjectId,
    senderType: String,        // "staff" or "support"
    message: String,
    attachments: [String],
    timestamp: Date
  }],
  status: String,              // "Open" / "Done"
  priority: String,            // "Normal" / "High" / "Urgent"
  createdAt: Date,
  resolvedAt: Date
}
```

---

## 12. API Endpoints (Node.js Backend)

### Dashboard Data
```
GET    /api/staff/dashboard
  Query: { building, floor, vehicleType }
  Response: { totalSlots, available, incoming, occupied, disabled }

GET    /api/staff/parking/slots
  Query: { buildingId, floorId }
  Response: Array of slot objects with status

PUT    /api/staff/parking/slots/:id
  Body: { status, action }
  Response: Updated slot object
```

### CCTV Feeds
```
GET    /api/staff/cctv/cameras
  Query: { buildingId, floorId }
  Response: Array of camera objects

GET    /api/staff/cctv/cameras/:id/stream
  Response: RTSP stream URL or WebRTC endpoint

GET    /api/staff/cctv/cameras/:id/snapshot
  Response: Latest camera snapshot image
```

### Parking Logs
```
GET    /api/staff/logs
  Query: { buildingId, floorId, vehicleType, dateRange }
  Response: Array of parking log entries

GET    /api/staff/logs/:id
  Response: Single log entry with full details

POST   /api/staff/logs
  Body: { manual entry data }
  Response: Created log entry
```

### History & Audit
```
GET    /api/staff/history
  Query: { dateRange, staffId }
  Response: Array of action history entries

GET    /api/staff/history/slots/:id
  Response: Slot modification history
```

### Chat/Support
```
GET    /api/staff/chat/tickets
  Response: Array of open tickets

GET    /api/staff/chat/tickets/:id
  Response: Ticket details with message thread

POST   /api/staff/chat/tickets
  Body: { subject, message }
  Response: Created ticket

POST   /api/staff/chat/messages/:ticketId
  Body: { message, attachments }
  Response: New message object

PUT    /api/staff/chat/tickets/:id
  Body: { status }
  Response: Updated ticket
```

### Staff Profile
```
GET    /api/staff/profile
  Response: Current staff member profile

GET    /api/staff/profile/assigned-area
  Response: { building, floor, assignedSlots }

PUT    /api/staff/profile
  Body: { password, preferences }
  Response: Updated profile
```

---

## 13. Security & Access Control

### Authentication
- Username/password login with JWT tokens
- Session expiration after 30 minutes of inactivity
- Automatic logout on session expiration
- Secure password storage (bcrypt hashing)

### Authorization
- Role-based access control (RBAC)
- Staff can only view assigned building/floor
- Cannot access other staff's areas
- Cannot modify system configuration
- Cannot delete records (only admins)

### Data Protection
- HTTPS/SSL encryption for all API calls
- Sensitive data masked in UI (passwords, sensitive phone numbers)
- Audit logging of all staff actions
- Database encryption at rest

---

## 14. Real-Time Features

### WebSocket Integration
- Live slot status updates
- Real-time CCTV feeds
- Instant chat notifications
- Push notifications for alerts

### Live Dashboard Updates
- Automatic refresh of slot statuses (5-10 second intervals)
- Real-time parking log entries
- Incoming vehicle alerts
- Camera offline notifications

---

## 15. Responsive Design

### Mobile Support (< 576px)
- Single column layout for tabs
- Stacked filter controls
- 1×1 camera grid (CCTV)
- Larger touch targets for slots

### Tablet Support (576px - 992px)
- Two-column layout where appropriate
- Horizontal filter bar
- 1×2 camera grid (CCTV)
- Responsive slot map

### Desktop Support (> 992px)
- Full-width layouts
- 2×2 camera grid (CCTV)
- Complete feature set
- Optimized spacing and typography

---

## 16. UI Components & Styling

### Color Palette
| Purpose | Color | Hex Value |
|---|---|---|
| Primary | MFU Red | #A93226 |
| Success/Available | Green | #4CAF50 |
| Warning/Occupied | Orange | #FF9800 |
| Danger/Disabled | Red | #A93226 |
| Info/Incoming | Yellow | #FFC107 |
| Disabled | Gray | #9E9E9E |
| Gold Accent | Gold | #C4A747 |
| Text Primary | Dark Gray | #333333 |
| Background | Light Gray | #F5F5F5 |

### Typography
- **Headings:** Bold, larger font size
- **Labels:** Medium weight, uppercase
- **Body Text:** Regular weight, readable line spacing
- **Buttons:** Medium weight, clear call-to-action text

### Form Controls
- Rounded corners (4-8px border radius)
- Light gray background for inputs
- Clear placeholder text
- Focus state with blue outline
- Error state with red text

---

## 17. Performance & Optimization

### Frontend Optimization
- Vue.js lazy loading for components
- Image optimization for CCTV feeds
- CSS/JavaScript minification
- Browser caching for static assets

### Backend Optimization
- Database indexing for quick queries
- API rate limiting to prevent abuse
- Response caching for frequently accessed data
- Pagination for large datasets

### Real-Time Optimization
- WebSocket connection pooling
- Message compression
- Efficient video streaming (RTSP/HLS)
- CDN for image delivery

---

## 18. Error Handling

### Common Error Scenarios

| Error | Message | Action |
|---|---|---|
| Authentication Failed | "Invalid username or password" | Retry login |
| Session Expired | "Your session has expired. Please login again" | Redirect to login |
| Camera Offline | "Camera currently offline" | Gray status indicator |
| No Data | "No parking records found" | Display empty state |
| Network Error | "Connection lost. Please check your internet" | Retry mechanism |

### User Feedback
- Toast notifications for quick messages
- Modal dialogs for important confirmations
- Inline error messages for form validation
- Loading spinners for long operations

---

## 19. Deployment & Environment

### Development Stack
- **Frontend:** Vue.js 3, Vite, TypeScript
- **Backend:** Node.js, Express.js, MongoDB
- **Real-Time:** WebSocket (Socket.io)
- **Video Streaming:** RTSP/WebRTC/HLS

### Deployment Options
- Docker containerization
- Kubernetes orchestration (optional)
- CI/CD pipeline (GitHub Actions)
- Environment-based configuration

### Environment Variables
```
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
MONGODB_URI=mongodb://localhost:27017/parking
JWT_SECRET=your_secret_key
CCTV_STREAM_URL=rtsp://camera_ip:554/stream
```

---

## 20. Support & Maintenance

### Common Support Issues
- Login problems (password reset)
- Camera feed not loading (camera check)
- Slow dashboard (performance optimization)
- Chat ticket creation issues

### Maintenance Tasks
- Database optimization
- Camera calibration
- System updates
- Security patches
- Log cleanup (24-hour reset)

### Training Requirements
- Dashboard navigation
- Slot management procedures
- Chat support usage
- Emergency procedures
- System troubleshooting

---

## Appendix: UI Screenshots

### Key Staff Portal Screens

1. **Login Screen**
   - Red background with centered card
   - MFU logo and branding
   - Username/password inputs
   - Login button

2. **Dashboard - Slots Tab**
   - Parking map with colored slot overlays
   - Filter controls (Building, Floor, Vehicle)
   - Statistics bar (Total, Available, Incoming, Occupied, Disabled)
   - Slot selection with action buttons (Edit, Enable, Disable)
   - Chat widget (bottom-right)

3. **Dashboard - CCTV Tab**
   - 2×2 grid of camera feeds
   - Live indicators on each camera
   - Timestamp overlays
   - License plate detection overlays
   - Real-time vehicle detection

4. **Dashboard - Log Tab**
   - Warning banner about 24-hour reset
   - Vehicle log entry cards
   - Owner information display
   - Parking time and slot details
   - Face recognition photos

5. **History Page**
   - List of staff actions
   - Audit trail entries
   - Status change indicators
   - Date/time of modifications

6. **Chat Support**
   - Floating chat button with badge
   - Chat list view with conversations
   - Chat detail view with messages
   - Quick reply buttons

---

## Workflow Examples

### Typical Staff Workday

1. **Login:** Staff member logs in with credentials
2. **Dashboard Check:** Reviews current parking status for assigned floor
3. **Slot Monitoring:** Watches CCTV feeds for entry/exit
4. **Manual Adjustments:** Disables slots for maintenance if needed
5. **Log Review:** Checks parking log for any irregularities
6. **Support Chat:** Responds to visitor inquiries through chat
7. **History Review:** Checks action history at end of shift
8. **Logout:** Signs out at end of shift

### Emergency Procedures
- **Camera Offline:** Immediate alert to admin via chat
- **System Issues:** Use support chat to contact admin
- **Capacity Reached:** Manual slot management to add/remove capacity
- **Invalid Entry:** Mark as "Not Parking" in log

---

## Document Version
- **Version:** 1.0
- **Last Updated:** June 2026
- **Status:** Active
- **System:** MFU Parking Management System
- **Role:** Staff Portal

---

**For questions or updates to this documentation, please contact the system administrator.**
