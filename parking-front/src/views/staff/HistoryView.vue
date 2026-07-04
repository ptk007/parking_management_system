<template>
  <div class="history-page">
    <section class="history-panel">
      <article v-for="entry in historyEntries" :key="entry.id" class="history-card">
        <p>Staff Name : {{ entry.staffName }}</p>
        <p>Building : {{ entry.building }}</p>
        <p>Floor <span>:</span> {{ entry.floor }}</p>
        <p>Parking Slot : {{ entry.parkingSlots }}</p>
        <p>Date edited : {{ entry.dateEdited }}</p>
        <p>Time edited : {{ entry.timeEdited }}</p>
        <p>
          Status changed to :
          <strong :class="entry.statusChangedTo === 'Enable' ? 'enabled' : 'disabled'">
            {{ entry.statusChangedTo }}
          </strong>
        </p>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface HistoryEntry {
  id: number
  staffName: string
  building: string
  floor: string
  parkingSlots: string
  dateEdited: string
  timeEdited: string
  statusChangedTo: 'Enable' | 'Disable'
}

const historyEntries = ref<HistoryEntry[]>([
  {
    id: 1,
    staffName: 'Thanathip Pitaksin',
    building: 'E4',
    floor: '4',
    parkingSlots: '120, 121, 122, 123',
    dateEdited: '11/4/2569',
    timeEdited: '13:00:23',
    statusChangedTo: 'Disable',
  },
  {
    id: 2,
    staffName: 'Atithan Sarapol',
    building: 'E4',
    floor: '4',
    parkingSlots: '120, 121, 122, 123',
    dateEdited: '11/4/2569',
    timeEdited: '13:00:23',
    statusChangedTo: 'Enable',
  },
])
</script>

<style scoped>
.history-page {
  min-height: calc(100vh - 78px);
  margin-left: 138px;
  background: #d8d8d8;
  padding: 30px 42px 42px;
}

.history-panel {
  min-height: calc(100vh - 158px);
  border-radius: 4px;
  background: #e5e5e5;
  padding: 34px 19px;
}

.history-card {
  min-height: 228px;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  padding: 17px 36px;
  margin-bottom: 22px;
  display: grid;
  align-content: center;
  gap: 10px;
}

.history-card p {
  color: #111;
  font-size: 15px;
}

.history-card span {
  display: inline-block;
  margin-left: 49px;
  color: #111;
}

.history-card strong {
  margin-left: 8px;
  font-weight: 400;
}

.history-card strong.disabled {
  color: #c7352c;
}

.history-card strong.enabled {
  color: #19d348;
}
</style>
