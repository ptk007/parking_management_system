<template>
  <section class="parking-map-page">
    <div v-if="mapNotice" class="map-notice" role="status">{{ t(mapNotice) }}</div>
    <header class="page-heading">
      <RouterLink to="/admin/setup" class="back-button" :aria-label="t('Back to Parking Setup')"
        ><ArrowLeft :size="20"
      /></RouterLink>
      <div>
        <p class="eyebrow">{{ t('PARKING SETUP') }}</p>
        <div class="title-row">
          <h1>{{ t('Parking Map') }}</h1>
          <div
            v-if="auth.isAdmin && floor"
            class="floor-status-control"
          >
            <ToggleSwitch
              :checked="floor.status === 'Available'"
              :disabled="updatingFloorStatus"
              :label="t('Set floor Available or Disable')"
              @toggle="setFloorStatus(floor.status === 'Available' ? 'Disable' : 'Available')"
            />
          </div>
        </div>
        <p v-if="floorStatusError" class="floor-status-error" role="alert">
          {{ t(floorStatusError) }}
        </p>
        <p v-if="floor" class="floor-context">
          {{ floor.building?.building_name || t('Building') }} /
          {{ t(['Floor {floor}', { floor: floor.floor }]) }} /
          {{ t(floor.veh_type === 'car' ? 'Cars' : 'Motorcycles') }}
        </p>
      </div>
      <RouterLink
        v-if="floor"
        class="cctv-link"
        :to="{ name: 'AdminSetup', query: { cctvFloorId: floor._id } }"
      >
        <Video :size="17" /> {{ t('Go to CCTV') }} <ArrowRight :size="17" />
      </RouterLink>
      <span class="local-badge"
        ><HardDrive :size="15" /> {{ t(dirty ? 'Unsaved changes' : 'Saved map') }}</span
      >
    </header>
    <div v-if="loading" class="page-state" role="status">{{ t('Loading floor...') }}</div>
    <div v-else-if="error" class="page-state" role="alert">
      <p>{{ t(error) }}</p>
      <button @click="loadFloor">{{ t('Try again') }}</button>
    </div>
    <template v-else-if="floor">
      <section
        :class="['map-transfer', { compact: viewMode === 'layout' }]"
        :aria-label="t('Map Import/Export')"
      >
        <div>
          <h2><FileJson :size="18" /> {{ t('Map Import/Export') }}</h2>
          <p>
            {{ t('Import replaces the current map. Export keeps a copy of slots, names and positions.') }}
          </p>
          <small>{{ displaySourceName }}</small>
        </div>
        <div class="transfer-actions">
          <button
            v-if="auth.isAdmin && floor.veh_type === 'car'"
            type="button"
            :disabled="!canEditLayout || importing || updatingFloorStatus"
            @click="useDefaultMap"
          >
            <LayoutGrid :size="16" /> {{ t('Use default map slot') }}
          </button>
          <button @click="exportMap" :disabled="!slots.length">
            <Download :size="16" /> {{ t('Export map') }}</button
          ><button
            class="primary"
            :disabled="importing || !canEditLayout"
            @click="fileInput?.click()"
          >
            <Upload :size="16" />{{ t(importing ? 'Importing...' : 'Import map') }}
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept=".json,application/json"
          multiple
          :aria-label="t('Import parking map JSON')"
          :disabled="importing || !canEditLayout"
          @change="importJson"
        />
        <p v-if="importError" class="import-error" role="alert">
          {{ t(['{detail} The current map has not changed.', { detail: t(importError) }]) }}
        </p>
        <p v-if="importMessage" class="import-success" role="status">{{ t(importMessage) }}</p>
      </section>
      <div
        :class="['summary-grid', { compact: viewMode === 'layout' }]"
        :aria-label="t('Parking summary and status filters')"
      >
        <button
          v-for="summary in summaries"
          :key="summary.key"
          :class="['summary-card', summary.key, { active: statusFilter === summary.key }]"
          :aria-pressed="statusFilter === summary.key"
          @click="statusFilter = summary.key"
        >
          <span>{{ t(summary.label) }}</span
          ><strong>{{ summary.count }}</strong>
        </button>
      </div>
      <div class="map-workspace">
        <section class="floor-panel" :aria-label="t('Parking slot layout')">
          <div v-if="viewMode === 'preview'" class="panel-heading">
            <div>
              <h2>{{ t('Floor overview') }}</h2>
              <p>{{ t('Select a slot to see its name and status.') }}</p>
            </div>
            <div class="panel-heading-actions">
              <span>{{ t(['{count} slots', { count: slots.length }]) }}</span>
              <button
                type="button"
                class="update-status-button"
                :disabled="!canUpdateModelSlotStatuses"
                @click="updateModelSlotStatuses"
              >
                {{ t(updatingModelSlotStatuses ? 'Updating...' : 'Update slot status') }}
              </button>
              <button
                type="button"
                class="reset-status-button"
                :disabled="!canResetSlotStatuses"
                :title="t('Disable every CCTV preset on this floor before resetting slots')"
                @click="resetConfirmationOpen = true"
              >
                <RotateCcw :size="16" />
                {{ t(resettingSlots ? 'Resetting...' : 'Reset parking slot status') }}
              </button>
            </div>
          </div>
          <div class="map-toolbar">
            <div class="view-mode" :aria-label="t('Parking map view')">
              <button
                :class="{ active: viewMode === 'preview' }"
                :aria-pressed="viewMode === 'preview'"
                @click="viewMode = 'preview'"
              >
                <LayoutGrid :size="16" />{{ t('Parking Preview') }}</button
              ><button
                v-if="auth.isAdmin"
                :disabled="!canEditLayout"
                :title="t(canEditLayout ? 'Edit layout' : 'Disable this floor before editing its layout')"
                :class="{ active: viewMode === 'layout' }"
                :aria-pressed="viewMode === 'layout'"
                @click="viewMode = 'layout'"
              >
                <PencilRuler :size="16" />{{ t('Layout editor') }}
              </button>
            </div>
            <label class="search-field"
              ><Search :size="16" /><input
                v-model="search"
                type="search"
                :placeholder="t('Find a slot by name')"
                :aria-label="t('Search slot name')"
            /></label>
            <select v-model="statusFilter" :aria-label="t('Filter by status')">
              <option value="all">{{ t('All statuses') }}</option>
              <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                {{ t(label) }}
              </option>
            </select>
          </div>
          <p v-if="floor.status === 'Available'" class="locked-note">
            {{ t('Disable this floor in Parking Setup to use Layout editor.') }}
          </p>
          <p v-if="slots.length && !visibleKeys.size" class="empty-results">
            {{ t('No matching slots.') }} <button @click="clearFilters">{{ t('Clear filters') }}</button>
          </p>
          <ParkingLayoutEditor
            :key="`${floor._id}:${editorRevision}`"
            :slots="slots"
            :model-value="layout"
            :show-connection-status="auth.canManageParking"
            :readonly="viewMode !== 'layout' || !canEditLayout || editingSlot"
            :autosave="autosave"
            :saving="saving"
            :save-message="t(saveMessage)"
            :save-failed="storageError"
            :visible-keys="visibleKeys"
            @change="updateMap"
            @selection="selected = new Set($event)"
            @autosave="setAutosave"
            @save="persistDraft"
          />
        </section>
        <ParkingSlotDetails
          v-if="auth.canManageParking"
          :floor-id="floor._id"
          :slots="slots"
          :selected-slots="selectedSlots"
          :presets="mapPresets"
          :allow-assignment="viewMode === 'layout' && canEditLayout"
          :show-vehicle-details="viewMode === 'preview' && !dirty"
          :busy="editingSlot || savingVehicleDetails || importing"
          :status-actions-disabled="dirty || saving || !floor.parking_map"
          @camera-change="changeSelectedPreset"
          @parking-slot-change="changeSelectedParkingSlot"
          @status-change="setStatus"
          @map-updated="applySlotMap"
          @vehicle-saving="savingVehicleDetails = $event"
        >
          <template #feedback>
            <p v-if="slotActionMessage" :class="{ 'slot-action-error': slotActionError }" role="status">
              {{ t(slotActionMessage) }}
            </p>
            <p v-if="dirty || !floor.parking_map">
              {{ t('Save the map before changing slot status.') }}
            </p>
            <p :class="['save-message', { failed: storageError }]" role="status">{{ t(saveMessage) }}</p>
            <button v-if="dirty && !autosave && auth.isAdmin" class="primary" @click="persistDraft">
              {{ t('Save changes') }}
            </button>
          </template>
        </ParkingSlotDetails>
      </div>
    </template>
    <div v-if="resetConfirmationOpen" class="dialog-backdrop">
      <section
        class="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-slots-title"
      >
        <h2 id="reset-slots-title">{{ t('Are you sure to reset all slot status') }}</h2>
        <div>
          <button type="button" @click="resetConfirmationOpen = false">{{ t('Cancel') }}</button>
          <button
            type="button"
            class="primary"
            :disabled="resettingSlots"
            @click="confirmResetParkingSlotStatuses"
          >
            {{ t('Confirm') }}
          </button>
        </div>
      </section>
    </div>
    <div v-if="leaveTarget" class="dialog-backdrop">
      <section
        class="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <h2 id="unsaved-title">{{ t('Save your changes?') }}</h2>
        <p>{{ t('This floor has changes that have not been saved to the server.') }}</p>
        <div>
          <button @click="leaveTarget = null">{{ t('Keep editing') }}</button
          ><button @click="discardAndLeave">{{ t('Discard changes') }}</button
          ><button class="primary" @click="saveAndLeave">{{ t('Save and leave') }}</button>
        </div>
      </section>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  RouterLink,
  useRoute,
  useRouter,
  type RouteLocationRaw,
} from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileJson,
  HardDrive,
  LayoutGrid,
  PencilRuler,
  RotateCcw,
  Search,
  Upload,
  Video,
} from 'lucide-vue-next'
import { isAxiosError } from 'axios'
import { floorService, type ParkingFloor, type ParkingFloorPayload } from '@/services/api'
import ToggleSwitch from '@/components/ToggleSwitch.vue'
import { useAuthStore } from '@/stores/auth'
import ParkingLayoutEditor from '@/components/parking/ParkingLayoutEditor.vue'
import ParkingSlotDetails from '@/components/parking/ParkingSlotDetails.vue'
import { createDashboardLayout } from '@/components/parking/dashboardLayoutTemplate'
import { t, type LocalizedText } from '@/i18n'
import {
  defaultSlotBox,
  emptyParkingLayout,
  restoreParkingLayout,
  slotDisplayName,
  type ParkingLayout,
  type ParkingMapState,
} from '@/components/parking/parkingLayout'
import {
  createPreviewSlots,
  restoreMapDraft,
  statusLabels,
  type PreviewSlot,
  type SlotStatus,
} from '@/components/parking/parkingMapPreview'
import {
  MAX_IMPORT_BYTES,
  parseParkingMapJson,
  slotKey,
  validateSlots,
} from '@/components/parking/parkingMapJson'
import type { CctvFormCamera } from './cctvForm'
const route = useRoute(),
  router = useRouter(),
  auth = useAuthStore()
const floor = ref<ParkingFloor | null>(null),
  loading = ref(true),
  error = ref<LocalizedText>('')
const slots = ref<PreviewSlot[]>([]),
  layout = ref<ParkingLayout>(emptyParkingLayout())
const canEditLayout = computed(() => auth.isAdmin && floor.value?.status !== 'Available')
const editorRevision = ref(0)
const defaultMapSource = 'Default map (E4 / Floor 4 / Cars)'
const sourceName = ref('New map'),
  viewMode = ref<'preview' | 'layout'>('preview')
const displaySourceName = computed(() =>
  sourceName.value === 'New map' || sourceName.value === defaultMapSource
    ? t(sourceName.value)
    : sourceName.value,
)
const selected = ref(new Set<string>())
const editingSlot = ref(false)
const savingVehicleDetails = ref(false)
const slotActionMessage = ref('')
const slotActionError = ref(false)
const mapNotice = ref<LocalizedText>('')
let mapNoticeTimeout: ReturnType<typeof setTimeout> | undefined
const autosave = ref(true),
  dirty = ref(false),
  saving = ref(false),
  updatingFloorStatus = ref(false),
  floorStatusError = ref(''),
  saveMessage = ref<LocalizedText>('No unsaved changes'),
  storageError = ref(false)
const fileInput = ref<HTMLInputElement | null>(null),
  importing = ref(false),
  importError = ref(''),
  importMessage = ref<LocalizedText>('')
const search = ref(''),
  statusFilter = ref<SlotStatus | 'all'>('all')
const draftKey = computed(
  () => `parking-map-preview:v1:${auth.user?._id || auth.user?.id}:${route.params.floorId}`,
)
let loadVersion = 0,
  importVersion = 0
const leaveTarget = ref<RouteLocationRaw | null>(null)
let allowLeave = false
const mapPresets = computed(() => (floor.value?.camera_presets || []).flatMap((camera) =>
  camera._id ? [{ _id: camera._id, name: camera.name, slotNames: getCameraSlotNames(camera) }] : [],
))
const selectedSlots = computed(() =>
  slots.value.filter((slot) => selected.value.has(slotKey(slot))),
)
const resettingSlots = ref(false)
const updatingModelSlotStatuses = ref(false)
const resetConfirmationOpen = ref(false)
const canResetSlotStatuses = computed(() => {
  const presets = floor.value?.camera_presets || []
  return (
    auth.isAdmin &&
    presets.length > 0 &&
    presets.every((camera) => camera.status === 'Disable') &&
    !dirty.value &&
    !saving.value &&
    !importing.value &&
    !resettingSlots.value
  )
})
const canUpdateModelSlotStatuses = computed(() => {
  const currentFloor = floor.value
  if (!currentFloor?.parking_map) return false
  const enabledPresetIds = new Set(
    (currentFloor.camera_presets || [])
      .filter((camera) => camera.status === 'Enable' && camera.modelEnabled)
      .map((camera) => camera._id),
  )
  return (
    enabledPresetIds.size > 0 &&
    currentFloor.parking_map.slots.some(
      (slot) => enabledPresetIds.has(slot.cameraPresetId || '') && Boolean(slot.parkingSlotName),
    ) &&
    !dirty.value &&
    !saving.value &&
    !importing.value &&
    !resettingSlots.value &&
    !updatingModelSlotStatuses.value
  )
})
const visibleKeys = computed(
  () =>
    new Set(
      slots.value
        .filter(
          (slot) =>
            (statusFilter.value === 'all' || slot.status === statusFilter.value) &&
            slotDisplayName(slot).toLowerCase().includes(search.value.trim().toLowerCase()),
        )
        .map(slotKey),
    ),
)
const summaries = computed(() => [
  { key: 'all' as const, label: 'Total slots', count: slots.value.length },
  ...Object.entries(statusLabels).map(([key, label]) => ({
    key: key as SlotStatus,
    label,
    count: slots.value.filter((slot) => slot.status === key).length,
  })),
])
function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
}
function withPositions(items: PreviewSlot[], next: ParkingLayout): ParkingLayout {
  return {
    ...next,
    positions: Object.fromEntries(
      items.map((slot, index) => [
        slotKey(slot),
        next.positions[slotKey(slot)] || defaultSlotBox(index),
      ]),
    ),
  }
}
async function loadFloor() {
  const version = ++loadVersion
  ++importVersion
  importing.value = false
  loading.value = true
  floor.value = null
  error.value = ''
  slotActionMessage.value = ''
  selected.value.clear()
  clearFilters()
  dirty.value = false
  storageError.value = false
  importError.value = ''
  importMessage.value = ''
  saveMessage.value = 'No unsaved changes'
  sourceName.value = 'New map'
  slots.value = []
  layout.value = emptyParkingLayout()
  viewMode.value = 'preview'
  try {
    const floorId = String(route.params.floorId)
    const response = await floorService.get(floorId)
    if (version !== loadVersion) return
    floor.value = response.data.floor || null
    if (!floor.value) {
      error.value = 'Floor not found. Return to Parking Setup to choose a floor.'
      return
    }
    let raw: string | null = null
    try {
      autosave.value = localStorage.getItem(`${draftKey.value}:autosave`) !== 'false'
      raw = localStorage.getItem(draftKey.value)
    } catch {
      autosave.value = false
      storageError.value = true
      saveMessage.value = 'Device storage is unavailable. Export your map to keep a copy.'
    }
    if (floor.value.parking_map) {
      const saved = restoreMapDraft(JSON.stringify(floor.value.parking_map))
      slots.value = saved.slots
      layout.value = saved.layout
      sourceName.value = saved.sourceName
      saveMessage.value = 'Saved map loaded'
    } else if (raw) {
      try {
        const saved = restoreMapDraft(raw)
        slots.value = saved.slots
        layout.value = saved.layout
        sourceName.value = saved.sourceName
        saveMessage.value = 'Saved map restored from this device'
      } catch {
        error.value = 'The saved map could not be restored. Import an exported map to recover it.'
        return
      }
    }
    if (version !== loadVersion) return
    layout.value = withPositions(slots.value, layout.value)
  } catch (cause) {
    if (version === loadVersion) {
      const message = isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message
        : cause instanceof Error
          ? cause.message
          : undefined
      error.value = message
        ? ['Unable to load this floor and its map: {detail}', { detail: message }]
        : 'Unable to load this floor and its map. Please try again.'
    }
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
function changed() {
  dirty.value = true
  if (autosave.value) persistDraft()
  else saveMessage.value = 'Unsaved changes. Save now or export your map.'
}
function updateMap(next: ParkingMapState) {
  if (!canEditLayout.value || loading.value || importing.value || editingSlot.value) return
  slots.value = next.slots
  layout.value = next.layout
  changed()
}
let saveQueue: Promise<unknown> = Promise.resolve()
let saveRevision = 0,
  activeSaves = 0
async function persistDraft(): Promise<boolean> {
  if (!auth.isAdmin || !floor.value || loading.value || importing.value) return false
  const floorId = floor.value._id,
    key = draftKey.value,
    revision = ++saveRevision
  const content = JSON.parse(
    JSON.stringify({
      version: 2,
      sourceName: sourceName.value,
      slots: slots.value,
      layout: layout.value,
    }),
  )
  try {
    localStorage.setItem(key, JSON.stringify(content))
  } catch {
    /* Server save remains available. */
  }
  saveMessage.value = 'Saving map...'
  activeSaves += 1
  saving.value = true
  const save = saveQueue.catch(() => {}).then(() => floorService.saveMap(floorId, content))
  saveQueue = save
  try {
    const response = await save
    if (
      key === draftKey.value &&
      revision === saveRevision &&
      JSON.stringify(content.slots) === JSON.stringify(slots.value) &&
      JSON.stringify(content.layout) === JSON.stringify(layout.value)
    ) {
      if (floor.value?._id === floorId) floor.value.parking_map = response.data?.floor?.parking_map || content
      dirty.value = false
      storageError.value = false
      saveMessage.value = 'Map saved and shared with dashboards'
    }
    return true
  } catch (cause) {
    if (key === draftKey.value && revision === saveRevision) {
      dirty.value = true
      storageError.value = true
      const serverMessage = isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message
        : undefined
      saveMessage.value = serverMessage
        ? [
            'Could not save map: {detail}. Retry Save now or export your map.',
            { detail: serverMessage },
          ]
        : 'Could not save to server. Retry Save now or export your map.'
    }
    return false
  } finally {
    activeSaves -= 1
    saving.value = activeSaves > 0
  }
}

function setAutosave(enabled: boolean) {
  if (!auth.isAdmin) return
  autosave.value = enabled
  try {
    localStorage.setItem(`${draftKey.value}:autosave`, String(enabled))
  } catch {
    storageError.value = true
    saveMessage.value = 'Could not save the autosave preference on this device.'
  }
  if (enabled && dirty.value) persistDraft()
  else if (!dirty.value)
    saveMessage.value = enabled
      ? 'Autosave is on for this floor'
      : 'Autosave is off. Use Save now to keep changes.'
}
function applySlotMap(floorId: string, map: NonNullable<ParkingFloor['parking_map']>) {
  if (floor.value?._id !== floorId) return
  floor.value.parking_map = map
  slots.value = map.slots
}

async function setStatus(status: 'available' | 'disabled') {
  const currentFloor = floor.value
  if (!auth.isAdmin || !currentFloor?.parking_map || importing.value || dirty.value ||
      saving.value || editingSlot.value || savingVehicleDetails.value) return
  const targets = selectedSlots.value.filter((slot) =>
    slot.status === (status === 'available' ? 'disabled' : 'available'),
  )
  if (!targets.length) return
  editingSlot.value = true
  slotActionMessage.value = ''
  slotActionError.value = false
  try {
    const { data } = await floorService.setSlotStatuses(currentFloor._id, targets.map(slotKey), status)
    applySlotMap(currentFloor._id, data.map)
    if (floor.value?._id === currentFloor._id)
      slotActionMessage.value = data.changedSlots
        ? 'Slot status updated and recorded in Slot Status Log.'
        : 'No eligible slot statuses changed.'
  } catch (cause) {
    if (floor.value?._id !== currentFloor._id) return
    slotActionError.value = true
    slotActionMessage.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Unable to update parking slots.'
      : 'Unable to update parking slots.'
  } finally {
    editingSlot.value = false
  }
}
async function setFloorStatus(status: ParkingFloor['status']) {
  const currentFloor = floor.value
  if (!auth.isAdmin || !currentFloor || updatingFloorStatus.value || currentFloor.status === status)
    return

  updatingFloorStatus.value = true
  floorStatusError.value = ''
  try {
    if (status === 'Available' && dirty.value && !(await persistDraft()))
      throw new Error('Save map changes before making this floor available.')

    const data: ParkingFloorPayload = {
      building: currentFloor.building?._id || '',
      floor: currentFloor.floor,
      veh_type: currentFloor.veh_type,
      status,
    }
    const response = await floorService.update(currentFloor._id, data)
    floor.value = response.data.floor || { ...currentFloor, status }
  } catch (cause) {
    floorStatusError.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Unable to update floor status.'
      : cause instanceof Error
        ? cause.message
        : 'Unable to update floor status.'
  } finally {
    updatingFloorStatus.value = false
  }
}
async function resetParkingSlotStatuses() {
  const currentFloor = floor.value
  if (!currentFloor || !canResetSlotStatuses.value) return
  resettingSlots.value = true
  try {
    const response = await floorService.resetSlotStatuses(currentFloor._id)
    const map = response.data.map
    currentFloor.parking_map = map
    slots.value = map.slots
    selected.value.clear()
    saveMessage.value = 'All parking slot statuses reset to Available.'
    showMapNotice('Parking slot statuses reset to Available.')
  } catch (cause) {
    showMapNotice(
      isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message || 'Unable to reset parking slot statuses.'
        : cause instanceof Error
          ? cause.message
          : 'Unable to reset parking slot statuses.',
    )
  } finally {
    resettingSlots.value = false
  }
}
async function updateModelSlotStatuses() {
  const currentFloor = floor.value
  if (!currentFloor || !canUpdateModelSlotStatuses.value) return
  updatingModelSlotStatuses.value = true
  try {
    const response = await floorService.refreshModelSlotStatuses(currentFloor._id)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    const refreshedFloor = await floorService.get(currentFloor._id)
    floor.value = refreshedFloor.data.floor
    slots.value = refreshedFloor.data.floor.parking_map?.slots || []
    showMapNotice([
      'Enabled Detection models will update their assigned parking slots ({count} slots).',
      { count: response.data.requestedSlots },
    ])
  } catch (cause) {
    showMapNotice(
      isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message || 'Unable to update parking slot statuses.'
        : cause instanceof Error
          ? cause.message
          : 'Unable to update parking slot statuses.',
    )
  } finally {
    updatingModelSlotStatuses.value = false
  }
}
async function confirmResetParkingSlotStatuses() {
  resetConfirmationOpen.value = false
  await resetParkingSlotStatuses()
}
function showMapNotice(message: LocalizedText) {
  mapNotice.value = message
  if (mapNoticeTimeout) clearTimeout(mapNoticeTimeout)
  mapNoticeTimeout = setTimeout(() => { mapNotice.value = '' }, 4000)
}
function changeSelectedPreset(cameraPresetId: string) {
  updateSlots({ cameraPresetId: cameraPresetId || undefined, parkingSlotName: undefined })
}
function changeSelectedParkingSlot(parkingSlotName: string, cameraPresetId: string) {
  const [slot] = selectedSlots.value
  if (selectedSlots.value.length !== 1 || !slot || slot.cameraPresetId !== cameraPresetId) return
  if (parkingSlotName && slots.value.some((other) =>
    slotKey(other) !== slotKey(slot) &&
    other.cameraPresetId === cameraPresetId &&
    other.parkingSlotName === parkingSlotName,
  )) {
    showMapNotice([
      'Parking slot "{name}" is already assigned to another map slot.',
      { name: parkingSlotName },
    ])
    return
  }
  updateSlots({
    cameraPresetId: cameraPresetId || undefined,
    parkingSlotName: parkingSlotName || undefined,
  })
}
function updateSlots(assignment: Pick<PreviewSlot, 'cameraPresetId' | 'parkingSlotName'>) {
  if (!canEditLayout.value || viewMode.value !== 'layout' || !selectedSlots.value.length || editingSlot.value)
    return
  slots.value = slots.value.map((slot) =>
    selected.value.has(slotKey(slot))
      ? {
          ...slot,
          ...assignment,
          connectionStatus: assignment.cameraPresetId && assignment.parkingSlotName ? 'Connect' : 'None',
        }
      : slot,
  )
  changed()
}

function getCameraSlotNames(camera?: CctvFormCamera) {
  const data = camera?.parkingSlotData
  if (!data || typeof data !== 'object' || !('categories' in data)) return []
  const categories = data.categories
  if (!Array.isArray(categories)) return []
  return [
    ...new Set(
      categories
        .filter(
          (category): category is { name: string; supercategory: string } =>
            !!category &&
            typeof category === 'object' &&
            'name' in category &&
            typeof category.name === 'string' &&
            !!category.name.trim() &&
            'supercategory' in category &&
            category.supercategory === 'parking-slot',
        )
        .map((category) => category.name.trim()),
    ),
  ]
}
function replaceMap(next: ParkingMapState, source: string) {
  slots.value = next.slots
  layout.value = withPositions(next.slots, next.layout)
  sourceName.value = source
  selected.value.clear()
  clearFilters()
  editorRevision.value++
  changed()
}

function useDefaultMap() {
  if (
    floor.value?.veh_type !== 'car' ||
    !canEditLayout.value ||
    loading.value ||
    importing.value ||
    updatingFloorStatus.value
  )
    return

  const hasMapContent = slots.value.length || layout.value.shapes.length || layout.value.background
  if (
    hasMapContent &&
    !window.confirm(t('Replace the current map and its CCTV slot assignments with the default map?'))
  )
    return

  // Copy the sample's slot identities without carrying demo occupancy into a real floor.
  const defaultSlots = createPreviewSlots().map(({ number, zone }): PreviewSlot => ({
    number,
    zone,
    status: 'available',
    connectionStatus: 'None',
  }))
  replaceMap(
    { slots: defaultSlots, layout: createDashboardLayout(defaultSlots) },
    defaultMapSource,
  )
  importError.value = ''
  importMessage.value = ['Loaded {count} default parking slots.', { count: defaultSlots.length }]
}

async function importJson(event: Event) {
  const input = event.target as HTMLInputElement,
    files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || !canEditLayout.value || !floor.value || loading.value || importing.value)
    return
  const version = ++importVersion,
    targetKey = draftKey.value
  importing.value = true
  importError.value = ''
  importMessage.value = ''
  try {
    if (files.some((file) => !file.name.toLowerCase().endsWith('.json')))
      throw new Error('Choose .json files only.')
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORT_BYTES)
      throw new Error('The selected files must total 5 MB or less.')
    const contents = await Promise.all(files.map((file) => file.text()))
    const imported = contents.map(parseParkingMapJson)
    const nextSlots = validateSlots(imported.flat())
    let nextLayout = emptyParkingLayout()
    if (contents.length === 1) {
      const parsed = JSON.parse(contents[0]!.replace(/^\uFEFF/, ''))
      if (parsed && typeof parsed === 'object' && 'layout' in parsed)
        nextLayout = restoreParkingLayout(parsed.layout)
    }
    if (version !== importVersion || targetKey !== draftKey.value || !canEditLayout.value) return
    importing.value = false
    replaceMap({ slots: nextSlots, layout: nextLayout }, files.map((file) => file.name).join(', '))
    importMessage.value = [
      'Imported {count} slots. Names and saved positions have been preserved.',
      { count: nextSlots.length },
    ]
  } catch (cause) {
    if (version === importVersion)
      importError.value = cause instanceof Error ? cause.message : 'Unable to import map.'
  } finally {
    if (version === importVersion) importing.value = false
  }
}
function exportMap() {
  const content = {
    version: 2,
    sourceName: sourceName.value,
    slots: slots.value,
    layout: layout.value,
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `parking-map-floor-${floor.value?.floor}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}
function guardLeave(to: { fullPath: string }) {
  if (!dirty.value || allowLeave) {
    allowLeave = false
    return true
  }
  leaveTarget.value = to.fullPath
  return false
}
onBeforeRouteLeave(guardLeave)
onBeforeRouteUpdate(guardLeave)
function discardAndLeave() {
  const target = leaveTarget.value
  leaveTarget.value = null
  if (target) {
    allowLeave = true
    void router.push(target)
  }
}
async function saveAndLeave() {
  if (await persistDraft()) discardAndLeave()
}
watch(canEditLayout, (allowed) => {
  if (!allowed) viewMode.value = 'preview'
})
watch(() => route.params.floorId, loadFloor, { immediate: true })
watch(
  () => auth.isAdmin,
  (admin) => {
    if (!admin) {
      selected.value.clear()
      viewMode.value = 'preview'
    }
  },
)
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => {
  ++loadVersion
  ++importVersion
  if (mapNoticeTimeout) clearTimeout(mapNoticeTimeout)
  window.removeEventListener('beforeunload', beforeUnload)
})
</script>
<style scoped>
.parking-map-page {
  margin-left: 138px;
  padding: 26px;
  background: #f4f6f9;
  min-height: calc(100vh - 78px);
  color: #334155;
}
button:not(.toggle-switch) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  border: 1px solid #dbe2eb;
  background: white;
  border-radius: 7px;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
}
button:not(.toggle-switch):hover {
  background: #f1f5f9;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.primary {
  background: #29374d;
  border-color: #000;
  color: white;
}
.primary:hover {
  background: #3b4b64;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}
.page-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
}
.title-row h1 {
  margin: 4px 0;
}
.floor-status-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  min-height: 28px;
}
.floor-status-error {
  color: #b42318;
  font-size: 12px;
  margin-top: 6px;
}
.back-button {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 10px;
  border-radius: 8px;
}
.cctv-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 9px 12px;
  border: 1px solid #000;
  border-radius: 7px;
  background: #fff;
  color: #000;
  font-size: 12px;
}
.cctv-link:hover {
  background: #f3f4f6;
}
.eyebrow {
  color: #94a3b8;
  font-size: 10px;
  letter-spacing: 1.5px;
}
.page-heading h1 {
  font-size: 26px;
  font-weight: 750;
  margin: 4px 0;
  color: #172b45;
}
.floor-context {
  font-size: 12px;
  color: #64748b;
}
.local-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-left: 0;
  color: #64748b;
  font-size: 11px;
}
.map-transfer {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 18px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  margin-bottom: 18px;
}
.map-transfer > div:first-child {
  flex: 1;
  min-width: 220px;
}
h2 {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 650;
  font-size: 14px;
  margin: 0;
}
.map-transfer p {
  font-size: 12px;
  margin: 6px 0;
  color: #64748b;
}
.map-transfer small {
  font-size: 11px;
  color: #94a3b8;
  overflow-wrap: anywhere;
}
.transfer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.hidden {
  display: none;
}
.map-transfer .import-error,
.field-error {
  color: #b42318;
}
.map-transfer .import-success {
  color: #15803d;
}
.import-error,
.import-success {
  width: 100%;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}
.summary-card {
  display: grid;
  justify-content: stretch;
  text-align: left;
  gap: 12px;
  padding: 16px;
  border-color: #e2e8f0;
}
.summary-grid.compact .summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
}
.summary-grid.compact .summary-card strong {
  font-size: 18px;
}
.map-transfer.compact {
  padding: 12px 18px;
}
.map-transfer.compact > div:first-child p,
.map-transfer.compact > div:first-child small {
  display: none;
}
.floor-panel > .map-toolbar:first-child {
  padding-top: 16px;
}
.summary-card strong {
  font-size: 24px;
}
.summary-card span {
  font-size: 11px;
  color: #64748b;
}
.summary-card.active {
  border-color: #475569;
  box-shadow: 0 0 0 1px #475569;
}
.summary-card.available strong {
  color: #15803d;
}
.summary-card.occupied strong {
  color: #c23b45;
}
.summary-card.incoming strong {
  color: #a36507;
}
.map-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 18px;
  align-items: start;
}
.floor-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  min-width: 0;
}
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px;
  gap: 12px;
}
.panel-heading p {
  font-size: 12px;
  color: #64748b;
  margin-top: 5px;
}
.panel-heading-actions > span {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
}
.panel-heading-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}
.map-toolbar {
  padding: 0 18px 16px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.view-mode {
  display: flex;
  gap: 4px;
}
.view-mode .active {
  background: #29374d;
  color: white;
  border-color: #29374d;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #dbe2eb;
  border-radius: 6px;
  padding: 8px;
  flex: 1;
  min-width: 140px;
}
.search-field input {
  width: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 12px;
}
.map-toolbar select {
  font-size: 12px;
  padding: 8px;
  border: 1px solid #dbe2eb;
  border-radius: 6px;
}
.empty-results {
  padding: 10px 18px;
  font-size: 12px;
  color: #64748b;
}
dl {
  font-size: 12px;
  display: grid;
  gap: 12px;
}
dl > div {
  display: flex;
  gap: 10px;
  justify-content: space-between;
}
dt {
  color: #94a3b8;
}
dd {
  margin: 0;
  overflow-wrap: anywhere;
  max-width: 65%;
  text-align: right;
}
.locked-note {
  display: flex;
  align-items: center;
  gap: 5px;
  padding-top: 12px;
  font-size: 11px;
  color: #947147;
}
.inspector-empty {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 14px;
  padding: 35px 20px;
  color: #94a3b8;
}
.inspector-empty strong {
  color: #64748b;
  font-size: 13px;
}
.inspector-empty p {
  font-size: 12px;
  line-height: 1.7;
}
.reset-status-button {
  color: #7c2d12;
  border-color: #c2410c;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 16%);
}
.slot-action-error, .save-message.failed { color: #b42318; }
.map-notice {
  position: fixed;
  top: 90px;
  right: 20px;
  z-index: 40;
  max-width: min(360px, calc(100vw - 40px));
  padding: 12px 16px;
  border: 1px solid #dbe2eb;
  border-radius: 8px;
  background: white;
  box-shadow: 0 8px 24px rgb(15 23 42 / 14%);
  color: #334155;
  font-size: 13px;
}
.page-state {
  padding: 40px;
  text-align: center;
}
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: #15223866;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 20px;
}
.leave-dialog {
  padding: 24px;
  border-radius: 12px;
  background: white;
  max-width: 480px;
}
.leave-dialog p {
  font-size: 13px;
  line-height: 1.7;
  margin: 14px 0 20px;
}
.leave-dialog > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 1100px) {
  .map-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .parking-map-page {
    padding: 18px;
  }
}
@media (max-width: 600px) {
  .parking-map-page {
    padding: 12px;
  }
  .local-badge {
    display: none;
  }
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .summary-card {
    padding: 12px;
  }
  .page-heading h1 {
    font-size: 23px;
  }
  .map-toolbar {
    padding: 0 12px 12px;
  }
}
</style>
