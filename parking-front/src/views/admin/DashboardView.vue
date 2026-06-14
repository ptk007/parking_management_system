<template>
  <div class="admin-dashboard">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-circle">
          <img :src="mfuLogo" alt="MFU Logo" class="logo-img" />
        </div>
        <h2>MFU Parking</h2>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          @click="adminStore.activeTab = item.id"
          :class="['nav-item', { active: adminStore.activeTab === item.id }]"
        >
          <component :is="item.icon" class="nav-icon" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar-user">
        <div class="user-avatar">{{ authStore.user?.avatar }}</div>
        <div class="user-info">
          <p class="user-name">{{ authStore.user?.fullName }}</p>
          <p class="user-role">{{ authStore.user?.role }}</p>
        </div>
        <button @click="handleLogout" class="logout-btn" title="Logout">
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <!-- Header -->
      <div class="header">
        <div class="header-title">
          <h1>{{ activeTabLabel }}</h1>
          <p>{{ adminStore.buildingFilter }} - Floor {{ adminStore.floorFilter }}</p>
        </div>
        <div class="header-status">
          <span class="online-indicator"></span>
          <span>Online</span>
        </div>
      </div>

      <!-- Filters & Stats (for Slots and CCTV) -->
      <div v-if="['slots', 'cctv'].includes(adminStore.activeTab)" class="filters-section">
        <div class="filters">
          <div class="filter-group">
            <label>Building *</label>
            <select v-model="adminStore.buildingFilter" class="filter-select">
              <option value="E4">E4</option>
              <option value="E5">E5</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Floor *</label>
            <select v-model="adminStore.floorFilter" class="filter-select">
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Vehicle *</label>
            <select v-model="adminStore.vehicleFilter" class="filter-select">
              <option value="Cars">Cars</option>
              <option value="Motorcycle">Motorcycle</option>
            </select>
          </div>
        </div>

        <div class="stats">
          <div v-for="stat in adminStats" :key="stat.label" class="stat-card">
            <span class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </div>

      <!-- Content Sections -->
      <div class="content">
        <!-- Slots Tab -->
        <div v-if="adminStore.activeTab === 'slots'" class="tab-content">
          <div class="slots-container">
            <!-- Parking Map -->
            <div class="parking-map">
              <div class="map-heading">
                <span></span>
                <strong>{{ adminStore.buildingFilter }}</strong>
                <span></span>
              </div>

              <div class="gate-label out">out</div>
              <div class="gate-label in">in</div>
              <div class="gate-label up">up</div>
              <div class="gate-label down">down</div>

              <div v-for="row in rowLabels" :key="row.label" class="row-label" :style="{ top: row.top }">
                {{ row.label }}
              </div>

              <svg class="flow-lines" viewBox="0 0 1000 520" aria-hidden="true">
                <defs>
                  <marker id="admin-flow-arrow" markerHeight="10" markerWidth="10" orient="auto" refX="8" refY="5">
                    <path d="M0,0 L10,5 L0,10 Z" fill="rgba(255, 167, 145, 0.72)" />
                  </marker>
                </defs>
                <path d="M95 140 C160 205, 220 165, 245 165" marker-end="url(#admin-flow-arrow)" />
                <path d="M320 170 C390 168, 430 168, 485 168" marker-end="url(#admin-flow-arrow)" />
                <path d="M555 165 C630 160, 705 160, 760 166" marker-end="url(#admin-flow-arrow)" />
                <path d="M895 160 C960 200, 960 285, 900 312" marker-end="url(#admin-flow-arrow)" />
                <path d="M790 305 C700 302, 630 300, 535 306" marker-end="url(#admin-flow-arrow)" />
                <path d="M455 306 C360 310, 265 306, 165 308" marker-end="url(#admin-flow-arrow)" />
                <path d="M70 310 C40 260, 44 210, 78 170" marker-end="url(#admin-flow-arrow)" />
                <path d="M675 400 C660 350, 665 325, 700 302" marker-end="url(#admin-flow-arrow)" />
                <path d="M905 315 C928 415, 810 455, 705 420" marker-end="url(#admin-flow-arrow)" />
              </svg>

              <button
                v-for="slot in parkingSlots"
                :key="slot.slotNumber"
                :class="[
                  'slot',
                  slotStatusClass(slot.slotNumber),
                  { selected: selectedSlots.has(slot.slotNumber) },
                ]"
                :style="slotStyle(slot)"
                type="button"
                @click="toggleSlotSelection(slot.slotNumber)"
              >
                <Check v-if="selectedSlots.has(slot.slotNumber)" class="h-4 w-4" :stroke-width="3" />
                <span v-else>{{ slot.slotNumber }}</span>
              </button>
            </div>

            <!-- Slot Controls -->
            <div class="slot-controls">
              <div class="control-buttons">
                <button class="btn btn-primary" type="button" @click="handleEditSlots">Edit</button>
                <button class="btn btn-success" type="button" @click="handleEnableSlots">Enable</button>
                <button class="btn btn-danger" type="button" @click="handleDisableSlots">Disable</button>
              </div>
              <div class="status-legend" aria-label="Slot status legend">
                <span><i class="available"></i>Available</span>
                <span><i class="incoming"></i>Incoming</span>
                <span><i class="occupied"></i>Occupied</span>
                <span><i class="disabled"></i>Disable</span>
              </div>
              <strong class="control-info">Selecting : {{ selectedSlots.size }}</strong>
            </div>
          </div>
        </div>

        <!-- CCTV Tab -->
        <div v-if="adminStore.activeTab === 'cctv'" class="tab-content">
          <div class="cctv-container">
            <div class="cctv-header">
              <button class="btn btn-success btn-lg">+ Add Camera</button>
            </div>

            <div class="camera-grid">
              <div v-for="camera in adminStore.cameras" :key="camera._id" class="camera-card">
                <div class="camera-feed">
                  <img src="https://via.placeholder.com/400x300/cccccc/999999?text=CCTV+Feed" alt="Camera Feed" />
                  <div class="camera-status" :class="camera.status.toLowerCase()">
                    <span class="status-dot"></span>
                    {{ camera.status }}
                  </div>
                </div>
                <div class="camera-info">
                  <h3>{{ camera.cameraName }}</h3>
                  <p><strong>IP Address:</strong> {{ camera.ipAddress }}</p>
                  <p><strong>Status:</strong> {{ camera.status }}</p>
                  <p><strong>Last Update:</strong> {{ camera.lastUpdate }}</p>
                </div>
                <div class="camera-actions">
                  <button class="btn btn-primary btn-sm">Edit Camera</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Staff Manager Tab -->
        <div v-if="adminStore.activeTab === 'staff'" class="tab-content">
          <div class="staff-container">
            <div class="staff-header">
              <h2>Staff List</h2>
              <p class="staff-note">*Edit staff can edit in each person<br />*Can edit staff when only offline or disable</p>
              <button class="btn btn-success btn-lg">+ Add Staff</button>
            </div>

            <div class="staff-list">
              <div v-for="staff in adminStore.staffList" :key="staff._id" class="staff-card">
                <div class="staff-avatar">
                  <UserCircle class="w-16 h-16" />
                </div>
                <div class="staff-details">
                  <p><strong>Staff Name:</strong> {{ staff.staffName }}</p>
                  <p><strong>Username:</strong> {{ staff.username }}</p>
                  <p><strong>Password:</strong> {{ staff.password }}</p>
                  <p><strong>Date added:</strong> {{ staff.dateAdded }}</p>
                  <p><strong>Time added:</strong> {{ staff.timeAdded }}</p>
                  <p><strong>Status:</strong> <span :class="['status-badge', staff.status.toLowerCase()]">{{ staff.status }}</span></p>
                </div>
                <div class="staff-actions">
                  <button class="btn btn-primary btn-sm">
                    <Edit class="w-4 h-4" />
                  </button>
                  <button class="btn btn-danger btn-sm">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- System Setup Tab -->
        <div v-if="adminStore.activeTab === 'setup'" class="tab-content">
          <div class="setup-container">
            <div class="setup-section">
              <h2>Parking Setup</h2>

              <!-- Buildings Section -->
              <div class="setup-subsection">
                <div class="subsection-header">
                  <h3>Buildings</h3>
                  <button class="btn btn-success btn-sm">+ Add Building</button>
                </div>

                <div class="setup-grid">
                  <div v-for="building in adminStore.buildings" :key="building._id" class="setup-card">
                    <div class="setup-card-image">
                      <img src="https://via.placeholder.com/300x200/cccccc/999999?text=Building" alt="Building" />
                    </div>
                    <div class="setup-card-content">
                      <h4>{{ building.buildingName }}</h4>
                      <p><strong>All Floors:</strong> {{ building.floors }}</p>
                      <p><strong>Last Date added:</strong> {{ building.lastDateAdded }}</p>
                      <p><strong>Last Time added:</strong> {{ building.lastTimeAdded }}</p>
                    </div>
                    <div class="setup-card-actions">
                      <button class="btn btn-primary btn-sm">View Floor</button>
                      <button class="btn btn-secondary btn-sm">Edit</button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Floors Section -->
              <div class="setup-subsection">
                <div class="subsection-header">
                  <h3>Floors</h3>
                  <button class="btn btn-success btn-sm">+ Add Floor</button>
                </div>

                <div class="setup-grid">
                  <div v-for="floor in adminStore.floors" :key="floor._id" class="setup-card">
                    <div class="setup-card-icon">
                      <MapPin class="w-12 h-12" />
                    </div>
                    <div class="setup-card-content">
                      <h4>Floor {{ floor.floorNumber }} ({{ floor.vehicleType }})</h4>
                      <p><strong>Building:</strong> {{ floor.building }}</p>
                      <p><strong>Status:</strong> <span :class="['status-badge', floor.status.toLowerCase()]">{{ floor.status }}</span></p>
                      <p><strong>Total Slots:</strong> {{ floor.slotsCount }}</p>
                    </div>
                    <div class="setup-card-actions">
                      <button class="btn btn-primary btn-sm">Parking Map</button>
                      <button class="btn btn-secondary btn-sm">Edit</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Log Tab -->
        <div v-if="adminStore.activeTab === 'log'" class="tab-content">
          <div class="log-container">
            <div class="log-header">
              <h2>Parking Activity Log</h2>
              <div class="log-filters">
                <input type="date" class="filter-input" />
                <select class="filter-select">
                  <option>All Status</option>
                  <option>Parking</option>
                  <option>Exited</option>
                </select>
              </div>
            </div>

            <div class="log-table">
              <div class="log-table-header">
                <div class="log-col">Vehicle Info</div>
                <div class="log-col">Owner</div>
                <div class="log-col">Entry Time</div>
                <div class="log-col">Exit Time</div>
                <div class="log-col">Duration</div>
                <div class="log-col">Status</div>
              </div>

              <div class="log-table-body">
                <div class="log-row">
                  <div class="log-col">Plate: ABC-1234</div>
                  <div class="log-col">John Doe</div>
                  <div class="log-col">10:30 AM</div>
                  <div class="log-col">11:45 AM</div>
                  <div class="log-col">1h 15m</div>
                  <div class="log-col"><span class="status-badge exited">Exited</span></div>
                </div>
                <div class="log-row">
                  <div class="log-col">Plate: XYZ-5678</div>
                  <div class="log-col">Jane Smith</div>
                  <div class="log-col">09:15 AM</div>
                  <div class="log-col">-</div>
                  <div class="log-col">2h 30m</div>
                  <div class="log-col"><span class="status-badge parking">Parking</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import {
  Check,
  LayoutDashboard,
  Video,
  Users,
  Settings,
  LogOut,
  FileText,
  UserCircle,
  Edit,
  Trash2,
  MapPin,
} from 'lucide-vue-next'
import mfuLogo from '@/assets/mae-fah-luang-university.png'
import parkingSlotsData from '@/data/parking-slots.json'

type SlotStatus = 'available' | 'incoming' | 'occupied' | 'disabled'

interface ParkingSlot {
  slotNumber: number
  x: number
  y: number
}

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const selectedSlots = ref(new Set<number>())
const parkingSlots = ref<ParkingSlot[]>([])
const slotStatus = ref<Record<number, SlotStatus>>({})

const incomingSlotNumbers = [8, 9, 10, 24, 25, 26]
const disabledSlotNumbers = [45, 46, 47]

const navItems = [
  { id: 'slots', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'cctv', label: 'CCTV', icon: Video },
  { id: 'staff', label: 'Staff Manager', icon: Users },
  { id: 'setup', label: 'System Setup', icon: Settings },
  { id: 'log', label: 'Log', icon: FileText },
]

const activeTabLabel = computed(() => {
  const item = navItems.find((item) => item.id === adminStore.activeTab)
  return item?.label || 'Dashboard'
})

const adminStats = computed(() => {
  const statuses = Object.values(slotStatus.value)
  const count = (status: SlotStatus) => statuses.filter((slot) => slot === status).length
  const hasLoadedSlots = parkingSlots.value.length > 0

  return [
    { label: 'Total slots', value: parkingSlots.value.length || adminStore.stats.totalSlots, color: '#3b82f6' },
    { label: 'Available', value: hasLoadedSlots ? count('available') : adminStore.stats.available, color: '#4caf50' },
    { label: 'Incoming', value: hasLoadedSlots ? count('incoming') : adminStore.stats.incoming, color: '#f5c443' },
    { label: 'Occupied', value: hasLoadedSlots ? count('occupied') : adminStore.stats.occupied, color: '#ef4444' },
    { label: 'Disable', value: hasLoadedSlots ? count('disabled') : adminStore.stats.disabled, color: '#7d7d7d' },
    { label: 'Active Staff', value: adminStore.stats.activeStaff, color: '#4f46e5' },
  ]
})

const rowLabels = [
  { label: 'A', top: '18%' },
  { label: 'B', top: '32%' },
  { label: 'C', top: '42%' },
  { label: 'D', top: '56%' },
  { label: 'E', top: '70%' },
  { label: 'F', top: '83%' },
]

const slotVerticalOffset = 42
const slotVerticalScale = 760

const slotStyle = (slot: ParkingSlot) => ({
  left: `${(slot.x / 1300) * 100}%`,
  top: `${((slot.y + slotVerticalOffset) / slotVerticalScale) * 100}%`,
})

const slotStatusClass = (slotNumber: number) => {
  return slotStatus.value[slotNumber] || 'available'
}

const toggleSlotSelection = (slotNumber: number) => {
  const next = new Set(selectedSlots.value)
  if (next.has(slotNumber)) {
    next.delete(slotNumber)
  } else {
    next.add(slotNumber)
  }
  selectedSlots.value = next
}

const handleEditSlots = () => {
  console.log('Edit admin slots:', Array.from(selectedSlots.value))
}

const handleEnableSlots = () => {
  const nextStatus = { ...slotStatus.value }
  selectedSlots.value.forEach((slotId) => {
    if (nextStatus[slotId] !== 'occupied') {
      nextStatus[slotId] = 'available'
    }
  })
  slotStatus.value = nextStatus
  selectedSlots.value = new Set()
}

const handleDisableSlots = () => {
  const nextStatus = { ...slotStatus.value }
  const restrictedSlots: number[] = []

  selectedSlots.value.forEach((slotId) => {
    const status = slotStatus.value[slotId]
    if (status === 'incoming' || status === 'occupied') {
      restrictedSlots.push(slotId)
    } else {
      nextStatus[slotId] = 'disabled'
    }
  })

  if (restrictedSlots.length > 0) {
    const statusNames = restrictedSlots.map((id) => `${id} (${slotStatus.value[id]})`).join(', ')
    alert(`Cannot disable slots with active vehicles: ${statusNames}`)
  }

  slotStatus.value = nextStatus
  selectedSlots.value = new Set()
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  const floor4Data = (parkingSlotsData as any).E4.floor4
  const allSlots: ParkingSlot[] = []

  for (const row of Object.values(floor4Data.rows) as any[]) {
    allSlots.push(
      ...row.positions.map((position: any) => ({
        slotNumber: Number(position.slot ?? position.slotNumber),
        x: Number(position.x),
        y: Number(position.y),
      })),
    )
  }

  parkingSlots.value = allSlots.sort((a, b) => a.slotNumber - b.slotNumber)
  const nextStatus: Record<number, SlotStatus> = { ...floor4Data.slotStatus }
  incomingSlotNumbers.forEach((slotNumber) => {
    if (nextStatus[slotNumber] !== 'occupied') {
      nextStatus[slotNumber] = 'incoming'
    }
  })
  disabledSlotNumbers.forEach((slotNumber) => {
    if (nextStatus[slotNumber] !== 'occupied') {
      nextStatus[slotNumber] = 'disabled'
    }
  })
  slotStatus.value = nextStatus
})
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.admin-dashboard {
  min-height: 100vh;
  background: #d8d8d8;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

/* Sidebar */
.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: 160px;
  background: #cf4647;
  color: white;
  padding: 24px 4px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar-logo {
  width: 104px;
  height: 134px;
  display: grid;
  place-items: center;
  margin-bottom: 18px;
}

.logo-circle {
  width: 104px;
  height: 116px;
  background: transparent;
  border-radius: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-img {
  width: 84px;
  height: 108px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18));
}

.sidebar-logo h2 {
  display: none;
}

.sidebar-nav {
  width: 100%;
  display: grid;
  gap: 10px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  min-height: 78px;
  padding: 0 14px;
  background: #fff;
  color: #a7a7a7;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.16s ease;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
}

.nav-item:hover {
  transform: translateX(2px);
}

.nav-item.active {
  background: #fdeceb;
  color: #9e2d25;
  font-weight: 700;
}

.nav-icon {
  width: 30px;
  height: 30px;
  color: #232323;
  flex: 0 0 auto;
}

.sidebar-user {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding-top: 16px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}

.user-info {
  display: none;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
}

.user-role {
  font-size: 11px;
  opacity: 0.8;
  text-transform: capitalize;
}

.logout-btn {
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  width: 48px;
  height: 42px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  transition: opacity 0.3s ease;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  opacity: 1;
}

/* Main Content */
.main-content {
  min-height: 100vh;
  margin-left: 160px;
  display: flex;
  flex-direction: column;
}

.header {
  position: sticky;
  top: 0;
  z-index: 30;
  min-height: 78px;
  background: white;
  padding: 0 16px 0 18px;
  border-bottom: 1px solid #d2d2d2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.header-title h1 {
  font-size: 25px;
  font-weight: 400;
  color: #111;
  margin-bottom: 4px;
}

.header-title p {
  font-size: 15px;
  color: #9a9a9a;
}

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: #19d348;
}

.online-indicator {
  width: 4px;
  height: 4px;
  background: #19d348;
  border-radius: 50%;
}

/* Filters Section */
.filters-section {
  min-height: 116px;
  background: #d8d8d8;
  padding: 12px 38px 18px 30px;
  border-bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  flex-wrap: wrap;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.filters {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
  flex: 1;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.filter-group label {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.filter-select {
  width: 142px;
  height: 45px;
  padding: 0 18px;
  border: 0;
  border-radius: 8px;
  font-size: 18px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: inset 0 0 0 1px #e4e4e4;
}

.filter-select:hover {
  border-color: #9ca3af;
}

.filter-select:focus {
  outline: none;
  border-color: #9f2f30;
  box-shadow: 0 0 0 2px rgba(159, 47, 48, 0.1);
}

.stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-top: 29px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 104px;
  min-height: 66px;
  padding: 8px 10px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #ececec;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
}

.stat-value {
  font-size: 30px;
  line-height: 0.9;
  font-weight: 700;
}

.stat-label {
  font-size: 14px;
  color: #909090;
  text-align: center;
}

/* Content */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 18px 42px 34px;
}

.tab-content {
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
}

/* Slots */
.slots-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.parking-map {
  position: relative;
  width: 100%;
  height: min(560px, calc(100vh - 320px));
  min-height: 430px;
  background: #cabb9a;
  border-radius: 22px;
  overflow: hidden;
  border: 8px solid rgba(255, 255, 255, 0.24);
  box-shadow: inset 0 0 38px rgba(0, 0, 0, 0.18);
}

.parking-map {
  background:
    linear-gradient(90deg, rgba(80, 64, 44, 0.12) 1px, transparent 1px) 0 0 / 92px 92px,
    linear-gradient(0deg, rgba(80, 64, 44, 0.1) 1px, transparent 1px) 0 0 / 92px 92px,
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.38), transparent 34%),
    #cabb9a;
}

.map-heading {
  position: absolute;
  top: 22px;
  left: 12%;
  right: 12%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 36px;
  z-index: 3;
}

.map-heading span {
  height: 2px;
  background: #353535;
}

.map-heading strong {
  color: #111;
  font-size: 56px;
  font-weight: 500;
  line-height: 1;
}

.gate-label,
.row-label {
  position: absolute;
  z-index: 3;
  color: #171717;
  font-size: 27px;
  font-weight: 400;
}

.gate-label::before,
.gate-label::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 48px;
  margin: 0 11px -14px;
  background: #333;
}

.gate-label.out {
  top: 75px;
  left: 2.5%;
}

.gate-label.in {
  top: 75px;
  left: 10%;
}

.gate-label.up {
  top: 58%;
  left: 7%;
}

.gate-label.down {
  top: 58%;
  left: 39%;
}

.row-label {
  right: 14px;
  font-size: 35px;
}

.flow-lines {
  position: absolute;
  inset: 58px 44px 52px;
  width: calc(100% - 88px);
  height: calc(100% - 110px);
  z-index: 1;
  pointer-events: none;
}

.flow-lines path {
  fill: none;
  stroke: rgba(255, 167, 145, 0.64);
  stroke-width: 9;
  stroke-linecap: round;
  filter: drop-shadow(0 0 5px rgba(255, 211, 200, 0.8));
}

.slot {
  position: absolute;
  z-index: 4;
  width: clamp(25px, 2.4vw, 34px);
  height: clamp(30px, 3vw, 42px);
  transform: translate(-50%, -50%);
  border: 1px solid rgba(20, 20, 20, 0.6);
  color: #101010;
  display: grid;
  place-items: center;
  font-size: clamp(10px, 0.85vw, 15px);
  font-weight: 500;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.14);
}

.slot.available {
  background: #4caf50;
  color: #0f2a12;
}

.slot.incoming {
  background: #f5c443;
  color: #3d2a00;
}

.slot.occupied {
  background: linear-gradient(#ff6b6b 0 55%, #dc2626 56% 100%);
  color: #f2f2f2;
  box-shadow:
    inset 0 -6px 0 rgba(0, 0, 0, 0.35),
    5px 6px 4px rgba(0, 0, 0, 0.34);
}

.slot.disabled {
  background: #9e9e9e;
  color: #282828;
}

.slot.selected {
  border: 3px solid #22c7f2;
  color: #fff;
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.18),
    0 0 0 3px rgba(103, 220, 247, 0.65),
    0 4px 4px rgba(0, 0, 0, 0.25);
}

.slot.selected svg {
  width: 20px;
  height: 20px;
  padding: 2px;
  border-radius: 999px;
  background: #67dcf7;
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}

.slot-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  min-height: 82px;
  padding: 14px 0 0;
  background: transparent;
  border-radius: 0;
}

.control-info {
  font-size: 15px;
  color: #111;
  white-space: nowrap;
}

.selected-count {
  font-weight: 700;
  color: #9f2f30;
}

.control-buttons {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.status-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex: 1;
  flex-wrap: wrap;
  min-width: 280px;
  color: #333;
  font-size: 14px;
}

.status-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.status-legend i {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(20, 20, 20, 0.35);
}

.status-legend .available {
  background: #4caf50;
}

.status-legend .incoming {
  background: #f5c443;
}

.status-legend .occupied {
  background: #dc2626;
}

.status-legend .disabled {
  background: #9e9e9e;
}

/* CCTV */
.cctv-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cctv-header {
  display: flex;
  gap: 16px;
}

.camera-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.camera-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.camera-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.camera-feed {
  width: 100%;
  height: 200px;
  background: #000;
  position: relative;
  overflow: hidden;
}

.camera-feed img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-status {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  font-size: 12px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #16a34a;
}

.camera-status.offline .status-dot {
  background: #dc2626;
}

.camera-info {
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.camera-info h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.camera-info p {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.camera-actions {
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 8px;
}

/* Staff */
.staff-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.staff-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.staff-header h2 {
  font-size: 18px;
  margin-bottom: 8px;
}

.staff-note {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}

.staff-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.staff-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  align-items: flex-start;
}

.staff-avatar {
  width: 80px;
  height: 80px;
  background: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #d1d5db;
}

.staff-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.staff-details p {
  font-size: 13px;
  color: #1f2937;
}

.staff-actions {
  display: flex;
  gap: 8px;
}

/* Setup */
.setup-container {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.setup-section h2 {
  font-size: 18px;
  margin-bottom: 24px;
}

.setup-subsection {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.subsection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subsection-header h3 {
  font-size: 16px;
  color: #1f2937;
}

.setup-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.setup-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.setup-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.setup-card-image {
  width: 100%;
  height: 160px;
  background: #f3f4f6;
  overflow: hidden;
}

.setup-card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.setup-card-icon {
  width: 100%;
  height: 160px;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
}

.setup-card-content {
  padding: 16px;
}

.setup-card-content h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.setup-card-content p {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.setup-card-actions {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  gap: 8px;
}

/* Log */
.log-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log-header h2 {
  font-size: 18px;
}

.log-filters {
  display: flex;
  gap: 12px;
}

.filter-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.log-table {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.log-table-header {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 12px;
  color: #374151;
}

.log-table-body {
  display: flex;
  flex-direction: column;
}

.log-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.log-row:last-child {
  border-bottom: none;
}

.log-col {
  color: #1f2937;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-success {
  background: #16a34a;
  color: white;
}

.btn-success:hover {
  background: #15803d;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.btn-secondary:hover {
  background: #d1d5db;
}

.btn-lg {
  padding: 10px 20px;
  font-size: 14px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* Status Badges */
.status-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
}

.status-badge.online {
  background: #dcfce7;
  color: #166534;
}

.status-badge.offline {
  background: #fee2e2;
  color: #991b1b;
}

.status-badge.disable {
  background: #f3f4f6;
  color: #374151;
}

.status-badge.available {
  background: #dcfce7;
  color: #166534;
}

.status-badge.parking {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.exited {
  background: #f0fdf4;
  color: #166534;
}
</style>
