<template>
  <section class="parking-map-page">
    <header class="page-heading">
      <RouterLink to="/admin/setup" class="back-button" aria-label="Back to Parking Setup"
        ><ArrowLeft :size="20"
      /></RouterLink>
      <div>
        <p class="eyebrow">PARKING SETUP</p>
        <h1>Parking Map</h1>
        <p v-if="floor" class="floor-context">
          {{ floor.building?.building_name || 'Building' }} / Floor {{ floor.floor }} /
          {{ floor.veh_type === 'car' ? 'Cars' : 'Motorcycles' }}
        </p>
      </div>
      <span class="local-badge"
        ><HardDrive :size="15" /> {{ dirty ? 'Unsaved changes' : 'Local map' }}</span
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
            :disabled="importing || !auth.isAdmin"
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
          :disabled="importing || !auth.isAdmin"
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
            <span>{{ slots.length }} slots</span>
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
          <p v-if="slots.length && !visibleKeys.size" class="empty-results">
            No matching slots. <button @click="clearFilters">Clear filters</button>
          </p>
          <ParkingLayoutEditor
            :key="`${floor._id}:${editorRevision}`"
            :slots="slots"
            :model-value="layout"
            :readonly="viewMode !== 'layout' || !auth.isAdmin"
            :autosave="autosave"
            :dirty="dirty"
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
        <aside class="details-panel" aria-label="Slot details and actions">
          <div class="details-heading">
            <h2>Slot details</h2>
            <span>{{ selectedSlots.length }} selected</span>
          </div>
          <template v-if="inspectedSlot">
            <div :class="['slot-preview', inspectedSlot.status]">
              <ParkingSquare :size="36" /><strong>{{ slotDisplayName(inspectedSlot) }}</strong
              ><span>{{ statusLabels[inspectedSlot.status] }}</span>
            </div>
            <div class="detail-body">
              <form
                v-if="viewMode === 'layout' && auth.isAdmin"
                class="rename-slot"
                @submit.prevent="renameSlot"
              >
                <label for="slot-name">Slot name</label>
                <div>
                  <input
                    id="slot-name"
                    v-model="slotName"
                    maxlength="100"
                    autocomplete="off"
                  /><button
                    :disabled="
                      !slotName.trim() || slotName.trim() === slotDisplayName(inspectedSlot)
                    "
                  >
                    Apply
                  </button>
                </div>
                <p>
                  Use the exact parking slot name in your CCTV JSON file, including capital letters.
                </p>
                <p v-if="renameError" class="field-error" role="alert">{{ renameError }}</p>
              </form>
              <dl>
                <div>
                  <dt>Building</dt>
                  <dd>{{ floor.building?.building_name || '-' }}</dd>
                </div>
                <div>
                  <dt>Floor</dt>
                  <dd>{{ floor.floor }}</dd>
                </div>
                <div>
                  <dt>Slot name</dt>
                  <dd>{{ slotDisplayName(inspectedSlot) }}</dd>
                </div>
              </dl>
              <p v-if="!isEditableSlot(inspectedSlot)" class="locked-note">
                <LockKeyhole :size="15" /> Occupied and incoming statuses are controlled by the
                camera.
              </p>
            </div>
          </template>
          <div v-else class="inspector-empty">
            <MousePointer2 :size="32" /><strong>Select a parking slot</strong>
            <p>Open Layout editor to create slots, move them or change their names.</p>
          </div>
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
    <div v-if="leaveTarget" class="dialog-backdrop">
      <section
        class="leave-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <h2 id="unsaved-title">Save your changes?</h2>
        <p>This floor has changes that have not been saved on this device.</p>
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
  Ban,
  CheckCircle2,
  Download,
  FileJson,
  HardDrive,
  LayoutGrid,
  LockKeyhole,
  MousePointer2,
  ParkingSquare,
  PencilRuler,
  Search,
  Upload,
} from 'lucide-vue-next'
import { floorService, type ParkingFloor } from '@/services/api'
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
const route = useRoute(),
  router = useRouter(),
  auth = useAuthStore()
const floor = ref<ParkingFloor | null>(null),
  loading = ref(true),
  error = ref('')
const slots = ref<PreviewSlot[]>([]),
  layout = ref<ParkingLayout>(emptyParkingLayout())
const editorRevision = ref(0)
const sourceName = ref('New map'),
  viewMode = ref<'preview' | 'layout'>('preview')
const selected = ref(new Set<string>()),
  inspectedKey = ref<string | null>(null),
  slotName = ref(''),
  renameError = ref('')
const autosave = ref(true),
  dirty = ref(false),
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
const selectedSlots = computed(() =>
  slots.value.filter((slot) => selected.value.has(slotKey(slot))),
)
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
  slotName.value = slotDisplayName(slot)
  renameError.value = ''
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
    if (raw) {
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
  } catch {
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
  if (!auth.isAdmin || loading.value || importing.value) return
  slots.value = next.slots
  layout.value = next.layout
  changed()
}
function persistDraft(): boolean {
  if (!auth.isAdmin || !floor.value || loading.value || importing.value) return false
  try {
    localStorage.setItem(
      draftKey.value,
      JSON.stringify({
        version: 2,
        sourceName: sourceName.value,
        slots: slots.value,
        layout: layout.value,
      }),
    )
    dirty.value = false
    storageError.value = false
    saveMessage.value = 'Map saved on this device'
    return true
  } catch {
    storageError.value = true
    saveMessage.value = 'Could not save on this device. Export your map to keep a copy.'
    return false
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
function renameSlot() {
  const slot = inspectedSlot.value,
    name = slotName.value.trim()
  if (!auth.isAdmin || viewMode.value !== 'layout' || !slot || !name) return
  if (
    slots.value.some((other) => slotKey(other) !== slotKey(slot) && slotDisplayName(other) === name)
  ) {
    renameError.value = 'This slot name is already in use. Choose a unique name.'
    return
  }
  slots.value = slots.value.map((other) =>
    slotKey(other) === slotKey(slot) ? { ...other, name } : other,
  )
  renameError.value = ''
  changed()
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement,
    files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || !auth.isAdmin || !floor.value || loading.value || importing.value) return
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
    if (version !== importVersion || targetKey !== draftKey.value || !auth.isAdmin) return
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
function saveAndLeave() {
  if (persistDraft()) discardAndLeave()
}
watch(() => route.params.floorId, loadFloor, { immediate: true })
watch(inspectedSlot, (slot) => {
  if (slot) slotName.value = slotDisplayName(slot)
  else inspectedKey.value = null
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
  border-color: #29374d;
  color: white;
}
.primary:hover {
  background: #3b4b64;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
a:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.page-heading {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}
.back-button {
  background: white;
  border: 1px solid #e2e8f0;
  padding: 10px;
  border-radius: 8px;
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
  margin-left: auto;
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
.panel-heading > span {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
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
.rename-slot {
  display: grid;
  gap: 8px;
  font-size: 12px;
  margin-bottom: 18px;
}
.rename-slot > div {
  display: flex;
  gap: 5px;
}
.rename-slot input {
  min-width: 0;
  width: 100%;
  padding: 8px;
  border: 1px solid #dbe2eb;
  border-radius: 6px;
}
.rename-slot p {
  color: #64748b;
  font-size: 11px;
  line-height: 1.7;
}
.rename-slot .field-error {
  color: #b42318;
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
  .details-panel {
    max-width: 100%;
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
