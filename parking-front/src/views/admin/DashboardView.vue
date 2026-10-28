<template>
  <div class="admin-dashboard">
    <main class="admin-main">
      <section v-if="activeSection === 'dashboard'" class="section-shell dashboard-section">
        <SharedDashboard embedded />
      </section>

      <section v-else-if="activeSection === 'staff'" class="section-shell staff-manager-section">
        <div v-if="staffMode === 'list'" class="staff-list-panel">
          <header class="staff-list-header">
            <div class="staff-heading">
              <span class="staff-heading-icon"><Users :size="24" /></span>
              <div>
                <h2>Staff Manager</h2>
                <p>Manage your parking support team.</p>
              </div>
            </div>
            <button class="green-button add-staff-button" type="button" @click="openAddStaff">
              <UserPlus :size="18" /> Add Staff
            </button>
          </header>
          <div class="staff-list-toolbar">
            <h3>
              Staff List <span class="staff-count">{{ adminStore.staffList.length }}</span>
            </h3>
            <p>Staff can be edited when Offline or Disable.</p>
          </div>
          <div v-if="!adminStore.staffList.length" class="staff-empty" role="status">
            <span class="staff-empty-icon"><Users :size="34" :stroke-width="1.6" /></span>
            <h3>No staff yet</h3>
            <p>Add your team members to help manage parking and support users.</p>
            <button class="green-button add-staff-button" type="button" @click="openAddStaff">
              <UserPlus :size="18" /> Add your first staff
            </button>
          </div>
          <article v-for="staff in adminStore.staffList" :key="staff._id" class="staff-card">
            <div class="profile-icon"><UserRound class="h-14 w-14" :stroke-width="1.8" /></div>
            <div class="staff-copy">
              <p>Staff Name : {{ staff.staffName }}</p>
              <p>Username : {{ staff.username }}</p>
              <p class="password-line">
                Password :
                {{
                  visiblePasswordIds.has(staff._id) ? staff.password : maskPassword(staff.password)
                }}
                <button
                  class="password-eye"
                  type="button"
                  :aria-label="
                    visiblePasswordIds.has(staff._id) ? 'Hide password' : 'Show password'
                  "
                  @click="togglePasswordVisibility(staff._id)"
                >
                  <component
                    :is="visiblePasswordIds.has(staff._id) ? EyeOff : Eye"
                    class="inline-icon h-4 w-4"
                    :stroke-width="2.2"
                  />
                </button>
              </p>
              <p>Date Updated : {{ staff.dateAdded }}</p>
              <p>Time Updated : {{ staff.timeAdded }}</p>
              <p>
                Status : <strong :class="statusClass(staff.status)">{{ staff.status }}</strong>
              </p>
            </div>
            <div class="row-actions">
              <button
                type="button"
                aria-label="Edit staff"
                :disabled="!canEditStaff(staff)"
                :title="
                  canEditStaff(staff)
                    ? 'Edit staff'
                    : 'Cannot edit staff while online or logging in'
                "
                @click="openEditStaff(staff)"
              >
                <SquarePen class="h-6 w-6" :stroke-width="2.4" />
              </button>
              <button
                type="button"
                aria-label="Delete staff"
                @click="adminStore.deleteStaff(staff._id)"
              >
                <Trash2 class="h-6 w-6" :stroke-width="2.4" />
              </button>
            </div>
          </article>
        </div>

        <StaffFormPanel
          v-else
          :mode="staffMode"
          :forms="staffForms"
          @save="saveStaff"
          @cancel="staffMode = 'list'"
          @add-more="addStaffForm"
        />
      </section>

      <section v-else class="section-shell setup-section">
        <div
          :class="[
            'setup-workspace',
            {
              'parking-list-workspace': setupMode === 'parking-list',
              'cctv-list-workspace': setupMode === 'cctv-list',
              'cctv-add-workspace': setupMode === 'add-cctv' || setupMode === 'edit-cctv',
            },
          ]"
        >
          <ParkingSetupList
            v-if="setupMode === 'parking-list'"
            :floors="parkingFloors"
            :buildings="buildings"
            :is-loading="isLoadingBuildings || isLoadingFloors"
            :error="buildingError || floorError"
            :expand-building-id="expandBuildingId"
            :camera-summaries="cameraSummaries"
            :is-loading-cameras="isLoadingCameras"
            :camera-error="cameraError"
            @reload-cameras="loadCameraSummaries"
            @add-building="openAddBuilding"
            @edit-building="openEditBuilding"
            @delete-building="openDeleteBuilding"
            @reload-buildings="loadParkingSetup"
            @add-floor="openAddFloor"
            @edit-floor="openEditFloor"
            @delete-floor="openDeleteFloor"
            @view-cctv="openFloorCctv"
          />

          <BuildingFormPanel
            v-else-if="setupMode === 'add-building' || setupMode === 'edit-building'"
            :mode="setupMode === 'add-building' ? 'add' : 'edit'"
            :building="editingBuilding"
            @saved="handleBuildingSaved"
            @cancel="showParkingSetup"
          />

          <FloorFormPanel
            v-else-if="setupMode === 'add-floor' || setupMode === 'edit-floor'"
            :mode="setupMode === 'add-floor' ? 'add' : 'edit'"
            :buildings="buildings"
            :floor="editingFloor"
            @saved="handleFloorSaved"
            @deleted="handleFloorSaved"
            @cancel="showParkingSetup"
          />

          <CCTVSetupList
            v-else-if="setupMode === 'cctv-list'"
            :key="cctvFloor?._id || 'all'"
            :selected-floor="cctvFloor"
            @add-cctv="setupMode = 'add-cctv'"
            @edit-cctv="openEditCctv"
            @view-map="openCctvParkingMap"
            @floor-updated="handleCctvFloorUpdated"
            @back="backFromCctv"
          />

          <AddCCTVPanel
            v-else-if="setupMode === 'add-cctv' || setupMode === 'edit-cctv'"
            :key="setupMode"
            :mode="setupMode === 'edit-cctv' ? 'edit' : 'add'"
            :camera="setupMode === 'edit-cctv' ? editingCctv : null"
            :selected-floor="cctvFloor"
            @saved="handleCctvFloorUpdated"
            @save="showCctvSetup"
            @cancel="showCctvSetup"
          />
        </div>

        <div
          v-if="floorToDelete"
          class="building-delete-backdrop"
          @click.self="!isDeletingFloor && (floorToDelete = null)"
        >
          <div
            class="building-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="floor-delete-title"
          >
            <h2 id="floor-delete-title">Delete Floor {{ floorToDelete.floor }}?</h2>
            <p>
              {{ floorToDelete.building?.building_name }} /
              {{ floorToDelete.veh_type === 'car' ? 'Cars' : 'Motorcycles' }}: this floor and its
              parking map file will be deleted.
            </p>
            <p v-if="deleteFloorError" class="building-delete-error" role="alert">
              {{ deleteFloorError }}
            </p>
            <div class="building-delete-actions">
              <button type="button" :disabled="isDeletingFloor" @click="floorToDelete = null">
                Cancel
              </button>
              <button
                type="button"
                class="red-button"
                :disabled="isDeletingFloor"
                @click="deleteFloor"
              >
                {{ isDeletingFloor ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>

        <div
          v-if="buildingToDelete"
          class="building-delete-backdrop"
          @click.self="!isDeletingBuilding && (buildingToDelete = null)"
        >
          <div
            class="building-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="building-delete-title"
          >
            <h2 id="building-delete-title">Delete {{ buildingToDelete.building_name }}?</h2>
            <p>The building, its floors, parking map files and image will be deleted.</p>
            <p v-if="deleteBuildingError" class="building-delete-error" role="alert">
              {{ deleteBuildingError }}
            </p>
            <div class="building-delete-actions">
              <button type="button" :disabled="isDeletingBuilding" @click="buildingToDelete = null">
                Cancel
              </button>
              <button
                type="button"
                class="red-button"
                :disabled="isDeletingBuilding"
                @click="deleteBuilding"
              >
                {{ isDeletingBuilding ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue'
import {
  ArrowLeft,
  Bike,
  Building2,
  CarFront,
  Eye,
  EyeOff,
  Menu,
  SquarePen,
  Trash2,
  UserPlus,
  Users,
  UserRound,
  Video,
} from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAdminStore, type StaffMember } from '@/stores/admin'
import SharedDashboard from '@/views/staff/DashboardView.vue'
import BuildingFormPanel from './BuildingFormPanel.vue'
import CCTVSetupList from './CCTVSetupList.vue'
import AddCCTVPanel from './AddCCTVPanel.vue'
import type { CctvFormCamera } from './cctvForm'
import BuildingCameraSummary from './BuildingCameraSummary.vue'
import FloorFormPanel from './FloorFormPanel.vue'
import {
  buildingService,
  floorService,
  type ParkingBuilding,
  type ParkingFloor,
  type BuildingCameraSummary as CameraSummary,
} from '@/services/api'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { restoreMapDraft } from '@/components/parking/parkingMapPreview'

type AdminSection = 'dashboard' | 'staff' | 'setup'
type StaffMode = 'list' | 'add' | 'edit'
type SetupMode =
  | 'parking-list'
  | 'add-building'
  | 'edit-building'
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

const adminStore = useAdminStore()
const route = useRoute()
const router = useRouter()

const activeSection = computed<AdminSection>(() => {
  if (route.path.endsWith('/staff')) return 'staff'
  if (route.path.endsWith('/setup')) return 'setup'
  return 'dashboard'
})
const staffMode = ref<StaffMode>('list')
const setupMode = ref<SetupMode>('parking-list')
const buildings = ref<ParkingBuilding[]>([])
const parkingFloors = ref<ParkingFloor[]>([])
const isLoadingBuildings = ref(false)
const isLoadingFloors = ref(false)
const buildingError = ref('')
const floorError = ref('')
const cameraSummaries = ref<Record<string, CameraSummary>>({})
const isLoadingCameras = ref(false)
const cameraError = ref('')
const editingBuilding = ref<ParkingBuilding | null>(null)
const editingFloor = ref<ParkingFloor | null>(null)
const editingCctv = ref<CctvFormCamera | null>(null)
const cctvFloor = ref<ParkingFloor | null>(null)
const floorToDelete = ref<ParkingFloor | null>(null)
const isDeletingFloor = ref(false)
const deleteFloorError = ref('')
const expandBuildingId = ref<string | null>(null)
const buildingToDelete = ref<ParkingBuilding | null>(null)
const isDeletingBuilding = ref(false)
const deleteBuildingError = ref('')
const editingStaffId = ref<string | null>(null)
const visiblePasswordIds = ref(new Set<string>())

const createStaffForm = (staff?: StaffMember): StaffFormState => ({
  staffName: staff?.staffName || '',
  username: staff?.username || '',
  password: staff?.password || '',
  confirmPassword: '',
  status: staff?.status || 'Offline',
})

const staffForms = ref<StaffFormState[]>([createStaffForm()])

watch(activeSection, (section, previousSection) => {
  if (section === previousSection) return
  if (section === 'staff') staffMode.value = 'list'
  if (section === 'setup') {
    showParkingSetup()
    void loadParkingSetup()
  }
})

onMounted(() => {
  if (activeSection.value === 'setup') void loadParkingSetup()
})

async function loadParkingSetup() {
  await Promise.all([loadBuildings(), loadFloors(), loadCameraSummaries()])
}

async function loadCameraSummaries() {
  isLoadingCameras.value = true
  cameraError.value = ''
  try {
    const response = await buildingService.cameraSummaries()
    cameraSummaries.value = response.data.summaries
  } catch {
    cameraError.value = 'Failed to load camera summaries.'
  } finally {
    isLoadingCameras.value = false
  }
}

async function loadBuildings() {
  isLoadingBuildings.value = true
  buildingError.value = ''
  try {
    const response = await buildingService.list()
    buildings.value = response.data.buildings
  } catch {
    buildingError.value = 'Failed to load buildings.'
  } finally {
    isLoadingBuildings.value = false
  }
}

async function loadFloors() {
  isLoadingFloors.value = true
  floorError.value = ''
  try {
    const response = await floorService.list()
    parkingFloors.value = response.data.floors
  } catch {
    floorError.value = 'Failed to load floors.'
  } finally {
    isLoadingFloors.value = false
  }
}

const openAddBuilding = () => {
  editingBuilding.value = null
  setupMode.value = 'add-building'
}

const openEditBuilding = (building: ParkingBuilding) => {
  editingBuilding.value = building
  setupMode.value = 'edit-building'
}

const handleBuildingSaved = () => {
  showParkingSetup()
  void loadParkingSetup()
}

const openAddFloor = () => {
  editingFloor.value = null
  setupMode.value = 'add-floor'
}

const openEditFloor = (floor: ParkingFloor) => {
  editingFloor.value = floor
  setupMode.value = 'edit-floor'
}

const handleFloorSaved = (buildingId: string) => {
  expandBuildingId.value = buildingId
  showParkingSetup()
  void loadFloors()
}

const openDeleteFloor = (floor: ParkingFloor) => {
  deleteFloorError.value = ''
  floorToDelete.value = floor
}

const deleteFloor = async () => {
  const floor = floorToDelete.value
  if (!floor || isDeletingFloor.value) return
  isDeletingFloor.value = true
  deleteFloorError.value = ''
  try {
    await floorService.remove(floor._id)
    parkingFloors.value = parkingFloors.value.filter((item) => item._id !== floor._id)
    floorToDelete.value = null
    void loadCameraSummaries()
  } catch (cause) {
    deleteFloorError.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Failed to delete floor.'
      : 'Failed to delete floor.'
  } finally {
    isDeletingFloor.value = false
  }
}

const handleCctvFloorUpdated = (floor: ParkingFloor) => {
  cctvFloor.value = floor
  parkingFloors.value = parkingFloors.value.map((item) => (item._id === floor._id ? floor : item))
}

const openEditCctv = (camera: CctvFormCamera) => {
  editingCctv.value = camera
  setupMode.value = 'edit-cctv'
}

const openFloorCctv = (floor: ParkingFloor) => {
  cctvFloor.value = floor
  setupMode.value = 'cctv-list'
}

const openDeleteBuilding = (building: ParkingBuilding) => {
  deleteBuildingError.value = ''
  buildingToDelete.value = building
}

const deleteBuilding = async () => {
  const building = buildingToDelete.value
  if (!building || isDeletingBuilding.value) return

  isDeletingBuilding.value = true
  deleteBuildingError.value = ''
  try {
    await buildingService.remove(building._id)
    buildingToDelete.value = null
    expandBuildingId.value = null
    await loadParkingSetup()
  } catch (cause) {
    deleteBuildingError.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Failed to delete building.'
      : 'Failed to delete building.'
  } finally {
    isDeletingBuilding.value = false
  }
}

const maskPassword = (password: string) => {
  return '*'.repeat(Math.max(password.length, 8))
}

const togglePasswordVisibility = (staffId: string) => {
  const nextVisible = new Set(visiblePasswordIds.value)
  if (nextVisible.has(staffId)) {
    nextVisible.delete(staffId)
  } else {
    nextVisible.add(staffId)
  }
  visiblePasswordIds.value = nextVisible
}

const canEditStaff = (staff: StaffMember) => {
  return staff.status !== 'Online' && staff.status !== 'Logging in'
}

const addStaffForm = () => {
  staffForms.value = [...staffForms.value, createStaffForm()]
}

const openAddStaff = () => {
  editingStaffId.value = null
  staffForms.value = [createStaffForm()]
  staffMode.value = 'add'
}

const openEditStaff = (staff: StaffMember) => {
  if (!canEditStaff(staff)) return
  editingStaffId.value = staff._id
  staffForms.value = [createStaffForm(staff)]
  staffMode.value = 'edit'
}

const saveStaff = () => {
  if (staffMode.value === 'add') {
    staffForms.value.forEach((form, index) => {
      adminStore.addStaff({
        _id: `${Date.now()}-${index}`,
        staffName: form.staffName,
        username: form.username,
        password: form.password,
        dateAdded: '19/3/2569',
        timeAdded: '12:00:00',
        status: form.status,
      })
    })
  } else if (editingStaffId.value) {
    const form = staffForms.value[0]
    if (!form) return
    adminStore.updateStaff(editingStaffId.value, {
      staffName: form.staffName,
      username: form.username,
      password: form.password,
      status: form.status,
    })
  }
  staffMode.value = 'list'
}

const backFromCctv = () => {
  expandBuildingId.value = cctvFloor.value?.building?._id || null
  showParkingSetup()
}

const showParkingSetup = () => {
  setupMode.value = 'parking-list'
}

const openCctvParkingMap = () => {
  if (cctvFloor.value) {
    void router.push({ name: 'AdminParkingMap', params: { floorId: cctvFloor.value._id } })
    return
  }
  void router.push('/admin/dashboard')
}

const showCctvSetup = () => {
  setupMode.value = 'cctv-list'
}

const statusClass = (status: StaffMember['status']) => {
  return `status-${status.toLowerCase().replace(/\s+/g, '-')}`
}

const StaffFormPanel = defineComponent({
  props: {
    mode: {
      type: String as () => 'add' | 'edit',
      required: true,
    },
    forms: {
      type: Array as () => StaffFormState[],
      required: true,
    },
  },
  emits: ['save', 'cancel', 'add-more'],
  setup(props, { emit }) {
    const visibleFormPasswordIndexes = ref(new Set<number>())

    const isFormPasswordVisible = (index: number) => visibleFormPasswordIndexes.value.has(index)

    const toggleFormPasswordVisibility = (index: number) => {
      const nextVisible = new Set(visibleFormPasswordIndexes.value)
      if (nextVisible.has(index)) {
        nextVisible.delete(index)
      } else {
        nextVisible.add(index)
      }
      visibleFormPasswordIndexes.value = nextVisible
    }

    const renderStaffCard = (form: StaffFormState, index: number) =>
      h('div', { class: 'staff-form-card', key: index }, [
        h('div', { class: 'profile-icon large' }, [
          h(UserRound, { class: 'h-20 w-20', strokeWidth: 1.6 }),
        ]),
        h('div', { class: 'staff-form-fields' }, [
          h('label', [
            h('span', 'Staff Name :'),
            h('input', {
              value: form.staffName,
              onInput: (event: Event) => {
                form.staffName = (event.target as HTMLInputElement).value
              },
            }),
          ]),
          h('label', [
            h('span', 'Username :'),
            h('input', {
              value: form.username,
              onInput: (event: Event) => {
                form.username = (event.target as HTMLInputElement).value
              },
            }),
          ]),
          h('label', [
            h('span', 'Password :'),
            h('input', {
              type: isFormPasswordVisible(index) ? 'text' : 'password',
              value: form.password,
              onInput: (event: Event) => {
                form.password = (event.target as HTMLInputElement).value
              },
            }),
            h(
              'button',
              {
                class: 'field-icon-button',
                type: 'button',
                'aria-label': isFormPasswordVisible(index) ? 'Hide password' : 'Show password',
                title: isFormPasswordVisible(index) ? 'Hide password' : 'Show password',
                onClick: () => toggleFormPasswordVisibility(index),
              },
              [
                h(isFormPasswordVisible(index) ? Eye : EyeOff, {
                  class: 'field-icon h-4 w-4',
                  strokeWidth: 2.2,
                }),
              ],
            ),
          ]),
          h('label', [
            h('span', 'Confirm Password :'),
            h('input', {
              type: 'password',
              value: form.confirmPassword,
              onInput: (event: Event) => {
                form.confirmPassword = (event.target as HTMLInputElement).value
              },
            }),
          ]),
        ]),
      ])

    return () =>
      h('div', { class: ['staff-form-panel', props.mode] }, [
        h(
          'button',
          {
            class: 'form-back-button',
            type: 'button',
            'aria-label': 'Back to Staff List',
            onClick: () => emit('cancel'),
          },
          [h(ArrowLeft, { class: 'h-5 w-5', strokeWidth: 2.4 })],
        ),
        h('h2', props.mode === 'add' ? 'Add Staff' : 'Edit Staff'),
        props.forms.map(renderStaffCard),
        props.mode === 'add'
          ? h(
              'button',
              { class: 'add-more-row', type: 'button', onClick: () => emit('add-more') },
              '+ Add More Staff',
            )
          : null,
        h('div', { class: 'form-actions' }, [
          h(
            'button',
            {
              class: props.mode === 'add' ? 'green-button' : 'blue-button',
              type: 'button',
              onClick: () => emit('save'),
            },
            props.mode === 'add' ? 'Add' : 'Edit',
          ),
          h(
            'button',
            { class: 'red-button', type: 'button', onClick: () => emit('cancel') },
            'Cancel',
          ),
        ]),
      ])
  },
})

const ParkingSetupList = defineComponent({
  props: {
    buildings: {
      type: Array as () => ParkingBuilding[],
      required: true,
    },
    floors: {
      type: Array as () => ParkingFloor[],
      required: true,
    },
    isLoading: { type: Boolean, required: true },
    error: { type: String, required: true },
    expandBuildingId: { type: String as () => string | null, default: null },
    cameraSummaries: { type: Object as () => Record<string, CameraSummary>, required: true },
    isLoadingCameras: { type: Boolean, required: true },
    cameraError: { type: String, required: true },
  },
  emits: [
    'add-building',
    'edit-building',
    'delete-building',
    'add-floor',
    'edit-floor',
    'delete-floor',
    'view-cctv',
    'reload-buildings',
    'reload-cameras',
  ],
  setup(props, { emit }) {
    const expandedBuildingId = ref<string | null>(props.expandBuildingId)
    const auth = useAuthStore()
    const hasParkingMap = (floor: ParkingFloor) => {
      if (
        floor.parking_map &&
        (floor.parking_map.slots.length ||
          floor.parking_map.layout.shapes.length ||
          floor.parking_map.layout.background)
      )
        return true
      if (floor.parking_slot_file || floor.parking_slot_files?.length) return true
      try {
        const raw = localStorage.getItem(
          `parking-map-preview:v1:${auth.user?._id || auth.user?.id}:${floor._id}`,
        )
        if (!raw) return false
        const draft = restoreMapDraft(raw)
        return draft.sourceName !== 'E4 sample' && draft.slots.length > 0
      } catch {
        return false
      }
    }

    const renderFloorRow = (floor: ParkingFloor) =>
      h('article', { class: 'floor-row', key: floor._id }, [
        h('div', { class: 'floor-icon' }, [
          floor.veh_type === 'motorcycle'
            ? h(Bike, { class: 'h-11 w-11', strokeWidth: 2.5 })
            : h(CarFront, { class: 'h-11 w-11', strokeWidth: 2.5 }),
        ]),
        h('div', { class: 'setup-copy' }, [
          h(
            'p',
            `Floor : ${floor.floor}      (${floor.veh_type === 'car' ? 'Cars' : 'Motorcycle'})`,
          ),
          h('p', `Date Updated : ${floor.date_add}`),
          h('p', `Time Updated : ${floor.time_add}`),
        ]),
        h('p', { class: 'floor-status' }, [
          'Status : ',
          h(
            'strong',
            { class: floor.status === 'available' ? 'available' : 'disable' },
            floor.status === 'available' ? 'Available' : 'Disable',
          ),
        ]),
        h('div', { class: 'floor-actions' }, [
          h(
            RouterLink,
            {
              class: ['floor-parking-map', { 'has-map': hasParkingMap(floor) }],
              title: hasParkingMap(floor) ? 'Parking map available' : 'No parking map yet',
              to: { name: 'AdminParkingMap', params: { floorId: floor._id } },
              'aria-label': `Parking Map for floor ${floor.floor} (${floor.veh_type === 'car' ? 'Cars' : 'Motorcycle'})`,
            },
            () => 'Parking Map',
          ),
          h(
            'button',
            {
              class: 'edit-floor-button floor-cctv-button',
              type: 'button',
              'aria-label': `CCTV for floor ${floor.floor} (${floor.veh_type === 'car' ? 'Cars' : 'Motorcycle'})`,
              onClick: () => emit('view-cctv', floor),
            },
            [h(Video, { class: 'h-5 w-5', 'aria-hidden': 'true' }), 'CCTV'],
          ),
          h(
            'button',
            {
              class: 'edit-floor-button',
              type: 'button',
              'aria-label': `Edit floor ${floor.floor} (${floor.veh_type === 'car' ? 'Cars' : 'Motorcycle'})`,
              onClick: () => emit('edit-floor', floor),
            },
            [h(SquarePen, { class: 'h-5 w-5', 'aria-hidden': 'true' }), 'Edit Floor'],
          ),
          h(
            'button',
            {
              class: 'delete-building-button delete-floor-button',
              type: 'button',
              'aria-label': `Delete floor ${floor.floor} (${floor.veh_type === 'car' ? 'Cars' : 'Motorcycle'})`,
              onClick: () => emit('delete-floor', floor),
            },
            [h(Trash2, { class: 'h-5 w-5', 'aria-hidden': 'true' }), 'Delete'],
          ),
        ]),
      ])

    return () =>
      h('div', { class: 'parking-setup-list' }, [
        h('div', { class: 'setup-actions' }, [
          h(
            'button',
            { class: 'green-button', type: 'button', onClick: () => emit('add-building') },
            '+ Add Building',
          ),
          h(
            'button',
            { class: 'green-button', type: 'button', onClick: () => emit('add-floor') },
            '+ Add Floor',
          ),
        ]),
        props.isLoading ? h('p', 'Loading parking setup...') : null,
        props.error
          ? h('p', { class: 'building-list-error', role: 'alert' }, [
              props.error,
              h('button', { type: 'button', onClick: () => emit('reload-buildings') }, 'Retry'),
            ])
          : null,
        !props.isLoading && !props.error && !props.buildings.length
          ? h('p', 'No buildings found. Add a building to get started.')
          : null,
        ...props.buildings.flatMap((building) => {
          const buildingFloors = props.floors.filter(
            (floor) => floor.building?._id === building._id,
          )
          const isExpanded = expandedBuildingId.value === building._id
          return [
            h(
              'article',
              { class: ['building-row', isExpanded ? 'is-expanded' : ''], key: building._id },
              [
                h(
                  'div',
                  { class: ['building-photo', !building.building_image ? 'is-placeholder' : ''] },
                  building.building_image
                    ? [
                        h('img', {
                          src: buildingService.imageUrl(building.building_image),
                          alt: `${building.building_name} building`,
                          loading: 'lazy',
                        }),
                      ]
                    : [
                        h(Building2, { 'aria-hidden': 'true', strokeWidth: 1.3 }),
                        h('span', 'No building image'),
                      ],
                ),
                h('div', { class: 'setup-copy' }, [
                  h('p', `Building Name : ${building.building_name}`),
                  h(
                    'p',
                    `All Floors : ${new Set(buildingFloors.map((floor) => floor.floor)).size}`,
                  ),
                  h('p', `Date Updated : ${building.date_add}`),
                  h('p', `Time Updated : ${building.time_add}`),
                ]),
                h(BuildingCameraSummary, {
                  summary: props.cameraSummaries[building._id],
                  loading: props.isLoadingCameras,
                  error: props.cameraError,
                  onRetry: () => emit('reload-cameras'),
                }),
                h(
                  'button',
                  {
                    class: 'map-link view-floor-button',
                    type: 'button',
                    'aria-label': `${isExpanded ? 'Hide' : 'View'} floors for ${building.building_name}`,
                    'aria-expanded': isExpanded,
                    'aria-controls': `building-floors-${building._id}`,
                    onClick: () => {
                      expandedBuildingId.value = isExpanded ? null : building._id
                    },
                  },
                  [
                    h(Menu, { class: 'h-10 w-10', strokeWidth: 1.8, 'aria-hidden': 'true' }),
                    h('span', isExpanded ? 'Hide Floor' : 'View Floor'),
                  ],
                ),
                h('div', { class: 'building-card-actions' }, [
                  h(
                    'button',
                    {
                      class: 'edit-building-button',
                      type: 'button',
                      'aria-label': `Edit ${building.building_name} building`,
                      onClick: () => emit('edit-building', building),
                    },
                    [h(SquarePen, { class: 'h-4 w-4', 'aria-hidden': 'true' }), 'Edit'],
                  ),
                  h(
                    'button',
                    {
                      class: 'delete-building-button',
                      type: 'button',
                      'aria-label': `Delete ${building.building_name} building`,
                      onClick: () => emit('delete-building', building),
                    },
                    [h(Trash2, { class: 'h-5 w-5', strokeWidth: 2.2 })],
                  ),
                ]),
              ],
            ),
            isExpanded
              ? h(
                  'section',
                  {
                    class: 'floor-expansion-panel',
                    id: `building-floors-${building._id}`,
                    'aria-label': `${building.building_name} Parking Floors`,
                    key: `${building._id}-floors`,
                  },
                  [
                    !buildingFloors.length
                      ? h(
                          'p',
                          { class: 'empty-floor-message' },
                          'No floors configured. Use + Add Floor to get started.',
                        )
                      : null,
                    ...buildingFloors.map(renderFloorRow),
                  ],
                )
              : null,
          ]
        }),
      ])
  },
})
</script>

<style>
.admin-dashboard {
  min-height: calc(100vh - 78px);
  background: #d8d8d8;
  color: #202020;
}

.admin-main {
  min-height: calc(100vh - 78px);
  margin-left: 138px;
}

.tabbar {
  height: 46px;
  background: #fff;
  display: flex;
  align-items: stretch;
  padding-left: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
}

.tab-button {
  width: 110px;
  border: 1px solid #a6a6a6;
  border-radius: 5px;
  background: #fff;
  color: #9a9a9a;
  font-size: 14px;
  font-weight: 700;
  margin-right: 8px;
}

.tab-button.is-active {
  background: #fdeceb;
  color: #9e2d25;
}

.dashboard-toolbar {
  min-height: 116px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 25px 18px 16px;
}

.filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-control {
  display: grid;
  gap: 9px;
}

.filter-control span {
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.filter-control select,
.cctv-filter-row select {
  width: 107px;
  height: 43px;
  border-radius: 8px;
  background: #fff;
  border: 0;
  padding: 0 16px;
  color: #242424;
  font-size: 16px;
  outline: none;
  box-shadow: inset 0 0 0 1px #e4e4e4;
}

.stats {
  display: flex;
  gap: 13px;
  flex-wrap: wrap;
  padding-top: 25px;
}

.stat-card {
  width: 74px;
  min-height: 42px;
  border-radius: 5px;
  background: #fff;
  display: grid;
  place-items: center;
  align-content: center;
}

.stat-card strong {
  font-size: 24px;
  line-height: 0.95;
  font-weight: 800;
}

.stat-card span {
  color: #909090;
  font-size: 11px;
  text-align: center;
}

.dashboard-content {
  padding: 16px 31px 32px;
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
  min-height: 670px;
  padding: 10px 20px 44px;
}

.warning-banner {
  width: max-content;
  margin: 0 0 21px;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  color: #111;
  padding: 11px 22px;
  font-size: 16px;
}

.warning-banner span {
  color: #c7352c;
}

.log-card {
  min-height: 158px;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  display: grid;
  grid-template-columns: 54px minmax(280px, 1fr) minmax(310px, 1fr) 205px;
  align-items: center;
  gap: 18px;
  padding: 14px 28px 14px 22px;
  margin-bottom: 21px;
}

.log-car {
  color: #202024;
}

.vehicle-info,
.parking-info {
  display: grid;
  gap: 7px;
  color: #111;
  font-size: 16px;
}

.vehicle-info p,
.parking-info p {
  color: #111;
  white-space: nowrap;
}

.vehicle-info span,
.parking-info span {
  display: inline-block;
  width: 12px;
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
  margin-bottom: 10px;
  font-size: 16px;
}

.face-driver > div {
  display: flex;
  justify-content: center;
  gap: 26px;
}

.face-placeholder {
  display: grid;
  justify-items: center;
  gap: 5px;
}

.face-placeholder div {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: #dfe1e6;
  display: grid;
  place-items: end center;
  color: #6d7376;
  overflow: hidden;
}

.face-placeholder figcaption {
  color: #111;
  font-size: 16px;
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

.status-logging-in {
  color: #bd7a10;
}

.password-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.password-eye {
  width: 22px;
  height: 22px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  color: #858585;
}

.password-eye:hover {
  background: #f1f1f1;
  color: #202020;
}

.inline-icon {
  display: inline-block;
  color: #858585;
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 32px;
  color: #202020;
}

.row-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.28;
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

.form-back-button {
  position: absolute;
  left: 18px;
  top: 18px;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: #fff;
  color: #202020;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);
}

.form-back-button:hover {
  background: #fdeceb;
  color: #9e2d25;
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

.staff-form-card + .staff-form-card {
  margin-top: 12px;
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

.field-icon-button {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  color: #858585;
  display: grid;
  place-items: center;
}

.field-icon-button:hover {
  background: #f1f1f1;
  color: #202020;
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

.setup-workspace.cctv-list-workspace,
.setup-workspace.cctv-add-workspace {
  width: calc(100% - 48px);
  max-width: 1192px;
  min-height: calc(100vh - 174px);
  margin: 24px auto 0;
  padding: 16px;
  border-radius: 6px;
}

.setup-workspace.parking-list-workspace {
  width: 100%;
  max-width: 1240px;
  min-height: 585px;
  margin: 0 auto;
  padding: 22px 24px;
  background: transparent;
}

.parking-setup-list .setup-actions {
  margin-bottom: 12px;
  gap: 12px;
}

.parking-setup-list .setup-actions .green-button {
  width: 136px;
  height: 38px;
  border-radius: 6px;
  background: #20d653;
  font-size: 14px;
  box-shadow: none;
}

.parking-setup-list .setup-actions .green-button + .green-button {
  background: #fff;
  border: 1px solid #ababab;
}

.building-row {
  position: relative;
  grid-template-columns: 190px minmax(210px, 1fr) minmax(220px, 0.9fr) 100px;
  grid-template-areas: 'photo details cameras toggle';
  min-height: 170px;
  padding: 16px 20px;
  gap: 22px;
  border: 2px solid #2828ff;
  border-radius: 10px;
  margin-top: 12px;
}

.setup-actions + .building-row {
  margin-top: 0;
}

.building-row .building-photo {
  grid-area: photo;
}
.building-row .building-camera-summary {
  grid-area: cameras;
}
.building-row .view-floor-button {
  grid-area: toggle;
}

.building-row .setup-copy {
  grid-area: details;
  gap: 7px;
}

.building-row .setup-copy p {
  font-size: 16px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.building-card-actions {
  position: absolute;
  right: 16px;
  bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.edit-building-button,
.delete-building-button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  padding: 6px 8px;
  color: #555;
  font-size: 13px;
}

.delete-building-button {
  width: 34px;
  color: #b42318;
}

.delete-building-button:hover {
  background: #feeceb;
}

.edit-building-button:hover {
  background: #f0f0f0;
}

.parking-setup-list button:focus-visible {
  outline: 3px solid #2356d8;
  outline-offset: 3px;
}

.building-delete-backdrop {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.45);
}

.building-delete-dialog {
  width: min(420px, 100%);
  border-radius: 8px;
  background: #fff;
  padding: 24px;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.2);
}

.building-delete-dialog h2 {
  margin-bottom: 10px;
  font-size: 20px;
  font-weight: 700;
}

.building-delete-dialog p {
  margin-bottom: 16px;
  font-size: 14px;
}

.building-delete-error {
  color: #b42318;
}

.building-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.building-delete-actions button {
  min-width: 84px;
  min-height: 36px;
  border-radius: 5px;
}

.building-row.is-expanded {
  border-color: #1919ff;
}

.view-floor-button {
  justify-self: center;
  align-self: center;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
}

.view-floor-button svg {
  width: 44px;
  height: 34px;
  padding: 3px 7px;
  border-radius: 5px;
  color: #999;
  background: #dedede;
}

.view-floor-button span {
  color: #666;
  font-size: 12px;
}

.view-floor-button:hover,
.view-floor-button[aria-expanded='true']:hover {
  background: #f0f0ff;
}

.floor-expansion-panel {
  display: grid;
  gap: 5px;
  margin-top: 6px;
}

.empty-floor-message {
  padding: 24px;
  border-radius: 10px;
  background: #fff;
  color: #666;
  font-size: 14px;
}

.floor-row {
  grid-template-columns: 46px minmax(140px, 1fr) 90px minmax(0, auto);
  min-height: 100px;
  padding: 12px 20px;
  gap: 18px;
  border: 1px solid #ddd;
  border-radius: 11px;
}

.floor-row .setup-copy {
  gap: 4px;
}

.floor-row .setup-copy p,
.floor-row .floor-status {
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.floor-row .floor-icon svg {
  width: 46px;
  height: 46px;
  stroke-width: 2;
  color: #909090;
}

.floor-row .floor-status {
  display: grid;
  justify-items: start;
  gap: 9px;
}

.floor-row .floor-status strong {
  padding: 4px 15px;
  border-radius: 20px;
  background: #ededed;
  font-size: 14px;
}

.floor-row .floor-status .available {
  color: #16723b;
  background: #e5f5e9;
}

.floor-row .floor-status .disable {
  color: #686868;
}

.floor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.floor-actions .delete-floor-button {
  display: inline-flex;
  width: auto;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid #cf4647;
  border-radius: 10px;
}

.floor-parking-map.has-map {
  border-color: #219653;
  background: #e5f5e9;
  color: #16723b;
}

.floor-parking-map.has-map:hover {
  background: #d0edd8;
}

.floor-parking-map {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid #cf4647;
  border-radius: 10px;
  background: #fff1f1;
  color: #a52f30;
  text-align: center;
  font-size: 14px;
}

.floor-parking-map:hover {
  background: #ffe1e1;
}

.edit-floor-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid #333;
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
}

.edit-floor-button:hover {
  background: #f3f3f3;
}

.building-photo {
  width: 100%;
  height: 136px;
  border-radius: 8px;
  overflow: hidden;
  background: #efefef;
}

.building-photo.is-placeholder {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 10px;
  border: 1px solid #dedede;
  color: #888;
  font-size: 13px;
}

.building-photo.is-placeholder svg {
  width: 44px;
  height: 44px;
}

.building-photo img {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.building-list-error {
  color: #b42318;
}

.building-list-error button {
  margin-left: 10px;
  text-decoration: underline;
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
    radial-gradient(ellipse at 50% 0, rgba(255, 255, 255, 0.18), transparent 55%), #676b66;
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
@media (max-width: 1100px) {
  .building-row {
    grid-template-columns: 160px minmax(0, 1fr) 90px;
    grid-template-areas: 'photo details toggle' 'photo cameras toggle';
    gap: 16px;
    padding: 16px;
  }

  .building-row .setup-copy p {
    font-size: 16px;
  }

  .floor-row {
    grid-template-columns: 46px minmax(120px, 1fr) 85px minmax(0, auto);
    gap: 16px;
    padding: 12px 16px;
  }

  .floor-row .setup-copy p,
  .floor-row .floor-status {
    font-size: 14px;
  }

  .edit-floor-button {
    padding: 8px;
    font-size: 14px;
  }
}

@media (max-width: 760px) {
  .setup-workspace.cctv-list-workspace,
  .setup-workspace.cctv-add-workspace {
    width: calc(100% - 24px);
    margin-top: 16px;
    padding: 12px;
  }

  .setup-workspace.parking-list-workspace {
    width: auto;
    padding: 18px 14px;
  }

  .building-row {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'photo' 'details' 'cameras' 'toggle';
    padding: 16px 16px 58px;
    gap: 12px 10px;
  }

  .building-row .view-floor-button {
    justify-self: start;
    display: flex;
  }

  .building-row .building-photo {
    grid-column: 1 / -1;
    height: 136px;
    max-width: 240px;
  }

  .building-row .setup-copy p {
    font-size: 16px;
  }

  .floor-row {
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 14px;
    padding: 16px;
  }

  .floor-row .floor-icon svg {
    width: 44px;
    height: 44px;
  }

  .floor-row .floor-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }

  .floor-row .floor-status,
  .floor-row .floor-parking-map,
  .floor-row .edit-floor-button {
    grid-column: 2;
  }

  .floor-row .floor-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .floor-row .edit-floor-button {
    justify-self: start;
  }

  .parking-setup-list .setup-actions {
    flex-wrap: wrap;
  }
}

@media (min-width: 761px) and (max-width: 980px) {
  .setup-workspace.parking-list-workspace {
    width: auto;
    padding: 20px 18px;
  }
}

/* Staff management follows the shared white-card layout. */
.staff-manager-section {
  padding: 24px 30px 28px;
}
.staff-manager-section .staff-list-panel,
.staff-manager-section .staff-form-panel {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 5px #00000005;
  overflow: hidden;
}
.staff-manager-section .staff-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
  padding: 22px 24px;
  border-bottom: 1px solid #edf0f4;
}
.staff-manager-section .staff-heading {
  display: flex;
  align-items: center;
  gap: 14px;
}
.staff-manager-section .staff-heading-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: #fdf0ef;
  color: #a52f30;
}
.staff-manager-section .staff-list-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  text-align: left;
}
.staff-manager-section .staff-list-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}
.staff-manager-section .add-staff-button {
  width: auto;
  height: 40px;
  padding: 0 16px;
  gap: 8px;
  flex-shrink: 0;
  border-radius: 6px;
  background: #16a36a;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  box-shadow: none;
  cursor: pointer;
}
.staff-manager-section .add-staff-button:hover {
  background: #128557;
}
.staff-manager-section .staff-list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 16px 24px;
  background: #fafbfc;
  border-bottom: 1px solid #edf0f4;
}
.staff-list-toolbar h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}
.staff-list-toolbar p {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}
.staff-count {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: 12px;
  background: #e9edf2;
  font-size: 12px;
  color: #475569;
}
.staff-manager-section .staff-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 390px;
  gap: 12px;
  padding: 40px 24px;
  text-align: center;
}
.staff-empty-icon {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: #fdf0ef;
  color: #b1443d;
}
.staff-manager-section .staff-empty h3 {
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  color: #334155;
}
.staff-manager-section .staff-empty p {
  max-width: 360px;
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.7;
  color: #64748b;
}
.staff-manager-section .staff-card {
  margin: 16px 24px;
  padding: 20px;
  gap: 20px;
  grid-template-columns: 64px minmax(0, 1fr) auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: none;
}
.staff-manager-section .staff-copy {
  min-width: 0;
  gap: 7px;
}
.staff-manager-section .staff-copy p {
  color: #475569;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.staff-manager-section .staff-copy p:first-child {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.staff-manager-section .profile-icon {
  border-radius: 50%;
  background: #f1f5f9;
  color: #94a3b8;
}
.staff-manager-section .row-actions {
  gap: 8px;
}
.staff-manager-section .row-actions > button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
}
.staff-manager-section .row-actions > button:hover:not(:disabled) {
  background: #f8fafc;
  color: #a52f30;
}
.staff-manager-section .staff-form-panel {
  min-height: 0;
  padding: 24px;
}
.staff-manager-section .staff-form-panel h2 {
  margin: 4px 0 28px;
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
}
.staff-manager-section .form-back-button {
  box-shadow: none;
  border: 1px solid #e2e8f0;
}
.staff-manager-section .staff-form-card,
.staff-manager-section .staff-form-panel.edit .staff-form-card {
  min-height: 0;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: none;
  background: #fafbfc;
}
.staff-manager-section .staff-form-fields {
  width: min(520px, 100%);
  gap: 16px;
}
.staff-manager-section .staff-form-fields label {
  grid-template-columns: 150px minmax(0, 1fr) 24px;
  gap: 10px;
  font-size: 13px;
  color: #475569;
}
.staff-manager-section .staff-form-fields input {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  text-align: left;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  color: #334155;
}
.staff-manager-section .staff-form-fields input:focus {
  border-color: #a52f30;
  box-shadow: 0 0 0 2px #a52f3015;
}
.staff-manager-section .add-more-row {
  height: 42px;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  box-shadow: none;
  background: #fff;
  color: #64748b;
}
.staff-manager-section .form-actions {
  position: static;
  justify-content: flex-end;
  margin-top: 24px;
  gap: 10px;
}
.staff-manager-section .form-actions button {
  height: 40px;
  padding: 0 18px;
  border-radius: 6px;
  box-shadow: none;
  font-size: 13px;
}
.staff-manager-section .form-actions .green-button {
  background: #16a36a;
  color: #fff;
}
.staff-manager-section .form-actions .red-button {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #475569;
}
.staff-manager-section button:focus-visible {
  outline: 2px solid #a52f30;
  outline-offset: 3px;
}
@media (max-width: 800px) {
  .staff-manager-section {
    padding: 16px;
  }
  .staff-manager-section .staff-list-header {
    padding: 18px;
  }
  .staff-manager-section .staff-list-toolbar {
    padding: 14px 18px;
  }
  .staff-manager-section .staff-card {
    margin: 14px;
    grid-template-columns: 48px minmax(0, 1fr);
    padding: 16px;
    gap: 14px;
  }
  .staff-manager-section .staff-card .profile-icon {
    width: 46px;
    height: 46px;
  }
  .staff-manager-section .staff-card .row-actions {
    grid-column: 2;
    justify-content: flex-start;
  }
  .staff-manager-section .staff-form-panel {
    padding: 18px;
  }
  .staff-manager-section .staff-form-card {
    padding: 20px 14px;
  }
  .staff-manager-section .staff-form-fields label {
    grid-template-columns: minmax(0, 1fr) 24px;
    gap: 8px;
  }
  .staff-manager-section .staff-form-fields label > span {
    grid-column: 1 / -1;
  }
}
</style>
