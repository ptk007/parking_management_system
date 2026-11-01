<template>
  <article class="parking-log-card">
    <CarFront :size="36" class="log-icon" />
    <div class="log-column">
      <p v-if="!hideName">Name <span>:</span> {{ log.name || '-' }}</p>
      <p>Brand <span>:</span> {{ log.brand || '-' }}</p>
      <p>Model <span>:</span> {{ log.model || '-' }}</p>
      <p>Color <span>:</span> {{ log.color || '-' }}</p>
      <p>License plate <span>:</span> {{ log.licenseNumber || '-' }}</p>
      <p>Province <span>:</span> {{ log.province || '-' }}</p>
    </div>
    <div class="log-column">
      <p>Date Enter <span>:</span> {{ log.date || '-' }}</p>
      <p>Parking Time <span>:</span> {{ log.parkingTime || '-' }}</p>
      <p>Date Exited <span>:</span> {{ log.exitDate || '-' }}</p>
      <p>Exited Time <span>:</span> {{ log.exitTime || '-' }}</p>
      <p>Parking Slot Number <span>:</span> {{ log.parkingSlot || '-' }}</p>
      <p>
        Parking Status <span>:</span>
        <strong :class="log.status.toLowerCase().replace(/ /g, '-')">{{ log.status }}</strong>
      </p>
    </div>
  </article>
</template>
<script setup lang="ts">
import { CarFront } from 'lucide-vue-next'
export interface ParkingLogDisplay {
  id: string | number
  name?: string
  brand?: string
  model?: string
  color?: string
  licenseNumber?: string
  province?: string
  date?: string
  parkingTime?: string
  exitDate?: string
  exitTime?: string
  parkingSlot?: string
  status: string
}
defineProps<{ log: ParkingLogDisplay; hideName?: boolean }>()
</script>
<style scoped>
.parking-log-card {
  display: flex;
  align-items: center;
  gap: 36px;
  padding: 24px 30px;
  background: white;
  border-radius: 8px;
  border: 1px solid #111;
  box-shadow: 0 2px 5px #0002;
}
.log-icon {
  color: #a52f30;
  flex-shrink: 0;
}
.log-column {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
p {
  margin: 0;
}
span {
  padding: 0 6px;
}
strong.parking {
  color: #16a36a;
}
strong.exited {
  color: #b73232;
}
@media (max-width: 700px) {
  .parking-log-card {
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
  }
  .log-column {
    flex-basis: 100%;
  }
}
</style>
