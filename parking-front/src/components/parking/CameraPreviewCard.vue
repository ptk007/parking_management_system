<template>
  <article class="camera-card">
    <div class="camera-display" :class="{ 'is-streaming': !!previewFrame }">
      <img
        v-if="previewFrame"
        class="camera-frame"
        :src="previewFrame"
        :alt="t([modelEnabled ? 'YOLO output for {name}' : 'Live CCTV preview for {name}', { name: title }])"
      />
      <div v-else class="camera-placeholder">
        <Video :size="36" aria-hidden="true" />
        <span>{{ title }}</span>
      </div>
      <span v-if="status === 'Disable'" class="disabled-message" role="status">
        {{ t('CCTV has disable') }}
      </span>
      <button
        v-if="previewFrame"
        class="expand-button"
        type="button"
        :aria-label="t(['Expand live preview for {name}', { name: title }])"
        @click="expanded = true"
      >
        {{ t('Expand') }}
      </button>
      <button
        v-if="status === 'Enable'"
        class="preview-toggle"
        type="button"
        :disabled="!floorId"
        @click="togglePreview"
      >
        {{
          isRunning
            ? modelEnabled
              ? t('Stop YOLO preview')
              : t('Stop preview')
            : modelEnabled
              ? t('Show YOLO preview')
              : t('Show live preview')
        }}
      </button>
      <span v-if="previewMessage" class="preview-message" role="status">{{ t(previewMessage) }}</span>
    </div>
    <div class="camera-info">
      <h2>{{ title }}</h2>
      <span :class="['source-status', sourceStatus.toLowerCase()]">{{ t(sourceStatus) }}</span>
    </div>
    <Teleport to="body">
      <div
        v-if="expanded && previewFrame"
        class="expanded-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t(['Live CCTV output for {name}', { name: title }])"
        @click.self="expanded = false"
      >
        <section class="expanded-panel">
          <header>
            <h2>{{ title }} — {{ modelEnabled ? t('YOLO Output') : t('Live Preview') }}</h2>
            <button type="button" :aria-label="t('Close expanded preview')" @click="expanded = false">
              {{ t('Close') }}
            </button>
          </header>
          <img :src="previewFrame" :alt="t(['Expanded CCTV output for {name}', { name: title }])" />
        </section>
      </div>
    </Teleport>
  </article>
</template>

<script setup lang="ts">
import { t } from '@/i18n'
import { onUnmounted, ref, watch } from 'vue'
import { Video } from 'lucide-vue-next'
import { isAxiosError } from 'axios'
import { cctvService } from '@/services/api'
import { consumeMjpegPreview } from '@/views/admin/cctvMjpeg'

const props = withDefaults(
  defineProps<{
    title: string
    floorId?: string
    cameraId: string
    sourceStatus?: 'Online' | 'Offline' | 'Unknown'
    status?: 'Enable' | 'Disable'
    modelEnabled?: boolean
  }>(),
  {
    sourceStatus: 'Unknown',
    status: 'Enable',
    modelEnabled: false,
  },
)

const previewFrame = ref('')
const previewMessage = ref('')
const isRunning = ref(false)
const expanded = ref(false)
let previewController: AbortController | null = null
let previewObjectUrl = ''

function stopPreview() {
  previewController?.abort()
  previewController = null
  isRunning.value = false
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
  previewObjectUrl = ''
  previewFrame.value = ''
  previewMessage.value = ''
  expanded.value = false
}

function handleExpandedKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') expanded.value = false
}

function waitForNextFrame(signal: AbortSignal, delay: number) {
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

async function readPreviewError(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string }
    if (payload.message) return payload.message
  } catch {
    // Use the HTTP response status below.
  }
  return `Unable to open CCTV preview (HTTP ${response.status}).`
}

async function readModelError(cause: unknown) {
  if (isAxiosError(cause) && cause.response?.data instanceof Blob) {
    try {
      const payload = (await cause.response.data.text()) as string
      const message = (JSON.parse(payload) as { message?: string }).message
      if (message) return message
    } catch {
      return 'YOLO preview returned an invalid response.'
    }
  }
  return cause instanceof Error ? cause.message : 'YOLO preview is unavailable.'
}

async function runModelPreview(controller: AbortController) {
  if (!props.floorId) return
  while (!controller.signal.aborted && previewController === controller) {
    try {
      const response = await cctvService.getDashboardModelFrame(
        props.floorId,
        props.cameraId,
        controller.signal,
      )
      if (controller.signal.aborted || previewController !== controller) return
      const nextUrl = URL.createObjectURL(response.data)
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
      previewObjectUrl = nextUrl
      previewFrame.value = nextUrl
      previewMessage.value = ''
      await waitForNextFrame(controller.signal, 200)
    } catch (cause) {
      if (controller.signal.aborted || previewController !== controller) return
      previewMessage.value = await readModelError(cause)
      if (!isAxiosError(cause) || cause.response?.status !== 503) return
      await waitForNextFrame(controller.signal, 1000)
    }
  }
}

async function runLivePreview(controller: AbortController) {
  if (!props.floorId) return
  try {
    previewMessage.value = 'Connecting to the camera...'
    const response = await cctvService.streamDashboardCameraPreview(
      props.floorId,
      props.cameraId,
      controller.signal,
    )
    if (controller.signal.aborted || previewController !== controller) return
    if (!response.ok) {
      previewMessage.value = await readPreviewError(response)
      isRunning.value = false
      return
    }
    previewMessage.value = ''
    await consumeMjpegPreview(response, controller.signal, (frame) => {
      if (previewController !== controller) return
      const nextUrl = URL.createObjectURL(frame)
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl)
      previewObjectUrl = nextUrl
      previewFrame.value = nextUrl
    })
    if (!controller.signal.aborted && previewController === controller) {
      previewMessage.value = 'The live camera preview ended.'
      isRunning.value = false
    }
  } catch (cause) {
    if (controller.signal.aborted || previewController !== controller) return
    previewMessage.value = cause instanceof Error ? cause.message : 'Unable to open the live preview.'
    isRunning.value = false
  }
}

function togglePreview() {
  if (isRunning.value) {
    stopPreview()
    return
  }
  stopPreview()
  const objectIdPattern = /^[\da-f]{24}$/i
  if (!objectIdPattern.test(props.floorId || '') || !objectIdPattern.test(props.cameraId)) {
    previewMessage.value = 'The CCTV preset API returned an invalid floor or preset ID.'
    return
  }
  const controller = new AbortController()
  previewController = controller
  isRunning.value = true
  previewMessage.value = props.modelEnabled ? 'Waiting for an annotated YOLO frame...' : ''
  if (props.modelEnabled) void runModelPreview(controller)
  else void runLivePreview(controller)
}

watch(() => [props.floorId, props.cameraId, props.status, props.modelEnabled], stopPreview)
watch(expanded, (isExpanded) => {
  if (isExpanded) window.addEventListener('keydown', handleExpandedKeydown)
  else window.removeEventListener('keydown', handleExpandedKeydown)
})
onUnmounted(stopPreview)
onUnmounted(() => window.removeEventListener('keydown', handleExpandedKeydown))
</script>

<style scoped>
.camera-card {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 5px rgb(15 23 42 / 8%);
}
.camera-display {
  position: relative;
  display: grid;
  min-height: 186px;
  place-items: center;
  overflow: hidden;
  background: #0b0b0b;
  color: #fff;
}
.camera-frame {
  width: 100%;
  height: 186px;
  object-fit: contain;
}
.camera-placeholder {
  display: grid;
  justify-items: center;
  gap: 8px;
  color: #b5b5b5;
}
.camera-placeholder span {
  color: #fff;
  font-size: 14px;
}
.disabled-message {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 60%);
  color: #fff;
  font-weight: 600;
}
.preview-toggle,
.expand-button {
  position: absolute;
  bottom: 8px;
  border: 1px solid #fff;
  border-radius: 5px;
  background: rgb(15 23 42 / 85%);
  color: #fff;
  padding: 5px 9px;
  font-size: 11px;
  cursor: pointer;
}
.preview-toggle { left: 8px; }
.expand-button { right: 8px; }
.preview-toggle:disabled { cursor: not-allowed; opacity: 0.55; }
.preview-message {
  position: absolute;
  top: 8px;
  left: 8px;
  max-width: calc(100% - 16px);
  border-radius: 4px;
  background: rgb(0 0 0 / 72%);
  color: #fff;
  padding: 5px 8px;
  font-size: 11px;
}
.camera-info {
  display: grid;
  min-height: 48px;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
}
.camera-info h2 {
  margin: 0;
  color: #242424;
  font-size: 14px;
  font-weight: 400;
}
.source-status { font-size: 12px; font-weight: 600; }
.source-status.online { color: #15803d; }
.source-status.offline { color: #b42318; }
.source-status.unknown { color: #64748b; }
.expanded-overlay {
  position: fixed;
  z-index: 1200;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 72%);
  padding: 24px;
}
.expanded-panel {
  width: min(1100px, 96vw);
  overflow: hidden;
  border-radius: 10px;
  background: #fff;
}
.expanded-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
}
.expanded-panel h2 { margin: 0; font-size: 16px; }
.expanded-panel header button {
  border: 1px solid #aaa;
  border-radius: 5px;
  background: #fff;
  padding: 7px 12px;
  cursor: pointer;
}
.expanded-panel img {
  display: block;
  width: 100%;
  max-height: calc(100vh - 120px);
  object-fit: contain;
  background: #0b0b0b;
}
</style>
