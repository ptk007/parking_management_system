# MFU Parking Staff Portal - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### 1. Install Dependencies
```bash
cd parking-front
npm install
```

### 2. Configure Backend API
Edit `.env` file:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### 3. Start Development Server
```bash
npm run dev
```

**Access the app:** http://localhost:5173/

---

## 🔐 Default Login Flow

1. Navigate to `http://localhost:5173/login`
2. Enter username and password (backend provides these)
3. Click "Login"
4. If successful, redirected to `/dashboard`

**Note:** Backend must be running and API must return valid JWT token.

---

## 📱 Dashboard Overview

### Tabs Available
- **Slots** - Parking lot management with visual floor map
- **CCTV** - Live camera feeds (2×2 grid)
- **Log** - Parking activity records with details

### Key Features
- Real-time statistics (Total, Available, Incoming, Occupied, Disabled)
- Building/Floor/Vehicle Type filters
- Slot selection with bulk actions (Edit, Enable, Disable)
- Parking log with vehicle info and facial recognition

### Left Sidebar Navigation
- Dashboard (selected by default)
- History (audit trail)
- Logout button

---

## 💬 Chat Support

**How to Use:**
1. Click red chat button (bottom-right corner)
2. Select "New" tab
3. Enter issue subject and message
4. Click "Send"

**View Existing Tickets:**
1. Click chat button
2. Click "Tickets" tab
3. Select a ticket to view conversation

---

## 📊 Statistics Bar

Real-time parking statistics displayed in filter bar:

| Stat | Color | Meaning |
|------|-------|---------|
| Total Slots | Red | Total capacity |
| Available | Green | Empty slots |
| Incoming | Yellow | Reserved/expected |
| Occupied | Orange | Vehicles parked |
| Disabled | Gray | Out of service |

---

## 🎨 UI Customization

### Colors
Edit `tailwind.config.ts`:
```javascript
colors: {
  'mfu-red': '#A93226',
  'mfu-gold': '#C4A747',
  'parking-green': '#4CAF50',
  // ... more colors
}
```

### Styling
- Global styles: `src/assets/main.css`
- Component styles: `<style scoped>` in `.vue` files
- Tailwind utility classes: Use directly in templates

---

## 📁 Project File Structure Quick Reference

```
Components (Reusable)
└── src/components/
    ├── layout/
    │   ├── Sidebar.vue    ← Navigation
    │   └── TopBar.vue     ← Header
    └── chat/
        └── ChatWidget.vue ← Chat support

Views (Pages)
└── src/views/
    ├── LoginView.vue      ← /login
    ├── DashboardView.vue  ← /dashboard
    └── HistoryView.vue    ← /history

State Management
└── src/stores/
    ├── auth.ts            ← User authentication
    ├── dashboard.ts       ← Parking data
    └── chat.ts            ← Support tickets

Services
└── src/services/
    └── api.ts             ← API calls

Types
└── src/types/
    └── index.ts           ← TypeScript interfaces
```

---

## 🔄 Data Flow Diagram

```
User Action (Click button)
         ↓
Component (.vue file)
         ↓
Store Action (Pinia)
         ↓
API Service (axios)
         ↓
Backend API (Node.js)
         ↓
Database (MongoDB)
         ↓
Response → Store → Component → UI Update
```

---

## 🛠️ Adding a New Feature

### Example: Add "Export Report" Button

**Step 1:** Add method to store (`src/stores/dashboard.ts`)
```javascript
const exportReport = async () => {
  try {
    const response = await apiClient.get('/staff/logs/export', {
      params: { buildingId, floorId },
    })
    // Handle download
  } catch (err) {
    error.value = 'Export failed'
  }
}
```

**Step 2:** Add button to component (`src/views/DashboardView.vue`)
```vue
<button @click="dashboardStore.exportReport" class="px-4 py-2 bg-blue-500...">
  <i class="pi pi-download"></i> Export
</button>
```

**Step 3:** Test in browser
- Navigate to dashboard
- Click new button
- Verify functionality

---

## 🧪 Testing

### Run All Tests
```bash
npm run test:unit      # Unit tests
npm run test:e2e       # E2E tests
npm run lint           # Linting
npm run type-check     # TypeScript check
```

---

## 🐛 Common Debug Tips

### Enable Vue DevTools
- DevTools URL shown in console on startup
- Alt+Shift+D to toggle in browser

### Check Browser Console
- Press F12 → Console tab
- Look for errors or warnings
- Network tab shows API requests

### Verify API Connection
Open browser console:
```javascript
// Check API base URL
console.log(import.meta.env.VITE_API_BASE_URL)

// Test API call
fetch('http://localhost:3000/api/auth/verify')
  .then(r => r.json())
  .then(d => console.log(d))
```

---

## 📚 Documentation Links

- **Full Setup Guide:** [SETUP.md](./SETUP.md)
- **Staff Portal Specs:** [../docs/STAFF_PORTAL.md](../docs/STAFF_PORTAL.md)
- **Vue.js Documentation:** https://vuejs.org
- **Tailwind CSS:** https://tailwindcss.com
- **Pinia State Management:** https://pinia.vuejs.org

---

## 🚢 Production Build

### Build for Production
```bash
npm run build
```

**Output:** `dist/` folder with optimized files ready to deploy

### Deploy to Web Server
```bash
# Copy dist/ folder to server
scp -r dist/* user@server:/var/www/parking-portal/

# Or with Docker
docker build -t parking-portal .
docker run -p 80:80 parking-portal
```

---

## ❓ FAQ

**Q: How do I change the logo?**
A: Update MFU logo references in `Sidebar.vue` and `LoginView.vue`

**Q: Can I use dark mode?**
A: Modify `tailwind.config.ts` to add dark mode or create a theme switcher

**Q: How to add real CCTV feeds?**
A: Replace video feed placeholders with actual RTSP stream URLs

**Q: Where to add new permissions?**
A: Extend `auth.ts` store with role-based checks

**Q: How to modify sidebar navigation?**
A: Edit `Sidebar.vue` component - add/remove router-link items

---

## 📞 Support

- **Chat Widget:** Use in-app support chat
- **Email:** admin@mfu-parking.local
- **Docs:** Check SETUP.md and STAFF_PORTAL.md

---

**Happy Coding! 🎉**

*Last Updated: June 2026*
