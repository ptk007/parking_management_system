<template>
  <section class="parking-map-page">
    <header class="page-heading">
      <div class="heading-main">
        <RouterLink to="/admin/setup" class="back-button" aria-label="Back to Parking Setup"
          ><ArrowLeft :size="21"
        /></RouterLink>
        <div>
          <p class="eyebrow">PARKING SETUP / FLOOR WORKSPACE</p>
          <h1>Parking Map <span class="preview-badge">Preview</span></h1>
          <p v-if="floor" class="floor-context">
            {{ floor.building?.building_name || 'Building' }} <span>/</span> Floor {{ floor.floor }}
            <span>/</span> {{ floor.veh_type === 'car' ? 'Cars' : 'Motorcycles' }}
          </p>
        </div>
      </div>
      <div v-if="floor" class="draft-status">
        <HardDrive :size="16" /> Local preview <span class="status-dot"></span>
      </div>
    </header>

    <div v-if="loading" class="page-state" role="status">Loading floor…</div>
    <div v-else-if="error" class="page-state" role="alert">
      <p>{{ error }}</p>
      <button class="secondary-button" @click="loadFloor">Try again</button>
    </div>
    <template v-else-if="floor">
      <div class="preview-note">
        <Info :size="17" />
        <p>
          ทดลองจัดการช่องจอดแบบ POS ·
          {{
            sourceName === 'E4 sample'
              ? 'ใช้แผนผังตัวอย่าง E4 จาก Dashboard'
              : 'ใช้แผนผังจากไฟล์ JSON'
          }}
          · บันทึกเฉพาะในเครื่องนี้ แยกตามชั้น
        </p>
      </div>
      <div class="json-import-panel">
        <div class="import-description">
          <strong><FileJson :size="18" /> JSON layout</strong>
          <p class="import-source">{{ sourceName }}</p>
          <p>
            เลือกได้หลายไฟล์เพื่อรวมโซน · นำเข้าแทนแผนผังปัจจุบัน · ช่องที่ไม่ระบุสถานะจะเป็น
            Available
          </p>
        </div>
        <div class="import-buttons">
          <button class="secondary-button" @click="downloadExample">
            <Download :size="16" /> Example JSON
          </button>
          <button
            class="import-button"
            :disabled="importing || !auth.isAdmin"
            @click="fileInput?.click()"
          >
            <Upload :size="16" />{{ importing ? 'Importing…' : 'Import JSON' }}
          </button>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept=".json,application/json"
            multiple
            aria-label="Import parking map JSON"
            :disabled="importing || !auth.isAdmin"
            @change="importJson"
          />
        </div>
        <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>
        <p v-else-if="importMessage" class="import-success" role="status">{{ importMessage }}</p>
      </div>
      <div class="summary-grid" aria-label="Parking summary and status filters">
        <button
          v-for="summary in summaries"
          :key="summary.key"
          :class="['summary-card', summary.key, { active: statusFilter === summary.key }]"
          :aria-pressed="statusFilter === summary.key"
          @click="statusFilter = summary.key"
        >
          <span class="summary-label"><i></i>{{ summary.label }}</span>
          <strong>{{ summary.count }}<ArrowUpRight :size="18" /></strong>
        </button>
      </div>

      <div :class="['pos-workspace', { 'layout-workspace': viewMode === 'layout' }]">
        <section class="floor-panel" aria-label="Parking slot layout">
          <div class="panel-heading">
            <div>
              <h2><LayoutGrid :size="19" /> Floor overview</h2>
              <p>
                {{
                  viewMode === 'layout'
                    ? 'จัดวางช่องจอดและออกแบบรายละเอียดบนแผนผัง'
                    : 'เลือกช่องจอดเหมือนเลือกโต๊ะในระบบ POS'
                }}
              </p>
            </div>
            <span class="slot-count"
              >{{ viewMode === 'layout' ? slots.length : filteredSlots.length }} slots shown</span
            >
          </div>
          <div class="view-mode" aria-label="Parking map view">
            <button
              :class="{ active: viewMode === 'pos' }"
              :aria-pressed="viewMode === 'pos'"
              @click="viewMode = 'pos'"
            >
              <LayoutGrid :size="16" /> POS view
            </button>
            <button
              :class="{ active: viewMode === 'layout' }"
              :aria-pressed="viewMode === 'layout'"
              @click="openLayout"
            >
              <PencilRuler :size="16" /> Layout editor
            </button>
          </div>
          <ParkingLayoutEditor
            v-if="viewMode === 'layout' && auth.isAdmin"
            :key="editorVersion"
            :slots="slots"
            :model-value="layout"
            :save-message="saveMessage"
            :save-failed="storageError"
            @update:model-value="updateLayout"
            @inspect-slot="inspectSlot"
          />
          <div v-if="viewMode === 'pos'" class="zone-tabs" aria-label="Filter by zone">
            <button
              v-for="zone in ['All', ...zones]"
              :key="zone"
              :class="{ active: zoneFilter === zone }"
              :aria-pressed="zoneFilter === zone"
              @click="zoneFilter = zone"
            >
              {{ zone === 'All' ? 'All zones' : `Zone ${zone}`
              }}<span>{{
                zone === 'All' ? slots.length : slots.filter((slot) => slot.zone === zone).length
              }}</span>
            </button>
          </div>
          <div v-if="viewMode === 'pos'" class="map-toolbar">
            <label class="search-field"
              ><Search :size="17" /><input
                v-model="search"
                type="search"
                placeholder="Search slot number…"
                aria-label="Search slot number"
            /></label>
            <label class="status-select"
              ><span class="sr-only">Filter by status</span
              ><select v-model="statusFilter">
                <option value="all">All statuses</option>
                <option v-for="(label, value) in statusLabels" :key="value" :value="value">
                  {{ label }}
                </option>
              </select></label
            >
          </div>
          <div v-if="viewMode === 'pos'" class="slot-board">
            <div class="board-guide">
              <span><LogIn :size="14" /> ENTRY</span><span>Select a slot to inspect</span
              ><span>EXIT <LogOut :size="14" /></span>
            </div>
            <div v-if="!filteredSlots.length" class="empty-results">
              <Search :size="28" />
              <h3>No matching slots</h3>
              <p>ลองเปลี่ยนโซน สถานะ หรือหมายเลขช่องจอด</p>
              <button class="secondary-button" @click="clearFilters">Clear filters</button>
            </div>
            <section
              v-for="zone in visibleZones"
              :key="zone.name"
              class="zone-section"
              :aria-label="`Zone ${zone.name}`"
            >
              <div class="zone-heading">
                <h3>
                  <span>{{ zone.name }}</span> Zone {{ zone.name }}
                </h3>
                <p>
                  {{ zone.slots.filter((slot) => slot.status === 'available').length }} available /
                  {{ zone.slots.length }} shown
                </p>
              </div>
              <div class="slot-grid">
                <button
                  v-for="slot in zone.slots"
                  :key="slotKey(slot)"
                  :class="[
                    'parking-tile',
                    slot.status,
                    {
                      selected: selected.has(slotKey(slot)),
                      inspected: inspectedKey === slotKey(slot),
                    },
                  ]"
                  :data-slot="slot.number"
                  :data-slot-key="slotKey(slot)"
                  :aria-label="`Slot ${slot.number}, Zone ${slot.zone}, ${statusLabels[slot.status]}`"
                  :aria-pressed="selected.has(slotKey(slot))"
                  @click="inspectSlot(slot)"
                >
                  <span class="tile-top"
                    ><span>{{ slot.zone }} / {{ String(slot.number).padStart(3, '0') }}</span
                    ><Check v-if="selected.has(slotKey(slot))" :size="15" /><LockKeyhole
                      v-else-if="!isEditableSlot(slot)"
                      :size="13" /><component
                      v-else
                      :is="floor.veh_type === 'car' ? CarFront : Bike"
                      :size="17"
                  /></span>
                  <strong>{{ String(slot.number).padStart(2, '0') }}</strong>
                  <span class="tile-status"><i></i>{{ statusLabels[slot.status] }}</span>
                </button>
              </div>
            </section>
          </div>
          <footer class="board-footer">
            <span v-for="(label, value) in statusLabels" :key="value" :class="value"
              ><i></i>{{ label }}</span
            >
          </footer>
        </section>

        <aside
          v-if="viewMode === 'pos' || inspectedSlot || selected.size"
          class="details-panel"
          aria-label="Slot details and actions"
        >
          <div class="details-heading">
            <h2>Slot details</h2>
            <span>{{ selected.size }} selected</span>
          </div>
          <template v-if="inspectedSlot">
            <div :class="['slot-preview', inspectedSlot.status]">
              <component
                :is="floor.veh_type === 'car' ? CarFront : Bike"
                :size="40"
                :stroke-width="1.5"
              /><span>ZONE {{ inspectedSlot.zone }}</span
              ><strong>{{ String(inspectedSlot.number).padStart(2, '0') }}</strong
              ><span class="detail-status"><i></i>{{ statusLabels[inspectedSlot.status] }}</span>
            </div>
            <dl class="slot-facts">
              <div>
                <dt>Building</dt>
                <dd>{{ floor.building?.building_name || '—' }}</dd>
              </div>
              <div>
                <dt>Floor</dt>
                <dd>{{ floor.floor }}</dd>
              </div>
              <div>
                <dt>Vehicle</dt>
                <dd>{{ floor.veh_type === 'car' ? 'Car' : 'Motorcycle' }}</dd>
              </div>
              <div>
                <dt>Layout source</dt>
                <dd>{{ sourceName }}</dd>
              </div>
            </dl>
            <p v-if="!isEditableSlot(inspectedSlot)" class="locked-note">
              <LockKeyhole :size="16" /> ช่องที่ Occupied หรือ Incoming ดูรายละเอียดได้
              แต่เปิด–ปิดไม่ได้
            </p>
          </template>
          <div v-else class="inspector-empty">
            <MousePointer2 :size="36" :stroke-width="1.4" />
            <h3>Select a parking slot</h3>
            <p>แตะการ์ดเพื่อดูรายละเอียด<br />เลือกหลายช่องเพื่อเปิด–ปิดพร้อมกัน</p>
          </div>

          <div class="selection-section">
            <div class="selection-heading">
              <h3>
                Selected slots <span>{{ selected.size }}</span>
              </h3>
              <button :disabled="!selected.size" @click="selected.clear()">Clear</button>
            </div>
            <div v-if="selected.size" class="selection-chips">
              <button
                v-for="slot in selectedSlots"
                :key="slotKey(slot)"
                :aria-label="`Remove slot ${slot.zone} / ${slot.number} from selection`"
                @click="selected.delete(slotKey(slot))"
              >
                {{ slot.zone }} / {{ String(slot.number).padStart(2, '0') }}<X :size="12" />
              </button>
            </div>
            <p v-else class="selection-hint">No slots selected</p>
          </div>
          <div class="selection-actions">
            <button class="enable-button" :disabled="!canEnable" @click="setStatus('available')">
              <CheckCircle2 :size="18" /> Enable slots</button
            ><button class="disable-button" :disabled="!canDisable" @click="setStatus('disabled')">
              <Ban :size="18" /> Disable slots
            </button>
          </div>
          <p :class="['save-message', { failed: storageError }]" role="status">
            <HardDrive :size="14" />{{ saveMessage }}
          </p>
        </aside>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import {
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Bike,
  CarFront,
  Check,
  CheckCircle2,
  Download,
  FileJson,
  HardDrive,
  Info,
  LayoutGrid,
  LockKeyhole,
  LogIn,
  LogOut,
  MousePointer2,
  PencilRuler,
  Search,
  Upload,
  X,
} from 'lucide-vue-next'
import { floorService, type ParkingFloor } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import ParkingLayoutEditor from '@/components/parking/ParkingLayoutEditor.vue'
import { createDashboardLayout } from '@/components/parking/dashboardLayoutTemplate'
import { emptyParkingLayout, type ParkingLayout } from '@/components/parking/parkingLayout'
import {
  createPreviewSlots,
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

const route = useRoute()
const auth = useAuthStore()
const floor = ref<ParkingFloor | null>(null)
const loading = ref(true)
const error = ref('')
const slots = ref<PreviewSlot[]>([])
const selected = ref(new Set<string>())
const inspectedKey = ref<string | null>(null)
const sourceName = ref('E4 sample')
const layout = ref<ParkingLayout>(emptyParkingLayout())
const viewMode = ref<'pos' | 'layout'>('pos')
const editorVersion = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const importError = ref('')
const importMessage = ref('')
let importVersion = 0
const zoneFilter = ref('A')
const statusFilter = ref<SlotStatus | 'all'>('all')
const search = ref('')
const saveMessage = ref('Changes save automatically on this device')
const storageError = ref(false)
const draftKey = computed(
  () => `parking-map-preview:v1:${auth.user?._id || auth.user?.id}:${route.params.floorId}`,
)
let loadVersion = 0

async function loadFloor() {
  const version = ++loadVersion
  ++importVersion
  importing.value = false
  importError.value = ''
  importMessage.value = ''
  sourceName.value = 'E4 sample'
  layout.value = emptyParkingLayout()
  editorVersion.value += 1
  const floorId = String(route.params.floorId)
  loading.value = true
  floor.value = null
  error.value = ''
  selected.value = new Set()
  inspectedKey.value = null
  clearFilters()
  zoneFilter.value = 'A'
  storageError.value = false
  saveMessage.value = 'Changes save automatically on this device'
  try {
    const response = await floorService.list()
    if (version !== loadVersion) return
    floor.value = response.data.floors.find((item) => item._id === floorId) || null
    if (!floor.value) {
      error.value = 'Floor not found. Return to Parking Setup to choose a floor.'
      return
    }
    try {
      const saved = localStorage.getItem(draftKey.value)
      const restored = restoreMapDraft(saved)
      slots.value = restored.slots
      sourceName.value = restored.sourceName
      layout.value = restored.layout
      zoneFilter.value = slots.value[0]?.zone || 'All'
      if (saved) saveMessage.value = 'Saved preview restored from this device'
    } catch {
      slots.value = createPreviewSlots()
      storageError.value = true
      saveMessage.value = 'Could not restore draft. Showing original sample.'
    }
  } catch {
    if (version === loadVersion) error.value = 'Unable to load this floor. Please try again.'
  } finally {
    if (version === loadVersion) loading.value = false
  }
}

const filteredSlots = computed(() =>
  slots.value.filter(
    (slot) =>
      (zoneFilter.value === 'All' || slot.zone === zoneFilter.value) &&
      (statusFilter.value === 'all' || slot.status === statusFilter.value) &&
      (!search.value.trim() || String(slot.number).padStart(3, '0').includes(search.value.trim())),
  ),
)
const zones = computed(() => [...new Set(slots.value.map((slot) => slot.zone))])
const visibleZones = computed(() =>
  zones.value
    .map((name) => ({
      name,
      slots: filteredSlots.value.filter((slot) => slot.zone === name),
    }))
    .filter((zone) => zone.slots.length),
)
const summaries = computed(() => [
  { key: 'all' as const, label: 'Total slots', count: slots.value.length },
  ...Object.entries(statusLabels).map(([key, label]) => ({
    key: key as SlotStatus,
    label,
    count: slots.value.filter((slot) => slot.status === key).length,
  })),
])
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

function clearFilters() {
  zoneFilter.value = 'All'
  statusFilter.value = 'all'
  search.value = ''
}
function inspectSlot(slot: PreviewSlot) {
  inspectedKey.value = slotKey(slot)
  if (!auth.isAdmin || !isEditableSlot(slot)) return
  if (selected.value.has(slotKey(slot))) selected.value.delete(slotKey(slot))
  else selected.value.add(slotKey(slot))
}
function setStatus(status: 'available' | 'disabled') {
  if (!auth.isAdmin || !floor.value || loading.value || importing.value) return
  for (const slot of slots.value) {
    if (selected.value.has(slotKey(slot)) && isEditableSlot(slot)) slot.status = status
  }
  selected.value.clear()
  persistDraft()
}
function persistDraft() {
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
    storageError.value = false
    saveMessage.value = 'Preview saved on this device'
  } catch {
    storageError.value = true
    saveMessage.value = 'Could not save. Changes will be lost when you leave.'
  }
}
function openLayout() {
  if (
    auth.isAdmin &&
    sourceName.value === 'E4 sample' &&
    !layout.value.background &&
    !layout.value.shapes.length &&
    !Object.keys(layout.value.positions).length
  ) {
    updateLayout(createDashboardLayout(slots.value))
  }
  viewMode.value = 'layout'
}
function updateLayout(next: ParkingLayout) {
  if (!auth.isAdmin || loading.value || importing.value) return
  layout.value = next
  persistDraft()
}
async function importJson(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || !auth.isAdmin || !floor.value || loading.value || importing.value) return
  const version = ++importVersion
  const targetKey = draftKey.value
  importing.value = true
  importError.value = ''
  importMessage.value = ''
  try {
    if (files.some((file) => !file.name.toLowerCase().endsWith('.json')))
      throw new Error('Please choose .json files only.')
    if (files.reduce((size, file) => size + file.size, 0) > MAX_IMPORT_BYTES)
      throw new Error('The selected files must total 5 MB or less.')
    const imported = await Promise.all(
      files.map(async (file) => {
        try {
          return parseParkingMapJson(await file.text())
        } catch (cause) {
          throw new Error(
            `${file.name}: ${cause instanceof Error ? cause.message : 'Unable to read this file.'}`,
          )
        }
      }),
    )
    const nextSlots = validateSlots(imported.flat())
    if (version !== importVersion || targetKey !== draftKey.value || !auth.isAdmin) return
    slots.value = nextSlots
    // Keep decorative shapes and the floor plan; reset slot placements for the new data.
    layout.value = { ...layout.value, positions: {} }
    editorVersion.value += 1
    sourceName.value = files.map((file) => file.name).join(', ')
    selected.value.clear()
    inspectedKey.value = null
    clearFilters()
    persistDraft()
    importMessage.value = `Imported ${nextSlots.length} slots in ${new Set(nextSlots.map((slot) => slot.zone)).size} zones.`
  } catch (cause) {
    if (version === importVersion)
      importError.value = `${cause instanceof Error ? cause.message : 'Unable to import JSON.'} The current map has not changed.`
  } finally {
    if (version === importVersion) importing.value = false
  }
}
function downloadExample() {
  const content = {
    slots: [
      { number: 1, zone: 'A', status: 'available' },
      { number: 2, zone: 'A', status: 'occupied' },
      { number: 1, zone: 'B', status: 'incoming' },
      { number: 2, zone: 'B', status: 'disabled' },
    ],
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'parking-map-example.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
watch(() => route.params.floorId, loadFloor, { immediate: true })
onBeforeUnmount(() => {
  ++loadVersion
  ++importVersion
})
watch(
  () => auth.isAdmin,
  () => selected.value.clear(),
)
</script>

<style scoped>
.view-mode {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 22px 16px;
}
.view-mode button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border-radius: 8px;
  border: 1px solid #e0e5ed;
  font-size: 12px;
  color: #758197;
}
.view-mode button.active {
  background: #293549;
  color: white;
  border-color: #293549;
}
.json-import-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  margin-bottom: 20px;
  border: 1px solid #e1e5eb;
  border-radius: 12px;
  background: white;
}
.import-description {
  min-width: 0;
  flex: 1 1 260px;
}
.import-description strong,
.import-buttons,
.import-buttons button {
  display: flex;
  align-items: center;
  gap: 8px;
}
.import-description strong {
  font-size: 13px;
}
.import-description p {
  margin-top: 5px;
  font-size: 11px;
  color: #7b8595;
}
.import-source {
  overflow-wrap: anywhere;
}
.import-buttons {
  flex-wrap: wrap;
}
.import-buttons .secondary-button {
  margin-top: 0;
}
.import-button {
  padding: 10px 14px;
  border-radius: 8px;
  background: #293549;
  color: white;
  font-size: 12px;
}
.import-error,
.import-success {
  flex-basis: 100%;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.import-error {
  color: #b43d42;
}
.import-success {
  color: #207c58;
}
.parking-map-page {
  margin-left: 138px;
  min-height: calc(100vh - 78px);
  padding: 28px;
  background: #f4f5f7;
  color: #243041;
}
.page-heading,
.heading-main,
.panel-heading,
.details-heading,
.selection-heading,
.map-toolbar,
.board-guide,
.zone-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.page-heading {
  margin-bottom: 22px;
}
.heading-main {
  justify-content: flex-start;
}
.back-button {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  background: white;
  border: 1px solid #e0e3e8;
  border-radius: 12px;
  flex-shrink: 0;
}
.eyebrow {
  color: #89909c;
  letter-spacing: 1.5px;
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 5px;
}
h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 29px;
  font-weight: 750;
  letter-spacing: -1px;
  line-height: 1.3;
}
.preview-badge {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  padding: 4px 9px;
  border-radius: 6px;
  background: #fce8e8;
  color: #b23a3b;
}
.floor-context {
  font-size: 13px;
  color: #6b7280;
  margin-top: 5px;
}
.floor-context span {
  margin: 0 8px;
  color: #b8bdc5;
}
.draft-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}
.status-dot {
  width: 6px;
  height: 6px;
  background: #21946a;
  border-radius: 50%;
}
.preview-note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 15px;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  background: #fff;
  color: #707784;
  font-size: 12px;
  margin-bottom: 20px;
}
.preview-note svg {
  flex-shrink: 0;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 22px;
}
.summary-card {
  text-align: left;
  background: white;
  padding: 15px 18px;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  transition: border-color 0.15s;
}
.summary-card.active {
  border-color: #525f75;
  box-shadow: 0 0 0 1px #525f75;
}
.summary-label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #707784;
  font-size: 12px;
}
.summary-card strong {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 29px;
  font-weight: 750;
}
.summary-card strong svg {
  opacity: 0.4;
}
.available {
  --status-color: #207c58;
  --status-bg: #edf8f1;
  --status-border: #b8dfc8;
}
.occupied {
  --status-color: #b63c42;
  --status-bg: #fdf0f0;
  --status-border: #efc3c5;
}
.incoming {
  --status-color: #93630b;
  --status-bg: #fff8e8;
  --status-border: #ecd499;
}
.disabled {
  --status-color: #757d89;
  --status-bg: #eff1f4;
  --status-border: #d7dbe2;
}
.all {
  --status-color: #3b4c66;
}
.summary-card strong {
  color: var(--status-color);
}
.summary-label i,
.tile-status i,
.detail-status i,
.board-footer i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-color);
  flex-shrink: 0;
}
.pos-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  align-items: start;
  gap: 20px;
}
.pos-workspace.layout-workspace {
  grid-template-columns: minmax(0, 1fr);
}
.floor-panel,
.details-panel {
  min-width: 0;
  background: white;
  border: 1px solid #e1e5eb;
  border-radius: 15px;
  overflow: hidden;
}
.panel-heading {
  padding: 22px 22px 18px;
}
.panel-heading h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 17px;
  font-weight: 700;
}
.panel-heading p {
  font-size: 12px;
  color: #8a919c;
  margin-top: 5px;
}
.slot-count {
  color: #87909c;
  font-size: 11px;
  white-space: nowrap;
}
.zone-tabs {
  display: flex;
  gap: 6px;
  padding: 0 22px 18px;
  overflow-x: auto;
  border-bottom: 1px solid #edf0f3;
}
.zone-tabs button {
  display: flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
  padding: 9px 12px;
  border-radius: 8px;
  font-size: 12px;
  color: #717b8b;
  background: #f5f6f8;
}
.zone-tabs button span {
  font-size: 10px;
  opacity: 0.7;
}
.zone-tabs button.active {
  background: #293549;
  color: white;
}
.map-toolbar {
  padding: 16px 22px;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e1e5eb;
  border-radius: 8px;
  padding: 9px 11px;
  color: #8d96a2;
  min-width: 0;
  flex: 1;
  max-width: 280px;
}
.search-field input {
  min-width: 0;
  width: 100%;
  outline: none;
  font-size: 12px;
  color: #374151;
}
.status-select select {
  border: 1px solid #e1e5eb;
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 12px;
  color: #657082;
  background: white;
}
.slot-board {
  background: #f8f9fb;
  padding: 0 22px 24px;
  min-height: 410px;
  max-height: 650px;
  overflow-y: auto;
  border-top: 1px solid #edf0f3;
  border-bottom: 1px solid #edf0f3;
}
.board-guide {
  padding: 16px 0 7px;
  color: #9ca5b2;
  font-size: 10px;
  letter-spacing: 0.5px;
}
.board-guide span {
  display: flex;
  align-items: center;
  gap: 6px;
}
.zone-section {
  margin-top: 17px;
}
.zone-heading {
  margin-bottom: 12px;
}
.zone-heading h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 650;
}
.zone-heading h3 span {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  background: #e9edf2;
  border-radius: 6px;
  font-size: 11px;
}
.zone-heading p {
  color: #97a0ad;
  font-size: 10px;
}
.slot-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(97px, 1fr));
  gap: 10px;
}
.parking-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  text-align: left;
  min-height: 106px;
  padding: 10px;
  border: 1px solid var(--status-border);
  border-radius: 10px;
  background: var(--status-bg);
  color: var(--status-color);
  transition:
    box-shadow 0.15s,
    transform 0.15s;
}
.parking-tile:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 9px #23304013;
}
.parking-tile.selected {
  border-color: #354e80;
  box-shadow: 0 0 0 2px #354e80;
}
.parking-tile.inspected:not(.selected) {
  outline: 2px dashed #67778d;
  outline-offset: 2px;
}
.tile-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font-size: 9px;
  opacity: 0.8;
}
.parking-tile strong {
  font-size: 26px;
  line-height: 1.35;
  font-weight: 750;
  letter-spacing: -0.5px;
  margin: 4px 0;
}
.tile-status {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
}
.board-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 15px;
}
.board-footer span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #7d8795;
  font-size: 10px;
}
.details-panel {
  position: sticky;
  top: 98px;
}
.details-heading {
  padding: 19px;
  border-bottom: 1px solid #edf0f3;
}
.details-heading h2 {
  font-size: 15px;
  font-weight: 700;
}
.details-heading > span {
  font-size: 10px;
  color: #8892a1;
  background: #f3f5f8;
  border-radius: 5px;
  padding: 4px 7px;
}
.slot-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 18px;
  padding: 20px;
  background: var(--status-bg);
  color: var(--status-color);
  border: 1px solid var(--status-border);
  border-radius: 12px;
}
.slot-preview > span:not(.detail-status) {
  font-size: 10px;
  letter-spacing: 2px;
  margin-top: 10px;
}
.slot-preview strong {
  font-size: 44px;
  font-weight: 750;
  line-height: 1.2;
  margin: 2px 0 10px;
}
.detail-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  background: #ffffffaa;
  border-radius: 20px;
  padding: 5px 12px;
}
.slot-facts {
  padding: 0 20px 16px;
}
.slot-facts div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 11px;
  font-size: 12px;
}
.slot-facts dt {
  color: #939ba7;
}
.slot-facts dd {
  font-weight: 550;
  text-align: right;
  overflow-wrap: anywhere;
}
.locked-note {
  display: flex;
  gap: 7px;
  font-size: 11px;
  color: #9b6d25;
  background: #fff8e8;
  padding: 12px;
  margin: 0 18px 18px;
  border-radius: 8px;
}
.locked-note svg {
  flex-shrink: 0;
}
.inspector-empty {
  text-align: center;
  padding: 62px 18px;
  color: #a5afbd;
}
.inspector-empty svg {
  margin: 0 auto 20px;
}
.inspector-empty h3 {
  color: #647084;
  font-size: 14px;
  font-weight: 600;
}
.inspector-empty p {
  font-size: 12px;
  line-height: 1.8;
  margin-top: 8px;
}
.selection-section {
  border-top: 1px dashed #e1e5eb;
  margin: 0 18px;
  padding: 17px 0;
}
.selection-heading h3 {
  font-size: 12px;
  font-weight: 650;
}
.selection-heading h3 span {
  color: #8b95a3;
  margin-left: 5px;
}
.selection-heading button {
  color: #b83f45;
  font-size: 11px;
}
.selection-hint {
  color: #a1a8b3;
  font-size: 11px;
  margin-top: 13px;
}
.selection-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  max-height: 95px;
  overflow-y: auto;
}
.selection-chips button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  background: #edf1f6;
  color: #506078;
  border-radius: 5px;
  font-size: 11px;
}
.selection-actions {
  display: grid;
  gap: 9px;
  padding: 0 18px;
}
.selection-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 650;
}
.enable-button {
  color: white;
  background: #25875f;
}
.disable-button {
  color: #b43d42;
  background: #fff1f1;
  border: 1px solid #efcccd;
}
.save-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 10px;
  line-height: 1.6;
  padding: 17px;
  color: #98a0ad;
}
.save-message svg {
  flex-shrink: 0;
}
.save-message.failed {
  color: #b43d42;
}
.page-state {
  padding: 80px 20px;
  text-align: center;
}
.secondary-button {
  border: 1px solid #dce1e8;
  border-radius: 8px;
  padding: 9px 14px;
  background: white;
  font-size: 12px;
  margin-top: 12px;
}
.empty-results {
  display: grid;
  justify-items: center;
  padding: 65px 15px;
  gap: 8px;
  color: #8893a2;
  font-size: 12px;
}
.empty-results h3 {
  font-size: 16px;
  color: #4c5a6e;
}
button,
a {
  -webkit-tap-highlight-color: transparent;
}
button:not(:disabled),
select {
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid #6790d3;
  outline-offset: 3px;
}
.search-field:focus-within {
  border-color: #6790d3;
}
@media (min-width: 1600px) {
  .parking-map-page {
    padding: 32px 40px;
  }
  .pos-workspace {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
  .slot-grid {
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  }
  .parking-tile {
    min-height: 118px;
  }
}
@media (max-width: 1100px) {
  .parking-map-page {
    padding: 20px;
  }
  .pos-workspace {
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 14px;
  }
  .summary-card {
    padding: 12px;
  }
  .slot-board {
    padding: 0 16px 20px;
  }
  .map-toolbar {
    flex-wrap: wrap;
  }
  .search-field {
    max-width: none;
  }
  .board-guide > span:nth-child(2) {
    display: none;
  }
}
@media (max-width: 900px) {
  .pos-workspace {
    grid-template-columns: minmax(0, 1fr);
  }
  .details-panel {
    position: static;
  }
  .inspector-empty {
    padding: 25px;
  }
  .slot-preview {
    padding: 12px;
  }
  .slot-preview strong {
    font-size: 32px;
  }
  .draft-status {
    display: none;
  }
  .summary-grid {
    gap: 8px;
  }
  .summary-label {
    font-size: 10px;
  }
  .summary-card strong {
    font-size: 24px;
  }
}
@media (max-width: 600px) {
  .parking-map-page {
    padding: 14px 10px;
  }
  h1 {
    font-size: 22px;
    flex-wrap: wrap;
    gap: 5px;
  }
  .heading-main {
    gap: 8px;
  }
  .eyebrow {
    font-size: 8px;
    letter-spacing: 0.5px;
  }
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .summary-card:first-child {
    grid-column: 1 / -1;
  }
  .panel-heading {
    padding: 15px;
    flex-wrap: wrap;
  }
  .zone-tabs {
    padding: 0 15px 14px;
  }
  .map-toolbar {
    padding: 14px;
  }
  .status-select,
  .status-select select {
    width: 100%;
  }
  .slot-grid {
    grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  }
  .floor-context {
    font-size: 11px;
  }
  .back-button {
    width: 30px;
    height: 34px;
  }
  .board-footer {
    gap: 12px;
  }
}
</style>
