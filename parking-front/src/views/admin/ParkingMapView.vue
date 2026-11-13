<template>
  <section class="parking-map-page">
    <div v-if="assignmentNotification" class="assignment-notification" role="alert" aria-live="assertive">
      {{ assignmentNotification }}
    </div>
    <header class="page-heading">
      <RouterLink to="/admin/setup" class="back-button" aria-label="Back to Parking Setup"
        ><ArrowLeft :size="20"
      /></RouterLink>
      <div>
        <p class="eyebrow">PARKING SETUP</p>
        <div class="title-row">
          <h1>Parking Map</h1>
          <div
            v-if="auth.isAdmin && floor"
            class="floor-status-control"
            role="group"
            aria-label="Floor status"
          >
            <button
              type="button"
              :class="['floor-status-button', 'available', { active: floor.status === 'Available' }]"
              :aria-pressed="floor.status === 'Available'"
              :disabled="updatingFloorStatus"
              @click="setFloorStatus('Available')"
            >
              Available
            </button>
            <button
              type="button"
              :class="['floor-status-button', 'disable', { active: floor.status === 'Disable' }]"
              :aria-pressed="floor.status === 'Disable'"
              :disabled="updatingFloorStatus"
              @click="setFloorStatus('Disable')"
            >
              Disable
            </button>
          </div>
        </div>
        <p v-if="floorStatusError" class="floor-status-error" role="alert">
          {{ floorStatusError }}
        </p>
        <p v-if="floor" class="floor-context">
          {{ floor.building?.building_name || 'Building' }} / Floor {{ floor.floor }} /
          {{ floor.veh_type === 'car' ? 'Cars' : 'Motorcycles' }}
        </p>
      </div>
      <RouterLink
        v-if="floor"
        class="cctv-link"
        :to="{ name: 'AdminSetup', query: { cctvFloorId: floor._id } }"
      >
        <Video :size="17" /> Go to CCTV <ArrowRight :size="17" />
      </RouterLink>
      <span class="local-badge"
        ><HardDrive :size="15" /> {{ dirty ? 'Unsaved changes' : 'Saved map' }}</span
      >
    </header>
    <div v-if="loading" class="page-state" role="status">Loading floor...</div>
    <div v-else-if="error" class="page-state" role="alert">
      <p>{{ error }}</p>
      <button @click="loadFloor">Try again</button>
    </div>
    <template v-else-if="floor">
      <section
        :class="['map-transfer', { compact: viewMode === 'layout' }]"
        aria-label="Map Import/Export"
      >
        <div>
          <h2><FileJson :size="18" /> Map Import/Export</h2>
          <p>Import replaces the current map. Export keeps a copy of slots, names and positions.</p>
          <small>{{ sourceName }}</small>
        </div>
        <div class="transfer-actions">
          <button @click="exportMap" :disabled="!slots.length">
            <Download :size="16" /> Export map</button
          ><button
            class="primary"
            :disabled="importing || !canEditLayout"
            @click="fileInput?.click()"
          >
            <Upload :size="16" />{{ importing ? 'Importing...' : 'Import map' }}
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept=".json,application/json"
          multiple
          aria-label="Import parking map JSON"
          :disabled="importing || !canEditLayout"
          @change="importJson"
        />
        <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>
        <p v-if="importMessage" class="import-success" role="status">{{ importMessage }}</p>
      </section>
      <div
        :class="['summary-grid', { compact: viewMode === 'layout' }]"
        aria-label="Parking summary and status filters"
      >
        <button
          v-for="summary in summaries"
          :key="summary.key"
          :class="['summary-card', summary.key, { active: statusFilter === summary.key }]"
          :aria-pressed="statusFilter === summary.key"
          @click="statusFilter = summary.key"
        >
          <span>{{ summary.label }}</span
          ><strong>{{ summary.count }}</strong>
        </button>
      </div>
      <div class="map-workspace">
        <section class="floor-panel" aria-label="Parking slot layout">
          <div v-if="viewMode === 'preview'" class="panel-heading">
            <div>
              <h2>Floor overview</h2>
              <p>Select a slot to see its name and status.</p>
            </div>
            <div class="panel-heading-actions">
              <span>{{ slots.length }} slots</span>
              <button
                type="button"
                class="update-status-button"
                :disabled="!canUpdateModelSlotStatuses"
                @click="updateModelSlotStatuses"
              >
                {{ updatingModelSlotStatuses ? 'Updating...' : 'Update slot status' }}
              </button>
              <button
                type="button"
                class="reset-status-button"
                :disabled="!canResetSlotStatuses"
                title="Disable every CCTV preset on this floor before resetting slots"
                @click="resetConfirmationOpen = true"
              >
                <RotateCcw :size="16" />
                {{ resettingSlots ? 'Resetting...' : 'Reset parking slot status' }}
              </button>
            </div>
          </div>
          <div class="map-toolbar">
            <div class="view-mode" aria-label="Parking map view">
              <button
                :class="{ active: viewMode === 'preview' }"
                :aria-pressed="viewMode === 'preview'"
                @click="viewMode = 'preview'"
              >
                <LayoutGrid :size="16" />Parking Preview</button
              ><button
                v-if="auth.isAdmin"
                :disabled="!canEditLayout"
                :title="
                  canEditLayout ? 'Edit layout' : 'Disable this floor before editing its layout'
                "
                :class="{ active: viewMode === 'layout' }"
                :aria-pressed="viewMode === 'layout'"
                @click="viewMode = 'layout'"
              >
                <PencilRuler :size="16" />Layout editor
              </button>
            </div>
            <label class="search-field"
              ><Search :size="16" /><input
                v-model="search"
                type="search"
                placeholder="Find a slot by name"
                aria-label="Search slot name"
            /></label>
            <select v-model="statusFilter" aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                {{ label }}
              </option>
            </select>
          </div>
          <p v-if="floor.status === 'Available'" class="locked-note">
            Disable this floor in Parking Setup to use Layout editor.
          </p>
          <p v-if="slots.length && !visibleKeys.size" class="empty-results">
            No matching slots. <button @click="clearFilters">Clear filters</button>
          </p>
          <ParkingLayoutEditor
            :key="`${floor._id}:${editorRevision}`"
            :slots="slots"
            :model-value="layout"
            :readonly="viewMode !== 'layout' || !canEditLayout"
            :autosave="autosave"
            :saving="saving"
            :save-message="saveMessage"
            :save-failed="storageError"
            :visible-keys="visibleKeys"
            @change="updateMap"
            @inspect-slot="inspectSlot"
            @selection="selected = new Set($event)"
            @autosave="setAutosave"
            @save="persistDraft"
          />
        </section>
        <aside
          v-if="selectedSlots.length > 0"
          class="details-panel"
          aria-label="Slot details and actions"
        >
          <div class="details-heading">
            <h2>Slot details</h2>
            <span>{{ selectedSlots.length }} selected</span>
          </div>
          <template v-if="inspectedSlot">
            <div class="detail-body">
              <div v-if="selectedSlots.length === 1" :class="['slot-preview', inspectedSlot.status]">
                <ParkingSquare :size="36" /><strong>{{ slotDisplayName(inspectedSlot) }}</strong
                ><span>{{ statusLabels[inspectedSlot.status] }}</span>
              </div>
              <div
                v-if="viewMode === 'layout' && canEditLayout"
                class="slot-assignment"
              >
                <label for="slot-cctv">Select CCTV</label>
                <select
                  id="slot-cctv"
                  v-model="selectedCctvPresetId"
                  :disabled="!floor.camera_presets?.length"
                >
                  <option value="">{{ floor.camera_presets?.length ? 'Select CCTV' : 'None' }}</option>
                  <option
                    v-for="camera in floor.camera_presets || []"
                    :key="camera._id"
                    :value="camera._id"
                  >
                    {{ camera.name }}
                  </option>
                </select>
                <template v-if="selectedSlots.length === 1">
                  <label for="slot-parking-name">Select Parking Slot</label>
                  <select
                    id="slot-parking-name"
                    v-model="selectedParkingSlotName"
                    :disabled="!selectedCctvPresetId || !parkingSlotNames.length"
                  >
                    <option value="">{{ parkingSlotNames.length ? 'Select Parking Slot' : 'None' }}</option>
                    <option v-for="name in parkingSlotNames" :key="name" :value="name">
                      {{ name }}
                    </option>
                  </select>
                </template>
              </div>
              <dl v-if="selectedSlots.length === 1">
                <div>
                  <dt>Building</dt>
                  <dd>{{ floor.building?.building_name || '-' }}</dd>
                </div>
                <div>
                  <dt>Floor</dt>
                  <dd>{{ floor.floor }}</dd>
                </div>
              </dl>
              <p
                v-if="selectedSlots.length === 1 && !isEditableSlot(inspectedSlot)"
                class="locked-note"
              >
                <LockKeyhole :size="15" /> Occupied and incoming statuses are controlled by the
                camera.
              </p>
            </div>
          </template>
          <div class="detail-body selection-section">
            <h3>{{ selectedSlots.length }} parking slots selected</h3>
            <p>Shift-click slots to select more than one.</p>
            <div class="selection-actions">
              <button class="enable-button" :disabled="!canEnable" @click="setStatus('available')">
                <CheckCircle2 :size="16" />Enable</button
              ><button
                class="disable-button"
                :disabled="!canDisable"
                @click="setStatus('disabled')"
              >
                <Ban :size="16" />Disable
              </button>
            </div>
            <p :class="['save-message', { failed: storageError }]" role="status">
              {{ saveMessage }}
            </p>
            <button v-if="dirty && !autosave && auth.isAdmin" class="primary" @click="persistDraft">
              Save changes
            </button>
          </div>
        </aside>
      </div>
    </template>
    <div v-if="resetConfirmationOpen" class="dialog-backdrop">
      <section
        class="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reset-slots-title"
      >
        <h2 id="reset-slots-title">Are you sure to reset all slot status</h2>
        <div>
          <button type="button" @click="resetConfirmationOpen = false">Cancel</button>
          <button
            type="button"
            class="primary"
            :disabled="resettingSlots"
            @click="confirmResetParkingSlotStatuses"
          >
            Confirm
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
        <h2 id="unsaved-title">Save your changes?</h2>
        <p>This floor has changes that have not been saved to the server.</p>
        <div>
          <button @click="leaveTarget = null">Keep editing</button
          ><button @click="discardAndLeave">Discard changes</button
          ><button class="primary" @click="saveAndLeave">Save and leave</button>
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
  Ban,
  CheckCircle2,
  Download,
  FileJson,
  HardDrive,
  LayoutGrid,
  LockKeyhole,
  ParkingSquare,
  PencilRuler,
  RotateCcw,
  Search,
  Upload,
  Video,
} from 'lucide-vue-next'
import { isAxiosError } from 'axios'
import { floorService, type ParkingFloor, type ParkingFloorPayload } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ParkingLayoutEditor from '@/components/parking/ParkingLayoutEditor.vue'
import {
  defaultSlotBox,
  emptyParkingLayout,
  restoreParkingLayout,
  slotDisplayName,
  type ParkingLayout,
  type ParkingMapState,
} from '@/components/parking/parkingLayout'
import {
  isEditableSlot,
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
  error = ref('')
const slots = ref<PreviewSlot[]>([]),
  layout = ref<ParkingLayout>(emptyParkingLayout())
const canEditLayout = computed(() => auth.isAdmin && floor.value?.status !== 'Available')
const editorRevision = ref(0)
const sourceName = ref('New map'),
  viewMode = ref<'preview' | 'layout'>('preview')
const selected = ref(new Set<string>()),
  inspectedKey = ref<string | null>(null)
const assignmentNotification = ref('')
let assignmentNotificationTimeout: ReturnType<typeof setTimeout> | undefined
const autosave = ref(true),
  dirty = ref(false),
  saving = ref(false),
  updatingFloorStatus = ref(false),
  floorStatusError = ref(''),
  saveMessage = ref('No unsaved changes'),
  storageError = ref(false)
const fileInput = ref<HTMLInputElement | null>(null),
  importing = ref(false),
  importError = ref(''),
  importMessage = ref('')
const search = ref(''),
  statusFilter = ref<SlotStatus | 'all'>('all')
const draftKey = computed(
  () => `parking-map-preview:v1:${auth.user?._id || auth.user?.id}:${route.params.floorId}`,
)
let loadVersion = 0,
  importVersion = 0
const leaveTarget = ref<RouteLocationRaw | null>(null)
let allowLeave = false
const inspectedSlot = computed(() =>
  slots.value.find((slot) => slotKey(slot) === inspectedKey.value),
)
const selectedCctvPresetId = computed({
  get: () => {
    if (selectedSlots.value.length > 1) {
      const presetIds = new Set(selectedSlots.value.map((slot) => slot.cameraPresetId || ''))
      return presetIds.size === 1 ? [...presetIds][0]! : ''
    }
    return inspectedSlot.value?.cameraPresetId || ''
  },
  set: (cameraPresetId: string) => {
    updateSelectedSlots({
      cameraPresetId: cameraPresetId || undefined,
      parkingSlotName: undefined,
    })
  },
})
const selectedCameraPreset = computed(() =>
  floor.value?.camera_presets?.find(
    (camera) => camera._id === selectedCctvPresetId.value,
  ),
)
const parkingSlotNames = computed(() => {
  const slot = inspectedSlot.value
  const assignedNames = new Set(
    slots.value
      .filter(
        (other) =>
          other.cameraPresetId === selectedCctvPresetId.value &&
          other.parkingSlotName &&
          (!slot || slotKey(other) !== slotKey(slot)),
      )
      .map((other) => other.parkingSlotName!),
  )
  return getCameraSlotNames(selectedCameraPreset.value).filter(
    (name) => !assignedNames.has(name),
  )
})
const selectedParkingSlotName = computed({
  get: () => inspectedSlot.value?.parkingSlotName || '',
  set: (parkingSlotName: string) => {
    const slot = inspectedSlot.value
    if (
      parkingSlotName &&
      slot &&
      slots.value.some(
        (other) =>
          slotKey(other) !== slotKey(slot) &&
          other.cameraPresetId === slot.cameraPresetId &&
          other.parkingSlotName === parkingSlotName,
      )
    ) {
      showAssignmentNotification(
        `Parking slot "${parkingSlotName}" is already assigned to another map slot.`,
      )
      return
    }
    assignmentNotification.value = ''
    updateInspectedSlot({
      cameraPresetId: slot?.cameraPresetId,
      parkingSlotName: parkingSlotName || undefined,
    })
  },
})
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
const canEnable = computed(
  () =>
    auth.isAdmin &&
    !importing.value &&
    selectedSlots.value.some((slot) => slot.status === 'disabled'),
)
const canDisable = computed(
  () =>
    auth.isAdmin &&
    !importing.value &&
    selectedSlots.value.some((slot) => slot.status === 'available'),
)
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
function inspectSlot(slot: PreviewSlot) {
  inspectedKey.value = slotKey(slot)
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
  selected.value.clear()
  inspectedKey.value = null
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
    const response = await floorService.list()
    if (version !== loadVersion) return
    floor.value = response.data.floors.find((item) => item._id === floorId) || null
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
    } else if (floor.value.parking_slot_files?.length) {
      const files = floor.value.parking_slot_files
      const imported = await Promise.all(
        files.map(async (file) =>
          parseParkingMapJson((await floorService.downloadSlotFile(floorId, file._id)).data),
        ),
      )
      if (version !== loadVersion) return
      slots.value = validateSlots(imported.flat())
      sourceName.value = files.map((file) => file.original_name).join(', ')
    }
    if (version !== loadVersion) return
    layout.value = withPositions(slots.value, layout.value)
  } catch (cause) {
    if (version === loadVersion)
      error.value = 'Unable to load this floor and its map. Please try again.'
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
  if (!canEditLayout.value || loading.value || importing.value) return
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
    await save
    if (
      key === draftKey.value &&
      revision === saveRevision &&
      JSON.stringify(content.slots) === JSON.stringify(slots.value) &&
      JSON.stringify(content.layout) === JSON.stringify(layout.value)
    ) {
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
        ? `Could not save map: ${serverMessage}. Retry Save now or export your map.`
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
function setStatus(status: 'available' | 'disabled') {
  if (!auth.isAdmin || importing.value) return
  slots.value = slots.value.map((slot) =>
    selected.value.has(slotKey(slot)) && isEditableSlot(slot) ? { ...slot, status } : slot,
  )
  changed()
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
    inspectedKey.value = null
    saveMessage.value = 'All parking slot statuses reset to Available.'
    showAssignmentNotification('Parking slot statuses reset to Available.')
  } catch (cause) {
    showAssignmentNotification(
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
    showAssignmentNotification(
      `${response.data.message} (${response.data.requestedSlots} slots).`,
    )
  } catch (cause) {
    showAssignmentNotification(
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
function updateInspectedSlot(
  assignment: Pick<PreviewSlot, 'cameraPresetId' | 'parkingSlotName'>,
) {
  const slot = inspectedSlot.value
  if (!canEditLayout.value || viewMode.value !== 'layout' || !slot) return
  updateSlots([slot], assignment)
}
function updateSelectedSlots(
  assignment: Pick<PreviewSlot, 'cameraPresetId' | 'parkingSlotName'>,
) {
  const targets =
    selectedSlots.value.length > 1
      ? selectedSlots.value
      : inspectedSlot.value
        ? [inspectedSlot.value]
        : []
  if (!canEditLayout.value || viewMode.value !== 'layout' || !targets.length) return
  updateSlots(targets, assignment)
}
function updateSlots(
  targets: PreviewSlot[],
  assignment: Pick<PreviewSlot, 'cameraPresetId' | 'parkingSlotName'>,
) {
  const targetKeys = new Set(targets.map(slotKey))
  slots.value = slots.value.map((other) =>
    targetKeys.has(slotKey(other))
      ? {
          ...other,
          cameraPresetId: assignment.cameraPresetId,
          parkingSlotName: assignment.parkingSlotName,
        }
      : other,
  )
  changed()
}
function showAssignmentNotification(message: string) {
  assignmentNotification.value = message
  if (assignmentNotificationTimeout) clearTimeout(assignmentNotificationTimeout)
  assignmentNotificationTimeout = setTimeout(() => {
    assignmentNotification.value = ''
    assignmentNotificationTimeout = undefined
  }, 4000)
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
    slots.value = nextSlots
    layout.value = withPositions(nextSlots, nextLayout)
    sourceName.value = files.map((file) => file.name).join(', ')
    selected.value.clear()
    inspectedKey.value = null
    clearFilters()
    editorRevision.value++
    importing.value = false
    changed()
    importMessage.value = `Imported ${nextSlots.length} slots. Names and saved positions have been preserved.`
  } catch (cause) {
    if (version === importVersion)
      importError.value = `${cause instanceof Error ? cause.message : 'Unable to import map.'} The current map has not changed.`
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
watch(inspectedSlot, (slot) => {
  if (!slot) inspectedKey.value = null
})
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
  if (assignmentNotificationTimeout) clearTimeout(assignmentNotificationTimeout)
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
button {
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
button:hover {
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
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #f1f3f5;
}
.floor-status-button {
  border: 0;
  border-radius: 999px;
  padding: 8px 16px;
  font-weight: 600;
}
.floor-status-button.available {
  color: #fff;
  background: #35b54a;
}
.floor-status-button.disable {
  color: #374151;
  background: #d1d5db;
}
.floor-status-button.active {
  box-shadow: inset 0 0 0 2px #000;
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
  background: #2563eb;
  color: white;
  font-size: 12px;
}
.cctv-link:hover {
  background: #1d4ed8;
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
.floor-panel,
.details-panel {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  min-width: 0;
}
.details-panel {
  min-height: 0;
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
.details-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 17px;
  border-bottom: 1px solid #edf0f4;
}
.details-heading span {
  font-size: 11px;
  color: #94a3b8;
}
.slot-preview {
  margin: 16px;
  padding: 22px 12px;
  display: grid;
  justify-items: center;
  gap: 10px;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #dbe2eb;
  border-radius: 8px;
  overflow-wrap: anywhere;
}
.slot-preview strong {
  font-size: 22px;
  max-width: 100%;
}
.slot-preview span {
  font-size: 12px;
}
.slot-preview.available {
  background: #edf9f1;
  color: #15803d;
}
.slot-preview.occupied {
  background: #fceeed;
  color: #c23b45;
}
.slot-preview.incoming {
  background: #fff5df;
  color: #a36507;
}
.detail-body {
  padding: 0 16px 16px;
}
.slot-assignment {
  display: grid;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 18px;
}
.slot-assignment select {
  min-width: 0;
  width: 100%;
  padding: 8px;
  border: 1px solid #dbe2eb;
  border-radius: 6px;
}
.assignment-notification {
  position: fixed;
  top: 90px;
  right: 20px;
  z-index: 40;
  max-width: min(360px, calc(100vw - 40px));
  padding: 12px 16px;
  border: 1px solid #f3b4b4;
  border-radius: 8px;
  background: #fff1f0;
  box-shadow: 0 8px 24px rgb(15 23 42 / 14%);
  color: #b42318;
  font-size: 13px;
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
.selection-section {
  border-top: 1px solid #edf0f4;
  padding-top: 16px;
}
.selection-section h3 {
  font-size: 12px;
  font-weight: 650;
}
.selection-section p {
  color: #94a3b8;
  font-size: 11px;
  line-height: 1.7;
  margin-top: 8px;
}
.selection-actions {
  display: flex;
  gap: 8px;
  margin: 14px 0;
}
.enable-button {
  color: #15803d;
}
.disable-button {
  color: #b42318;
}
.reset-status-button {
  color: #7c2d12;
  border-color: #c2410c;
  background: #fff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 16%);
}
.selection-section .failed {
  color: #b42318;
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
  .transfer-actions {
    flex-wrap: wrap;
  }
  .map-toolbar {
    padding: 0 12px 12px;
  }
}
</style>
