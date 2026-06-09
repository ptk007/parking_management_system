# MFU Parking Management - Staff Portal Frontend

This is the Vue.js 3 frontend for the MFU Parking Management System Staff Portal, built following the specifications in `STAFF_PORTAL.md`.

## Project Structure

```
parking-front/
├── src/
│   ├── assets/
│   │   └── main.css              # Tailwind CSS & global styles
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.vue       # Left navigation sidebar
│   │   │   └── TopBar.vue        # Top header bar with user info
│   │   └── chat/
│   │       └── ChatWidget.vue    # Floating chat support widget
│   ├── views/
│   │   ├── LoginView.vue         # Login page
│   │   ├── DashboardView.vue     # Main dashboard (Slots/CCTV/Log tabs)
│   │   └── HistoryView.vue       # Action history page
│   ├── services/
│   │   └── api.ts               # API service layer with Axios
│   ├── stores/
│   │   ├── auth.ts              # Authentication store (Pinia)
│   │   ├── dashboard.ts         # Dashboard data store (Pinia)
│   │   └── chat.ts              # Chat/support store (Pinia)
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces
│   ├── router/
│   │   └── index.ts             # Vue Router configuration
│   ├── App.vue                  # Root component
│   └── main.ts                  # App entry point
├── .env                         # Environment variables (dev)
├── .env.development             # Development environment config
├── .env.production              # Production environment config
├── tailwind.config.ts           # Tailwind CSS configuration
├── postcss.config.js            # PostCSS configuration
└── package.json                 # Dependencies and scripts
```

## Tech Stack

- **Vue.js 3** - Progressive JavaScript framework
- **Vue Router 5** - Client-side routing
- **Pinia 3** - State management
- **Axios** - HTTP client for API calls
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Static type checking
- **Vite 8** - Build tool and dev server
- **PrimeVue** - UI component library (icons)
- **Lucide Vue** - Icon library (optional)

## Installation & Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### 1. Install Dependencies

```bash
cd parking-front
npm install
```

### 2. Environment Configuration

Create or update `.env` file with your backend API URL:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### 3. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm preview

# Type check TypeScript
npm run type-check

# Run unit tests
npm run test:unit

# Run end-to-end tests
npm run test:e2e

# Run linting
npm run lint

# Format code
npm run format
```

## Features Implemented

### 1. Authentication ✅
- Login page with username/password
- JWT token management
- Session persistence (localStorage)
- Protected routes

### 2. Layout Components ✅
- **Sidebar Navigation** - Fixed left sidebar with MFU branding
  - Dashboard link
  - History link
  - Logout button
- **Top Bar** - Header with user info and notifications
  - User full name and initials
  - Online status indicator
  - Notification bell with unread count
  - User avatar

### 3. Dashboard ✅
Three tabs for staff operations:

#### Slots Tab
- Parking floor map visualization (placeholder)
- Real-time slot status display
  - Green: Available
  - Red: Occupied
  - Gray: Disabled
- Slot selection with bulk actions
- Action buttons: Edit, Enable, Disable

#### CCTV Tab
- 2×2 grid of camera feeds
- Camera status indicators (Live/Offline)
- Real-time streaming placeholders
- Camera information (IP, status, timestamp)

#### Log Tab
- Parking activity records
- Vehicle information display
  - Owner name
  - License number
  - Province
  - Vehicle description
- Time and location info
  - Entry/exit times
  - Parking duration
  - Slot assignment
- Parking status indicators
  - Orange: Parking (currently parked)
  - Red: Exited (departed)
  - Gray: Not Parking (invalid)
- Face recognition placeholders

### 4. Shared Features
- **Filter Bar** - Building, Floor, and Vehicle Type filters
- **Statistics Bar** - Real-time parking statistics
  - Total slots
  - Available slots
  - Incoming vehicles
  - Occupied slots
  - Disabled slots

### 5. History Page ✅
- Audit trail of staff actions
- Shows parking management modifications:
  - Staff name
  - Building and floor
  - Affected slots
  - Date/time of action
  - Status change (Enable/Disable)
- Chronologically sorted entries

### 6. Chat Support System ✅
- Floating chat button (bottom-right corner)
- Unread message badge
- Chat panel with two views:
  - **Ticket List** - View all support conversations
  - **Create New** - Submit new support ticket
- Ticket management:
  - Open/Done status indicators
  - Quick reply buttons
  - Message thread display

## State Management (Pinia)

### auth.ts - Authentication Store
```javascript
// Methods
login(username, password)      // Authenticate user
logout()                       // Clear session
verifyToken()                  // Check token validity
initFromStorage()              // Load session from localStorage

// State
user: User                     // Current user object
token: string                  // JWT token
isAuthenticated: boolean       // Auth status
isLoading: boolean            // Loading state
error: string                 // Error messages
```

### dashboard.ts - Dashboard Store
```javascript
// Methods
loadStats()                    // Fetch dashboard statistics
loadSlots()                    // Load parking slots
loadLogs()                     // Load parking logs
loadCameras()                  // Load CCTV cameras
toggleSlotSelection(slotId)    // Select/deselect slot
updateSlotStatus(slotId, status) // Update slot status

// State
stats: DashboardStats         // Parking statistics
slots: ParkingSlot[]          // Parking slot data
logs: ParkingLog[]            // Parking activity logs
cameras: CCTVCamera[]         // CCTV camera list
selectedSlots: Set<string>    // Selected slot IDs
filters: {
  building: string
  floor: string
  vehicleType: string
}
```

### chat.ts - Chat Support Store
```javascript
// Methods
loadTickets()                 // Fetch all tickets
loadTicket(ticketId)          // Load specific ticket
createTicket(subject, message) // Create new support ticket
sendMessage(ticketId, message) // Send message to ticket
updateTicketStatus(ticketId, status) // Close/open ticket

// State
tickets: ChatTicket[]         // List of tickets
currentTicket: ChatTicket     // Selected ticket
unreadCount: number           // Unread message count
isOpen: boolean               // Chat panel visibility
```

## API Service Layer

All API calls go through `services/api.ts` which provides:

- Automatic JWT token injection in request headers
- Centralized error handling
- Base URL configuration
- Response/request interceptors

### Available API Services

```javascript
// Authentication
authService.login(username, password)
authService.logout()
authService.verifyToken()

// Dashboard
dashboardService.getStats(building, floor, vehicle)

// Parking Management
parkingService.getSlots(building, floor)
parkingService.updateSlot(slotId, status)
parkingService.getLogs(building, floor, vehicle)

// CCTV
cctvService.getCameras(building, floor)
cctvService.getStreamUrl(cameraId)
cctvService.getSnapshot(cameraId)

// Chat/Support
chatService.getTickets()
chatService.getTicket(ticketId)
chatService.createTicket(subject, message)
chatService.sendMessage(ticketId, message)
chatService.updateTicketStatus(ticketId, status)

// History
historyService.getHistory(dateRange?)

// Staff Profile
staffService.getProfile()
staffService.getAssignedArea()
```

## UI Design System

### Color Palette
```css
--mfu-red: #A93226;
--mfu-gold: #C4A747;
--parking-green: #4CAF50;
--parking-orange: #FF9800;
--parking-yellow: #FFC107;
--parking-gray: #9E9E9E;
```

### Typography
- **Headings:** Bold, large font size
- **Labels:** Medium weight, uppercase
- **Body Text:** Regular weight, readable line spacing
- **Buttons:** Medium weight, clear CTA text

### Layout
- **Sidebar Width:** 160px (fixed)
- **Responsive Design:**
  - Mobile: Hamburger menu, stacked layout
  - Tablet: 2-column grids
  - Desktop: Full-width, 2×2 camera grid

## TypeScript Interfaces

All types are defined in `src/types/index.ts`:

```typescript
interface User { ... }           // Staff member
interface AuthResponse { ... }   // Login response
interface ParkingSlot { ... }    // Parking slot data
interface ParkingLog { ... }     // Entry/exit record
interface CCTVCamera { ... }     // Camera information
interface DashboardStats { ... } // Statistics
interface ChatTicket { ... }     // Support ticket
interface HistoryEntry { ... }   // Action history
```

## Routing

### Routes Configured

```javascript
/login              → LoginView (public)
/dashboard          → DashboardView (protected)
/history            → HistoryView (protected)
/                   → Redirects to /dashboard
```

### Route Protection

Routes are protected by checking authentication status in:
- `App.vue` - Redirects unauthenticated users to login
- Router guards can be added for granular control

## Development Workflow

### 1. Create New Page
```javascript
// Create view file: src/views/MyView.vue
// Add route to src/router/index.ts
// Link from navigation component
```

### 2. Add New Store
```javascript
// Create in src/stores/mystore.ts
// Use defineStore() from Pinia
// Import and use in components with useMyStore()
```

### 3. Add API Endpoint
```javascript
// Add method to src/services/api.ts
// Use in store actions
// Call store action from component
```

### 4. Create Component
```javascript
// Components in src/components/
// Reusable across multiple views
// Import and use with <MyComponent />
```

## Testing

### Unit Tests
```bash
npm run test:unit
```

Test files: `src/__tests__/*.spec.ts`

### E2E Tests
```bash
npm run test:e2e
```

Test files: `e2e/*.spec.ts`

## Build & Deployment

### Production Build
```bash
npm run build
```

Output: `dist/` directory with optimized static files

### Preview Production Build
```bash
npm run preview
```

### Deploy Options
- **Static Hosting:** Netlify, Vercel, GitHub Pages
- **Docker:** Create Dockerfile for containerization
- **Web Server:** Nginx, Apache (configure for SPA routing)

## Troubleshooting

### Common Issues

**Issue:** "Failed to resolve ..."
- Solution: Clear node_modules and reinstall
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

**Issue:** Port 5173 already in use
- Solution: Change port or kill process using it
  ```bash
  npm run dev -- --port 3000
  ```

**Issue:** API requests failing (CORS)
- Solution: Ensure backend allows CORS or use proxy

**Issue:** Tailwind styles not applying
- Solution: Rebuild CSS or restart dev server
  ```bash
  npm run dev
  ```

## Performance Optimization

- **Lazy Loading:** Components load only when needed
- **Code Splitting:** Automatic by Vite
- **Image Optimization:** Use WebP for CCTV feeds
- **Caching:** Browser caches for static assets
- **CDN:** Serve assets from CDN in production

## Security Best Practices

- ✅ JWT tokens for authentication
- ✅ HTTPS/SSL in production
- ✅ Secure password handling (never stored locally)
- ✅ XSS protection via Vue's auto-escaping
- ✅ CSRF token in requests (if needed)
- ✅ Rate limiting on backend
- ✅ Input validation and sanitization

## Browser Support

- Chrome/Edge: Latest versions
- Firefox: Latest versions
- Safari: Latest versions
- Mobile browsers: iOS Safari, Chrome for Android

## Environment Variables Reference

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api    # Backend API URL
VITE_WS_URL=ws://localhost:3000                # WebSocket URL for real-time

# Deployment
VITE_APP_NAME=MFU Parking Management           # App name
VITE_APP_VERSION=1.0.0                         # App version
```

## Contributing

1. Follow existing code style and structure
2. Use TypeScript for type safety
3. Create components in appropriate folders
4. Update documentation when adding features
5. Run tests before committing
6. Use meaningful commit messages

## License

Copyright © 2026 MFU. All rights reserved.

## Support

For issues or questions:
1. Check this README
2. Review STAFF_PORTAL.md documentation
3. Contact development team
4. Submit issue via chat support widget

---

**Last Updated:** June 2026
**Version:** 1.0.0
**Status:** Active Development
