<template>
  <section class="add-cctv-panel">
    <header class="add-cctv-header">
      <button
        class="add-cctv-back"
        type="button"
        aria-label="Back to CCTV list"
        @click="$emit('cancel')"
      >
        <ArrowLeft :size="21" />
      </button>
      <h2>
        {{ mode === 'edit' ? 'Edit CCTV' : 'Add CCTV'
        }}<span v-if="selectedFloor">
          / {{ selectedFloor.building?.building_name }} / Floor {{ selectedFloor.floor }}</span
        >
      </h2>
    </header>

    <form class="add-cctv-card" @submit.prevent="save">
      <div class="add-cctv-fields">
        <div class="add-cctv-preview" role="status">
          <img
            v-if="frameData"
            class="add-cctv-frame"
            :src="frameData"
            alt="Live CCTV preview with parking-slot bounding boxes when available"
          />
          <template v-else>
            <Video :size="30" aria-hidden="true" />
            <span>{{ previewMessage }}</span>
          </template>
        </div>

        <label class="add-cctv-field">
          <span>Parking CCTV Name</span>
          <input v-model="cameraName" required type="text" placeholder="Enter CCTV name" />
        </label>

        <label class="add-cctv-field">
          <span>Select 1 Original CCTV Source</span>
          <select
            v-model="selectedCctvFileId"
            required
            :disabled="!availableCctvFiles.length || saving"
            @change="resetLookup"
          >
            <option value="" disabled>
              {{
                availableCctvFiles.length
                  ? 'Select original CCTV source'
                  : 'Import original CCTV source files first'
              }}
            </option>
            <option v-for="file in availableCctvFiles" :key="file._id" :value="file._id">
              {{ file.original_name }}
            </option>
          </select>
        </label>
        <div class="add-cctv-field">
          <label for="camera-source-query">Camera No/IP/Name/RTSP link</label>
          <input
            id="camera-source-query"
            v-model="cameraLookup"
            type="text"
            placeholder="Enter an exact value from the CCTV source"
            :disabled="saving"
            @input="resetLookup"
            @keydown.enter.prevent="searchCameraSource"
          />
          <button
            class="add-cctv-search"
            type="button"
            :disabled="saving || searching || !selectedCctvFileId || !cameraLookup.trim()"
            @click="searchCameraSource"
          >
            {{ searching ? 'Searching and connecting...' : 'Search CCTV source' }}
          </button>
        </div>
        <label class="add-cctv-field">
          <span>Parking Slot JSON File</span>
          <input
            class="add-cctv-file"
            type="file"
            accept=".json,application/json"
            :required="!camera?.parkingSlotFileId"
            :disabled="saving"
            @change="selectCctvFile"
          />
          <small v-if="mode === 'edit' && camera?.parkingSlotFileId">
            Leave empty to keep the current file, or choose a replacement.
          </small>
          <small v-else-if="mode === 'edit' && camera?.parkingSlotData">
            This preset has embedded slot data. Upload a JSON file to replace it.
          </small>
        </label>

        <details
          class="add-cctv-connection"
          :open="Boolean(selectedCamera || lookupAttempted)"
        >
          <summary>Connection details</summary>
          <div class="add-cctv-connection-fields">
            <label v-if="matchedCameras.length > 1" class="add-cctv-field">
              <span>Multiple exact matches found</span>
              <select
                v-model="selectedRecordIndex"
                :disabled="searching || saving"
                @change="selectMatchedCamera"
              >
                <option value="" disabled>Select the intended camera</option>
                <option
                  v-for="match in matchedCameras"
                  :key="match.recordIndex"
                  :value="String(match.recordIndex)"
                >
                  {{ match.cameraNo || 'No number' }} ·
                  {{ match.ipAddress || 'No IP' }} ·
                  {{ match.sourceCameraName || 'No name' }}
                </option>
              </select>
            </label>
            <dl v-if="selectedCamera" class="add-cctv-connection-details">
              <div><dt>No</dt><dd>{{ selectedCamera.cameraNo || '-' }}</dd></div>
              <div><dt>IP Address</dt><dd>{{ selectedCamera.ipAddress || '-' }}</dd></div>
              <div><dt>Name</dt><dd>{{ selectedCamera.sourceCameraName || '-' }}</dd></div>
              <div>
                <dt>RTSP Link</dt>
                <dd class="add-cctv-rtsp">{{ selectedCamera.rtspLink || '-' }}</dd>
              </div>
            </dl>
            <button
              v-if="selectedCamera && selectedCamera.recordIndex >= 0 && selectedCamera.rtspLink"
              class="add-cctv-search"
              type="button"
              :disabled="saving || searching"
              @click="startLivePreview"
            >
              {{ searching ? 'Connecting...' : 'Restart live preview' }}
            </button>
            <p class="add-cctv-status-row">
              Status:
              <strong :class="['add-cctv-status', `status-${connectionStatus.toLowerCase()}`]">
                {{ searching ? 'Connecting...' : connectionStatus }}
              </strong>
            </p>
            <p v-if="connectionMessage" class="add-cctv-connection-message" role="status">
              {{ connectionMessage }}
            </p>
          </div>
        </details>
      </div>

      <p v-if="error" role="alert">{{ error }}</p>
      <footer class="add-cctv-actions">
        <button class="add-cctv-cancel" type="button" @click="$emit('cancel')">Cancel</button>
        <button class="add-cctv-confirm" type="submit" :disabled="saving">
          {{ saving ? 'Saving...' : 'Confirm' }}
        </button>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeft, Video } from 'lucide-vue-next'
import type {
  CctvConnectionStatus,
  CctvFormCamera,
  CctvSourceMatch,
} from './cctvForm'
import { consumeMjpegPreview } from './cctvMjpeg'
import { floorService, type ParkingSlotFile } from '@/services/api'
import { MAX_IMPORT_BYTES } from '@/components/parking/parkingMapJson'

const emit = defineEmits<{
  save: [camera: CctvFormCamera, file: File | null]
  cancel: []
  saved: [floor: import('@/services/api').ParkingFloor]
}>()
const props = withDefaults(
  defineProps<{
    selectedFloor?: import('@/services/api').ParkingFloor | null
    mode?: 'add' | 'edit'
    camera?: CctvFormCamera | null
  }>(),
  { mode: 'add', camera: null },
)
const cameraName = ref(
  props.camera?.name ??
    (props.selectedFloor
      ? `Floor${props.selectedFloor.floor} ${props.selectedFloor.building?.building_name || ''}`
      : ''),
)
const cameraLookup = ref(props.camera?.cameraNo || props.camera?.cameraSelector || '')
const cctvFile = ref<File | null>(null)
const availableParkingFiles = ref<ParkingSlotFile[]>([])
const availableCctvFiles = computed(() =>
  availableParkingFiles.value.filter(
    (file) =>
      (file.fileType === 'cctv' || file.fileType === undefined) &&
      file.available !== false,
  ),
)
const selectedCctvFileId = ref('')
const selectedCctvSource = computed(() =>
  availableCctvFiles.value.find((file) => file._id === selectedCctvFileId.value),
)
const matchedCameras = ref<CctvSourceMatch[]>([])
const selectedCamera = ref<CctvSourceMatch | null>(
  props.camera &&
    (props.camera.cameraNo ||
      props.camera.cameraSelector ||
      props.camera.ipAddress ||
      props.camera.rtspLink)
    ? {
        recordIndex: -1,
        cameraNo: props.camera.cameraNo || props.camera.cameraSelector || '',
        ipAddress: props.camera.ipAddress || '',
        sourceCameraName: props.camera.sourceCameraName || '',
        rtspLink: props.camera.rtspLink || '',
      }
    : null,
)
const selectedRecordIndex = ref('')
const lookupAttempted = ref(false)
const connectionStatus = ref<CctvConnectionStatus | 'Disable'>(
  props.camera?.sourceStatus || 'Unknown',
)
const connectionMessage = ref(
  selectedCamera.value ? 'Saved connection details. Search the source to open a live preview.' : '',
)
const frameData = ref('')
const searching = ref(false)
const parkingSlotDataForPreview = ref<unknown>(props.camera?.parkingSlotData || null)
let previewController: AbortController | null = null
let previewObjectUrl = ''
let lookupGeneration = 0
const previewMessage = computed(() => {
  if (searching.value) return 'Opening a live camera preview...'
  if (connectionStatus.value === 'Online') {
    if (selectedCamera.value?.recordIndex === -1) {
      return 'Saved preset is marked Online. Search the source to open its live preview.'
    }
    return 'Live preview connected. Waiting for the first frame...'
  }
  if (connectionStatus.value === 'Offline')
    return 'The camera did not return a video frame.'
  return 'Search the selected CCTV source to open a live preview.'
})
const error = ref(''),
  saving = ref(false)
onMounted(async () => {
  try {
    availableParkingFiles.value = (await floorService.sourceFiles()).data.files
    if (props.camera?.cctvFileName) {
      selectedCctvFileId.value =
        availableCctvFiles.value.find((file) => file.original_name === props.camera?.cctvFileName)
          ?._id || ''
    }
  } catch {
    error.value = 'Unable to load original CCTV sources.'
  }
})
onUnmounted(() => stopLivePreview())
function stopLivePreview() {
  previewController?.abort()
  previewController = null
  searching.value = false
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  previewObjectUrl = ''
  frameData.value = ''
}
function resetLookup() {
  lookupGeneration += 1
  stopLivePreview()
  error.value = ''
  matchedCameras.value = []
  selectedRecordIndex.value = ''
  lookupAttempted.value = false
  selectedCamera.value = null
  connectionStatus.value = 'Unknown'
  connectionMessage.value = ''
  frameData.value = ''
}
function selectMatchedCamera() {
  const selected = matchedCameras.value.find(
    (match) => String(match.recordIndex) === selectedRecordIndex.value,
  )
  if (!selected) return
  selectedCamera.value = selected
  connectionStatus.value = 'Unknown'
  connectionMessage.value = selected.rtspLink
    ? 'Camera selected. Opening its live preview.'
    : 'RTSP link is missing in the source file.'
  if (selected.rtspLink) startLivePreview()
}
async function startLivePreview() {
  const camera = selectedCamera.value
  if (!camera || camera.recordIndex < 0 || !selectedCctvFileId.value || searching.value) return
  stopLivePreview()
  const controller = new AbortController()
  previewController = controller
  searching.value = true
  error.value = ''
  connectionStatus.value = 'Unknown'
  connectionMessage.value = 'Connecting to the camera live stream...'
  try {
    const response = await floorService.streamCctvPreview(
      selectedCctvFileId.value,
      camera.recordIndex,
      parkingSlotDataForPreview.value,
      controller.signal,
    )
    if (previewController !== controller) return
    if (!response.ok) {
      let message = `Unable to open the live preview (HTTP ${response.status}).`
      try {
        const result = (await response.json()) as { message?: string }
        if (result.message) message = result.message
      } catch {
        // Keep the HTTP status message when the server does not return JSON.
      }
      connectionStatus.value = response.status === 503 || response.status === 504 ? 'Offline' : 'Unknown'
      connectionMessage.value = message
      return
    }

    connectionStatus.value = 'Online'
    connectionMessage.value = 'Connection check succeeded: live preview is receiving camera frames.'
    void consumeMjpegPreview(response, controller.signal, (frame) => {
      if (previewController !== controller) return
      const nextObjectUrl = URL.createObjectURL(frame)
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
      previewObjectUrl = nextObjectUrl
      frameData.value = nextObjectUrl
    })
      .then(() => {
        if (previewController !== controller || controller.signal.aborted) return
        connectionStatus.value = 'Offline'
        connectionMessage.value = 'The live camera preview ended.'
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || previewController !== controller) return
        connectionStatus.value = 'Offline'
        connectionMessage.value =
          cause instanceof Error ? cause.message : 'The live camera preview stopped unexpectedly.'
      })
  } catch (cause) {
    if (controller.signal.aborted || previewController !== controller) return
    connectionStatus.value = 'Unknown'
    connectionMessage.value =
      cause instanceof Error ? cause.message : 'Unable to open the live camera preview.'
  } finally {
    if (previewController === controller) searching.value = false
  }
}

async function searchCameraSource() {
  if (searching.value || !selectedCctvFileId.value) return
  const query = cameraLookup.value.trim()
  if (!query) {
    error.value = 'Enter a camera number, IP address, name, or RTSP link.'
    return
  }
  stopLivePreview()
  const generation = ++lookupGeneration
  searching.value = true
  error.value = ''
  lookupAttempted.value = true
  matchedCameras.value = []
  selectedCamera.value = null
  selectedRecordIndex.value = ''
  connectionStatus.value = 'Unknown'
  connectionMessage.value = ''
  frameData.value = ''
  let cameraForPreview: CctvSourceMatch | null = null
  try {
    const response = await floorService.searchCctvSource(selectedCctvFileId.value, query)
    if (generation !== lookupGeneration) return
    matchedCameras.value = response.data.matches
    if (response.data.camera) {
      selectedCamera.value = response.data.camera
      cameraForPreview = response.data.camera
      connectionStatus.value = 'Unknown'
      connectionMessage.value = response.data.camera.rtspLink
        ? 'Camera matched. Opening the live preview...'
        : 'RTSP link is missing in the source file.'
    } else {
      connectionStatus.value = response.data.status
      connectionMessage.value = response.data.message
    }
  } catch (cause) {
    if (generation !== lookupGeneration) return
    connectionStatus.value = 'Unknown'
    error.value = cause instanceof Error ? cause.message : 'Unable to search CCTV source.'
  } finally {
    if (generation === lookupGeneration) searching.value = false
  }
  if (generation === lookupGeneration && cameraForPreview?.rtspLink) startLivePreview()
}
async function selectCctvFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] || null
  cctvFile.value = file
  if (!file) return
  stopLivePreview()
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a parking slot file up to 5 MB.')
    parkingSlotDataForPreview.value = JSON.parse((await file.text()).replace(/^\uFEFF/, ''))
    const camera = selectedCamera.value
    if (camera && camera.recordIndex >= 0) {
      stopLivePreview()
      startLivePreview()
    }
  } catch (cause) {
    stopLivePreview()
    parkingSlotDataForPreview.value = null
    error.value = cause instanceof Error ? cause.message : 'Unable to read the parking slot JSON file.'
  }
}
async function save() {
  if (saving.value || !props.selectedFloor) return
  saving.value = true
  error.value = ''
  try {
    if (!cameraName.value.trim() || !selectedCctvSource.value)
      throw new Error('Enter a CCTV name and select an original CCTV source.')
    if (cctvFile.value) {
      if (cctvFile.value.size > MAX_IMPORT_BYTES)
        throw new Error('Choose a parking slot file up to 5 MB.')
      const text = await cctvFile.value.text()
      let parkingSlotData: unknown
      try {
        parkingSlotData = JSON.parse(text.replace(/^\uFEFF/, ''))
      } catch {
        throw new Error('Parking Slot JSON file is invalid.')
      }
      const categories = (parkingSlotData as { categories?: unknown })?.categories
      if (
        !Array.isArray(categories) ||
        !categories.some(
          (category) =>
            category &&
            typeof category === 'object' &&
            'supercategory' in category &&
            category.supercategory === 'parking-slot' &&
            'name' in category &&
            typeof category.name === 'string' &&
            category.name.trim(),
        )
      )
        throw new Error('JSON must contain at least one parking-slot category name.')
    } else if (!props.camera?.parkingSlotFileId) {
      throw new Error('Choose a Parking Slot JSON file.')
    }
    const camera: CctvFormCamera = {
      ...(props.camera?._id ? { _id: props.camera._id } : {}),
      name: cameraName.value.trim(),
      cameraSelector: selectedCamera.value?.cameraNo || cameraLookup.value.trim(),
      cameraNo: selectedCamera.value?.cameraNo || '',
      ipAddress: selectedCamera.value?.ipAddress || '',
      sourceCameraName: selectedCamera.value?.sourceCameraName || '',
      rtspLink: selectedCamera.value?.rtspLink || '',
      cctvFileName: selectedCctvSource.value.original_name,
      parkingSlotFileId: cctvFile.value ? null : props.camera?.parkingSlotFileId || null,
      status: props.camera?.status || 'Enable',
      sourceStatus: connectionStatus.value === 'Disable' ? 'Unknown' : connectionStatus.value,
    }
    const response = await floorService.saveCamera(
      props.selectedFloor._id,
      camera,
      cctvFile.value,
    )
    stopLivePreview()
    emit('saved', response.data.floor)
    emit('save', camera, cctvFile.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Unable to save CCTV preset.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.add-cctv-header {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  align-items: center;
  margin-bottom: 14px;
}
.add-cctv-header h2 {
  text-align: center;
  color: #222;
  font-size: 21px;
  font-weight: 400;
}
.add-cctv-back {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: #fff;
  color: #222;
}
.add-cctv-card {
  padding: 24px 18px 16px;
  border-radius: 7px;
  background: #fff;
  box-shadow: 0 3px 4px rgb(0 0 0 / 20%);
}
.add-cctv-fields {
  display: grid;
  gap: 12px;
  width: min(380px, 100%);
  margin: 0 auto;
}
.add-cctv-preview {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  width: min(300px, 100%);
  min-height: 100px;
  aspect-ratio: 16 / 9;
  justify-self: center;
  padding: 12px;
  margin-bottom: 2px;
  border-radius: 7px;
  background: #171b20;
  color: #e5e7eb;
  text-align: center;
  font-size: 12px;
}
.add-cctv-frame {
  display: block;
  width: 100%;
  max-height: 220px;
  aspect-ratio: 16 / 9;
  border-radius: 4px;
  object-fit: contain;
  background: #000;
}
.add-cctv-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: #222;
  font-size: 14px;
}
.add-cctv-field small {
  font-size: 12px;
}
.add-cctv-field input,
.add-cctv-field select {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 8px 12px;
  border: 1px solid #d5d5d5;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 14px;
}
.add-cctv-field input::placeholder {
  color: #929292;
}
.add-cctv-search {
  width: fit-content;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 12px;
}
.add-cctv-search:disabled {
  cursor: wait;
  opacity: 0.6;
}
.add-cctv-field select:disabled {
  background: #f7f7f7;
  color: #888;
}
.add-cctv-field .add-cctv-file {
  padding: 5px 8px;
  font-size: 12px;
}
.add-cctv-file::file-selector-button {
  margin-right: 10px;
  padding: 3px 14px;
  border: 1px solid #bbb;
  border-radius: 3px;
  background: #e6e6e6;
  color: #222;
  font: inherit;
  cursor: pointer;
}
.add-cctv-connection {
  color: #777;
  font-size: 12px;
}
.add-cctv-connection summary {
  cursor: pointer;
  width: fit-content;
}
.add-cctv-connection-fields {
  display: grid;
  gap: 12px;
  padding-top: 12px;
}
.add-cctv-connection-details {
  display: grid;
  gap: 8px;
  margin: 0;
  color: #333;
}
.add-cctv-connection-details > div {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr);
  gap: 8px;
}
.add-cctv-connection-details dt {
  font-weight: 600;
}
.add-cctv-connection-details dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}
.add-cctv-rtsp {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.add-cctv-status-row {
  margin: 0;
  color: #333;
}
.add-cctv-status {
  color: #64748b;
  font-weight: 600;
}
.add-cctv-status.status-online {
  color: #15803d;
}
.add-cctv-status.status-offline {
  color: #b91c1c;
}
.add-cctv-connection-message {
  margin: 0;
  color: #475569;
  overflow-wrap: anywhere;
}
.add-cctv-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}
.add-cctv-actions button {
  min-width: 86px;
  min-height: 38px;
  padding: 8px 16px;
  border-radius: 5px;
  font-size: 13px;
}
.add-cctv-confirm {
  background: #12b45b;
  color: #fff;
  box-shadow: 0 2px 4px rgb(0 0 0 / 18%);
}
.add-cctv-confirm:hover {
  background: #0d9a4c;
}
.add-cctv-cancel {
  border: 1px solid #ddd;
  color: #666;
  background: #fff;
}
.add-cctv-back:hover,
.add-cctv-cancel:hover {
  background: #f8eeed;
}
.add-cctv-panel button:focus-visible,
.add-cctv-field input:focus-visible,
.add-cctv-field select:focus-visible,
.add-cctv-connection summary:focus-visible {
  outline: 3px solid #2356d8;
  outline-offset: 2px;
}
@media (max-width: 600px) {
  .add-cctv-card {
    padding: 16px 12px;
  }
  .add-cctv-header {
    grid-template-columns: 36px minmax(0, 1fr) 36px;
  }
  .add-cctv-back {
    width: 36px;
    height: 36px;
  }
  .add-cctv-header h2 {
    font-size: 18px;
  }
  .add-cctv-field input,
  .add-cctv-field select {
    font-size: 12px;
  }
}
</style>
