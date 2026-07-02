<template>
  <section class="reference-parking-card">
    <div class="scene-board" aria-label="Parking slot map">
      <div class="parking-grid">
        <button
          v-for="slot in slots"
          :key="slot.slotNumber"
          :class="['slot-cell', slot.status, { selected: selectedSlots.has(slot.slotNumber) }]"
          type="button"
          @click="toggleSlot(slot.slotNumber)"
        >
          <span v-if="selectedSlots.has(slot.slotNumber)" class="slot-check">
            <Check class="h-6 w-6" :stroke-width="3" />
          </span>
          <span
            v-else-if="slot.status === 'occupied' || slot.status === 'incoming'"
            :class="['car-shape', slot.carColor]"
          >
            <i></i>
          </span>
        </button>
      </div>

      <div class="right-zone" aria-hidden="true"></div>
      <span class="wall wall-vertical" aria-hidden="true"></span>
      <span class="wall wall-horizontal" aria-hidden="true"></span>
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
import { ref } from 'vue'
import { Check } from 'lucide-vue-next'

type SlotStatus = 'available' | 'incoming' | 'occupied' | 'disabled'
type CarColor = 'red' | 'black' | 'yellow' | 'pink'

interface SceneSlot {
  slotNumber: number
  status: SlotStatus
  carColor?: CarColor
}

const slots = ref<SceneSlot[]>([
  { slotNumber: 1, status: 'occupied', carColor: 'black' },
  { slotNumber: 2, status: 'incoming', carColor: 'yellow' },
  { slotNumber: 3, status: 'available' },
  { slotNumber: 4, status: 'occupied', carColor: 'red' },
  { slotNumber: 5, status: 'disabled' },
  { slotNumber: 6, status: 'occupied', carColor: 'red' },
  { slotNumber: 7, status: 'available' },
  { slotNumber: 8, status: 'occupied', carColor: 'red' },
  { slotNumber: 9, status: 'available' },
  { slotNumber: 10, status: 'occupied', carColor: 'pink' },
])

const selectedSlots = ref(new Set<number>([3, 5, 7, 9]))

const toggleSlot = (slotNumber: number) => {
  const slot = slots.value.find((item) => item.slotNumber === slotNumber)
  if (!slot || slot.status === 'occupied' || slot.status === 'incoming') return

  const nextSelected = new Set(selectedSlots.value)
  if (nextSelected.has(slotNumber)) {
    nextSelected.delete(slotNumber)
  } else {
    nextSelected.add(slotNumber)
  }
  selectedSlots.value = nextSelected
}

const setSelectedStatus = (status: SlotStatus) => {
  slots.value = slots.value.map((slot) => {
    if (!selectedSlots.value.has(slot.slotNumber)) return slot
    if (slot.status === 'occupied' || slot.status === 'incoming') return slot
    return { ...slot, status }
  })
}
</script>

<style scoped>
.reference-parking-card {
  border-radius: 10px;
  background: #fff;
  padding: 18px 24px 12px;
}

.scene-board {
  position: relative;
  width: min(638px, 78vw);
  height: 364px;
  margin: 0 auto;
  border-radius: 7px;
  background: #555c5b;
  overflow: hidden;
}

.parking-grid {
  position: absolute;
  left: 15px;
  top: 82px;
  z-index: 5;
  display: grid;
  grid-template-columns: repeat(5, 82px);
  grid-template-rows: repeat(2, 95px);
  gap: 10px 4px;
}

.slot-cell {
  position: relative;
  width: 82px;
  height: 95px;
  border: 0;
  border-radius: 0;
  background: #19a349;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.slot-cell::before,
.slot-cell::after {
  content: '';
  position: absolute;
  top: 0;
  width: 6px;
  height: 100%;
  background: #f6f6f6;
}

.slot-cell::before {
  left: -3px;
}

.slot-cell::after {
  right: -3px;
}

.slot-cell.available {
  background: #18a449;
}

.slot-cell.incoming {
  background: #ffc400;
}

.slot-cell.occupied {
  background: #ba352d;
}

.slot-cell.disabled {
  background: #d7d7d7;
}

.slot-cell.selected {
  background: #18a449;
}

.slot-cell.disabled.selected {
  background: #d7d7d7;
}

.slot-check {
  position: absolute;
  left: 50%;
  top: 58%;
  z-index: 6;
  width: 31px;
  height: 31px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #6defff;
  color: #14a9c4;
  display: grid;
  place-items: center;
  box-shadow:
    inset 0 -3px 0 rgba(0, 0, 0, 0.08),
    0 2px 4px rgba(0, 0, 0, 0.24);
}

.car-shape {
  position: absolute;
  inset: 13px 12px 11px;
  z-index: 4;
  border-radius: 26px 26px 12px 12px;
  background: linear-gradient(90deg, #681a16, #d2362c 52%, #681a16);
  box-shadow:
    inset 0 -10px 0 rgba(0, 0, 0, 0.22),
    0 12px 8px rgba(0, 0, 0, 0.34);
}

.car-shape::before {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  top: 10px;
  height: 26px;
  border-radius: 18px 18px 8px 8px;
  background: rgba(24, 28, 30, 0.74);
}

.car-shape::after {
  content: '';
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 11px;
  height: 19px;
  border-radius: 4px;
  background: rgba(28, 31, 33, 0.82);
}

.car-shape i {
  position: absolute;
  left: 50%;
  top: -8px;
  width: 24px;
  height: 4px;
  transform: translateX(-50%);
  border-radius: 999px;
  background: #6ff4ff;
}

.car-shape.black {
  background: linear-gradient(90deg, #541711, #7d2a23 52%, #34383a);
}

.car-shape.yellow {
  border-radius: 9px;
  background: linear-gradient(90deg, #d9a400, #ffe270 52%, #f3b800);
}

.car-shape.yellow::before {
  background: #f7f7f7;
}

.car-shape.pink {
  background: linear-gradient(90deg, #45272f, #dc456a 52%, #44252d);
}

.right-zone {
  position: absolute;
  top: 0;
  right: 0;
  width: 96px;
  height: 239px;
  border-radius: 7px 7px 0 0;
  background: #5bad2c;
}

.wall {
  position: absolute;
  z-index: 3;
  background: #efefef;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.52);
}

.wall-vertical {
  top: 0;
  right: 104px;
  width: 7px;
  height: 253px;
}

.wall-horizontal {
  right: 0;
  bottom: 112px;
  width: 108px;
  height: 7px;
}

.map-actions {
  width: min(638px, 78vw);
  margin: 10px auto 26px;
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
  background: #18a449;
}

.status-legend .occupied {
  background: #bd352e;
}

.status-legend .incoming {
  background: #ffc400;
}

.status-legend .disabled {
  background: #d7d7d7;
}

@media (max-width: 760px) {
  .reference-parking-card {
    padding: 14px 12px;
  }

  .scene-board,
  .map-actions {
    width: 100%;
  }

  .scene-board {
    height: 282px;
  }

  .parking-grid {
    top: 68px;
    left: 8px;
    grid-template-columns: repeat(5, minmax(44px, 1fr));
    grid-template-rows: repeat(2, 72px);
    width: calc(100% - 88px);
  }

  .slot-cell {
    width: 100%;
    height: 72px;
  }

  .right-zone {
    width: 62px;
    height: 184px;
  }

  .wall-vertical {
    right: 68px;
    height: 194px;
  }

  .wall-horizontal {
    width: 72px;
    bottom: 89px;
  }

  .status-legend {
    gap: 12px;
    flex-wrap: wrap;
  }
}
</style>
