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
      <h2>Add CCTV</h2>
    </header>

    <form class="add-cctv-card" @submit.prevent="$emit('save')">
      <div class="add-cctv-fields">
        <div
          class="inline-camera-scene add-cctv-preview"
          role="img"
          aria-label="Parking camera preview illustration"
        >
          <span class="timestamp">03-05-2026 Sun 00:38:45</span>
          <span class="pillar one">B03</span>
          <span class="pillar two">C03</span>
          <span class="scene-car car-a" />
          <span class="scene-car car-b" />
          <span class="scene-car car-c" />
          <span class="direction-arrow" />
          <span class="plate">B-4CB5</span>
        </div>

        <label class="add-cctv-field">
          <span>Parking CCTV Name</span>
          <input v-model="cameraName" type="text" placeholder="Enter CCTV name" />
        </label>

        <label class="add-cctv-field">
          <span>CCTV .json File</span>
          <input class="add-cctv-file" type="file" accept=".json,application/json" />
        </label>

        <label class="add-cctv-field">
          <span>Camera No/IP</span>
          <input
            v-model="cameraSelector"
            type="text"
            placeholder="Camera name, number or IP address"
          />
        </label>

        <label class="add-cctv-field">
          <span>Parking Slot .json <small>(Can add more than 1 file)</small></span>
          <input
            class="add-cctv-file"
            type="file"
            accept=".json,application/json"
            multiple
            @change="selectParkingFiles"
          />
        </label>

        <label class="add-cctv-field">
          <span>Select 1 Parking Slot</span>
          <select v-model="selectedParkingFile" :disabled="!parkingFiles.length">
            <option value="" disabled>
              {{
                parkingFiles.length
                  ? 'Select a parking slot file'
                  : 'Choose parking slot files first'
              }}
            </option>
            <option v-for="(file, index) in parkingFiles" :key="index" :value="String(index)">
              {{ file.name }}
            </option>
          </select>
        </label>

        <details class="add-cctv-connection">
          <summary>Connection details</summary>
          <div class="add-cctv-connection-fields">
            <label class="add-cctv-field"
              ><span>IP Address</span><input v-model="ipAddress" type="text"
            /></label>
            <label class="add-cctv-field"
              ><span>RTSP Link</span><input v-model="rtspLink" type="text"
            /></label>
            <p>Status : <span class="add-cctv-status">Online</span></p>
          </div>
        </details>
      </div>

      <footer class="add-cctv-actions">
        <button class="add-cctv-cancel" type="button" @click="$emit('cancel')">Cancel</button>
        <button class="add-cctv-confirm" type="submit">Confirm</button>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'

defineEmits<{ save: []; cancel: [] }>()
const cameraName = ref('Floor4 B6')
const cameraSelector = ref('')
const ipAddress = ref('172.28.113.103')
const rtspLink = ref('rtsp://mfustream:...')
const parkingFiles = ref<File[]>([])
const selectedParkingFile = ref('')

function selectParkingFiles(event: Event) {
  const input = event.target as HTMLInputElement
  parkingFiles.value = Array.from(input.files ?? [])
  selectedParkingFile.value = parkingFiles.value.length ? '0' : ''
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
  width: min(300px, 100%);
  height: auto;
  aspect-ratio: 16 / 9;
  justify-self: center;
  margin-bottom: 2px;
  border-radius: 7px;
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
.add-cctv-status {
  color: #218143;
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
