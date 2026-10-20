<template>
  <div class="cctv-setup-list">
    <header class="cctv-toolbar">
      <h2 class="cctv-heading">{{ building }} : Floor {{ floor }} CCTV</h2>
      <button class="green-button cctv-add" type="button" @click="$emit('add-cctv')">
        + Add CCTV
      </button>
      <button class="cctv-map-button" type="button" @click="$emit('view-map')">
        Go to parking map <ArrowRight :size="19" />
      </button>
    </header>

    <div class="cctv-location-filters" aria-label="CCTV filters">
      <label
        >Building
        <select v-model="building">
          <option>E4</option>
        </select></label
      >
      <label
        >Floor
        <select v-model="floor">
          <option>4</option>
        </select></label
      >
      <label
        >Vehicle
        <select v-model="vehicle">
          <option>Cars</option>
        </select></label
      >
    </div>

    <article class="cctv-camera-card" aria-label="Floor4 B6 camera">
      <div class="cctv-preview" role="img" aria-label="Parking camera preview illustration">
        <div class="inline-camera-scene" aria-hidden="true">
          <span class="timestamp">03-05-2026 Sun 00:38:45</span>
          <span class="pillar one">B03</span>
          <span class="pillar two">C03</span>
          <span class="scene-car car-a" />
          <span class="scene-car car-b" />
          <span class="scene-car car-c" />
          <span class="direction-arrow" />
          <span class="plate">B-4CB5</span>
        </div>
        <Eye class="cctv-preview-eye" :size="32" :stroke-width="2.5" aria-hidden="true" />
      </div>

      <dl class="cctv-camera-details">
        <div>
          <dt>Parking CCTV Name</dt>
          <dd>Floor4 B6</dd>
        </div>
        <div>
          <dt>Vehicle</dt>
          <dd>{{ vehicle === 'Cars' ? 'Car' : vehicle }}</dd>
        </div>
        <div>
          <dt>CCTV File</dt>
          <dd>cctvinfo2.json</dd>
        </div>
        <div>
          <dt>Camera No/IP</dt>
          <dd>172.28.113.103</dd>
        </div>
        <div>
          <dt>Parking Slot</dt>
          <dd class="cctv-unspecified">Not specified</dd>
        </div>
        <div class="cctv-stream-detail">
          <dt>RTSP Link</dt>
          <dd>rtsp://••••@172.28.109.31/Streaming/Channels/101</dd>
        </div>
      </dl>

      <div class="cctv-card-actions">
        <span class="cctv-online-status"><span aria-hidden="true" />Online</span>
        <button
          class="cctv-edit"
          type="button"
          aria-label="Edit Camera"
          @click="$emit('edit-cctv')"
        >
          <SquarePen :size="29" :stroke-width="2" />
        </button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Eye, SquarePen } from 'lucide-vue-next'

defineEmits<{ 'add-cctv': []; 'edit-cctv': []; 'view-map': [] }>()
const building = ref('E4')
const floor = ref('4')
const vehicle = ref('Cars')
</script>

<style scoped>
.cctv-setup-list {
  display: grid;
  gap: 14px;
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
.cctv-location-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  padding-left: 4px;
}
.cctv-location-filters label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 12px;
}
.cctv-location-filters select {
  min-width: 64px;
  height: 30px;
  border: 1px solid #ccc;
  border-radius: 5px;
  padding: 0 8px;
  background: #fff;
  color: #333;
  font-size: 12px;
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
.cctv-location-filters select:focus-visible {
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
  .cctv-location-filters {
    gap: 10px;
  }
  .cctv-camera-card {
    padding: 14px;
  }
}
</style>
