<template>
  <section class="building-camera-summary" aria-label="Building CCTV summary" aria-live="polite">
    <div class="camera-summary-heading">
      <Video :size="18" aria-hidden="true" />
      <span>CCTV</span>
      <strong v-if="!loading && !error && summary">{{ summary.total }} cameras</strong>
    </div>
    <p v-if="loading" class="camera-summary-note">Loading cameras...</p>
    <div v-else-if="error || !summary" class="camera-summary-error">
      <span>Camera data unavailable</span>
      <button type="button" @click="$emit('retry')">Retry</button>
    </div>
    <template v-else>
      <div class="camera-status-list">
        <span class="camera-status online"><i aria-hidden="true" />Online <b>{{ summary.online }}</b></span>
        <span class="camera-status offline"><i aria-hidden="true" />Offline <b>{{ summary.offline }}</b></span>
        <span class="camera-status disabled"><i aria-hidden="true" />Disabled <b>{{ summary.disabled }}</b></span>
        <span v-if="summary.unknown" class="camera-status unknown"><i aria-hidden="true" />Unknown <b>{{ summary.unknown }}</b></span>
      </div>
      <p class="camera-summary-note">{{ summary.total ? 'Last reported status' : 'No cameras assigned' }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { Video } from 'lucide-vue-next'
import type { BuildingCameraSummary } from '@/services/api'

defineProps<{ summary?: BuildingCameraSummary; loading: boolean; error: string }>()
defineEmits<{ retry: [] }>()
</script>

<style scoped>
.building-camera-summary {
  min-width: 0;
  padding-left: 20px;
  border-left: 1px solid #e7e7e7;
}
.camera-summary-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 10px;
  color: #444;
  font-size: 14px;
}
.camera-summary-heading strong {
  margin-left: auto;
  color: #222;
  font-size: 14px;
  font-weight: 600;
}
.camera-status-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.camera-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.5;
}
.camera-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.camera-status b {
  font-weight: 600;
}
.online { color: #207444; background: #eaf6ee; }
.offline { color: #b13b37; background: #fceeed; }
.disabled { color: #626262; background: #f0f0f0; }
.unknown { color: #8a651a; background: #fff5dc; }
.camera-summary-note {
  margin-top: 7px;
  color: #777;
  font-size: 11px;
}
.camera-summary-error {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: #a43630;
  font-size: 12px;
}
.camera-summary-error button { text-decoration: underline; }
@media (max-width: 1100px) {
  .building-camera-summary { padding-left: 0; border-left: 0; }
  .camera-summary-heading strong { margin-left: 4px; }
}
</style>
