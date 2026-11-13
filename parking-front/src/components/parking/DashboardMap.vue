<template>
  <section :class="['dashboard-map', { 'header-only': headerOnly }]">
    <div class="map-header">
      <button
        class="filter-toggle"
        :aria-label="expanded ? 'Collapse filters' : 'Expand filters'"
        :title="expanded ? 'Collapse filters' : 'Expand filters'"
        :aria-expanded="expanded"
        aria-controls="map-filters"
        @click="expanded = !expanded"
      >
        <Menu :size="24" aria-hidden="true" />
      </button>
      <div class="location" role="status">{{ location }}</div>
      <span v-if="isSample" class="sample-badge">Sample map</span>
      <div class="map-header-actions">
        <button v-if="!isSample" @click="showSample">View sample map</button>
        <button
          v-if="auth.canManageParking && selectedFloor?.parking_map"
          type="button"
          aria-label="Update slot status"
          :disabled="!canUpdateSlotStatuses || updatingSlotStatuses"
          @click="updateSlotStatuses"
        >
          {{ updatingSlotStatuses ? 'Updating...' : 'Update slot status' }}
        </button>
        <button
          v-if="auth.canManageParking && selectedFloor?.parking_map"
          class="reset-status-button"
          type="button"
          aria-label="Reset parking slot status"
          :disabled="!canResetSlotStatuses || resettingSlots"
          @click="showResetConfirmation = true"
        >
          {{ resettingSlots ? 'Resetting...' : 'Reset parking slot status' }}
        </button>
      </div>
    </div>
    <p v-if="slotResetNotification" class="slot-reset-notification" role="status">
      {{ slotResetNotification }}
    </p>
    <div v-if="showResetConfirmation" class="map-confirm-backdrop">
      <section
        class="map-confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dashboard-reset-title"
      >
        <h2 id="dashboard-reset-title">Are you sure to reset all slot status</h2>
        <div>
          <button type="button" @click="showResetConfirmation = false">Cancel</button>
          <button type="button" :disabled="resettingSlots" @click="confirmResetSlotStatuses">
            Confirm
          </button>
        </div>
      </section>
    </div>
    <p v-if="syncError && !headerOnly" class="refresh-error" role="status">
      Live parking updates are temporarily unavailable. <button @click="load(true)">Retry</button>
    </p>

    <div v-if="expanded" id="map-filters" :class="['filter-overlay', { inline: headerOnly }]">
      <label
        >1. Building *<select v-model="building" aria-label="Building">
          <option value="">Select building</option>
          <option v-for="item in buildings" :key="item._id" :value="item._id">
            {{ item.building_name }}
          </option>
        </select></label
      >
      <label v-if="building"
        >2. Floor *<select v-model="floorNumber" aria-label="Floor">
          <option value="">Select floor</option>
          <option v-for="item in floorNumbers" :key="item" :value="String(item)">
            {{ item }}
          </option>
        </select></label
      >
      <label v-if="floorNumber"
        >3. Vehicle *<select v-model="vehicle" aria-label="Vehicle">
          <option value="">Select vehicle</option>
          <option v-for="item in vehicleTypes" :key="item" :value="item">
            {{ item === 'car' ? 'Cars' : 'Motorcycles' }}
          </option>
        </select></label
      >
    </div>

    <template v-if="!headerOnly">
      <div class="stats">
        <div v-for="stat in stats" :key="stat.label" class="stat-card">
          <strong :style="{ color: stat.color }">{{ stat.value }}</strong
          ><span>{{ stat.label }}</span>
        </div>
      </div>

      <div :class="['map-surface', { 'filters-open': expanded }]">
        <div v-if="loading" class="map-empty" role="status">Loading parking locations...</div>
        <div v-else-if="error" class="map-empty" role="alert">
          {{ error }} <button @click="load()">Try again</button>
        </div>
        <div v-else-if="selectedFloor?.status === 'Disable'" class="map-empty" role="status">
          <h2>Parking is not available for now!</h2>
        </div>
        <div v-else-if="!selectedFloor" class="map-empty">
          <MapPin :size="42" />
          <h2>Select a parking location</h2>
          <p v-if="!floors.length">No parking locations have been configured yet.</p>
        </div>
        <div
          v-else-if="!slots.length && !layout.shapes.length && !layout.background"
          class="map-empty"
        >
          <MapPin :size="42" />
          <h2>No parking map yet</h2>
          <p>{{ location }} has 0 parking slots.</p>
        </div>
        <template v-else>
          <ParkingLayoutEditor
            :key="`${selectedFloor._id}:${auth.canManageParking}`"
            :slots="slots"
            :model-value="layout"
            readonly
            fit-to-viewport
            save-message=""
            :save-failed="false"
            @selection="selection = $event"
          />
        </template>
      </div>
      <div class="map-footer">
        <div v-if="auth.canManageParking && selectedFloor?.parking_map" class="map-actions">
          <button :disabled="saving || !selection.length" @click="setStatus('available')">
            Enable</button
          ><button :disabled="saving || !selection.length" @click="setStatus('disabled')">
            Disable</button
          ><span>Selected: {{ selection.length }}</span>
        </div>
        <div class="status-legend">
          <span v-for="(label, status) in statusLabels" :key="status"
            ><i :class="status" />{{ label }}</span
          >
        </div>
      </div>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { MapPin, Menu } from 'lucide-vue-next'
import { floorService, type ParkingFloor } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import ParkingLayoutEditor from './ParkingLayoutEditor.vue'
import { emptyParkingLayout, restoreParkingLayout } from './parkingLayout'
import { statusLabels, createPreviewSlots, type PreviewSlot } from './parkingMapPreview'
import { createDashboardLayout } from './dashboardLayoutTemplate'
import { slotKey } from './parkingMapJson'
const auth = useAuthStore(),
  admin = useAdminStore()
withDefaults(defineProps<{ headerOnly?: boolean }>(), { headerOnly: false })
const emit = defineEmits<{
  'location-change': [location: { floor: ParkingFloor; isSample: boolean } | null]
}>()
const floors = ref<ParkingFloor[]>([]),
  loading = ref(false),
  error = ref(''),
  syncError = ref('')
const building = ref(''),
  floorNumber = ref(''),
  vehicle = ref(''),
expanded = ref(false)
const selection = ref<string[]>([]),
  saving = ref(false)
const resettingSlots = ref(false),
  updatingSlotStatuses = ref(false),
  slotResetNotification = ref(''),
  showResetConfirmation = ref(false)
let slotResetTimeout: ReturnType<typeof setTimeout> | undefined
let refreshTimer: ReturnType<typeof setInterval> | undefined
let loadPending = false
const buildings = computed(() => [
  ...new Map(
    floors.value.filter((f) => f.building).map((f) => [f.building!._id, f.building!]),
  ).values(),
])
const floorNumbers = computed(() =>
  [
    ...new Set(floors.value.filter((f) => f.building?._id === building.value).map((f) => f.floor)),
  ].sort((a, b) => a - b),
)
const vehicleTypes = computed(() => [
  ...new Set(
    floors.value
      .filter((f) => f.building?._id === building.value && String(f.floor) === floorNumber.value)
      .map((f) => f.veh_type),
  ),
])
const selectedFloor = computed(() =>
  building.value && floorNumber.value && vehicle.value
    ? floors.value.find(
        (f) =>
          f.building?._id === building.value &&
          String(f.floor) === floorNumber.value &&
          f.veh_type === vehicle.value,
      )
    : undefined,
)
const isSample = computed(() => selectedFloor.value?._id === 'sample-e4-floor4')
const canResetSlotStatuses = computed(() => {
  const presets = selectedFloor.value?.camera_presets || []
  return presets.length > 0 && presets.every((camera) => camera.status === 'Disable')
})
const canUpdateSlotStatuses = computed(() => {
  const floor = selectedFloor.value
  if (!floor?.parking_map) return false
  const enabledPresetIds = new Set(
    (floor.camera_presets || [])
      .filter((camera) => camera.status === 'Enable' && camera.modelEnabled)
      .map((camera) => camera._id),
  )
  return floor.parking_map.slots.some(
    (slot) => enabledPresetIds.has(slot.cameraPresetId || '') && Boolean(slot.parkingSlotName),
  )
})
const slots = computed<PreviewSlot[]>(() => selectedFloor.value?.parking_map?.slots || [])
const layout = computed(() =>
  restoreParkingLayout(selectedFloor.value?.parking_map?.layout || emptyParkingLayout()),
)
const location = computed(() => {
  if (!building.value || !floorNumber.value || !vehicle.value)
    return 'Select a parking location'
  return [
    buildings.value.find((b) => b._id === building.value)?.building_name || 'No building selected',
    floorNumber.value ? `Floor ${floorNumber.value}` : 'No floor selected',
    vehicle.value ? (vehicle.value === 'car' ? 'Cars' : 'Motorcycles') : 'No vehicle selected',
  ].join(' / ')
})
const stats = computed(() => [
  { label: 'Total slots', value: slots.value.length, color: '#cf3b30' },
  ...(['available', 'incoming', 'occupied', 'disabled'] as const)
    .map((status) => ({ status, label: statusLabels[status] }))
    .map(({ status, label }) => ({
      label,
      value: slots.value.filter((s) => s.status === status).length,
      color: (
        {
          available: '#16a36a',
          occupied: '#bd7a10',
          incoming: '#d4a51c',
          disabled: '#777',
        } as Record<string, string>
      )[status],
    })),
  ...(auth.isAdmin
    ? [
        {
          label: 'Active Staff',
          value: admin.staffList.filter((staff) => staff.status === 'Online').length,
          color: '#5141c9',
        },
      ]
    : []),
])
watch(
  building,
  () => {
    floorNumber.value = ''
    vehicle.value = ''
  },
  { flush: 'sync' },
)
watch(
  floorNumber,
  () => {
    vehicle.value = ''
  },
  { flush: 'sync' },
)
watch(
  () => auth.canManageParking,
  () => {
    selection.value = []
  },
)
watch(selectedFloor, () => {
  selection.value = []
  error.value = ''
})
watch(
  [selectedFloor, isSample],
  ([floor, sample]) => {
    emit('location-change', floor ? { floor, isSample: sample } : null)
  },
  { immediate: true },
)
function showSample() {
  let sample = floors.value.find((floor) => floor._id === 'sample-e4-floor4')
  if (!sample) {
    const slots = createPreviewSlots()
    sample = {
      _id: 'sample-e4-floor4',
      building: {
        _id: 'sample-e4',
        building_name: 'E4 (Sample)',
        building_image: null,
        date_updated: '',
        time_updated: '',
      },
      floor: 4,
      veh_type: 'car',
      status: 'Available',
      parking_slot_file: null,
      date_updated: '',
      time_updated: '',
      parking_map: {
        version: 2,
        sourceName: 'Sample parking map',
        slots,
        layout: createDashboardLayout(slots),
      },
    }
    floors.value.push(sample)
  }
  building.value = sample.building!._id
  floorNumber.value = String(sample.floor)
  vehicle.value = sample.veh_type
  expanded.value = false
  error.value = ''
}
async function load(silent = false) {
  if (loadPending) return
  loadPending = true
  if (!silent) {
    loading.value = true
    error.value = ''
  }
  try {
    const refreshedFloors = (await floorService.catalog()).data.floors
    const sampleFloor = floors.value.find((floor) => floor._id === 'sample-e4-floor4')
    floors.value = sampleFloor
      ? [...refreshedFloors, sampleFloor]
      : refreshedFloors
    syncError.value = ''
    if (
      !floors.value.some(
        (floor) =>
          floor.parking_map &&
          (floor.parking_map.slots.length ||
            floor.parking_map.layout.shapes.length ||
            floor.parking_map.layout.background),
      )
    )
      showSample()
  } catch (loadError) {
    if (silent) {
      syncError.value = 'Refresh failed'
      console.error('Failed to refresh dashboard parking map:', loadError)
    } else {
      showSample()
    }
  } finally {
    loadPending = false
    if (!silent) loading.value = false
  }
}
async function setStatus(status: 'available' | 'disabled') {
  const floor = selectedFloor.value
  if (!auth.canManageParking || !floor?.parking_map || saving.value) return
  if (isSample.value) {
    const selected = new Set(selection.value)
    floor.parking_map.slots = floor.parking_map.slots.map((slot) =>
      selected.has(slotKey(slot)) && ['available', 'disabled'].includes(slot.status)
        ? { ...slot, status }
        : slot,
    )
    selection.value = []
    return
  }
  saving.value = true
  error.value = ''
  try {
    const response = await floorService.setSlotStatuses(floor._id, selection.value, status)
    floor.parking_map = response.data.map
    selection.value = []
  } catch {
    error.value = 'Unable to update parking slots. Please try again.'
  } finally {
    saving.value = false
  }
}
async function confirmResetSlotStatuses() {
  showResetConfirmation.value = false
  await resetSlotStatuses()
}
async function updateSlotStatuses() {
  const floor = selectedFloor.value
  if (!floor || isSample.value || !auth.canManageParking || !canUpdateSlotStatuses.value || updatingSlotStatuses.value)
    return
  updatingSlotStatuses.value = true
  slotResetNotification.value = ''
  try {
    const response = await floorService.refreshModelSlotStatuses(floor._id)
    slotResetNotification.value = `${response.data.message} (${response.data.requestedSlots} slots).`
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await load(true)
  } catch (cause) {
    slotResetNotification.value =
      cause instanceof Error ? cause.message : 'Unable to update parking slot statuses.'
  } finally {
    updatingSlotStatuses.value = false
    if (slotResetTimeout) clearTimeout(slotResetTimeout)
    slotResetTimeout = setTimeout(() => (slotResetNotification.value = ''), 5000)
  }
}
async function resetSlotStatuses() {
  const floor = selectedFloor.value
  if (!floor || isSample.value || !auth.canManageParking || !canResetSlotStatuses.value || resettingSlots.value)
    return
  resettingSlots.value = true
  slotResetNotification.value = ''
  try {
    const response = await floorService.resetSlotStatuses(floor._id)
    floor.parking_map = response.data.map
    selection.value = []
    slotResetNotification.value = 'Parking slot statuses reset to Available.'
  } catch (cause) {
    slotResetNotification.value =
      cause instanceof Error ? cause.message : 'Unable to reset parking slot statuses.'
  } finally {
    resettingSlots.value = false
    if (slotResetTimeout) clearTimeout(slotResetTimeout)
    slotResetTimeout = setTimeout(() => (slotResetNotification.value = ''), 4000)
  }
}
onMounted(() => {
  void load()
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void load(true)
  }, 5000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (slotResetTimeout) clearTimeout(slotResetTimeout)
})
</script>
<style scoped>
.refresh-error {
  margin: 0;
  padding: 6px 16px;
  color: #8a4b08;
  background: #fff7ed;
  font-size: 13px;
}
.refresh-error button {
  margin-left: 6px;
}
.dashboard-map {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 156px);
  min-height: 300px;
  position: relative;
  background: white;
  border-radius: 8px;
  overflow: hidden;
}
.dashboard-map.header-only {
  height: auto;
  min-height: 0;
  overflow: visible;
  margin-bottom: 20px;
}
.map-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.map-header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}
.reset-status-button {
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 16%);
}
.map-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 20px;
  background: #15223866;
}
.map-confirm-dialog {
  width: min(100%, 420px);
  padding: 24px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 18px 50px #15223833;
}
.map-confirm-dialog h2 {
  margin: 0 0 22px;
  color: #172033;
  font-size: 18px;
}
.map-confirm-dialog > div {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.slot-reset-notification {
  margin: 8px 16px 0;
  padding: 8px 12px;
  border: 1px solid #86efac;
  border-radius: 6px;
  color: #166534;
  background: #f0fdf4;
  font-size: 13px;
}
.filter-toggle {
  width: 40px;
  height: 40px;
  padding: 0;
  border-color: #e4e4e4;
  border-radius: 6px;
  background: #e4e4e4;
  color: #8d8d8d;
  display: grid;
  place-items: center;
  flex: 0 0 40px;
}
.filter-toggle:hover {
  background: #d7d7d7;
}
.sample-badge {
  padding: 5px 10px;
  border-radius: 999px;
  color: #92400e;
  background: #fef3c7;
  font-size: 12px;
  margin-left: auto;
}
.location {
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}
button {
  padding: 8px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 13px;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.map-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.map-surface > .layout-editor {
  flex: 1;
  min-height: 0;
}
.map-actions {
  flex-shrink: 0;
}

.filter-overlay {
  position: absolute;
  top: 60px;
  left: 16px;
  right: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  z-index: 2;
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  padding: 18px 20px;
  background: #f8fafc;
  box-shadow: 0 4px 8px #0001;
}
.filter-overlay.inline {
  position: static;
  margin: 0 16px 10px;
}
label {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: #475569;
  flex: 1;
  min-width: 160px;
}
select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 10px;
  background: white;
}
.stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
}
.stat-card {
  flex: 1;
  min-width: 90px;
  display: grid;
  gap: 6px;
  text-align: center;
}
.stat-card strong {
  font-size: 25px;
}
.stat-card span {
  font-size: 12px;
  color: #64748b;
}
.map-empty {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 12px;
  min-height: 380px;
  padding: 30px;
  text-align: center;
  color: #64748b;
  background: #f8fafc;
}
.map-empty h2 {
  font-size: 20px;
  color: #334155;
}
.map-empty p {
  font-size: 14px;
}
.filters-open .map-empty {
  padding-top: 30px;
  min-height: 380px;
}
.status-legend,
.map-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  padding: 16px;
  font-size: 12px;
}
.map-surface .map-empty {
  flex: 1;
  min-height: 0;
}
.status-legend,
.map-actions {
  padding: 8px 12px;
}
.map-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 4px 8px;
  gap: 4px 12px;
}
.map-footer .status-legend {
  margin-left: auto;
  gap: 12px;
}
.map-footer .map-actions {
  gap: 8px;
}
.status-legend span {
  display: flex;
  gap: 6px;
  align-items: center;
}
.status-legend i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.available {
  background: #16a36a;
}
.occupied {
  background: #bd7a10;
}
.incoming {
  background: #f4c233;
}
.disabled {
  background: #888;
}
</style>
