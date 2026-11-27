<template>
  <div class="history-page">
    <section class="history-panel">
      <div class="history-heading">
        <div class="history-title">
          <h2>{{ t('Slot Status Log') }}</h2>
          <p>{{ t('Enable / Disable Slot Records') }}</p>
        </div>

        <div class="history-controls">
          <fieldset class="role-filter" :aria-label="t('Filter by role')">
            <label><input v-model="selectedRoles" type="checkbox" value="staff" /> {{ t('Staff') }}</label>
            <label><input v-model="selectedRoles" type="checkbox" value="admin" /> {{ t('Admin') }}</label>
          </fieldset>
          <div class="info-popover">
            <button class="info-button" type="button" :aria-label="t('About this page')">!</button>
            <div class="info-tooltip" role="tooltip">
              {{ t('Shows which parking slots were enabled or disabled, which staff member changed the slot status, and when the change happened.') }}
            </div>
          </div>
        </div>
      </div>

      <p v-if="loading" class="history-message">{{ t('Loading slot status logs...') }}</p>
      <p v-else-if="loadError" class="history-message error">{{ t(loadError) }}</p>
      <p v-else-if="!historyEntries.length" class="history-message">{{ t('No slot status changes found.') }}</p>
      <DatedLogList
        v-else
        v-slot="{ entries }"
        :entries="historyEntries"
        :get-date="(entry) => entry.date_updated"
        heading-level="h3"
      >
        <article v-for="entry in entries" :key="entry._id" class="history-card">
          <p>{{ t('Changed by') }} {{ entry.role === 'staff' ? t('Staff') : t('Admin') }} : {{ entry.name }}</p>
          <p>{{ t('Building :') }} {{ entry.building }}</p>
          <p>{{ t('Floor') }} <span>:</span> {{ entry.floor }}</p>
          <p>{{ t('Parking Slots :') }} {{ formatSlots(entry.slots) }}</p>
          <p>{{ t('Date edited :') }} {{ entry.date_updated }}</p>
          <p>{{ t('Time edited :') }} {{ entry.time_updated }}</p>
          <p>
            {{ t('Slot status changed to :') }}
            <strong :class="entry.status === 'available' ? 'enabled' : 'disabled'">
              {{ entry.status === 'available' ? t('Enable') : t('Disable') }}
            </strong>
          </p>
        </article>
      </DatedLogList>
    </section>
  </div>
</template>

<script setup lang="ts">
import { t } from '@/i18n'
import { onMounted, ref, watch } from 'vue'
import DatedLogList from '@/components/parking/DatedLogList.vue'
import { floorService, type ParkingSlotStatusLog } from '@/services/api'

const historyEntries = ref<ParkingSlotStatusLog[]>([])
const selectedRoles = ref<Array<'staff' | 'admin'>>(['staff', 'admin'])
const loading = ref(false)
const loadError = ref('')

async function loadHistory() {
  loadError.value = ''
  if (!selectedRoles.value.length) {
    historyEntries.value = []
    return
  }
  loading.value = true
  try {
    const response = await floorService.slotStatusLogs(selectedRoles.value)
    historyEntries.value = response.data.logs
  } catch {
    loadError.value = 'Could not load slot status logs. Please try again.'
  } finally {
    loading.value = false
  }
}

function formatSlots(slots: ParkingSlotStatusLog['slots']) {
  return slots.map((slot) => slot.name || String(slot.number)).join(', ')
}

onMounted(loadHistory)
watch(selectedRoles, loadHistory)
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
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 18px;
  margin: 0 0 22px;
}

.history-title {
  border: 1px solid #bcbcbc;
  border-radius: 6px;
  background: #fff;
  padding: 10px 14px;
}

.history-controls {
  display: flex;
  align-items: center;
  gap: 18px;
}

.role-filter {
  display: flex;
  align-items: center;
  gap: 14px;
  border: 0;
  margin: 0;
  padding: 0;
}

.role-filter label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #333;
  font-size: 14px;
  white-space: nowrap;
}

.role-filter input {
  accent-color: #a52e28;
}

.history-message {
  margin: 24px 14px;
  color: #555;
  font-size: 14px;
}

.history-message.error {
  color: #b42318;
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
