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
    <p v-if="modelStatusRefreshError" class="model-runtime-error" role="status">
      {{ modelStatusRefreshError }}
    </p>

    <p v-if="!selectedFloor" class="preset-empty">
      Open CCTV from a floor in Parking Setup to manage its preset.
    </p>
    <section class="slot-files-panel" aria-labelledby="slot-files-title">
      <div class="slot-files-header">
        <div>
          <h3 id="slot-files-title">Original CCTV source files</h3>
          <p>Shared CCTV sources for every building and floor. Up to 5 MB per import.</p>
        </div>
        <button
          class="slot-import-button"
          type="button"
          :disabled="importing"
          @click="fileInput?.click()"
        >
          <Upload :size="17" /> {{ importing ? 'Importing...' : 'Import CCTV source' }}
        </button>
        <input
          ref="fileInput"
          class="slot-file-input"
          type="file"
          accept=".json,application/json"
          multiple
          aria-label="Import original CCTV source JSON files"
          :disabled="importing"
          @change="importSlotFiles"
        />
      </div>
      <p v-if="importError" class="slot-import-error" role="alert">{{ importError }}</p>
      <p v-if="importMessage" class="slot-import-success" role="status">{{ importMessage }}</p>
      <ul
        v-if="cctvSourceFiles.length"
        class="slot-file-list"
        aria-label="Imported original CCTV source files"
      >
        <li v-for="file in cctvSourceFiles" :key="file._id">
          <FileJson :size="22" aria-hidden="true" />
          <div class="slot-file-name">
            <strong>
              {{ file.original_name }}
              <span v-if="file.available === false" class="slot-file-missing">
                Missing — re-import required
              </span>
            </strong
            ><span>{{ formatSize(file.size) }}</span>
          </div>
          <button
            type="button"
            :disabled="!!downloading || file.available === false"
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
      <div class="cctv-preview" :class="{ 'is-streaming': activePreviewCameraId === camera._id }">
        <div v-if="camera.status === 'Disable'" class="cctv-disabled-message" role="status">
          CCTV has disable
        </div>
        <img
          v-else-if="activePreviewCameraId === camera._id && previewFrame"
          class="cctv-live-frame"
          :src="previewFrame"
          :alt="`${camera.modelEnabled ? 'YOLO output' : 'Live CCTV preview'} for ${camera.name}`"
        />
        <template v-else>
          <Video :size="36" aria-hidden="true" />
          <span>{{ camera.name }}</span>
        </template>
        <button
          v-if="activePreviewCameraId === camera._id && previewFrame"
          class="cctv-preview-expand"
          type="button"
          :aria-label="`Expand live preview for ${camera.name}`"
          @click="openExpandedPreview"
        >
          Expand
        </button>
        <button
          v-if="camera.status !== 'Disable'"
          class="cctv-preview-toggle"
          type="button"
          :aria-label="`${activePreviewCameraId === camera._id ? 'Stop' : 'Show'} ${camera.modelEnabled ? 'YOLO' : 'live'} preview for ${camera.name}`"
          @click="toggleCameraPreview(camera)"
        >
          {{
            activePreviewCameraId === camera._id
              ? camera.modelEnabled
                ? 'Stop YOLO preview'
                : 'Stop preview'
              : camera.modelEnabled
                ? 'Show YOLO preview'
                : 'Show live preview'
          }}
        </button>
        <span
          v-if="activePreviewCameraId === camera._id && previewMessage"
          class="cctv-preview-message"
          role="status"
        >
          {{ previewMessage }}
        </span>
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
          <dd>{{ camera.cctvFileName || '-' }}</dd>
        </div>
        <div>
          <dt>Parking Slot File</dt>
          <dd>
            {{
              slotFiles.find((file) => file._id === camera.parkingSlotFileId)?.original_name ||
              (camera.parkingSlotData ? 'Embedded JSON' : '-')
            }}
          </dd>
        </div>
        <div>
          <dt>Camera No/IP</dt>
          <dd>{{ camera.cameraSelector || camera.ipAddress || '-' }}</dd>
        </div>
        <div>
          <dt>Source status</dt>
          <dd>{{ camera.sourceStatus || 'Unknown' }}</dd>
        </div>
      </dl>
      <div class="cctv-card-actions">
        <div class="cctv-preset-control">
          <button
            type="button"
            :class="['cctv-preset-toggle', camera.status === 'Disable' ? 'is-enable' : 'is-disable']"
            :disabled="!camera._id || modelBusyCameraIds.length > 0"
            :aria-label="`${camera.status === 'Disable' ? 'Enable' : 'Disable'} CCTV preset ${camera.name}`"
            @click="togglePreset(camera)"
          >
            {{ camera.status === 'Disable' ? 'Enable' : 'Disable' }}
          </button>
          <small>Preset</small>
        </div>
        <div class="cctv-model-control">
          <button
            type="button"
            class="cctv-model-toggle"
            :class="camera.modelEnabled ? 'is-disable' : 'is-enable'"
            :disabled="!camera._id || camera.status === 'Disable' || modelBusyCameraIds.length > 0"
            :aria-label="`${camera.modelEnabled ? 'Disable Detection' : 'Enable Detection'} for ${camera.name}`"
            @click="toggleModel(camera)"
          >
            {{ modelBusyCameraIds.includes(camera._id || '') ? 'Saving...' : camera.modelEnabled ? 'Disable Detection' : 'Enable Detection' }}
          </button>
          <span
            class="cctv-model-status"
            :class="`status-${modelStatusLabel(camera).toLowerCase()}`"
            :title="camera.modelRuntimeMessage || modelStatusLabel(camera)"
            role="status"
          >
            {{ modelStatusLabel(camera) }}
          </span>
          <small
            v-if="camera.modelEnabled && modelStatusLabel(camera) === 'Offline'"
            class="model-runtime-hint"
          >
            No recent Python worker heartbeat. CCTV Online only confirms camera connectivity;
            check the runtime URL/key and Python supervisor output.
          </small>
          <small v-if="modelControlErrors[camera._id || '']" role="alert">
            {{ modelControlErrors[camera._id || ''] }}
          </small>
          <small v-else-if="camera.modelRuntimeMessage && camera.modelRuntimeStatus === 'Error'" role="alert">
            {{ camera.modelRuntimeMessage }}
          </small>
        </div>
        <button
          type="button"
          class="cctv-edit"
          aria-label="Edit Camera"
          @click="$emit('edit-cctv', camera)"
        >
          <SquarePen :size="29" />
        </button>
      </div>
    </article>
    <Teleport to="body">
      <div
        v-if="expandedPreview && activePreviewCamera"
        class="cctv-expanded-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="`Live CCTV preview for ${activePreviewCamera.name}`"
        tabindex="-1"
        @click.self="closeExpandedPreview"
      >
        <section class="cctv-expanded-panel">
          <header class="cctv-expanded-header">
            <h2>{{ activePreviewCamera.name }} — Live Preview</h2>
            <button type="button" aria-label="Close expanded preview" @click="closeExpandedPreview">
              Close
            </button>
          </header>
          <img
            v-if="previewFrame"
            class="cctv-expanded-frame"
            :src="previewFrame"
            :alt="`Expanded ${activePreviewCamera.modelEnabled ? 'YOLO output' : 'live CCTV preview'} for ${activePreviewCamera.name}`"
          />
          <p v-else class="cctv-expanded-message" role="status">
            {{ previewMessage || 'Waiting for camera frame...' }}
          </p>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import { consumeMjpegPreview } from './cctvMjpeg'

const emit = defineEmits<{
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
const activePreviewCameraId = ref('')
const previewFrame = ref('')
const previewMessage = ref('')
const expandedPreview = ref(false)
const modelBusyCameraIds = ref<string[]>([])
const modelControlErrors = ref<Record<string, string>>({})
const modelStatusRefreshError = ref('')
let modelRefreshTimer: ReturnType<typeof setInterval> | undefined
let modelRefreshPending = false
let modelStateVersion = 0
const activePreviewCamera = computed(() =>
  props.selectedFloor?.camera_presets?.find(
    (camera) => camera._id === activePreviewCameraId.value,
  ),
)
let previewController: AbortController | null = null
let previewObjectUrl = ''
const cctvSourceFiles = computed(() =>
  slotFiles.value.filter(
    (file) => file.fileType === 'cctv' || file.fileType === undefined,
  ),
)
const availableCctvSourceFiles = computed(() =>
  cctvSourceFiles.value.filter((file) => file.available !== false),
)
async function loadSourceFiles() {
  try {
    slotFiles.value = (await floorService.sourceFiles()).data.files
  } catch {
    importError.value = 'Unable to load shared source files. Please try again.'
  }
}
onMounted(loadSourceFiles)
onMounted(() => {
  modelRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void refreshModelStatus()
  }, 4000)
})
onUnmounted(() => {
  stopCameraPreview()
  if (modelRefreshTimer) clearInterval(modelRefreshTimer)
})
watch(
  () => props.selectedFloor?._id,
  () => stopCameraPreview(),
)
const fileInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const downloading = ref('')
const importError = ref('')
const importMessage = ref('')
const formatSize = (size: number) => (size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`)

function modelStatusLabel(camera: CctvFormCamera) {
  if (!camera.modelEnabled)
    return camera.modelRuntimeStatus === 'Stopping' ? 'Stopping' : 'Off'
  const updatedAt = camera.modelRuntimeUpdatedAt
    ? new Date(camera.modelRuntimeUpdatedAt).getTime()
    : 0
  if (!updatedAt || Date.now() - updatedAt > 20000) return 'Offline'
  return camera.modelRuntimeStatus || 'Starting'
}

async function refreshModelStatus() {
  const floorId = props.selectedFloor?._id
  if (!floorId || modelRefreshPending || modelBusyCameraIds.value.length) return
  modelRefreshPending = true
  const version = modelStateVersion
  try {
    const response = await floorService.get(floorId)
    if (props.selectedFloor?._id === floorId && modelStateVersion === version) {
      modelStatusRefreshError.value = ''
      emit('floor-updated', response.data.floor)
    }
  } catch (cause) {
    modelStatusRefreshError.value = isAxiosError<{ message?: string }>(cause)
      ? cause.response?.data?.message || 'Unable to refresh YOLO runtime status.'
      : cause instanceof Error
        ? cause.message
        : 'Unable to refresh YOLO runtime status.'
  } finally {
    modelRefreshPending = false
  }
}

async function toggleModel(camera: CctvFormCamera) {
  const floorId = props.selectedFloor?._id
  const cameraId = camera._id
  if (!floorId || !cameraId || modelBusyCameraIds.value.includes(cameraId)) return
  modelStateVersion += 1
  modelBusyCameraIds.value = [...modelBusyCameraIds.value, cameraId]
  modelControlErrors.value = { ...modelControlErrors.value, [cameraId]: '' }
  try {
    const response = await floorService.setCameraModelEnabled(
      floorId,
      cameraId,
      !camera.modelEnabled,
    )
    emit('floor-updated', response.data.floor)
    modelStatusRefreshError.value = ''
  } catch (cause) {
    modelControlErrors.value = {
      ...modelControlErrors.value,
      [cameraId]: isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message || 'Unable to change YOLO model state.'
        : cause instanceof Error
          ? cause.message
          : 'Unable to change YOLO model state.',
    }
  } finally {
    modelBusyCameraIds.value = modelBusyCameraIds.value.filter((id) => id !== cameraId)
  }
}

async function togglePreset(camera: CctvFormCamera) {
  const floorId = props.selectedFloor?._id
  const cameraId = camera._id
  if (!floorId || !cameraId || modelBusyCameraIds.value.includes(cameraId)) return
  const nextStatus = camera.status === 'Disable' ? 'Enable' : 'Disable'
  modelStateVersion += 1
  modelBusyCameraIds.value = [...modelBusyCameraIds.value, cameraId]
  modelControlErrors.value = { ...modelControlErrors.value, [cameraId]: '' }
  if (nextStatus === 'Disable' && activePreviewCameraId.value === cameraId)
    stopCameraPreview()
  try {
    const response = await floorService.setCameraPresetStatus(floorId, cameraId, nextStatus)
    emit('floor-updated', response.data.floor)
    modelStatusRefreshError.value = ''
  } catch (cause) {
    modelControlErrors.value = {
      ...modelControlErrors.value,
      [cameraId]: isAxiosError<{ message?: string }>(cause)
        ? cause.response?.data?.message || 'Unable to change CCTV preset status.'
        : cause instanceof Error
          ? cause.message
          : 'Unable to change CCTV preset status.',
    }
  } finally {
    modelBusyCameraIds.value = modelBusyCameraIds.value.filter((id) => id !== cameraId)
  }
}

function stopCameraPreview() {
  closeExpandedPreview()
  previewController?.abort()
  previewController = null
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  previewObjectUrl = ''
  activePreviewCameraId.value = ''
  previewFrame.value = ''
  previewMessage.value = ''
}

function openExpandedPreview() {
  if (!previewFrame.value) return
  expandedPreview.value = true
  window.addEventListener('keydown', handleExpandedKeydown)
}

function closeExpandedPreview() {
  window.removeEventListener('keydown', handleExpandedKeydown)
  expandedPreview.value = false
}

function handleExpandedKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeExpandedPreview()
}

async function toggleCameraPreview(camera: CctvFormCamera) {
  if (activePreviewCameraId.value === camera._id) {
    stopCameraPreview()
    return
  }
  stopCameraPreview()
  activePreviewCameraId.value = camera._id || ''
  if (!camera._id) {
    previewMessage.value = 'This CCTV preset has no camera ID.'
    return
  }
  if (camera.modelEnabled) {
    const controller = new AbortController()
    previewController = controller
    previewMessage.value = 'Waiting for an annotated YOLO frame...'
    void consumeModelPreview(camera, controller)
    return
  }

  const source = availableCctvSourceFiles.value.find(
    (file) => file.original_name === camera.cctvFileName,
  )
  if (!source) {
    previewMessage.value = 'Original CCTV source is unavailable. Re-import it in this setup.'
    return
  }

  const query =
    camera.rtspLink ||
    camera.cameraNo ||
    camera.cameraSelector ||
    camera.ipAddress ||
    camera.sourceCameraName ||
    ''
  if (!query) {
    previewMessage.value = 'This preset has no camera value to find in its source.'
    return
  }

  const controller = new AbortController()
  previewController = controller
  previewMessage.value = 'Looking up the camera...'
  try {
    const lookup = await floorService.searchCctvSource(source._id, query)
    if (previewController !== controller) return
    const selectedCamera = lookup.data.camera
    if (!selectedCamera) {
      previewMessage.value = lookup.data.message
      return
    }

    let parkingSlotData = camera.parkingSlotData || null
    if (!parkingSlotData && camera.parkingSlotFileId) {
      const slotFile = slotFiles.value.find((file) => file._id === camera.parkingSlotFileId)
      if (slotFile?.available === false) {
        previewMessage.value = 'Parking slot JSON is missing. Re-import it to show slot boxes.'
        return
      }
      if (slotFile) {
        const downloaded = await floorService.downloadSourceFile(slotFile)
        if (previewController !== controller) return
        try {
          parkingSlotData = JSON.parse(downloaded.data.replace(/^\uFEFF/, ''))
        } catch {
          previewMessage.value = 'Parking slot JSON is invalid; live preview cannot be started.'
          return
        }
      }
    }

    previewMessage.value = 'Connecting to the camera...'
    const response = await floorService.streamCctvPreview(
      source._id,
      selectedCamera.recordIndex,
      parkingSlotData,
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
      previewMessage.value = message
      return
    }
    previewMessage.value = 'Live preview connected.'
    void consumeMjpegPreview(response, controller.signal, (frame) => {
      if (previewController !== controller) return
      const nextObjectUrl = URL.createObjectURL(frame)
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
      previewObjectUrl = nextObjectUrl
      previewFrame.value = nextObjectUrl
      previewMessage.value = ''
    })
      .then(() => {
        if (previewController === controller && !controller.signal.aborted) {
          previewMessage.value = 'The live camera preview ended.'
        }
      })
      .catch((cause: unknown) => {
        if (previewController === controller && !controller.signal.aborted) {
          previewMessage.value =
            cause instanceof Error ? cause.message : 'The live camera preview stopped unexpectedly.'
        }
      })
  } catch (cause) {
    if (controller.signal.aborted || previewController !== controller) return
    previewMessage.value = cause instanceof Error ? cause.message : 'Unable to open the live preview.'
  }
}

function waitForModelFrame(signal: AbortSignal, delay: number) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, delay)
    signal.addEventListener('abort', finish, { once: true })
  })
}

async function modelPreviewErrorMessage(cause: unknown) {
  if (!isAxiosError(cause)) {
    return cause instanceof Error ? cause.message : 'YOLO preview is unavailable.'
  }
  const responseData: unknown = cause.response?.data
  if (responseData instanceof Blob) {
    try {
      const payload: unknown = JSON.parse(await responseData.text())
      if (
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        typeof payload.message === 'string'
      )
        return payload.message
    } catch {
      return 'YOLO preview returned an invalid response.'
    }
  }
  return cause.response?.status
    ? `YOLO preview request failed (${cause.response.status}).`
    : cause.message || 'YOLO preview is unavailable.'
}

async function consumeModelPreview(camera: CctvFormCamera, controller: AbortController) {
  const floorId = props.selectedFloor?._id
  const cameraId = camera._id
  if (!floorId || !cameraId) return
  while (!controller.signal.aborted && previewController === controller) {
    try {
      const response = await floorService.getCameraModelFrame(
        floorId,
        cameraId,
        controller.signal,
      )
      if (controller.signal.aborted || previewController !== controller) return
      const nextObjectUrl = URL.createObjectURL(response.data)
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
      previewObjectUrl = nextObjectUrl
      previewFrame.value = nextObjectUrl
      previewMessage.value = ''
      await waitForModelFrame(controller.signal, 200)
    } catch (cause) {
      if (controller.signal.aborted || previewController !== controller) return
      previewMessage.value = await modelPreviewErrorMessage(cause)
      if (isAxiosError(cause) && cause.response?.status !== 503) return
      await waitForModelFrame(controller.signal, 1000)
    }
  }
}

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
    const names = new Set(availableCctvSourceFiles.value.map((file) => file.original_name))
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
      ? cause.response?.data?.message || 'Unable to import CCTV source files. Please try again.'
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
.slot-file-name .slot-file-missing {
  display: inline-block;
  margin-left: 6px;
  color: #b91c1c;
  font-weight: 600;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 190px;
  height: 112px;
  overflow: hidden;
  border-radius: 7px;
  background: #171b20;
  color: #e5e7eb;
  text-align: center;
}
.cctv-live-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.cctv-preview-toggle {
  position: absolute;
  z-index: 2;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100% - 12px);
  padding: 4px 8px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: 5px;
  background: rgb(17 24 39 / 85%);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
}
.cctv-preview-expand {
  position: absolute;
  z-index: 2;
  top: 5px;
  right: 5px;
  padding: 4px 8px;
  border: 1px solid rgb(255 255 255 / 55%);
  border-radius: 5px;
  background: rgb(17 24 39 / 85%);
  color: #fff;
  font-size: 11px;
}
.cctv-preview-message {
  position: absolute;
  z-index: 3;
  inset: 0 0 30px;
  display: grid;
  place-content: center;
  padding: 8px;
  background: rgb(17 24 39 / 70%);
  color: #fff;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.cctv-expanded-overlay {
  position: fixed;
  z-index: 10000;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(12px, 3vw, 40px);
  background: rgb(0 0 0 / 82%);
}
.cctv-expanded-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: min(100%, 1440px);
  max-height: 100%;
  overflow: hidden;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px;
  background: #101318;
  box-shadow: 0 20px 70px rgb(0 0 0 / 45%);
}
.cctv-expanded-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  color: #fff;
}
.cctv-expanded-header h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}
.cctv-expanded-header button {
  padding: 7px 12px;
  border: 1px solid rgb(255 255 255 / 35%);
  border-radius: 5px;
  color: #fff;
}
.cctv-expanded-frame {
  display: block;
  width: 100%;
  max-height: calc(100dvh - 110px);
  object-fit: contain;
  background: #000;
}
.cctv-expanded-message {
  display: grid;
  min-height: 220px;
  place-items: center;
  margin: 0;
  padding: 24px;
  color: #e5e7eb;
  text-align: center;
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
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14px;
}
.cctv-preset-control {
  display: grid;
  justify-items: center;
  gap: 7px;
  text-align: center;
}
.cctv-preset-control small {
  color: #64748b;
  font-size: 11px;
}
.cctv-preset-toggle,
.cctv-model-toggle {
  min-height: 38px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #e5e7eb;
  color: #1f2937;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.cctv-preset-toggle {
  min-width: 96px;
  padding: 8px 12px;
}
.cctv-preset-toggle.is-enable,
.cctv-model-toggle.is-enable {
  border-color: #15803d;
}
.cctv-preset-toggle.is-disable,
.cctv-model-toggle.is-disable {
  border-color: #b91c1c;
}
.cctv-preset-toggle:hover:not(:disabled),
.cctv-model-toggle:hover:not(:disabled) {
  filter: brightness(0.96);
}
.cctv-disabled-message {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #555;
  font-weight: 700;
  background: #e5e7eb;
}
.cctv-model-control {
  display: grid;
  justify-items: center;
  gap: 7px;
  max-width: none;
  text-align: center;
}
.cctv-model-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 160px;
  padding: 8px 12px;
}
.cctv-model-toggle:not(:disabled):hover {
  filter: brightness(0.96);
}
.cctv-model-status {
  font-size: 12px;
  font-weight: 600;
}
.cctv-model-status.status-online {
  color: #16803c;
}
.cctv-model-status.status-error {
  color: #b42318;
}
.cctv-model-status.status-starting,
.cctv-model-status.status-stopping,
.cctv-model-status.status-waiting {
  color: #9a6700;
}
.cctv-model-status.status-starting {
  color: #f97316;
}
.cctv-model-status.status-off {
  color: #64748b;
}
.cctv-model-status.status-offline {
  color: #64748b;
}
.cctv-model-control small,
.model-runtime-error {
  color: #b42318;
  font-size: 11px;
  overflow-wrap: anywhere;
}
.cctv-model-control .model-runtime-hint {
  color: #64748b;
}
.model-runtime-error {
  margin: 0;
  padding: 8px 12px;
  border-radius: 5px;
  background: #fef2f2;
  font-size: 13px;
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
