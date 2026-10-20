<template>
  <div class="history-page">
    <section class="history-panel">
      <div class="history-heading">
        <div>
          <h2>Slot Status Log</h2>
          <p>Enable / Disable Slot Records</p>
        </div>

        <div class="info-popover">
          <button class="info-button" type="button" aria-label="About this page">!</button>
          <div class="info-tooltip" role="tooltip">
            Shows which parking slots were enabled or disabled, which staff member changed the slot status, and when the change happened.
          </div>
        </div>
      </div>

      <article v-for="entry in historyEntries" :key="entry.id" class="history-card">
        <p>Changed by Staff : {{ entry.staffName }}</p>
        <p>Building : {{ entry.building }}</p>
        <p>Floor <span>:</span> {{ entry.floor }}</p>
        <p>Parking Slots : {{ entry.parkingSlots }}</p>
        <p>Date edited : {{ entry.dateEdited }}</p>
        <p>Time edited : {{ entry.timeEdited }}</p>
        <p>
          Slot status changed to :
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

.history-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 18px;
  margin: 0 0 22px;
  padding: 0 14px;
}

.history-heading h2 {
  color: #111;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.15;
}

.history-heading p {
  margin-top: 4px;
  color: #777;
  font-size: 13px;
}

.info-popover {
  position: relative;
  flex: 0 0 auto;
}

.info-button {
  width: 34px;
  height: 34px;
  border: 2px solid #9e2d25;
  border-radius: 999px;
  background: #fff;
  color: #9e2d25;
  display: grid;
  place-items: center;
  font-size: 19px;
  font-weight: 800;
  line-height: 1;
}

.info-button:hover,
.info-button:focus-visible {
  background: #fdeceb;
}

.info-tooltip {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  z-index: 20;
  width: 310px;
  border-radius: 6px;
  background: #2c2c2c;
  color: #fff;
  padding: 11px 13px;
  font-size: 12px;
  line-height: 1.45;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition:
    opacity 0.14s ease 0s,
    transform 0.14s ease 0s,
    visibility 0s linear 0.14s;
}

.info-tooltip::before {
  content: '';
  position: absolute;
  top: -6px;
  right: 12px;
  width: 12px;
  height: 12px;
  background: #2c2c2c;
  transform: rotate(45deg);
}

.info-popover:hover .info-tooltip,
.info-popover:focus-within .info-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition-delay: 0s;
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
