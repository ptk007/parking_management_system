<template>
  <div class="admin-dashboard">
    <aside class="admin-sidebar">
      <button class="sidebar-crest" type="button" @click="setSection('dashboard')">
        <img :src="mfuLogo" alt="Mae Fah Luang University" />
      </button>

      <nav class="sidebar-nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          :class="['nav-card', activeSection === item.id ? 'is-active' : '']"
          type="button"
          @click="setSection(item.id)"
        >
          <component :is="item.icon" class="nav-icon" :stroke-width="2.7" />
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar">
        <div>
          <h1>MFU Parking Management</h1>
          <p>{{ adminName }} ● Admin</p>
        </div>

        <div class="topbar-actions">
          <div class="online-status"><span></span><strong>Online</strong></div>
          <button class="bell-button" type="button" aria-label="Notifications">
            <Bell class="h-8 w-8" :stroke-width="1.8" />
            <span></span>
          </button>
          <div class="avatar">{{ adminInitials }}</div>
        </div>
      </header>

      <section v-if="activeSection === 'dashboard'" class="section-shell dashboard-section">
        <div class="tabbar">
          <button
            v-for="tab in dashboardTabs"
            :key="tab.id"
            :class="['tab-button', activeDashboardTab === tab.id ? 'is-active' : '']"
            type="button"
            @click="activeDashboardTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <FilterStats :stats="adminStats" />

        <div class="dashboard-content">
          <ReferenceParkingMap v-if="activeDashboardTab === 'slots'" />

          <div v-else-if="activeDashboardTab === 'cctv'" class="admin-cctv-grid">
            <CameraPreviewCard
              v-for="camera in adminDashboardCameras"
              :key="camera"
              :title="camera"
              mode="detection"
            />
          </div>

          <ParkingLogList v-else />
        </div>
      </section>

      <section v-else-if="activeSection === 'staff'" class="section-shell staff-manager-section">
        <div v-if="staffMode === 'list'" class="staff-list-panel">
          <div class="staff-list-header">
            <button class="green-button add-staff-button" type="button" @click="openAddStaff">
              <UserPlus class="h-5 w-5" :stroke-width="2.7" />
              Add Staff
            </button>
            <h2>Staff List</h2>
            <p>
              *Edit staff can edit in each person<br />
              *Can edit staff when only offline or disable
            </p>
          </div>

          <article v-for="staff in adminStore.staffList" :key="staff._id" class="staff-card">
            <div class="profile-icon"><UserRound class="h-14 w-14" :stroke-width="1.8" /></div>
            <div class="staff-copy">
              <p>Staff Name : {{ staff.staffName }}</p>
              <p>Username : {{ staff.username }}</p>
              <p>
                Password : {{ staff.password }}
                <EyeOff class="inline-icon h-4 w-4" :stroke-width="2.2" />
              </p>
              <p>Date added : {{ staff.dateAdded }}</p>
              <p>Time added : {{ staff.timeAdded }}</p>
              <p>Status : <strong :class="statusClass(staff.status)">{{ staff.status }}</strong></p>
            </div>
            <div class="row-actions">
              <button type="button" aria-label="Edit staff" @click="openEditStaff(staff)">
                <SquarePen class="h-6 w-6" :stroke-width="2.4" />
              </button>
              <button type="button" aria-label="Delete staff" @click="adminStore.deleteStaff(staff._id)">
                <Trash2 class="h-6 w-6" :stroke-width="2.4" />
              </button>
            </div>
          </article>
        </div>

        <StaffFormPanel
          v-else
          :mode="staffMode"
          :form="staffForm"
          @save="saveStaff"
          @cancel="staffMode = 'list'"
          @add-more="resetStaffForm()"
        />
      </section>

      <section v-else class="section-shell setup-section">
        <div class="setup-tabs">
          <button
            :class="['tab-button', setupTab === 'parking' ? 'is-active' : '']"
            type="button"
            @click="showParkingSetup"
          >
            Parking
          </button>
          <button
            :class="['tab-button', setupTab === 'cctv' ? 'is-active' : '']"
            type="button"
            @click="showCctvSetup"
          >
            CCTV
          </button>
        </div>

        <div class="setup-workspace">
          <ParkingSetupList
            v-if="setupMode === 'parking-list'"
            :floors="adminStore.floors"
            @add-building="setupMode = 'add-building'"
            @add-floor="setupMode = 'add-floor'"
            @edit-floor="setupMode = 'edit-floor'"
          />

          <BuildingFormPanel
            v-else-if="setupMode === 'add-building'"
            mode="add"
            @save="showParkingSetup"
            @cancel="showParkingSetup"
          />

          <FloorFormPanel
            v-else-if="setupMode === 'add-floor'"
            mode="add"
            @save="showParkingSetup"
            @cancel="showParkingSetup"
          />

          <FloorFormPanel
            v-else-if="setupMode === 'edit-floor'"
            mode="edit"
            @save="showParkingSetup"
            @cancel="showParkingSetup"
          />

          <CCTVSetupList
            v-else-if="setupMode === 'cctv-list'"
            @add-cctv="setupMode = 'add-cctv'"
            @edit-cctv="setupMode = 'edit-cctv'"
          />

          <CCTVFormPanel
            v-else-if="setupMode === 'add-cctv'"
            mode="add"
            @save="showCctvSetup"
            @cancel="showCctvSetup"
          />

          <CCTVFormPanel
            v-else
            mode="edit"
            @save="showCctvSetup"
            @cancel="showCctvSetup"
          />
        </div>
      </section>
    </main>

    <ChatWidget />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref } from 'vue'
import {
  Bell,
  Bike,
  CarFront,
  CheckCircle2,
  CircleArrowUp,
  EyeOff,
  Map,
  Monitor,
  Search,
  SquarePen,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  VideoOff,
  Wrench,
  X,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore, type StaffMember, type Floor } from '@/stores/admin'
import ReferenceParkingMap from '@/components/parking/ReferenceParkingMap.vue'
import CameraPreviewCard from '@/components/parking/CameraPreviewCard.vue'
import ChatWidget from '@/components/chat/ChatWidget.vue'
import mfuLogo from '@/assets/mae-fah-luang-university.png'

type AdminSection = 'dashboard' | 'staff' | 'setup'
type DashboardTab = 'slots' | 'cctv' | 'log'
type StaffMode = 'list' | 'add' | 'edit'
type SetupTab = 'parking' | 'cctv'
type SetupMode =
  | 'parking-list'
  | 'add-building'
  | 'add-floor'
  | 'edit-floor'
  | 'cctv-list'
  | 'add-cctv'
  | 'edit-cctv'

interface StaffFormState {
  staffName: string
  username: string
  password: string
  confirmPassword: string
  status: StaffMember['status']
}

const authStore = useAuthStore()
const adminStore = useAdminStore()

const activeSection = ref<AdminSection>('dashboard')
const activeDashboardTab = ref<DashboardTab>('slots')
const staffMode = ref<StaffMode>('list')
const setupTab = ref<SetupTab>('parking')
const setupMode = ref<SetupMode>('parking-list')
const editingStaffId = ref<string | null>(null)

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: Monitor },
  { id: 'staff' as const, label: 'Staff\nManager', icon: Users },
  { id: 'setup' as const, label: 'System\nSetup', icon: Wrench },
]

const dashboardTabs: { id: DashboardTab; label: string }[] = [
  { id: 'slots', label: 'Slots' },
  { id: 'cctv', label: 'CCTV' },
  { id: 'log', label: 'Log' },
]

const adminStats = [
  { label: 'Total slots', value: 124, color: '#cf3b30' },
  { label: 'Available', value: 47, color: '#16a36a' },
  { label: 'Incoming', value: 6, color: '#f4c233' },
  { label: 'Occupied', value: 74, color: '#bd7a10' },
  { label: 'Disable', value: 3, color: '#777777' },
  { label: 'Active Staff', value: 6, color: '#5141c9' },
]

const adminDashboardCameras = ['Entrance', 'Exit', 'Floor4 B6', 'Floor4 A5']

const staffForm = reactive<StaffFormState>({
  staffName: 'Panuwat Panan',
  username: 'Panuwat',
  password: '************',
  confirmPassword: '',
  status: 'Offline',
})

const adminName = computed(() => authStore.user?.fullName || 'Thanawit Boonphom')
const adminInitials = computed(() => authStore.user?.avatar || 'TB')

const setSection = (section: AdminSection) => {
  activeSection.value = section
  if (section === 'staff') staffMode.value = 'list'
  if (section === 'setup') showParkingSetup()
}

const resetStaffForm = (staff?: StaffMember) => {
  staffForm.staffName = staff?.staffName || 'Panuwat Panan'
  staffForm.username = staff?.username || 'Panuwat'
  staffForm.password = '************'
  staffForm.confirmPassword = ''
  staffForm.status = staff?.status || 'Offline'
}

const openAddStaff = () => {
  editingStaffId.value = null
  resetStaffForm()
  staffMode.value = 'add'
}

const openEditStaff = (staff: StaffMember) => {
  editingStaffId.value = staff._id
  resetStaffForm(staff)
  staffMode.value = 'edit'
}

const saveStaff = () => {
  if (staffMode.value === 'add') {
    adminStore.addStaff({
      _id: `${Date.now()}`,
      staffName: staffForm.staffName,
      username: staffForm.username,
      password: '**********',
      dateAdded: '19/3/2569',
      timeAdded: '12:00:00',
      status: staffForm.status,
    })
  } else if (editingStaffId.value) {
    adminStore.updateStaff(editingStaffId.value, {
      staffName: staffForm.staffName,
      username: staffForm.username,
      status: staffForm.status,
    })
  }
  staffMode.value = 'list'
}

const showParkingSetup = () => {
  setupTab.value = 'parking'
  setupMode.value = 'parking-list'
}

const showCctvSetup = () => {
  setupTab.value = 'cctv'
  setupMode.value = 'cctv-list'
}

const statusClass = (status: StaffMember['status']) => {
  return `status-${status.toLowerCase()}`
}

const FilterStats = defineComponent({
  props: {
    stats: {
      type: Array as () => { label: string; value: number; color: string }[],
      required: true,
    },
  },
  setup(props) {
    const building = ref('E4')
    const floor = ref('4')
    const vehicle = ref('Cars')
    const filters = [
      { label: 'Building', model: building, options: ['E4'] },
      { label: 'Floor', model: floor, options: ['4'] },
      { label: 'Vehicle', model: vehicle, options: ['Cars', 'Motorcycles'] },
    ]

    return () =>
      h('div', { class: 'dashboard-toolbar' }, [
        h(
          'div',
          { class: 'filters' },
          filters.map((filter) =>
            h('label', { class: 'filter-control' }, [
              h('span', `${filter.label} *`),
              h(
                'select',
                {
                  value: filter.model.value,
                  onChange: (event: Event) => {
                    filter.model.value = (event.target as HTMLSelectElement).value
                  },
                },
                filter.options.map((option) => h('option', { value: option }, option)),
              ),
            ]),
          ),
        ),
        h(
          'div',
          { class: 'stats' },
          props.stats.map((stat) =>
            h('div', { class: 'stat-card' }, [
              h('strong', { style: { color: stat.color } }, stat.value),
              h('span', stat.label),
            ]),
          ),
        ),
      ])
  },
})

const FacePlaceholder = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h('figure', { class: 'face-placeholder' }, [
        h('div', [h(UserRound, { class: 'h-11 w-11', strokeWidth: 1.8 })]),
        h('figcaption', props.label),
      ])
  },
})

const ParkingLogList = defineComponent({
  setup() {
    const logs = [
      {
        id: 1,
        name: 'Mrs. Wilayporn Nonsila',
        licenseNumber: 'กง 1234',
        province: 'เชียงราย',
        vehicleDescription: 'Black Toyota Fortuner',
        date: '12/08/2569',
        parkingTime: '12:00:34',
        exitTime: '-',
        parkingSlot: '10',
        status: 'Parking',
      },
      {
        id: 2,
        name: '*Guest555',
        licenseNumber: 'กถ 5555',
        province: 'ลำพูน',
        vehicleDescription: 'Unknown',
        date: '12/08/2569',
        parkingTime: '14:00:34',
        exitTime: '16:01:21',
        parkingSlot: '54',
        status: 'Exited',
      },
      {
        id: 3,
        name: 'Anutin Charnvirakul',
        licenseNumber: 'รย 1000',
        province: 'กรุงเทพมหานคร',
        vehicleDescription: 'BYD blue pearl',
        date: '12/08/2569',
        parkingTime: '-',
        exitTime: '-',
        parkingSlot: '-',
        status: 'Not Parking',
      },
    ]

    const logStatusClass = (status: string) => {
      if (status === 'Parking') return 'status-parking'
      if (status === 'Exited') return 'status-exited'
      return 'status-muted'
    }

    return () =>
      h('div', { class: 'logs-panel' }, [
        h('div', { class: 'warning-banner' }, [h('span', 'Exited'), ' car log will reset after 24 hours']),
        logs.map((log) =>
          h('article', { class: 'log-card', key: log.id }, [
            h(CarFront, { class: 'log-car h-9 w-9', strokeWidth: 2.4 }),
            h('div', { class: 'vehicle-info' }, [
              h('p', ['Name ', h('span', ':'), ` ${log.name}`]),
              h('p', ['License Number ', h('span', ':'), ` ${log.licenseNumber}`]),
              h('p', ['Province ', h('span', ':'), ` ${log.province}`]),
              h('p', ['Vehicle Description ', h('span', ':'), ` ${log.vehicleDescription}`]),
            ]),
            h('div', { class: 'parking-info' }, [
              h('p', ['Date ', h('span', ':'), ` ${log.date}`]),
              h('p', ['Parking Time ', h('span', ':'), ` ${log.parkingTime}`]),
              h('p', ['Exit Time ', h('span', ':'), ` ${log.exitTime}`]),
              h('p', ['Parking slot number ', h('span', ':'), ` ${log.parkingSlot}`]),
              h('p', [
                'Parking Status ',
                h('span', ':'),
                ' ',
                h('strong', { class: logStatusClass(log.status) }, log.status),
              ]),
            ]),
            h('div', { class: 'face-driver' }, [
              h('p', 'Face Driver'),
              h('div', [h(FacePlaceholder, { label: 'Entered' }), h(FacePlaceholder, { label: 'Exited' })]),
            ]),
          ]),
        ),
      ])
  },
})

const StaffFormPanel = defineComponent({
  props: {
    mode: {
      type: String as () => 'add' | 'edit',
      required: true,
    },
    form: {
      type: Object as () => StaffFormState,
      required: true,
    },
  },
  emits: ['save', 'cancel', 'add-more'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: ['staff-form-panel', props.mode] }, [
        h('h2', props.mode === 'add' ? 'Add Staff' : 'Edit Staff'),
        h('div', { class: 'staff-form-card' }, [
          h('div', { class: 'profile-icon large' }, [h(UserRound, { class: 'h-20 w-20', strokeWidth: 1.6 })]),
          h('div', { class: 'staff-form-fields' }, [
            h('label', [
              h('span', 'Staff Name :'),
              h('input', {
                value: props.form.staffName,
                onInput: (event: Event) => {
                  props.form.staffName = (event.target as HTMLInputElement).value
                },
              }),
            ]),
            h('label', [
              h('span', 'Username :'),
              h('input', {
                value: props.form.username,
                onInput: (event: Event) => {
                  props.form.username = (event.target as HTMLInputElement).value
                },
              }),
            ]),
            h('label', [
              h('span', 'Password :'),
              h('input', {
                type: 'password',
                value: props.form.password,
                onInput: (event: Event) => {
                  props.form.password = (event.target as HTMLInputElement).value
                },
              }),
              h(EyeOff, { class: 'field-icon h-4 w-4', strokeWidth: 2.2 }),
            ]),
            h('label', [
              h('span', 'Confirm Password :'),
              h('input', {
                type: 'password',
                value: props.form.confirmPassword,
                onInput: (event: Event) => {
                  props.form.confirmPassword = (event.target as HTMLInputElement).value
                },
              }),
            ]),
          ]),
          props.mode === 'edit'
            ? h('div', { class: 'form-actions' }, [
                h('button', { class: 'blue-button', type: 'button', onClick: () => emit('save') }, 'Edit'),
                h('button', { class: 'red-button', type: 'button', onClick: () => emit('cancel') }, 'Cancel'),
              ])
            : null,
        ]),
        props.mode === 'add'
          ? h('button', { class: 'add-more-row', type: 'button', onClick: () => emit('add-more') }, '+ Add More Staff')
          : null,
        props.mode === 'add'
          ? h('button', { class: 'green-button save-add', type: 'button', onClick: () => emit('save') }, 'Add')
          : null,
      ])
  },
})

const ParkingSetupList = defineComponent({
  props: {
    floors: {
      type: Array as () => Floor[],
      required: true,
    },
  },
  emits: ['add-building', 'add-floor', 'edit-floor'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'parking-setup-list' }, [
        h('div', { class: 'setup-actions' }, [
          h('button', { class: 'green-button', type: 'button', onClick: () => emit('add-building') }, '+ Add Building'),
          h('button', { class: 'green-button', type: 'button', onClick: () => emit('add-floor') }, '+ Add Floor'),
        ]),
        h('article', { class: 'building-row' }, [
          h('div', { class: 'building-photo' }),
          h('div', { class: 'setup-copy' }, [
            h('p', 'Building : E4'),
            h('p', 'All Floor : 4'),
            h('p', 'Last Date added : 19/3/2569'),
            h('p', 'Last Time added : 12:00:00'),
          ]),
          h('button', { class: 'map-link', type: 'button' }, [
            h(CircleArrowUp, { class: 'h-10 w-10', strokeWidth: 2.4 }),
            h('span', 'View Floor'),
          ]),
          h('button', { class: 'blue-button', type: 'button', onClick: () => emit('add-building') }, 'Edit'),
        ]),
        props.floors.map((floor) =>
          h('article', { class: 'floor-row', key: floor._id }, [
            h('div', { class: 'floor-icon' }, [
              floor.vehicleType === 'Motorcycle'
                ? h(Bike, { class: 'h-11 w-11', strokeWidth: 2.5 })
                : h(CarFront, { class: 'h-11 w-11', strokeWidth: 2.5 }),
            ]),
            h('div', { class: 'setup-copy' }, [
              h('p', `Floor : ${floor.floorNumber}      (${floor.vehicleType})`),
              h('p', 'Date added : 19/3/2569'),
              h('p', `Time added : ${floor.floorNumber === 3 ? '11:00:00' : '12:00:00'}`),
            ]),
            h('p', { class: 'floor-status' }, [
              'Status : ',
              h('strong', { class: floor.status === 'Available' ? 'available' : 'disable' }, floor.status),
            ]),
            h('button', { class: 'map-link', type: 'button' }, [
              h(Map, { class: 'h-10 w-10', strokeWidth: 2.5 }),
              h('span', 'Parking Map'),
            ]),
            h('button', { class: 'blue-button', type: 'button', onClick: () => emit('edit-floor') }, 'Edit'),
          ]),
        ),
      ])
  },
})

const BuildingFormPanel = defineComponent({
  props: {
    mode: {
      type: String as () => 'add' | 'edit',
      required: true,
    },
  },
  emits: ['save', 'cancel'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'overlay-card building-form' }, [
        h('button', { class: 'close-x', type: 'button', onClick: () => emit('cancel') }, [
          h(X, { class: 'h-7 w-7', strokeWidth: 3 }),
        ]),
        h('div', { class: 'building-photo large' }),
        h('label', [h('span', 'Building Name'), h('input', { value: 'E4' })]),
        h(
          'button',
          { class: props.mode === 'add' ? 'green-button' : 'blue-button', type: 'button', onClick: () => emit('save') },
          'Confirm',
        ),
      ])
  },
})

const FloorFormPanel = defineComponent({
  props: {
    mode: {
      type: String as () => 'add' | 'edit',
      required: true,
    },
  },
  emits: ['save', 'cancel'],
  setup(props, { emit }) {
    return () =>
      h('div', { class: 'overlay-card floor-form' }, [
        h('button', { class: 'close-x', type: 'button', onClick: () => emit('cancel') }, [
          h(X, { class: 'h-7 w-7', strokeWidth: 3 }),
        ]),
        props.mode === 'edit' ? h('h2', 'Floor : 3') : null,
        props.mode === 'add'
          ? h('label', [h('span', 'Building *'), h('select', [h('option', 'E4')])])
          : null,
        props.mode === 'add' ? h('label', [h('span', 'Floor'), h('input', { value: '4' })]) : null,
        props.mode === 'add'
          ? h('label', [h('span', 'Vehicle*'), h('select', [h('option', 'Cars'), h('option', 'Motorcycle')])])
          : h('label', [h('span', 'Status'), h('select', [h('option', 'Disable'), h('option', 'Available')])]),
        h('p', { class: 'import-row' }, [h('button', { type: 'button' }, 'Import'), ' parking map']),
        h(
          'button',
          { class: props.mode === 'add' ? 'green-button' : 'blue-button', type: 'button', onClick: () => emit('save') },
          'Confirm',
        ),
      ])
  },
})

const CCTVSetupList = defineComponent({
  emits: ['add-cctv', 'edit-cctv'],
  setup(_, { emit }) {
    return () =>
      h('div', { class: 'cctv-setup-list' }, [
        h('div', { class: 'cctv-filter-row' }, [
          h('button', { class: 'green-button', type: 'button', onClick: () => emit('add-cctv') }, '+ Add CCTV'),
          h('label', [h('span', 'Building'), h('select', [h('option', 'E4')])]),
          h('label', [h('span', 'Floor'), h('select', [h('option', '4')])]),
          h('label', [h('span', 'Vehicle *'), h('select', [h('option', 'Cars')])]),
        ]),
        h('article', { class: 'cctv-row-card' }, [
          h('div', { class: 'inline-camera-scene' }, [
            h('span', { class: 'timestamp' }, '03-05-2026 Sun 00:38:45'),
            h('span', { class: 'pillar one' }, 'B03'),
            h('span', { class: 'pillar two' }, 'C03'),
            h('span', { class: 'scene-car car-a' }),
            h('span', { class: 'scene-car car-b' }),
            h('span', { class: 'scene-car car-c' }),
            h('span', { class: 'direction-arrow' }),
            h('span', { class: 'plate' }, 'B-4CB5'),
          ]),
          h('div', { class: 'cctv-row-copy' }, [
            h('p', 'CCTV Name :       Floor4 B6'),
            h('p', 'IP Address : 172.28.113.103'),
            h('p', 'RTSP Link :   rtsp://mfustream:mediamfu2025@172.28.109.31/Streaming/Channels/101'),
            h('p', ['Status : ', h('strong', 'Online')]),
            h('p', 'CCTV File :   cctvinfo2.json'),
          ]),
          h('button', { class: 'blue-button edit-camera', type: 'button', onClick: () => emit('edit-cctv') }, [
            'Edit',
            h('br'),
            'Camera',
          ]),
        ]),
      ])
  },
})

const CCTVFormPanel = defineComponent({
  props: {
    mode: {
      type: String as () => 'add' | 'edit',
      required: true,
    },
  },
  emits: ['save', 'cancel'],
  setup(props, { emit }) {
    const isAdd = props.mode === 'add'
    return () =>
      h('div', { class: 'cctv-form-panel' }, [
        h('h2', isAdd ? 'Add CCTV' : 'Edit CCTV'),
        h('div', { class: 'cctv-form-card' }, [
          h('label', [h('span', 'CCTV File :'), h('select', [h('option', isAdd ? 'cctvinfo2.json' : 'cctv1.json')])]),
          h('label', { class: 'search-field' }, [
            h('span', 'Search Cam :'),
            h('input', { placeholder: 'Camera name' }),
            h(Search, { class: 'h-4 w-4', strokeWidth: 2.2 }),
          ]),
          isAdd
            ? h('div', { class: 'inline-camera-scene form-scene' }, [
                h('span', { class: 'timestamp' }, '03-05-2026 Sun 00:38:45'),
                h('span', { class: 'pillar one' }, 'B03'),
                h('span', { class: 'pillar two' }, 'C03'),
                h('span', { class: 'scene-car car-a' }),
                h('span', { class: 'scene-car car-b' }),
                h('span', { class: 'scene-car car-c' }),
                h('span', { class: 'direction-arrow' }),
              ])
            : h('div', { class: 'offline-scene' }, [h(VideoOff, { class: 'h-9 w-9', strokeWidth: 2.2 })]),
          h('div', { class: 'cctv-fields' }, [
            h('p', ['Create', h('br'), ' CCTV Name : ', h('input', { value: isAdd ? 'Floor4 B6' : 'Floor3 B6' })]),
            h('p', [
              'IP Address : ',
              h('input', { value: isAdd ? '172.28.113.103' : '' }),
              isAdd ? h(CheckCircle2, { class: 'ok-icon h-4 w-4', strokeWidth: 2.4 }) : h(X, { class: 'bad-icon h-4 w-4', strokeWidth: 3 }),
            ]),
            !isAdd ? h('small', 'IP Address doesn’t found') : null,
            h('p', [
              'RTSP Link : ',
              h('input', { value: isAdd ? 'rtsp://mfustream:...' : '' }),
              isAdd ? h(CheckCircle2, { class: 'ok-icon h-4 w-4', strokeWidth: 2.4 }) : h(X, { class: 'bad-icon h-4 w-4', strokeWidth: 3 }),
            ]),
            !isAdd ? h('small', 'RTSP Link doesn’t found') : null,
            h('p', ['Status : ', h('strong', { class: isAdd ? 'online' : 'offline' }, isAdd ? 'Online' : 'Offline')]),
          ]),
          h('div', { class: 'form-actions' }, [
            h(
              'button',
              { class: isAdd ? 'green-button' : 'blue-button', type: 'button', onClick: () => emit('save') },
              isAdd ? 'Confirm' : 'Edit',
            ),
            h('button', { class: 'red-button', type: 'button', onClick: () => emit('cancel') }, 'Cancel'),
          ]),
        ]),
      ])
  },
})
</script>

<style>
.admin-dashboard {
  min-height: 100vh;
  background: #d8d8d8;
  color: #202020;
}

.admin-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: 120px;
  background: #cf4647;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar-crest {
  width: 104px;
  height: 116px;
  margin-top: 18px;
  display: grid;
  place-items: center;
}

.sidebar-crest img {
  width: 78px;
  height: 102px;
  object-fit: contain;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.18));
}

.sidebar-nav {
  width: 100%;
  margin-top: 17px;
  display: grid;
  gap: 6px;
  padding: 0 6px;
  box-sizing: border-box;
}

.nav-card {
  width: 100%;
  box-sizing: border-box;
  height: 57px;
  border-radius: 4px;
  background: #fff;
  color: #a7a7a7;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  text-align: left;
  white-space: pre-line;
  font-size: 11px;
}

.nav-card.is-active {
  background: #fdeceb;
  color: #9e2d25;
  font-weight: 800;
}

.nav-icon {
  width: 29px;
  height: 29px;
  color: #202020;
  flex: 0 0 auto;
}

.admin-main {
  min-height: 100vh;
  margin-left: 120px;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  height: 57px;
  background: #fff;
  border-bottom: 1px solid #d2d2d2;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 13px;
}

.admin-topbar h1 {
  color: #111;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.1;
}

.admin-topbar p {
  color: #9a9a9a;
  font-size: 11px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 18px;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #19d348;
  font-size: 13px;
}

.online-status span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #19d348;
}

.online-status strong {
  color: #19d348;
  font-weight: 400;
}

.bell-button {
  position: relative;
  width: 32px;
  height: 38px;
  display: grid;
  place-items: center;
  color: #111;
}

.bell-button span {
  position: absolute;
  top: 8px;
  right: 3px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ff0d0d;
}

.avatar {
  width: 43px;
  height: 43px;
  border-radius: 999px;
  background: #fdeceb;
  color: #9e2d25;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
}

.tabbar,
.setup-tabs {
  height: 35px;
  background: #fff;
  display: flex;
  align-items: stretch;
  padding-left: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.setup-tabs {
  height: 46px;
  align-items: center;
  padding-left: 10px;
  gap: 10px;
}

.tab-button {
  width: 74px;
  border: 1px solid #a6a6a6;
  border-radius: 4px;
  background: #fff;
  color: #9a9a9a;
  font-size: 11px;
  font-weight: 700;
  margin-right: 5px;
}

.setup-tabs .tab-button {
  width: 78px;
  height: 35px;
}

.tab-button.is-active {
  background: #fdeceb;
  color: #9e2d25;
}

.dashboard-toolbar {
  min-height: 82px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 9px 27px 13px 20px;
}

.filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-control {
  display: grid;
  gap: 7px;
}

.filter-control span {
  color: #333;
  font-size: 13px;
  font-weight: 600;
}

.filter-control select,
.cctv-filter-row select {
  width: 101px;
  height: 34px;
  border-radius: 6px;
  background: #fff;
  border: 0;
  padding: 0 14px;
  color: #242424;
  font-size: 14px;
  outline: none;
  box-shadow: inset 0 0 0 1px #e4e4e4;
}

.stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  padding-top: 24px;
}

.stat-card {
  width: 75px;
  min-height: 42px;
  border-radius: 5px;
  background: #fff;
  display: grid;
  place-items: center;
  align-content: center;
}

.stat-card strong {
  font-size: 23px;
  line-height: 0.95;
  font-weight: 800;
}

.stat-card span {
  color: #909090;
  font-size: 11px;
  text-align: center;
}

.dashboard-content {
  padding: 0 34px 28px;
}

.admin-cctv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 393px));
  gap: 12px 82px;
  justify-content: center;
}

.logs-panel {
  background: #e3e3e3;
  border-radius: 5px;
  min-height: 478px;
  padding: 9px 15px 25px;
}

.warning-banner {
  width: max-content;
  margin: 0 0 14px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.24);
  color: #111;
  padding: 8px 16px;
  font-size: 12px;
}

.warning-banner span {
  color: #c7352c;
}

.log-card {
  min-height: 113px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  display: grid;
  grid-template-columns: 36px minmax(245px, 1fr) minmax(250px, 1fr) 160px;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
  margin-bottom: 15px;
}

.log-car {
  color: #202024;
}

.vehicle-info,
.parking-info {
  display: grid;
  gap: 4px;
  color: #111;
  font-size: 11px;
}

.vehicle-info p,
.parking-info p {
  color: #111;
  white-space: nowrap;
}

.vehicle-info span,
.parking-info span {
  display: inline-block;
  width: 10px;
  color: #111;
}

.status-parking {
  color: #09d82e;
  font-weight: 400;
}

.status-exited {
  color: #c7352c;
  font-weight: 400;
}

.status-muted {
  color: #898989;
  font-weight: 400;
}

.face-driver {
  text-align: center;
}

.face-driver > p {
  color: #111;
  margin-bottom: 5px;
  font-size: 12px;
}

.face-driver > div {
  display: flex;
  justify-content: center;
  gap: 18px;
}

.face-placeholder {
  display: grid;
  justify-items: center;
  gap: 3px;
}

.face-placeholder div {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: #dfe1e6;
  display: grid;
  place-items: end center;
  color: #6d7376;
  overflow: hidden;
}

.face-placeholder figcaption {
  color: #111;
  font-size: 11px;
}

.staff-manager-section,
.setup-section {
  padding: 24px 30px 28px;
}

.setup-section {
  padding: 0 0 28px;
}

.staff-list-panel,
.setup-workspace {
  width: min(914px, calc(100vw - 180px));
  margin: 0 auto;
  border-radius: 4px;
  background: #e3e3e3;
  padding: 17px 15px 32px;
}

.setup-workspace {
  min-height: 585px;
  margin-top: 26px;
}

.staff-list-header {
  display: grid;
  grid-template-columns: 145px 1fr 250px;
  align-items: start;
  gap: 16px;
  margin: 4px 0 17px;
}

.staff-list-header h2 {
  justify-self: center;
  color: #111;
  font-size: 19px;
  font-weight: 400;
}

.staff-list-header p {
  color: #111;
  font-size: 12px;
  line-height: 1.75;
}

.green-button,
.blue-button,
.red-button {
  min-width: 84px;
  height: 35px;
  border-radius: 4px;
  color: #111;
  font-size: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
}

.green-button {
  background: #23df5c;
}

.blue-button {
  background: #149cf0;
  color: #001322;
}

.red-button {
  background: #c7382f;
  color: #fff;
}

.add-staff-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 137px;
}

.staff-card {
  min-height: 145px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  display: grid;
  grid-template-columns: 80px 1fr 130px;
  align-items: center;
  gap: 18px;
  padding: 14px 36px 14px 20px;
  margin-bottom: 12px;
}

.profile-icon {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: #dfe1e6;
  color: #6d7376;
  display: grid;
  place-items: end center;
  overflow: hidden;
}

.profile-icon.large {
  width: 95px;
  height: 95px;
  margin: 0 auto 18px;
}

.staff-copy {
  display: grid;
  gap: 5px;
}

.staff-copy p {
  color: #111;
  font-size: 12px;
}

.staff-copy strong {
  font-weight: 400;
}

.status-online {
  color: #16a36a;
}

.status-offline {
  color: #c7352c;
}

.status-disable {
  color: #a0a0a0;
}

.inline-icon {
  display: inline-block;
  margin-left: 6px;
  color: #858585;
  vertical-align: -3px;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 32px;
  color: #202020;
}

.staff-form-panel {
  position: relative;
  width: min(914px, calc(100vw - 180px));
  min-height: 610px;
  margin: 0 auto;
  border-radius: 4px;
  background: #e3e3e3;
  padding: 24px 15px 82px;
}

.staff-form-panel h2,
.cctv-form-panel h2 {
  color: #111;
  text-align: center;
  font-size: 19px;
  font-weight: 400;
  margin-bottom: 16px;
}

.staff-form-card,
.cctv-form-card {
  position: relative;
  min-height: 326px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.24);
  padding: 25px;
}

.staff-form-panel.edit .staff-form-card {
  min-height: 506px;
}

.staff-form-fields {
  width: 320px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.staff-form-fields label {
  display: grid;
  grid-template-columns: 120px 120px 20px;
  align-items: center;
  color: #111;
  font-size: 12px;
}

.staff-form-fields input,
.overlay-card input,
.overlay-card select,
.cctv-form-card input,
.cctv-form-card select {
  height: 36px;
  border: 0;
  border-bottom: 1px solid #bcbcbc;
  background: transparent;
  color: #777;
  text-align: center;
  outline: none;
}

.field-icon {
  color: #858585;
}

.add-more-row {
  width: 100%;
  height: 33px;
  margin-top: 12px;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.24);
  color: #222;
  font-size: 12px;
}

.save-add {
  position: absolute;
  right: 18px;
  bottom: 14px;
}

.form-actions {
  position: absolute;
  right: 14px;
  bottom: 12px;
  display: flex;
  gap: 18px;
}

.parking-setup-list,
.cctv-setup-list {
  display: grid;
  gap: 0;
}

.setup-actions,
.cctv-filter-row {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  margin-bottom: 18px;
}

.setup-actions .green-button {
  width: 123px;
}

.building-row,
.floor-row,
.cctv-row-card {
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.24);
  display: grid;
  align-items: center;
  gap: 14px;
}

.building-row {
  grid-template-columns: 80px 1fr 92px 90px;
  min-height: 101px;
  padding: 12px 10px 12px 15px;
}

.floor-row {
  grid-template-columns: 72px 1fr 170px 96px 90px;
  min-height: 86px;
  padding: 10px 10px 10px 22px;
}

.building-photo {
  width: 80px;
  height: 59px;
  border-radius: 3px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.5), transparent 42%),
    linear-gradient(90deg, #6b4b3d 0 22%, #b9886a 23% 43%, #78412f 44% 70%, #c2c7be 71% 100%);
}

.building-photo.large {
  width: 176px;
  height: 132px;
  margin: 0 auto 18px;
}

.setup-copy {
  display: grid;
  gap: 5px;
}

.setup-copy p,
.floor-status {
  color: #111;
  font-size: 12px;
}

.floor-status strong {
  font-weight: 400;
}

.floor-status .available {
  color: #19d348;
}

.floor-status .disable {
  color: #969696;
}

.floor-icon {
  color: #858585;
  display: grid;
  place-items: center;
}

.map-link {
  display: grid;
  justify-items: center;
  gap: 3px;
  color: #202020;
  font-size: 12px;
}

.overlay-card {
  position: relative;
  width: min(410px, 100%);
  min-height: 303px;
  margin: 0 auto;
  border-radius: 4px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.24);
  padding: 20px 34px;
  display: grid;
  justify-items: center;
  align-content: start;
}

.overlay-card.floor-form {
  width: 326px;
  min-height: 353px;
  gap: 12px;
}

.overlay-card h2 {
  color: #111;
  font-size: 19px;
  font-weight: 400;
}

.close-x {
  position: absolute;
  left: 10px;
  top: 10px;
  color: #202020;
}

.overlay-card label {
  display: grid;
  gap: 8px;
  color: #222;
  font-size: 16px;
  text-align: left;
}

.overlay-card.floor-form label {
  width: 110px;
  font-size: 16px;
}

.overlay-card input,
.overlay-card select {
  width: 106px;
  border: 1px solid #d5d5d5;
  border-radius: 7px;
  text-align: left;
  padding: 0 12px;
}

.import-row {
  color: #222;
  font-size: 12px;
}

.import-row button {
  height: 34px;
  margin-right: 8px;
  border-radius: 4px;
  background: #e8e8e8;
  padding: 0 14px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
}

.cctv-filter-row {
  align-items: end;
}

.cctv-filter-row label {
  display: grid;
  gap: 6px;
  color: #222;
  font-size: 13px;
}

.cctv-row-card {
  grid-template-columns: 270px 1fr 106px;
  min-height: 188px;
  padding: 16px;
}

.inline-camera-scene {
  position: relative;
  overflow: hidden;
  width: 270px;
  height: 153px;
  border-radius: 4px;
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0)),
    linear-gradient(115deg, #1f272a 0 16%, #777d7d 17% 36%, #c8cbc7 37% 52%, #696e6d 53% 100%);
}

.inline-camera-scene::before {
  content: '';
  position: absolute;
  inset: 44% -10% 0;
  background:
    linear-gradient(95deg, transparent 0 32%, rgba(255, 255, 255, 0.18) 33% 34%, transparent 35%),
    radial-gradient(ellipse at 50% 0, rgba(255, 255, 255, 0.18), transparent 55%),
    #676b66;
  transform: perspective(220px) rotateX(45deg);
  transform-origin: top;
}

.timestamp,
.plate,
.pillar,
.scene-car,
.direction-arrow {
  position: absolute;
}

.timestamp {
  left: 9px;
  top: 7px;
  z-index: 5;
  color: rgba(255, 255, 255, 0.9);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  text-shadow: 0 1px 1px #000;
}

.pillar {
  top: 14px;
  z-index: 3;
  width: 35px;
  height: 108px;
  background: linear-gradient(#d8dddd, #b9bdbb);
  color: #5d4030;
  display: grid;
  place-items: end center;
  padding-bottom: 9px;
  font-size: 9px;
}

.pillar.one {
  left: 25%;
}

.pillar.two {
  right: 19%;
}

.scene-car {
  z-index: 4;
  width: 76px;
  height: 38px;
  border-radius: 48% 48% 16px 16px;
  background: linear-gradient(135deg, #1a1d20, #596064 52%, #151719);
  box-shadow: 0 12px 18px rgba(0, 0, 0, 0.48);
}

.car-a {
  left: 2%;
  top: 55px;
  transform: rotate(-13deg);
}

.car-b {
  right: 15%;
  top: 86px;
  transform: rotate(8deg);
  background: linear-gradient(135deg, #dde3e0, #8c9696 55%, #202427);
}

.car-c {
  left: -5%;
  bottom: 12px;
  transform: rotate(18deg);
}

.direction-arrow {
  left: 45%;
  bottom: 21px;
  z-index: 3;
  width: 16px;
  height: 67px;
  background: rgba(255, 255, 255, 0.2);
  clip-path: polygon(35% 0, 65% 0, 65% 60%, 100% 60%, 50% 100%, 0 60%, 35% 60%);
}

.plate {
  right: 8px;
  bottom: 7px;
  z-index: 5;
  color: #fff;
  font-family: ui-serif, Georgia, serif;
  font-size: 10px;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

.cctv-row-copy {
  display: grid;
  gap: 12px;
}

.cctv-row-copy p {
  color: #111;
  font-size: 12px;
}

.cctv-row-copy strong {
  color: #16a36a;
  font-weight: 400;
}

.edit-camera {
  height: 52px;
}

.cctv-form-panel {
  width: min(860px, 100%);
  margin: 0 auto;
  border-radius: 4px;
  background: #e3e3e3;
  padding: 15px;
}

.cctv-form-card {
  min-height: 466px;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 11px;
}

.cctv-form-card label {
  width: 230px;
  display: grid;
  grid-template-columns: 76px 1fr;
  align-items: center;
  color: #111;
  font-size: 12px;
}

.cctv-form-card select,
.cctv-form-card input {
  height: 34px;
  border: 1px solid #d5d5d5;
  border-radius: 8px;
  padding: 0 12px;
  text-align: left;
}

.search-field {
  position: relative;
}

.search-field svg {
  position: absolute;
  right: 10px;
  top: 9px;
  color: #111;
}

.form-scene {
  width: 270px;
  height: 153px;
  margin: 8px 0 0;
}

.offline-scene {
  width: 229px;
  height: 144px;
  border-radius: 5px;
  background: #d3d3d3;
  color: #333;
  display: grid;
  place-items: center;
}

.cctv-fields {
  width: 330px;
  display: grid;
  gap: 8px;
}

.cctv-fields p {
  display: grid;
  grid-template-columns: 95px 1fr 20px;
  align-items: center;
  color: #111;
  font-size: 12px;
}

.cctv-fields input {
  height: 24px;
  border: 0;
  border-bottom: 1px solid #bcbcbc;
  border-radius: 0;
}

.cctv-fields small {
  margin-left: 88px;
  color: #d33a32;
  font-size: 11px;
}

.ok-icon {
  color: #16a36a;
}

.bad-icon {
  color: #c7352c;
}

.cctv-fields strong.online {
  color: #16a36a;
  font-weight: 400;
}

.cctv-fields strong.offline {
  color: #8f8f8f;
  font-weight: 400;
}

@media (max-width: 980px) {
  .admin-cctv-grid {
    grid-template-columns: 1fr;
  }

  .staff-list-header,
  .staff-card,
  .building-row,
  .floor-row,
  .cctv-row-card,
  .log-card {
    grid-template-columns: 1fr;
  }

  .staff-list-panel,
  .setup-workspace,
  .staff-form-panel {
    width: calc(100vw - 150px);
  }
}
</style>
