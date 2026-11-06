<template>
  <div :class="['staff-dashboard', { embedded }]">
    <div class="tabbar">
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        :class="['tab-button', activeTab === tab.id ? 'is-active' : '']"
        type="button"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <section
      :class="[
        'dashboard-content',
        { 'slots-content': activeTab === 'slots' || !authStore.canManageParking },
      ]"
    >
      <DashboardMap
        :header-only="activeTab !== 'slots' && authStore.canManageParking"
        @location-change="onLogLocationChange"
      />

      <div v-if="activeTab === 'cctv' && authStore.canManageParking" class="cctv-grid">
        <CameraPreviewCard
          v-for="camera in staffCameras"
          :key="camera.title"
          :title="camera.title"
          :plate-suffix="camera.plateSuffix"
        />
      </div>

      <div v-else-if="activeTab === 'log' && authStore.canManageParking" class="logs-panel">
        <div class="sample-log-controls">
          <button
            type="button"
            class="sample-log-toggle"
            :aria-pressed="isShowingSampleLogs"
            @click="isShowingSampleLogs = !isShowingSampleLogs"
          >
            {{ isShowingSampleLogs ? 'Hide sample logs' : 'View sample logs' }}
          </button>
          <span v-if="isShowingSampleLogs" class="sample-log-note">
            Sample preview only. These logs are not saved to the database.
          </span>
        </div>
        <div class="warning-banner">
          <span>Exited and Not Parking</span> logs are shown for 24 hours; records remain in the
          database.
        </div>
        <p v-if="!isShowingSampleLogs && isLoadingLogs" class="logs-state" role="status">
          Loading parking logs...
        </p>
        <p v-else-if="!isSelectedLocation" class="logs-state" role="status">
          Select a parking location
        </p>
        <p v-else-if="!isShowingSampleLogs && logsError" class="logs-state error" role="alert">
          {{ logsError }} <button type="button" @click="loadParkingLogs">Try again</button>
        </p>
        <p v-else-if="!displayedParkingLogs.length" class="logs-state" role="status">
          No parking logs found
        </p>
        <ParkingLogCard
          v-for="log in displayedParkingLogs"
          :key="log.id"
          :log="log"
          hide-building
          hide-floor
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ParkingLogCard, { type ParkingLogDisplay } from '@/components/parking/ParkingLogCard.vue'
import DashboardMap from '@/components/parking/DashboardMap.vue'
import CameraPreviewCard from '@/components/parking/CameraPreviewCard.vue'
import { useAuthStore } from '@/stores/auth'
import { parkingLogService, type ParkingFloor, type ParkingLogRecord } from '@/services/api'
import { dashboardParkingLogSamples } from '@/data/parkingLogSamples'

defineProps<{ embedded?: boolean }>()

type ActiveTab = 'slots' | 'cctv' | 'log'

const activeTab = ref<ActiveTab>('slots')
const authStore = useAuthStore()

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'slots', label: 'Slots' },
  { id: 'cctv', label: 'CCTV' },
  { id: 'log', label: 'Log' },
]

const visibleTabs = computed(() =>
  tabs.filter((tab) => tab.id === 'slots' || authStore.canManageParking),
)

const selectTab = (tab: ActiveTab) => {
  if (tab !== 'slots' && !authStore.canManageParking) return
  activeTab.value = tab
}

watch(
  () => authStore.canManageParking,
  (canManage) => {
    if (!canManage) activeTab.value = 'slots'
  },
)

const staffCameras = [
  { title: 'Entrance', plateSuffix: '7' },
  { title: 'Exit', plateSuffix: '7' },
  { title: 'Floor4 B6', plateSuffix: '5' },
  { title: 'Floor4 C3', plateSuffix: '6' },
]

const parkingLogs = ref<ParkingLogDisplay[]>([])
const isShowingSampleLogs = ref(false)
const isLoadingLogs = ref(false)
const logsError = ref('')
const selectedLocation = ref<{ floor: ParkingFloor; isSample: boolean } | null>(null)
let logRequestSequence = 0
const isSelectedLocation = computed(() => Boolean(selectedLocation.value))
const sampleLogsForSelectedLocation = computed(() => {
  const location = selectedLocation.value
  if (!location?.isSample) return []
  return dashboardParkingLogSamples.filter(
    (log) =>
      log.buildingId === String(location.floor.building?._id) &&
      log.floor === location.floor.floor &&
      log.vehType === location.floor.veh_type,
  )
})
const displayedParkingLogs = computed(() =>
  isShowingSampleLogs.value ? sampleLogsForSelectedLocation.value : parkingLogs.value,
)

const mapParkingLog = (log: ParkingLogRecord): ParkingLogDisplay => ({
  id: log._id,
  name: log.name,
  brand: log.brand,
  model: log.model,
  color: log.color,
  licenseNumber: log.license_num,
  province: log.province,
  building: log.building,
  buildingId: log.buildingId,
  floor: log.floor,
  vehType: log.veh_type,
  date: log.date_enter,
  parkingTime: log.park_time,
  exitDate: log.date_exit || '-',
  exitTime: log.exit_time || '-',
  parkingSlot: log.park_slot === null ? '-' : String(log.park_slot),
  status: log.park_status === 'Not parking' ? 'Not Parking' : log.park_status,
  slotDisabled: log.slotDisabled,
})

const onLogLocationChange = (location: { floor: ParkingFloor; isSample: boolean } | null) => {
  logRequestSequence += 1
  selectedLocation.value = location
  parkingLogs.value = []
  isLoadingLogs.value = false
  logsError.value = ''
  if (activeTab.value === 'log') loadParkingLogs()
}

watch(activeTab, (tab) => {
  if (tab === 'log' && authStore.canManageParking && selectedLocation.value)
    loadParkingLogs()
})

async function loadParkingLogs() {
  const requestSequence = ++logRequestSequence
  const location = selectedLocation.value
  const floor = location?.floor
  if (!floor || location.isSample) {
    parkingLogs.value = []
    isLoadingLogs.value = false
    logsError.value = ''
    return
  }
  isLoadingLogs.value = true
  logsError.value = ''
  try {
    const response = await parkingLogService.list({
      buildingId: floor.building!._id,
      floorId: floor._id,
      veh_type: floor.veh_type,
    })
    if (requestSequence !== logRequestSequence) return
    parkingLogs.value = response.data.logs.map(mapParkingLog)
  } catch {
    if (requestSequence !== logRequestSequence) return
    logsError.value = 'Failed to load parking logs'
  } finally {
    if (requestSequence === logRequestSequence) isLoadingLogs.value = false
  }
}
</script>

<style scoped>
.staff-dashboard.embedded {
  margin-left: 0;
}
.staff-dashboard {
  min-height: calc(100vh - 78px);
  margin-left: 138px;
  background: #d8d8d8;
  color: #202020;
}

.tabbar {
  height: 46px;
  background: #fff;
  display: flex;
  align-items: stretch;
  padding-left: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-button {
  width: 110px;
  border: 1px solid #a6a6a6;
  border-radius: 5px;
  background: #fff;
  color: #9a9a9a;
  font-size: 14px;
  font-weight: 600;
  margin-right: 8px;
}

.tab-button.is-active {
  background: #fdeceb;
  color: #9e2d25;
}

.dashboard-toolbar {
  min-height: 116px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 12px 25px 18px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.filters {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-control {
  display: grid;
  gap: 9px;
  color: #252525;
  font-size: 20px;
}

.filter-control span {
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.filter-control select {
  width: 107px;
  height: 43px;
  border-radius: 8px;
  background: #fff;
  border: 0;
  padding: 0 16px;
  color: #242424;
  font-size: 16px;
  outline: none;
  box-shadow: inset 0 0 0 1px #e4e4e4;
}

.filter-control:nth-child(3) select {
  width: 100px;
}

.stats {
  display: flex;
  gap: 13px;
  flex-wrap: wrap;
  padding-top: 25px;
}

.stat-card {
  width: 74px;
  min-height: 42px;
  border-radius: 5px;
  background: #fff;
  display: grid;
  place-items: center;
  align-content: center;
  border: 1px solid #ececec;
}

.stat-card strong {
  font-size: 24px;
  line-height: 0.95;
  font-weight: 800;
}

.stat-card span {
  color: #909090;
  font-size: 11px;
  text-align: center;
}

.dashboard-content {
  padding: 16px 31px 32px;
}

.dashboard-content.slots-content {
  padding-bottom: 16px;
}

.cctv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 393px));
  gap: 12px 82px;
  justify-content: center;
}

.logs-panel {
  display: grid;
  gap: 16px;
  align-content: start;
  background: #e3e3e3;
  border-radius: 5px;
  min-height: 670px;
  padding: 10px 20px 44px;
}

.sample-log-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.sample-log-toggle {
  border: 1px solid #9e2d25;
  border-radius: 5px;
  background: #fff;
  color: #9e2d25;
  padding: 9px 16px;
  font-weight: 700;
  cursor: pointer;
}

.sample-log-note {
  color: #555;
  font-size: 14px;
}

.warning-banner {
  width: max-content;
  margin: 0 0 21px;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  color: #111;
  padding: 11px 22px;
  font-size: 16px;
}

.warning-banner span {
  color: #c7352c;
}

.log-card {
  min-height: 158px;
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 3px 4px rgba(0, 0, 0, 0.28);
  display: grid;
  grid-template-columns: 54px minmax(280px, 1fr) minmax(310px, 1fr) 205px;
  align-items: center;
  gap: 18px;
  padding: 14px 28px 14px 22px;
  margin-bottom: 21px;
}

.log-car {
  color: #202024;
}

.vehicle-info,
.parking-info {
  display: grid;
  gap: 7px;
  color: #111;
  font-size: 16px;
}

.vehicle-info p,
.parking-info p {
  color: #111;
  white-space: nowrap;
}

.vehicle-info span,
.parking-info span {
  display: inline-block;
  width: 12px;
  color: #111;
}

.status-parking {
  color: #09d82e;
  font-weight: 400;
}

.status-exited {
  color: #c7352c;
  font-weight: 400;
}

.status-muted {
  color: #898989;
  font-weight: 400;
}

.face-driver {
  text-align: center;
}

.face-driver > p {
  color: #111;
  margin-bottom: 10px;
  font-size: 16px;
}

.face-driver > div {
  display: flex;
  justify-content: center;
  gap: 26px;
}

:deep(.face-placeholder) {
  display: grid;
  justify-items: center;
  gap: 5px;
}

:deep(.face-placeholder div) {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: #dfe1e6;
  display: grid;
  place-items: end center;
  color: #6d7376;
  overflow: hidden;
}

:deep(.face-placeholder figcaption) {
  color: #111;
  font-size: 16px;
}

@media (max-width: 900px) {
  .dashboard-toolbar {
    flex-direction: column;
  }

  .stats {
    padding-top: 0;
  }

  .dashboard-content.slots-content {
    padding-bottom: 16px;
  }

  .cctv-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .log-card {
    grid-template-columns: 44px 1fr;
  }

  .parking-info,
  .face-driver {
    grid-column: 2;
  }
}
</style>
