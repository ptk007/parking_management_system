<template>
  <section class="reference-parking-card">
    <div class="map-scroll">
      <div class="scene-board" aria-label="E4 floor 4 parking slot map">
        <div class="map-title">E4</div>

        <span class="lane-label label-out">out</span>
        <span class="lane-label label-in">in</span>
        <span class="lane-label label-up">up</span>
        <span class="lane-label label-down">down</span>

        <span class="row-label row-a">A</span>
        <span class="row-label row-b">B</span>
        <span class="row-label row-c">C</span>
        <span class="row-label row-d">D</span>
        <span class="row-label row-e">E</span>
        <span class="row-label row-f">F</span>

        <span class="lane-line top-line"></span>
        <span class="lane-line left-line out-line"></span>
        <span class="lane-line left-line in-line"></span>
        <span class="lane-line left-line up-line"></span>
        <span class="lane-line center-line down-line"></span>
        <span class="lane-line center-line e-line"></span>

        <span class="flow-arrow arrow-top-left"></span>
        <span class="flow-arrow arrow-top-center"></span>
        <span class="flow-arrow arrow-top-right"></span>
        <span class="flow-arrow arrow-mid-one"></span>
        <span class="flow-arrow arrow-mid-two"></span>
        <span class="flow-arrow arrow-mid-three"></span>
        <span class="flow-arrow arrow-mid-four"></span>
        <span class="flow-arrow arrow-right-down"></span>
        <span class="flow-arrow arrow-left-up"></span>
        <span class="flow-loop"></span>

        <div
          v-for="group in layoutGroups"
          :key="group.id"
          class="slot-group"
          :style="groupStyle(group)"
        >
          <div v-for="row in group.rows" :key="row.map((slot) => slot.slotNumber).join('-')" class="slot-row">
            <button
              v-for="slot in row"
              :key="slot.slotNumber"
              :class="[
                'slot-cell',
                slot.status,
                {
                  selected: selectedSlots.has(slot.slotNumber),
                  'is-locked': slot.status === 'occupied' || slot.status === 'incoming',
                },
              ]"
              type="button"
              :aria-label="`Slot ${slot.slotNumber} ${slot.status}`"
              @click="toggleSlot(slot.slotNumber)"
            >
              <span v-if="selectedSlots.has(slot.slotNumber)" class="slot-check">
                <Check class="h-3 w-3" :stroke-width="3.2" />
              </span>
              <span class="slot-number">{{ slot.slotNumber }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="map-actions">
      <div class="button-group">
        <button class="action-button enable" type="button" @click="setSelectedStatus('available')">
          Enable
        </button>
        <button class="action-button disable" type="button" @click="setSelectedStatus('disabled')">
          Disable
        </button>
      </div>
      <strong>Selecting : {{ selectedSlots.size }}</strong>
    </div>

    <div class="status-legend" aria-label="Slot status legend">
      <span><i class="available"></i>Available</span>
      <span><i class="occupied"></i>Occupied</span>
      <span><i class="incoming"></i>Incoming</span>
      <span><i class="disabled"></i>Disable</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import parkingSlotData from '@/data/parking-slots.json'

type SlotStatus = 'available' | 'incoming' | 'occupied' | 'disabled'

interface SlotStats {
  total: number
  available: number
  incoming: number
  occupied: number
  disabled: number
}

const emit = defineEmits<{
  'stats-change': [stats: SlotStats]
}>()

interface ParkingGroup {
  id: string
  x: number
  y: number
  rows: number[][]
  compact?: boolean
}

interface LayoutSlot {
  slotNumber: number
  status: SlotStatus
}

interface LayoutGroup extends Omit<ParkingGroup, 'rows'> {
  rows: LayoutSlot[][]
}

const sourceStatuses = parkingSlotData.E4.floor4.slotStatus as Record<string, string>

const normalizeStatus = (status: string | undefined): SlotStatus => {
  if (status === 'occupied' || status === 'incoming' || status === 'disabled') return status
  return 'available'
}

const buildInitialSlotStatus = () => {
  const nextStatus: Record<number, SlotStatus> = {}

  for (let slotNumber = 1; slotNumber <= parkingSlotData.E4.floor4.totalSlots; slotNumber += 1) {
    nextStatus[slotNumber] = normalizeStatus(sourceStatuses[String(slotNumber)])
  }

  return nextStatus
}

const parkingLayout: ParkingGroup[] = [
  { id: 'a-1', x: 112, y: 50, rows: [[1, 2, 3]] },
  { id: 'a-2', x: 220, y: 50, rows: [[4, 5, 6, 7]] },
  { id: 'a-3', x: 338, y: 50, rows: [[8, 9, 10, 11]] },
  { id: 'a-4', x: 460, y: 50, rows: [[12, 13, 14]] },
  { id: 'a-5', x: 566, y: 50, rows: [[15, 16, 17]] },
  { id: 'a-6', x: 668, y: 50, rows: [[18, 19, 20]] },
  { id: 'a-7', x: 770, y: 50, rows: [[21, 22, 23]] },
  { id: 'a-8', x: 868, y: 50, rows: [[24, 25, 26]] },

  { id: 'bc-1', x: 112, y: 137, rows: [[49, 48, 47], [50, 51, 52]], compact: true },
  { id: 'bc-2', x: 218, y: 137, rows: [[46, 45, 44, 43], [53, 54, 55, 56]], compact: true },
  { id: 'bc-3', x: 350, y: 137, rows: [[42, 41, 40, 39], [57, 58, 59, 60]], compact: true },
  { id: 'bc-4', x: 484, y: 137, rows: [[36, 37, 38], [61, 62, 63]], compact: true },
  { id: 'bc-5', x: 598, y: 137, rows: [[35, 34, 33], [64, 65, 66]], compact: true },
  { id: 'bc-6', x: 712, y: 137, rows: [[32, 31, 30], [67, 68, 69]], compact: true },
  { id: 'bc-7', x: 828, y: 137, rows: [[29, 28, 27], [70, 71, 72]], compact: true },

  { id: 'de-1', x: 112, y: 293, rows: [[94, 93, 92], [95, 96, 97]], compact: true },
  { id: 'de-2', x: 225, y: 293, rows: [[91, 90, 89, 88], [98, 99, 100, 101]], compact: true },
  { id: 'de-3', x: 456, y: 284, rows: [[85, 86, 87], [102, 103, 104]], compact: true },
  { id: 'de-4', x: 650, y: 284, rows: [[79, 80, 81], [82, 83, 84]], compact: true },
  { id: 'de-5', x: 785, y: 284, rows: [[73, 74, 75], [76, 77, 78]], compact: true },

  { id: 'f-1', x: 30, y: 430, rows: [[124, 123, 122, 121, 120, 119, 118]] },
  { id: 'f-2', x: 232, y: 430, rows: [[117, 116, 115]] },
  { id: 'f-3', x: 342, y: 430, rows: [[114, 113, 112, 111]] },
  { id: 'f-4', x: 490, y: 430, rows: [[110, 109, 108, 107]] },
  { id: 'f-5', x: 640, y: 430, rows: [[106, 105]] },
]

const slotStatuses = ref(buildInitialSlotStatus())
const selectedSlots = ref(new Set<number>())

const getSlotStatus = (slotNumber: number) => slotStatuses.value[slotNumber] ?? 'available'

const mapStats = computed<SlotStats>(() => {
  const stats: SlotStats = {
    total: 0,
    available: 0,
    incoming: 0,
    occupied: 0,
    disabled: 0,
  }

  Object.values(slotStatuses.value).forEach((status) => {
    stats.total += 1

    if (status === 'available') stats.available += 1
    if (status === 'incoming') stats.incoming += 1
    if (status === 'occupied') stats.occupied += 1
    if (status === 'disabled') stats.disabled += 1
  })

  return stats
})

const layoutGroups = computed<LayoutGroup[]>(() =>
  parkingLayout.map((group) => ({
    ...group,
    rows: group.rows.map((row) =>
      row.map((slotNumber) => ({
        slotNumber,
        status: getSlotStatus(slotNumber),
      })),
    ),
  })),
)

const groupStyle = (group: LayoutGroup): Record<string, string> => ({
  left: `${group.x}px`,
  top: `${group.y}px`,
  '--slot-width': group.compact ? '23px' : '25px',
  '--slot-height': group.compact ? '28px' : '30px',
})

const toggleSlot = (slotNumber: number) => {
  const status = getSlotStatus(slotNumber)
  if (status === 'occupied' || status === 'incoming') return

  const nextSelected = new Set(selectedSlots.value)
  if (nextSelected.has(slotNumber)) {
    nextSelected.delete(slotNumber)
  } else {
    nextSelected.add(slotNumber)
  }
  selectedSlots.value = nextSelected
}

const setSelectedStatus = (status: SlotStatus) => {
  selectedSlots.value.forEach((slotNumber) => {
    const currentStatus = getSlotStatus(slotNumber)
    if (currentStatus === 'occupied' || currentStatus === 'incoming') return
    slotStatuses.value[slotNumber] = status
  })
  selectedSlots.value = new Set()
}

watch(
  mapStats,
  (stats) => {
    emit('stats-change', stats)
  },
  { immediate: true },
)
</script>

<style scoped>
.reference-parking-card {
  width: min(1080px, 100%);
  margin: 0 auto;
  border-radius: 8px;
  background: #fff;
  padding: 14px 16px 13px;
  box-sizing: border-box;
}

.map-scroll {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 4px;
}

.scene-board {
  position: relative;
  width: 960px;
  height: 510px;
  margin: 0 auto;
  border: 3px solid #d8d2c7;
  border-radius: 3px;
  background:
    linear-gradient(0deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.28)),
    #b7a890;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(70, 55, 36, 0.26);
}

.map-title {
  position: absolute;
  left: 50%;
  top: 7px;
  transform: translateX(-50%);
  color: #080808;
  font-size: 45px;
  font-weight: 400;
  line-height: 1;
}

.lane-label,
.row-label {
  position: absolute;
  z-index: 5;
  color: #111;
  font-size: 19px;
  line-height: 1;
}

.label-out {
  left: 25px;
  top: 52px;
}

.label-in {
  left: 84px;
  top: 52px;
}

.label-up {
  left: 82px;
  top: 298px;
}

.label-down {
  left: 368px;
  top: 298px;
}

.row-a {
  right: 7px;
  top: 61px;
}

.row-b {
  right: 7px;
  top: 132px;
}

.row-c {
  right: 7px;
  top: 184px;
}

.row-d {
  right: 7px;
  top: 310px;
}

.row-e {
  left: 544px;
  top: 339px;
}

.row-f {
  left: 610px;
  top: 441px;
}

.lane-line {
  position: absolute;
  z-index: 2;
  background: #4f4b42;
  opacity: 0.85;
}

.top-line {
  left: 125px;
  top: 47px;
  width: 315px;
  height: 2px;
}

.left-line {
  width: 2px;
  height: 38px;
}

.out-line {
  left: 21px;
  top: 42px;
}

.in-line {
  left: 72px;
  top: 42px;
}

.up-line {
  left: 57px;
  top: 289px;
}

.center-line {
  width: 2px;
  height: 54px;
}

.down-line {
  left: 360px;
  top: 282px;
}

.e-line {
  left: 534px;
  top: 318px;
}

.slot-group {
  position: absolute;
  z-index: 8;
  display: grid;
  gap: 2px;
}

.slot-row {
  display: flex;
  gap: 2px;
}

.slot-cell {
  position: relative;
  width: var(--slot-width);
  height: var(--slot-height);
  border: 1px solid rgba(28, 60, 38, 0.52);
  border-radius: 2px;
  background: #58da82;
  color: #0c1e12;
  cursor: pointer;
  display: grid;
  place-items: center;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.42),
    0 1px 2px rgba(0, 0, 0, 0.22);
}

.slot-cell.is-locked {
  cursor: default;
}

.slot-cell.available {
  background: #5dde86;
}

.slot-cell.incoming {
  background: #f4c23a;
  border-color: rgba(122, 91, 14, 0.7);
}

.slot-cell.occupied {
  background: #b62924;
  border-color: rgba(83, 18, 14, 0.75);
  color: #fff;
}

.slot-cell.disabled {
  background: #d2d2d2;
  border-color: rgba(100, 100, 100, 0.48);
  color: #555;
}

.slot-cell.selected {
  outline: 3px solid #6defff;
  outline-offset: -2px;
}

.slot-number {
  position: relative;
  z-index: 2;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}

.slot-check {
  position: absolute;
  right: 1px;
  top: 1px;
  z-index: 4;
  width: 13px;
  height: 13px;
  border-radius: 999px;
  background: #70edff;
  color: #1295a9;
  display: grid;
  place-items: center;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.26);
}

.flow-arrow,
.flow-loop {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  opacity: 0.7;
}

.flow-arrow {
  width: 96px;
  height: 0;
  border-top: 4px solid rgba(255, 184, 166, 0.72);
  filter: drop-shadow(0 0 5px rgba(255, 210, 195, 0.45));
}

.flow-arrow::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -9px;
  width: 15px;
  height: 15px;
  border-right: 4px solid rgba(255, 184, 166, 0.82);
  border-top: 4px solid rgba(255, 184, 166, 0.82);
  transform: rotate(45deg);
}

.arrow-top-left {
  left: 72px;
  top: 89px;
}

.arrow-top-center {
  left: 335px;
  top: 89px;
}

.arrow-top-right {
  left: 760px;
  top: 89px;
}

.arrow-mid-one,
.arrow-mid-two,
.arrow-mid-three,
.arrow-mid-four {
  transform: rotate(180deg);
}

.arrow-mid-one {
  left: 122px;
  top: 236px;
}

.arrow-mid-two {
  left: 350px;
  top: 236px;
}

.arrow-mid-three {
  left: 585px;
  top: 236px;
}

.arrow-mid-four {
  left: 790px;
  top: 236px;
}

.arrow-right-down {
  left: 872px;
  top: 104px;
  width: 90px;
  transform: rotate(90deg);
  transform-origin: left center;
}

.arrow-left-up {
  left: 40px;
  top: 221px;
  width: 82px;
  transform: rotate(-105deg);
}

.flow-loop {
  right: 75px;
  bottom: 100px;
  width: 260px;
  height: 126px;
  border-right: 5px solid rgba(255, 184, 166, 0.72);
  border-bottom: 5px solid rgba(255, 184, 166, 0.72);
  border-radius: 0 0 128px 0;
  filter: drop-shadow(0 0 5px rgba(255, 210, 195, 0.45));
}

.flow-loop::after {
  content: '';
  position: absolute;
  left: -1px;
  top: 7px;
  width: 15px;
  height: 15px;
  border-left: 5px solid rgba(255, 184, 166, 0.82);
  border-top: 5px solid rgba(255, 184, 166, 0.82);
  transform: rotate(45deg);
}

.map-actions {
  margin: 12px auto 24px;
  display: flex;
  align-items: center;
  gap: 13px;
}

.button-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.action-button {
  width: 75px;
  height: 34px;
  border: 0;
  border-radius: 4px;
  color: #111;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 2px 3px rgba(0, 0, 0, 0.16);
}

.action-button.enable {
  background: #23df5c;
}

.action-button.disable {
  background: #c9382f;
  color: #fff;
}

.map-actions strong {
  color: #111;
  font-size: 12px;
}

.status-legend {
  display: flex;
  align-items: center;
  gap: 28px;
  color: #202020;
  font-size: 12px;
}

.status-legend span {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.status-legend i {
  width: 16px;
  height: 16px;
  display: inline-block;
}

.status-legend .available {
  background: #5dde86;
}

.status-legend .occupied {
  background: #b62924;
}

.status-legend .incoming {
  background: #f4c23a;
}

.status-legend .disabled {
  background: #d2d2d2;
}

@media (max-width: 760px) {
  .reference-parking-card {
    padding: 12px;
  }

  .scene-board {
    margin: 0;
  }

  .map-actions {
    flex-wrap: wrap;
  }

  .status-legend {
    gap: 12px;
    flex-wrap: wrap;
  }
}
</style>
