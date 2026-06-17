<template>
  <div class="staff-dashboard">
    <div class="tabbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-button', activeTab === tab.id ? 'is-active' : '']"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="dashboard-toolbar">
      <div class="filters">
        <label v-for="filter in filters" :key="filter.label" class="filter-control">
          <span>{{ filter.label }} *</span>
          <select v-model="filter.model.value" :disabled="filter.disabled">
            <option v-for="option in filter.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
        </label>
      </div>

      <div class="stats">
        <div v-for="stat in stats" :key="stat.label" class="stat-card">
          <strong :style="{ color: stat.color }">{{ stat.value }}</strong>
          <span>{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <section class="dashboard-content">
      <div v-if="activeTab === 'slots'" class="slots-view">
        <div class="parking-map">
          <div class="map-heading">
            <span></span>
            <strong>E4</strong>
            <span></span>
          </div>

          <div class="gate-label out">out</div>
          <div class="gate-label in">in</div>
          <div class="gate-label up">up</div>
          <div class="gate-label down">down</div>

          <div v-for="row in rowLabels" :key="row.label" class="row-label" :style="{ top: row.top }">
            {{ row.label }}
          </div>

          <svg class="flow-lines" viewBox="0 0 1000 520" aria-hidden="true">
            <defs>
              <marker id="flow-arrow" markerHeight="10" markerWidth="10" orient="auto" refX="8" refY="5">
                <path d="M0,0 L10,5 L0,10 Z" fill="rgba(255, 167, 145, 0.72)" />
              </marker>
            </defs>
            <path d="M95 140 C160 205, 220 165, 245 165" marker-end="url(#flow-arrow)" />
            <path d="M320 170 C390 168, 430 168, 485 168" marker-end="url(#flow-arrow)" />
            <path d="M555 165 C630 160, 705 160, 760 166" marker-end="url(#flow-arrow)" />
            <path d="M895 160 C960 200, 960 285, 900 312" marker-end="url(#flow-arrow)" />
            <path d="M790 305 C700 302, 630 300, 535 306" marker-end="url(#flow-arrow)" />
            <path d="M455 306 C360 310, 265 306, 165 308" marker-end="url(#flow-arrow)" />
            <path d="M70 310 C40 260, 44 210, 78 170" marker-end="url(#flow-arrow)" />
            <path d="M675 400 C660 350, 665 325, 700 302" marker-end="url(#flow-arrow)" />
            <path d="M905 315 C928 415, 810 455, 705 420" marker-end="url(#flow-arrow)" />
          </svg>

          <button
            v-for="slot in parkingSlots"
            :key="slot.slotNumber"
            :class="[
              'slot',
              slotStatusClass(slot.slotNumber),
              { selected: selectedSlots.has(slot.slotNumber) },
            ]"
            :style="slotStyle(slot)"
            type="button"
            @click="toggleSlotSelection(slot.slotNumber)"
          >
            <Check v-if="selectedSlots.has(slot.slotNumber)" class="h-4 w-4" :stroke-width="3" />
            <span v-else>{{ slot.slotNumber }}</span>
          </button>
        </div>

        <div class="slot-actions">
          <div class="action-buttons">
            <button class="edit" type="button" @click="handleEditSlots">Edit</button>
            <button class="enable" type="button" @click="handleEnableSlots">Enable</button>
            <button class="disable" type="button" @click="handleDisableSlots">Disable</button>
          </div>
          <strong>Selecting : {{ selectedSlots.size }}</strong>
        </div>
      </div>

      <div v-else-if="activeTab === 'cctv'" class="cctv-grid">
        <article v-for="camera in cameras" :key="camera.name" class="camera-card">
          <header>
            <h2>{{ camera.name }}</h2>
            <span><i></i>Live</span>
          </header>
          <div :class="['camera-feed', camera.scene]">
            <div class="timestamp">{{ camera.timestamp }}</div>
            <div class="pillar one">{{ camera.pillarA }}</div>
            <div class="pillar two">{{ camera.pillarB }}</div>
            <div class="car car-a"></div>
            <div class="car car-b"></div>
            <div class="car car-c"></div>
            <div class="direction-arrow"></div>
            <div class="plate">{{ camera.plate }}</div>
            <Maximize2 class="expand-icon h-4 w-4" />
          </div>
        </article>
      </div>

      <div v-else class="logs-panel">
        <div class="warning-banner"><span>Exited</span> car log will reset after 24 hours</div>

        <article v-for="log in parkingLogs" :key="log.id" class="log-card">
          <CarFront class="log-car h-9 w-9" :stroke-width="2.4" />

          <div class="vehicle-info">
            <p>Name <span>:</span> {{ log.name }}</p>
            <p>License Number <span>:</span> {{ log.licenseNumber }}</p>
            <p>Province <span>:</span> {{ log.province }}</p>
            <p>Vehicle Description <span>:</span> {{ log.vehicleDescription }}</p>
          </div>

          <div class="parking-info">
            <p>Date <span>:</span> {{ log.date }}</p>
            <p>Parking Time <span>:</span> {{ log.parkingTime }}</p>
            <p>Exit Time <span>:</span> {{ log.exitTime }}</p>
            <p>Parking slot number <span>:</span> {{ log.parkingSlot }}</p>
            <p>
              Parking Status <span>:</span>
              <strong :class="statusClass(log.status)">{{ log.status }}</strong>
            </p>
          </div>

          <div class="face-driver">
            <p>Face Driver</p>
            <div>
              <FacePlaceholder label="Entered" />
              <FacePlaceholder label="Exited" />
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref } from 'vue'
import { CarFront, Check, Maximize2, UserRound } from 'lucide-vue-next'
import parkingSlotsData from '@/data/parking-slots.json'

type ActiveTab = 'slots' | 'cctv' | 'log'
type SlotStatus = 'available' | 'incoming' | 'occupied' | 'disabled'

interface ParkingSlot {
  slotNumber: number
  x: number
  y: number
}

const FacePlaceholder = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () =>
      h('figure', { class: 'face-placeholder' }, [
        h('div', [h(UserRound, { class: 'h-11 w-11', strokeWidth: 1.8 })]),
        h('figcaption', props.label),
      ])
  },
})

const activeTab = ref<ActiveTab>('slots')
const selectedBuilding = ref('E4')
const selectedFloor = ref('4')
const selectedVehicle = ref('Cars')
const selectedSlots = ref(new Set<number>())
const parkingSlots = ref<ParkingSlot[]>([])
const slotStatus = ref<Record<number, SlotStatus>>({})

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'slots', label: 'Slots' },
  { id: 'cctv', label: 'CCTV' },
  { id: 'log', label: 'Log' },
]

const filters = [
  { label: 'Building', model: selectedBuilding, options: ['E4'], disabled: false },
  { label: 'Floor', model: selectedFloor, options: ['4'], disabled: false },
  { label: 'Vehicle', model: selectedVehicle, options: ['Cars', 'Motorcycles'], disabled: false },
]

const incomingSlotNumbers = [8, 9, 10, 24, 25, 26]
const disabledSlotNumbers = [45, 46, 47]

const stats = computed(() => {
  const statuses = Object.values(slotStatus.value)
  const count = (status: SlotStatus) => statuses.filter((slot) => slot === status).length

  return [
    { label: 'Total slots', value: parkingSlots.value.length || 124, color: '#3b82f6' },
    { label: 'Available', value: count('available'), color: '#4caf50' },
    { label: 'Incoming', value: count('incoming'), color: '#f5c443' },
    { label: 'Occupied', value: count('occupied'), color: '#ef4444' },
    { label: 'Disable', value: count('disabled'), color: '#7d7d7d' },
  ]
})

const rowLabels = [
  { label: 'A', top: '18%' },
  { label: 'B', top: '32%' },
  { label: 'C', top: '42%' },
  { label: 'D', top: '56%' },
  { label: 'E', top: '70%' },
  { label: 'F', top: '83%' },
]

const cameras = [
  {
    name: 'Enter',
    scene: 'scene-one',
    timestamp: '03-05-2026 Sun 00:44:46',
    plate: 'B-4CB17',
    pillarA: 'E04',
    pillarB: 'F05',
  },
  {
    name: 'Exit',
    scene: 'scene-two',
    timestamp: '03-05-2026 Sun 00:44:46',
    plate: 'B-4CB17',
    pillarA: 'E05',
    pillarB: 'F06',
  },
  {
    name: 'Floor4 B6',
    scene: 'scene-three',
    timestamp: '03-05-2026 Sun 00:38:45',
    plate: 'B-4CB5',
    pillarA: 'D03',
    pillarB: 'C03',
  },
  {
    name: 'Floor4 C3',
    scene: 'scene-four',
    timestamp: '03-05-2026 Sun 00:39:36',
    plate: 'B-4CB6',
    pillarA: 'B03',
    pillarB: 'A03',
  },
]

const parkingLogs = [
  {
    id: 1,
    name: 'Mrs. Wilayporn Nonsila',
    licenseNumber: 'กง 1234',
    province: 'เชียงราย',
    vehicleDescription: 'Black Toyota Fortuner',
    date: '12/08/2569',
    parkingTime: '12:00:34',
    exitTime: '-',
    parkingSlot: '10',
    status: 'Parking',
  },
  {
    id: 2,
    name: '*Guest555',
    licenseNumber: 'ภค 5555',
    province: 'ลำพูน',
    vehicleDescription: 'Unknown',
    date: '12/08/2569',
    parkingTime: '14:00:34',
    exitTime: '16:01:21',
    parkingSlot: '54',
    status: 'Exited',
  },
  {
    id: 3,
    name: 'Anutin Charnvirakul',
    licenseNumber: 'รฮ 1000',
    province: 'กรุงเทพมหานคร',
    vehicleDescription: 'BYD blue pearl',
    date: '12/08/2569',
    parkingTime: '-',
    exitTime: '-',
    parkingSlot: '-',
    status: 'Not Parking',
  },
]

const slotStyle = (slot: ParkingSlot) => ({
  left: `${(slot.x / 1300) * 100}%`,
  top: `${(slot.y / 700) * 100}%`,
})

const slotStatusClass = (slotNumber: number) => {
  return slotStatus.value[slotNumber] || 'available'
}

const statusClass = (status: string) => {
  if (status === 'Parking') return 'status-parking'
  if (status === 'Exited') return 'status-exited'
  return 'status-muted'
}

const toggleSlotSelection = (slotNumber: number) => {
  const next = new Set(selectedSlots.value)
  if (next.has(slotNumber)) {
    next.delete(slotNumber)
  } else {
    next.add(slotNumber)
  }
  selectedSlots.value = next
}

const handleEditSlots = () => {
  console.log('Edit slots:', Array.from(selectedSlots.value))
}

const handleEnableSlots = () => {
  const nextStatus = { ...slotStatus.value }
  selectedSlots.value.forEach((slotId) => {
    if (nextStatus[slotId] !== 'occupied') {
      nextStatus[slotId] = 'available'
    }
  })
  slotStatus.value = nextStatus
  selectedSlots.value = new Set()
}

const handleDisableSlots = () => {
  const nextStatus = { ...slotStatus.value }
  const restrictedSlots: number[] = []
  
  selectedSlots.value.forEach((slotId) => {
    const status = slotStatus.value[slotId]
    if (status === 'incoming' || status === 'occupied') {
      restrictedSlots.push(slotId)
    } else {
      nextStatus[slotId] = 'disabled'
    }
  })
  
  if (restrictedSlots.length > 0) {
    const statusNames = restrictedSlots.map(id => {
      const status = slotStatus.value[id]
      return `${id} (${status})`
    }).join(', ')
    alert(`Cannot disable slots with active vehicles: ${statusNames}`)
  }
  
  slotStatus.value = nextStatus
  selectedSlots.value = new Set()
}

onMounted(() => {
  const floor4Data = (parkingSlotsData as any).E4.floor4
  const allSlots: ParkingSlot[] = []

  for (const row of Object.values(floor4Data.rows) as any[]) {
    allSlots.push(
      ...row.positions.map((position: any) => ({
        slotNumber: Number(position.slot ?? position.slotNumber),
        x: Number(position.x),
        y: Number(position.y),
      })),
    )
  }

  parkingSlots.value = allSlots.sort((a, b) => a.slotNumber - b.slotNumber)
  const nextStatus: Record<number, SlotStatus> = { ...floor4Data.slotStatus }
  incomingSlotNumbers.forEach((slotNumber) => {
    if (nextStatus[slotNumber] !== 'occupied') {
      nextStatus[slotNumber] = 'incoming'
    }
  })
  disabledSlotNumbers.forEach((slotNumber) => {
    if (nextStatus[slotNumber] !== 'occupied') {
      nextStatus[slotNumber] = 'disabled'
    }
  })
  slotStatus.value = nextStatus
})
</script>

<style scoped>
.staff-dashboard {
  min-height: calc(100vh - 78px);
  margin-left: 160px;
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
  gap: 24px;
  padding: 12px 38px 18px 30px;
}

.filters {
  display: flex;
  gap: 22px;
  flex-wrap: wrap;
}

.filter-control {
  display: grid;
  gap: 9px;
  color: #252525;
  font-size: 20px;
}

.filter-control span {
  color: #252525;
}

.filter-control select {
  width: 142px;
  height: 45px;
  border-radius: 8px;
  background: #fff;
  border: 0;
  padding: 0 18px;
  color: #242424;
  font-size: 20px;
  outline: none;
}

.stats {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding-top: 29px;
}

.stat-card {
  width: 104px;
  height: 59px;
  border-radius: 6px;
  background: #fff;
  display: grid;
  place-items: center;
  align-content: center;
}

.stat-card strong {
  font-size: 30px;
  line-height: 0.9;
  font-weight: 800;
}

.stat-card span {
  color: #909090;
  font-size: 16px;
}

.dashboard-content {
  padding: 0 42px 34px;
}

.parking-map {
  position: relative;
  height: min(589px, calc(100vh - 300px));
  min-height: 430px;
  overflow: hidden;
  border-radius: 22px;
  border: 8px solid rgba(255, 255, 255, 0.24);
  background:
    linear-gradient(90deg, rgba(80, 64, 44, 0.12) 1px, transparent 1px) 0 0 / 92px 92px,
    linear-gradient(0deg, rgba(80, 64, 44, 0.1) 1px, transparent 1px) 0 0 / 92px 92px,
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.38), transparent 34%),
    #cabb9a;
  box-shadow: inset 0 0 38px rgba(0, 0, 0, 0.18);
}

.map-heading {
  position: absolute;
  top: 22px;
  left: 12%;
  right: 12%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 36px;
  z-index: 3;
}

.map-heading span {
  height: 2px;
  background: #353535;
}

.map-heading strong {
  color: #111;
  font-size: 56px;
  font-weight: 500;
  line-height: 1;
}

.gate-label,
.row-label {
  position: absolute;
  z-index: 3;
  color: #171717;
  font-size: 27px;
  font-weight: 400;
}

.gate-label::before,
.gate-label::after {
  content: '';
  display: inline-block;
  width: 2px;
  height: 48px;
  margin: 0 11px -14px;
  background: #333;
}

.gate-label.out {
  top: 75px;
  left: 2.5%;
}

.gate-label.in {
  top: 75px;
  left: 10%;
}

.gate-label.up {
  top: 58%;
  left: 7%;
}

.gate-label.down {
  top: 58%;
  left: 39%;
}

.row-label {
  right: 14px;
  font-size: 35px;
}

.flow-lines {
  position: absolute;
  inset: 58px 44px 52px;
  width: calc(100% - 88px);
  height: calc(100% - 110px);
  z-index: 1;
  pointer-events: none;
}

.flow-lines path {
  fill: none;
  stroke: rgba(255, 167, 145, 0.64);
  stroke-width: 9;
  stroke-linecap: round;
  filter: drop-shadow(0 0 5px rgba(255, 211, 200, 0.8));
}

.slot {
  position: absolute;
  z-index: 4;
  width: clamp(25px, 2.4vw, 34px);
  height: clamp(30px, 3vw, 42px);
  transform: translate(-50%, -50%);
  border: 1px solid rgba(20, 20, 20, 0.6);
  color: #101010;
  display: grid;
  place-items: center;
  font-size: clamp(10px, 0.85vw, 15px);
  font-weight: 500;
  box-shadow: inset 0 -2px 0 rgba(0, 0, 0, 0.14);
}

.slot.available {
  background: #4caf50;
  color: #0f2a12;
}

.slot.incoming {
  background: #f5c443;
  color: #3d2a00;
}

.slot.occupied {
  background: linear-gradient(#ff6b6b 0 55%, #dc2626 56% 100%);
  color: #f2f2f2;
  box-shadow:
    inset 0 -6px 0 rgba(0, 0, 0, 0.35),
    5px 6px 4px rgba(0, 0, 0, 0.34);
}

.slot.disabled {
  background: #9e9e9e;
  color: #282828;
}

.slot.selected {
  border: 3px solid #22c7f2;
  color: #fff;
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.18),
    0 0 0 3px rgba(103, 220, 247, 0.65),
    0 4px 4px rgba(0, 0, 0, 0.25);
}

.slot.selected svg {
  width: 20px;
  height: 20px;
  padding: 2px;
  border-radius: 999px;
  background: #67dcf7;
  color: #fff;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}

.slot-actions {
  height: 86px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.action-buttons {
  display: flex;
  gap: 92px;
}

.slot-actions button {
  width: 104px;
  height: 46px;
  border-radius: 5px;
  color: #111;
  font-size: 16px;
}

.slot-actions .edit {
  background: #149cf0;
}

.slot-actions .enable {
  background: #26df5d;
}

.slot-actions .disable {
  background: #c7382f;
  color: #fff;
}

.slot-actions strong {
  color: #111;
  font-size: 15px;
  letter-spacing: 1px;
}

.cctv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(320px, 1fr));
  gap: 12px 114px;
  padding: 0 38px 0 0;
}

.camera-card {
  border-radius: 32px;
  background: #fff;
  overflow: hidden;
  padding: 0 0 10px;
}

.camera-card header {
  height: 54px;
  border-bottom: 1px solid #1f1f1f;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
}

.camera-card h2 {
  color: #202020;
  font-size: 20px;
  font-weight: 400;
}

.camera-card header span {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #c7352c;
  font-size: 14px;
}

.camera-card header i {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #c7352c;
}

.camera-feed {
  position: relative;
  height: 260px;
  margin: 12px 38px 0;
  overflow: hidden;
  border-radius: 6px;
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0)),
    linear-gradient(115deg, #1f272a 0 18%, #777d7d 19% 36%, #c8cbc7 37% 52%, #696e6d 53% 100%);
}

.camera-feed::before {
  content: '';
  position: absolute;
  inset: 44% -10% 0;
  background:
    linear-gradient(95deg, transparent 0 32%, rgba(255, 255, 255, 0.18) 33% 34%, transparent 35%),
    radial-gradient(ellipse at 50% 0, rgba(255, 255, 255, 0.18), transparent 55%),
    #676b66;
  transform: perspective(220px) rotateX(45deg);
  transform-origin: top;
}

.timestamp {
  position: absolute;
  top: 10px;
  left: 15px;
  z-index: 4;
  color: rgba(255, 255, 255, 0.78);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 15px;
  font-weight: 700;
}

.pillar {
  position: absolute;
  top: 12px;
  width: 54px;
  height: 178px;
  background: linear-gradient(#d8dddd, #b9bdbb);
  color: #5d4030;
  display: grid;
  place-items: center;
  font-size: 13px;
  z-index: 2;
}

.pillar.one {
  left: 27%;
}

.pillar.two {
  right: 18%;
}

.car {
  position: absolute;
  z-index: 3;
  width: 110px;
  height: 54px;
  border-radius: 50% 50% 18px 18px;
  background: linear-gradient(135deg, #1a1d20, #596064 52%, #151719);
  box-shadow: 0 14px 22px rgba(0, 0, 0, 0.48);
}

.car-a {
  left: 4%;
  top: 70px;
  transform: rotate(-13deg);
}

.car-b {
  right: 16%;
  top: 118px;
  transform: rotate(8deg);
  background: linear-gradient(135deg, #dde3e0, #8c9696 55%, #202427);
}

.car-c {
  left: -4%;
  bottom: 20px;
  transform: rotate(18deg);
}

.direction-arrow {
  position: absolute;
  left: 45%;
  bottom: 28px;
  width: 18px;
  height: 82px;
  background: rgba(255, 255, 255, 0.2);
  clip-path: polygon(35% 0, 65% 0, 65% 60%, 100% 60%, 50% 100%, 0 60%, 35% 60%);
}

.plate {
  position: absolute;
  right: 64px;
  bottom: 13px;
  color: #fff;
  font-family: ui-serif, Georgia, serif;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}

.expand-icon {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 2px;
  border-radius: 3px;
  background: #101524;
  color: #fff;
}

.scene-three,
.scene-four {
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0)),
    linear-gradient(110deg, #333b3c 0 12%, #b0b9b6 13% 35%, #555e5e 36% 100%);
}

.scene-four .car-b {
  background: linear-gradient(135deg, #c56f2f, #8c341c 55%, #24120f);
}

.logs-panel {
  background: #e3e3e3;
  border-radius: 5px;
  min-height: 670px;
  padding: 10px 20px 44px;
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

@media (max-width: 1120px) {
  .dashboard-toolbar {
    flex-direction: column;
  }

  .stats {
    padding-top: 0;
  }

  .cctv-grid {
    grid-template-columns: 1fr;
    gap: 18px;
    padding-right: 0;
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
