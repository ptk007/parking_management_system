<template>
  <div class="cctv-setup-list">
    <button class="cctv-back-button" type="button" @click="$emit('back')">
      <ArrowLeft :size="18" /> Back to Parking Setup
    </button>
    <header class="cctv-toolbar">
      <h2 class="cctv-heading">
        {{ selectedFloor ? `${building} : Floor ${selectedFloor.floor} CCTV` : 'CCTV presets' }}
      </h2>
      <button
        v-if="selectedFloor"
        class="green-button cctv-add"
        type="button"
        @click="$emit('add-cctv')"
      >
        + Add CCTV
      </button>
      <button v-if="selectedFloor" class="cctv-map-button" type="button" @click="$emit('view-map')">
        Go to parking map <ArrowRight :size="19" />
      </button>
    </header>

    <p v-if="!selectedFloor" class="preset-empty">
      Open CCTV from a floor in Parking Setup to manage its preset.
    </p>
    <section class="slot-files-panel" aria-labelledby="slot-files-title">
      <div class="slot-files-header">
        <div>
          <h3 id="slot-files-title">Parking slot files</h3>
          <p>Shared original CCTV sources for every building and floor. Up to 5 MB per import.</p>
        </div>
        <button
          class="slot-import-button"
          type="button"
          :disabled="importing"
          @click="fileInput?.click()"
        >
          <Upload :size="17" /> {{ importing ? 'Importing...' : 'Import parking slot' }}
        </button>
        <input
          ref="fileInput"
          class="slot-file-input"
          type="file"
          accept=".json,application/json"
          multiple
          aria-label="Import parking slot JSON files"
          :disabled="importing"
          @change="importSlotFiles"
        />
      </div>
      <p v-if="importError" class="slot-import-error" role="alert">{{ importError }}</p>
      <p v-if="importMessage" class="slot-import-success" role="status">{{ importMessage }}</p>
      <ul v-if="slotFiles.length" class="slot-file-list" aria-label="Imported parking slot files">
        <li v-for="file in slotFiles" :key="file._id">
          <FileJson :size="22" aria-hidden="true" />
          <div class="slot-file-name">
            <strong>{{ file.original_name }}</strong
            ><span>{{ formatSize(file.size) }}</span>
          </div>
          <button
            type="button"
            :disabled="!!downloading"
            :aria-label="`Download ${file.original_name}`"
            @click="downloadFile(file)"
          >
            <Download :size="18" /> Download
          </button>
        </li>
      </ul>
      <p v-else class="slot-files-empty">No original CCTV source files imported yet.</p>
    </section>

    <p v-if="selectedFloor && !selectedFloor.camera_presets?.length" class="preset-empty">
      No CCTV presets for this floor. Add CCTV to create one.
    </p>
    <article
      v-for="camera in selectedFloor?.camera_presets || []"
      :key="camera._id"
      class="cctv-camera-card"
    >
      <div class="cctv-preview">
        <Video :size="48" /><span>{{ camera.name }}</span>
      </div>
      <dl class="cctv-camera-details">
        <div>
          <dt>Parking CCTV Name</dt>
          <dd>{{ camera.name }}</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{{ vehicle }}</dd>
        </div>
        <div>
          <dt>Original CCTV Source</dt>
          <dd>
            {{
              slotFiles.find((file) => file._id === camera.parkingSlotFileId)?.original_name || '-'
            }}
          </dd>
        </div>
        <div>
          <dt>Parking Slot File</dt>
          <dd>{{ camera.cctvFileName || '-' }}</dd>
        </div>
        <div>
          <dt>Camera No/IP</dt>
          <dd>{{ camera.cameraSelector || camera.ipAddress || '-' }}</dd>
        </div>
      </dl>
      <div class="cctv-card-actions">
        <button class="cctv-edit" aria-label="Edit Camera" @click="$emit('edit-cctv', camera)">
          <SquarePen :size="29" />
        </button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CctvFormCamera } from './cctvForm'
import {
  ArrowLeft,
  ArrowRight,
  Video,
  SquarePen,
  Upload,
  FileJson,
  Download,
} from 'lucide-vue-next'
import { isAxiosError } from 'axios'
import { floorService, type ParkingFloor, type ParkingSlotFile } from '@/services/api'
import { MAX_IMPORT_BYTES } from '@/components/parking/parkingMapJson'

defineEmits<{
  'add-cctv': []
  'edit-cctv': [camera: CctvFormCamera]
  'view-map': []
  back: []
  'floor-updated': [floor: ParkingFloor]
}>()
const props = defineProps<{ selectedFloor?: ParkingFloor | null }>()
const building = computed(() => props.selectedFloor?.building?.building_name || 'Building')
const vehicle = computed(() =>
  props.selectedFloor?.veh_type === 'motorcycle' ? 'Motorcycles' : 'Cars',
)
const slotFiles = ref<ParkingSlotFile[]>([])
async function loadSourceFiles() {
  try {
    slotFiles.value = (await floorService.sourceFiles()).data.files
  } catch {
    importError.value = 'Unable to load shared source files. Please try again.'
  }
}
onMounted(loadSourceFiles)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const downloading = ref('')
const importError = ref('')
const importMessage = ref('')
const formatSize = (size: number) => (size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`)

async function importSlotFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length || importing.value) return
  importing.value = true
  importError.value = ''
  importMessage.value = ''
  try {
    if (files.length > 20) throw new Error('Choose up to 20 files at a time.')
    if (files.some((file) => !file.name.toLowerCase().endsWith('.json')))
      throw new Error('Please choose .json files only.')
    if (files.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORT_BYTES)
      throw new Error('Selected files must total 5 MB or less.')
    const names = new Set(slotFiles.value.map((file) => file.original_name))
    for (const file of files) {
      if (names.has(file.name)) throw new Error(`File already imported: ${file.name}`)
      names.add(file.name)
    }
    for (const file of files) {
      try {
        JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
      } catch {
        throw new Error(`${file.name}: Invalid JSON.`)
      }
    }
    await floorService.importSourceFiles(files)
    await loadSourceFiles()
    importMessage.value = `Imported ${files.length} file${files.length === 1 ? '' : 's'} successfully.`
  } catch (cause) {
    importError.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Unable to import parking slot files. Please try again.'
      : cause instanceof Error
        ? cause.message
        : 'Unable to import files.'
  } finally {
    importing.value = false
  }
}

async function downloadFile(file: ParkingSlotFile) {
  if (downloading.value) return
  downloading.value = file._id
  importError.value = ''
  try {
    const response = await floorService.downloadSourceFile(file)
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = file.original_name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    importError.value = 'Unable to download file. Please try again.'
  } finally {
    downloading.value = ''
  }
}
</script>

<style scoped>
.cctv-setup-list {
  display: grid;
  gap: 14px;
}
.cctv-back-button {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 8px;
  padding: 8px 0;
  color: #555;
  font-size: 14px;
}
.cctv-back-button:hover {
  color: #a52f30;
}
.cctv-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.cctv-heading {
  margin: 0;
  padding: 12px 22px;
  border-radius: 6px;
  background: #fff;
  color: #222;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.3;
}
.cctv-add {
  width: 136px;
  height: 38px;
  border-radius: 5px;
  background: #20d653;
  box-shadow: none;
  font-size: 14px;
}
.cctv-map-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 42px;
  margin-left: auto;
  padding: 9px 15px;
  border-radius: 6px;
  background: #fff;
  font-size: 16px;
  color: #222;
}
.slot-files-panel {
  padding: 20px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.slot-files-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.slot-files-header > div {
  flex: 1;
  min-width: 180px;
}
.slot-files-header h3 {
  margin: 0 0 6px;
  font-size: 16px;
}
.slot-files-header p,
.slot-files-empty,
.preset-empty {
  color: #777;
  font-size: 13px;
}
.slot-import-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 6px;
  background: #20d653;
  color: #123e1c;
}
.slot-file-input {
  display: none;
}
.slot-file-list {
  display: grid;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
}
.slot-file-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
}
.slot-file-name {
  flex: 1;
  min-width: 120px;
  overflow-wrap: anywhere;
  display: grid;
  gap: 4px;
  font-size: 13px;
}
.slot-file-name span {
  color: #777;
  font-size: 12px;
}
.slot-file-list button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #555;
  font-size: 13px;
}
.slot-import-error {
  margin-top: 12px;
  color: #b42318;
  font-size: 13px;
}
.slot-import-success {
  margin-top: 12px;
  color: #16723b;
  font-size: 13px;
}
.slot-files-empty {
  margin: 18px 0 0;
  padding: 18px;
  text-align: center;
  border: 1px dashed #ddd;
  border-radius: 6px;
}
button:disabled {
  opacity: 0.6;
  cursor: wait;
}
.cctv-camera-card {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 148px;
  align-items: center;
  gap: 30px;
  min-height: 230px;
  padding: 28px;
  border: 1px solid #ddd;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 3px 4px rgb(0 0 0 / 20%);
}
.cctv-preview {
  position: relative;
  width: 190px;
  height: 112px;
  overflow: hidden;
  border-radius: 7px;
}
.cctv-preview .inline-camera-scene {
  width: 100%;
  height: 100%;
}
.cctv-preview-eye {
  position: absolute;
  z-index: 6;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #cc4545;
}
.cctv-camera-details {
  display: grid;
  gap: 12px;
  min-width: 0;
  color: #222;
  font-size: 13px;
}
.cctv-camera-details > div {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  column-gap: 6px;
}
.cctv-camera-details dt {
  flex-shrink: 0;
}
.cctv-camera-details dt::after {
  content: ' :';
}
.cctv-camera-details dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.cctv-unspecified {
  color: #888;
}
.cctv-stream-detail {
  color: #777;
  font-size: 11px;
}
.cctv-card-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
}
.cctv-online-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border-radius: 20px;
  background: #eaf7e8;
  color: #31803b;
  font-size: 12px;
}
.cctv-online-status > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #64c74d;
}
.cctv-edit {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  color: #222;
}
.cctv-edit:hover,
.cctv-map-button:hover {
  background: #f8eeed;
}
.cctv-setup-list button:focus-visible,
.slot-file-list button:focus-visible {
  outline: 3px solid #2356d8;
  outline-offset: 3px;
}
@media (max-width: 1100px) {
  .cctv-camera-card {
    grid-template-columns: 160px minmax(0, 1fr) 112px;
    gap: 20px;
    padding: 22px;
  }
  .cctv-preview {
    width: 160px;
    height: 106px;
  }
  .cctv-card-actions {
    gap: 10px;
  }
  .cctv-map-button {
    font-size: 14px;
  }
}
@media (max-width: 800px) {
  .cctv-camera-card {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    padding: 20px;
  }
  .cctv-preview {
    width: 190px;
    max-width: 100%;
    height: 112px;
  }
  .cctv-card-actions {
    justify-content: space-between;
  }
  .cctv-heading {
    flex: 1;
    padding: 12px;
    font-size: 16px;
  }
  .cctv-map-button {
    margin-left: 0;
  }
}
@media (max-width: 480px) {
  .cctv-toolbar {
    gap: 10px;
  }
  .cctv-heading {
    min-width: 0;
    font-size: 14px;
  }
  .cctv-add,
  .cctv-map-button {
    width: 100%;
  }
  .cctv-camera-card {
    padding: 14px;
  }
}
</style>
