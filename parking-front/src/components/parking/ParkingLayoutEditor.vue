<template>
  <div class="layout-editor">
    <header class="editor-intro">
      <div>
        <span class="section-kicker">LAYOUT STUDIO</span>
        <h3>ออกแบบแผนผังที่จอดรถ</h3>
        <p>เพิ่มภาพพื้นหลัง จัดวางช่องจอด แล้วเติมรายละเอียดให้แผนผัง</p>
      </div>
      <span :class="['save-indicator', { failed: saveFailed }]" role="status"
        ><span></span>{{ saveMessage }}</span
      >
    </header>
    <div class="editor-toolbar" aria-label="Layout drawing tools">
      <div class="tool-group">
        <button
          v-for="item in tools"
          :key="item.id"
          :class="{ active: tool === item.id }"
          :aria-label="item.label"
          :aria-pressed="tool === item.id"
          :title="item.description"
          @click="chooseTool(item.id)"
        >
          <component :is="item.icon" :size="18" /><span>{{ item.title }}</span>
        </button>
      </div>
      <div class="history-controls">
        <button
          :disabled="!past.length"
          aria-label="Undo layout change"
          title="ย้อนกลับ"
          @click="undo"
        >
          <Undo2 :size="17" />
        </button>
        <button
          :disabled="!future.length"
          aria-label="Redo layout change"
          title="ทำซ้ำ"
          @click="redo"
        >
          <Redo2 :size="17" />
        </button>
        <label class="zoom-control"
          >ซูม<select v-model.number="zoom" aria-label="Layout zoom">
            <option :value="75">75%</option>
            <option :value="100">100%</option>
            <option :value="125">125%</option>
            <option :value="150">150%</option>
          </select></label
        >
      </div>
    </div>
    <div class="editor-help" role="status">
      <MousePointer2 :size="17" />
      <div>
        <strong>{{ activeTool.title }}</strong
        ><span>{{ helpText }}</span>
      </div>
      <kbd>Esc ยกเลิก</kbd>
    </div>
    <p v-if="error" role="alert" class="editor-error">{{ error }}</p>
    <div class="editor-body">
      <div class="canvas-panel">
        <div class="canvas-heading">
          <span
            >พื้นที่ออกแบบ <span class="canvas-dimensions">1000 × {{ canvasHeight }}</span></span
          ><span>{{ slots.length }} ช่องจอด · {{ layout.shapes.length }} องค์ประกอบ</span>
        </div>
        <div class="canvas-scroll">
          <div class="canvas-size" :style="{ width: `${zoom}%` }">
            <svg
              ref="canvas"
              :class="['layout-canvas', { drawing: !['select', 'slots'].includes(tool) }]"
              :viewBox="`0 0 1000 ${canvasHeight}`"
              role="group"
              aria-label="Editable parking floor plan"
              tabindex="0"
              @pointerdown="beginCanvas"
              @pointermove="movePointer"
              @pointerup="finishPointer"
              @pointercancel="cancelPointer"
              @keydown.esc.prevent="cancelPointer"
              @keydown.delete.prevent="deleteShape"
            >
              <defs>
                <pattern
                  id="parking-layout-grid"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e9f0" stroke-width="1" />
                </pattern>
              </defs>
              <rect width="1000" :height="canvasHeight" fill="#f8fafc" />
              <rect width="1000" :height="canvasHeight" fill="url(#parking-layout-grid)" />
              <image
                v-if="layout.background"
                :href="layout.background.dataUrl"
                width="1000"
                height="700"
                preserveAspectRatio="xMidYMid meet"
                pointer-events="none"
              />
              <g
                v-for="shape in renderedShapes"
                :key="shape.id"
                :data-shape="shape.id"
                class="canvas-shape"
                :style="{ pointerEvents: tool === 'slots' ? 'none' : 'auto' }"
                role="button"
                tabindex="0"
                :aria-label="`${shape.type} shape ${shape.text || ''}`"
                @pointerdown.stop="beginShape($event, shape)"
                @keydown.enter.prevent="selectShape(shape.id)"
              >
                <rect
                  v-if="shape.type === 'rectangle'"
                  v-bind="geometry(shape)"
                  rx="3"
                  :fill="shape.color"
                  :fill-opacity="shape.opacity"
                  :stroke="shape.color"
                  stroke-width="2"
                />
                <ellipse
                  v-else-if="shape.type === 'ellipse'"
                  :cx="shape.x + shape.width / 2"
                  :cy="shape.y + shape.height / 2"
                  :rx="shape.width / 2"
                  :ry="shape.height / 2"
                  :fill="shape.color"
                  :fill-opacity="shape.opacity"
                  :stroke="shape.color"
                  stroke-width="2"
                />
                <template v-else-if="shape.type === 'line'">
                  <line
                    :x1="shape.x"
                    :y1="shape.y + (shape.reverse ? shape.height : 0)"
                    :x2="shape.x + shape.width"
                    :y2="shape.y + (shape.reverse ? 0 : shape.height)"
                    stroke="transparent"
                    stroke-width="16"
                  />
                  <line
                    :x1="shape.x"
                    :y1="shape.y + (shape.reverse ? shape.height : 0)"
                    :x2="shape.x + shape.width"
                    :y2="shape.y + (shape.reverse ? 0 : shape.height)"
                    :stroke="shape.color"
                    :opacity="shape.opacity"
                    stroke-width="4"
                    stroke-linecap="round"
                  />
                </template>
                <text
                  v-else
                  :x="shape.x"
                  :y="shape.y + shape.height * 0.8"
                  :font-size="Math.max(12, shape.height * 0.8)"
                  :textLength="shape.width"
                  lengthAdjust="spacingAndGlyphs"
                  :fill="shape.color"
                  :opacity="shape.opacity"
                >
                  {{ shape.text }}
                </text>
                <template v-if="selectedShapeId === shape.id">
                  <rect
                    :x="shape.x - 4"
                    :y="shape.y - 4"
                    :width="shape.width + 8"
                    :height="shape.height + 8"
                    fill="none"
                    stroke="#2563eb"
                    stroke-width="2"
                    stroke-dasharray="5 3"
                    pointer-events="none"
                  />
                  <rect
                    :x="shape.x + shape.width - 5"
                    :y="shape.y + shape.height - 5"
                    width="10"
                    height="10"
                    fill="white"
                    stroke="#2563eb"
                    stroke-width="2"
                    class="resize-grip"
                    aria-label="Resize selected shape"
                    @pointerdown.stop="beginShape($event, shape, true)"
                  />
                </template>
              </g>
              <g
                v-for="(slot, index) in slots"
                :key="slotKey(slot)"
                :transform="`translate(${slotBox(slot, index).x} ${slotBox(slot, index).y})`"
                :class="['canvas-slot', slot.status, { moving: tool === 'slots' }]"
                :data-layout-slot="slotKey(slot)"
                role="button"
                tabindex="0"
                :aria-label="`Layout slot ${slot.zone} / ${slot.number}, ${statusLabels[slot.status]}`"
                @pointerdown.stop="beginSlot($event, slot, index)"
                @keydown.enter.prevent="emit('inspect-slot', slot)"
                @keydown.space.prevent="emit('inspect-slot', slot)"
              >
                <rect
                  :width="slotBox(slot, index).width"
                  :height="slotBox(slot, index).height"
                  rx="6"
                  fill="var(--slot-fill)"
                  stroke="var(--slot-stroke)"
                  stroke-width="1.5"
                />
                <text
                  :x="slotBox(slot, index).width / 2"
                  :y="slotBox(slot, index).height / 2 + 5"
                  text-anchor="middle"
                  :font-size="slotBox(slot, index).width < 50 ? 10 : 15"
                  font-weight="700"
                  fill="var(--slot-stroke)"
                  pointer-events="none"
                >
                  {{
                    slotBox(slot, index).width < 50 ? slot.number : `${slot.zone} / ${slot.number}`
                  }}
                </text>
              </g>
            </svg>
          </div>
        </div>
        <div class="canvas-caption">
          <span>รูปทรงใช้ตกแต่งแผนผังเท่านั้น</span><span>เพิ่มช่องจอดได้จาก Import JSON</span>
        </div>
      </div>
      <aside class="editor-inspector" aria-label="Layout settings">
        <section class="background-section">
          <div class="section-title">
            <LayoutGrid :size="17" />
            <h4>ผังลานจอดสำเร็จรูป</h4>
          </div>
          <p>จัดกลุ่มช่องจอด พร้อมทางวิ่งและทิศทางรถแบบ Dashboard แล้วแก้ไขต่อได้</p>
          <button class="upload-button" @click="applyDashboardTemplate">
            <LayoutGrid :size="17" />ใช้ผังแบบ Dashboard
          </button>
          <p class="template-hint">
            แทนที่การจัดวางและองค์ประกอบปัจจุบัน จำนวนและสถานะช่องจอดคงเดิม · กด Undo เพื่อย้อนกลับ
          </p>
        </section>
        <section class="background-section">
          <div class="section-title">
            <ImagePlus :size="17" />
            <h4>ภาพพื้นหลัง</h4>
            <span class="optional-label">ไม่บังคับ</span>
          </div>
          <p>ใช้ภาพแปลนอาคารเป็นแนวทางจัดวาง</p>
          <div v-if="layout.background" class="background-preview">
            <img :src="layout.background.dataUrl" alt="ภาพพื้นหลังแผนผัง" /><span
              :title="layout.background.name"
              >{{ layout.background.name }}</span
            >
          </div>
          <button class="upload-button" @click="backgroundInput?.click()" :disabled="imageLoading">
            <ImagePlus :size="17" />{{
              imageLoading
                ? 'กำลังโหลด…'
                : layout.background
                  ? 'เปลี่ยนภาพพื้นหลัง'
                  : 'อัปโหลดแปลนอาคาร'
            }}
          </button>
          <span class="file-hint">PNG, JPG หรือ WebP · ไม่เกิน 2 MB</span>
          <button
            v-if="layout.background"
            class="remove-background"
            @click="commit({ ...layout, background: null })"
          >
            <Trash2 :size="14" />ลบภาพพื้นหลัง
          </button>
          <input
            ref="backgroundInput"
            type="file"
            class="sr-only"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Upload floor plan image"
            @change="uploadBackground"
          />
        </section>
        <section class="properties-section">
          <div class="section-title">
            <Square :size="17" />
            <h4>ตั้งค่าองค์ประกอบ</h4>
          </div>
          <div v-if="selectedShape" class="shape-properties" aria-label="Selected shape properties">
            <div class="selected-heading">
              <strong>{{ tools.find((item) => item.id === selectedShape?.type)?.title }}</strong
              ><span>เลือกอยู่</span>
            </div>
            <label v-if="selectedShape.type === 'text'" class="text-property"
              >ข้อความ<input
                type="text"
                aria-label="Shape text"
                maxlength="100"
                :value="selectedShape.text"
                @change="
                  patchShape({ text: ($event.target as HTMLInputElement).value || 'Label' })
                "
            /></label>
            <div class="geometry-fields">
              <label v-for="field in ['x', 'y', 'width', 'height'] as const" :key="field"
                >{{ fieldLabels[field]
                }}<input
                  type="number"
                  :aria-label="`Shape ${field}`"
                  :value="Math.round(selectedShape[field])"
                  :min="field === 'width' || field === 'height' ? 8 : 0"
                  :max="field === 'x' || field === 'width' ? 1000 : canvasHeight"
                  @change="editNumber(field, $event)"
              /></label>
            </div>
            <label class="color-property"
              >สีองค์ประกอบ<input
                type="color"
                aria-label="Shape color"
                :value="selectedShape.color"
                @change="patchShape({ color: ($event.target as HTMLInputElement).value })"
            /></label>
            <label
              >ความทึบ
              <span class="opacity-value">{{ Math.round(selectedShape.opacity * 100) }}%</span
              ><input
                type="range"
                aria-label="Shape opacity"
                min="0.05"
                max="1"
                step="0.05"
                :value="selectedShape.opacity"
                @change="
                  patchShape({ opacity: Number(($event.target as HTMLInputElement).value) })
                "
            /></label>
            <p class="resize-hint">ลากองค์ประกอบเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด</p>
            <button class="delete-shape" aria-label="Delete shape" @click="deleteShape">
              <Trash2 :size="16" />ลบองค์ประกอบ
            </button>
          </div>
          <div v-else class="properties-empty">
            <MousePointer2 :size="28" /><strong>เลือกสิ่งที่ต้องการแก้ไข</strong>
            <p>ใช้เครื่องมือ “เลือก / ย้าย” แล้วคลิกรูปทรงบนแผนผัง เพื่อแก้ไขขนาด สี หรือข้อความ</p>
          </div>
        </section>
        <details class="quick-guide">
          <summary>วิธีใช้งานอย่างรวดเร็ว</summary>
          <ol>
            <li>อัปโหลดภาพแปลนอาคาร (ถ้ามี)</li>
            <li>เลือก “ย้ายช่องจอด” แล้วลากช่องให้ตรงกับแปลน</li>
            <li>เพิ่มรูปทรง เส้น หรือข้อความประกอบ</li>
          </ol>
          <p>คลิกช่องจอดเพื่อดูรายละเอียดและเปิด–ปิดการใช้งานด้านล่างแผนผัง</p>
          <p>ย้อนการแก้ไขได้ด้วยปุ่มลูกศร · บันทึกเฉพาะในเครื่องนี้</p>
        </details>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Circle,
  ImagePlus,
  LayoutGrid,
  Minus,
  MousePointer2,
  Move,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-vue-next'
import { slotKey } from './parkingMapJson'
import { createDashboardLayout } from './dashboardLayoutTemplate'
import { statusLabels, type PreviewSlot } from './parkingMapPreview'
import type { LayoutBox, LayoutShape, ParkingLayout } from './parkingLayout'

const props = defineProps<{
  slots: PreviewSlot[]
  modelValue: ParkingLayout
  saveMessage: string
  saveFailed: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [layout: ParkingLayout]
  'inspect-slot': [slot: PreviewSlot]
}>()
type Tool = 'select' | 'slots' | LayoutShape['type']
const tools = [
  {
    id: 'select' as const,
    label: 'Select',
    title: 'เลือก / ย้าย',
    description: 'เลือก ย้าย และปรับขนาดองค์ประกอบ',
    icon: MousePointer2,
  },
  {
    id: 'slots' as const,
    label: 'Move slots',
    title: 'ย้ายช่องจอด',
    description: 'ลากช่องจอดไปยังตำแหน่งบนแปลน',
    icon: Move,
  },
  {
    id: 'rectangle' as const,
    label: 'Rectangle',
    title: 'สี่เหลี่ยม',
    description: 'วาดสี่เหลี่ยมบนแผนผัง',
    icon: Square,
  },
  {
    id: 'ellipse' as const,
    label: 'Ellipse',
    title: 'วงรี',
    description: 'วาดวงรีบนแผนผัง',
    icon: Circle,
  },
  {
    id: 'line' as const,
    label: 'Line',
    title: 'เส้น',
    description: 'วาดเส้นบนแผนผัง',
    icon: Minus,
  },
  {
    id: 'text' as const,
    label: 'Text',
    title: 'ข้อความ',
    description: 'เพิ่มข้อความบนแผนผัง',
    icon: Type,
  },
]
const tool = ref<Tool>('select')
const activeTool = computed(() => tools.find((item) => item.id === tool.value)!)
const fieldLabels = { x: 'ตำแหน่ง X', y: 'ตำแหน่ง Y', width: 'ความกว้าง', height: 'ความสูง' }
const canvas = ref<SVGSVGElement | null>(null)
const backgroundInput = ref<HTMLInputElement | null>(null)
const layout = ref(props.modelValue)
const past = ref<ParkingLayout[]>([])
const future = ref<ParkingLayout[]>([])
const zoom = ref(100)
const selectedShapeId = ref<string | null>(null)
const error = ref('')
const imageLoading = ref(false)
let imageVersion = 0
const selectedShape = computed(() =>
  layout.value.shapes.find((shape) => shape.id === selectedShapeId.value),
)
const canvasHeight = computed(() =>
  Math.max(
    700,
    Math.ceil(props.slots.length / 12) * 62 + 50,
    ...layout.value.shapes.map((shape) => shape.y + shape.height + 20),
    ...Object.values(layout.value.positions).map((position) => position.y + position.height + 20),
  ),
)
const helpText = computed(() =>
  tool.value === 'slots'
    ? 'ลากช่องจอดไปวางให้ตรงกับแผนผัง'
    : tool.value === 'select'
      ? 'เลือกและลาก Shape · ลากมุมขวาล่างเพื่อปรับขนาด'
      : tool.value === 'text'
        ? 'คลิกเพื่อเพิ่มข้อความ แล้วแก้ไขข้อความในแถบตั้งค่า'
        : 'ลากบนแผนผังเพื่อวาด Shape · กด Esc เพื่อยกเลิก',
)
type Gesture = {
  mode: 'draw' | 'move' | 'resize' | 'slot'
  pointer: number
  start: { x: number; y: number }
  original: LayoutBox
  shape?: LayoutShape
  key?: string
  slot?: PreviewSlot
  moved: boolean
}
let gesture: Gesture | null = null
const preview = ref<LayoutBox | null>(null)
const drawing = ref<LayoutShape | null>(null)
const renderedShapes = computed(() => [
  ...layout.value.shapes.map((shape) =>
    selectedShapeId.value === shape.id && preview.value && gesture?.mode !== 'slot'
      ? { ...shape, ...preview.value }
      : shape,
  ),
  ...(drawing.value ? [drawing.value] : []),
])

function geometry(shape: LayoutBox) {
  return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
}
function point(event: PointerEvent) {
  const matrix = canvas.value?.getScreenCTM()
  if (!matrix) return { x: 0, y: 0 }
  const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  return {
    x: Math.max(0, Math.min(1000, position.x)),
    y: Math.max(0, Math.min(canvasHeight.value, position.y)),
  }
}
function slotBox(slot: PreviewSlot, index: number): LayoutBox {
  const key = slotKey(slot)
  if (gesture?.mode === 'slot' && gesture.key === key && preview.value) return preview.value
  return (
    layout.value.positions[key] || {
      x: 24 + (index % 12) * 80,
      y: 28 + Math.floor(index / 12) * 62,
      width: 70,
      height: 48,
    }
  )
}
function commit(next: ParkingLayout) {
  past.value = [...past.value.slice(-19), layout.value]
  future.value = []
  layout.value = next
  emit('update:modelValue', layout.value)
}
function applyDashboardTemplate() {
  cancelPointer()
  selectedShapeId.value = null
  tool.value = 'select'
  commit(createDashboardLayout(props.slots))
}
function undo() {
  const previous = past.value.pop()
  if (!previous) return
  cancelPointer()
  future.value.push(layout.value)
  layout.value = previous
  selectedShapeId.value = null
  emit('update:modelValue', layout.value)
}
function redo() {
  const next = future.value.pop()
  if (!next) return
  cancelPointer()
  past.value.push(layout.value)
  layout.value = next
  selectedShapeId.value = null
  emit('update:modelValue', layout.value)
}
function chooseTool(next: Tool) {
  cancelPointer()
  tool.value = next
  selectedShapeId.value = null
}
function selectShape(id: string) {
  tool.value = 'select'
  selectedShapeId.value = id
}
function capture(event: PointerEvent) {
  canvas.value?.setPointerCapture(event.pointerId)
  event.preventDefault()
}
function beginCanvas(event: PointerEvent) {
  if (event.button !== 0 || gesture) return
  selectedShapeId.value = null
  if (tool.value === 'select' || tool.value === 'slots') return
  if (layout.value.shapes.length >= 300) {
    error.value = 'A layout supports up to 300 shapes.'
    return
  }
  const start = point(event)
  const shape: LayoutShape = {
    id: crypto.randomUUID(),
    type: tool.value,
    ...start,
    width: 0,
    height: 0,
    color: '#64748b',
    opacity: tool.value === 'text' || tool.value === 'line' ? 1 : 0.35,
    text: tool.value === 'text' ? 'Label' : '',
  }
  if (tool.value === 'text') {
    shape.width = 140
    shape.height = 30
    shape.x = Math.min(shape.x, 860)
    shape.y = Math.min(shape.y, canvasHeight.value - 30)
    commit({ ...layout.value, shapes: [...layout.value.shapes, shape] })
    selectShape(shape.id)
    return
  }
  capture(event)
  gesture = { mode: 'draw', pointer: event.pointerId, start, original: shape, shape, moved: false }
  drawing.value = shape
}
function beginShape(event: PointerEvent, shape: LayoutShape, resize = false) {
  if (tool.value !== 'select') {
    beginCanvas(event)
    return
  }
  if (event.button !== 0 || gesture) return
  selectedShapeId.value = shape.id
  capture(event)
  gesture = {
    mode: resize ? 'resize' : 'move',
    pointer: event.pointerId,
    start: point(event),
    original: geometry(shape),
    shape,
    moved: false,
  }
}
function beginSlot(event: PointerEvent, slot: PreviewSlot, index: number) {
  if (tool.value !== 'slots') {
    if (tool.value === 'select') emit('inspect-slot', slot)
    else beginCanvas(event)
    return
  }
  if (event.button !== 0 || gesture) return
  selectedShapeId.value = null
  capture(event)
  gesture = {
    mode: 'slot',
    pointer: event.pointerId,
    start: point(event),
    original: geometry(slotBox(slot, index)),
    key: slotKey(slot),
    slot,
    moved: false,
  }
}
function movePointer(event: PointerEvent) {
  if (!gesture || gesture.pointer !== event.pointerId) return
  const current = point(event)
  const dx = current.x - gesture.start.x,
    dy = current.y - gesture.start.y
  if (Math.abs(dx) + Math.abs(dy) > 3) gesture.moved = true
  if (gesture.mode === 'draw' && gesture.shape) {
    drawing.value = {
      ...gesture.shape,
      x: Math.min(current.x, gesture.start.x),
      y: Math.min(current.y, gesture.start.y),
      width: Math.abs(dx),
      height: Math.abs(dy),
      reverse: dx * dy < 0,
    }
  } else if (gesture.mode === 'resize') {
    const original = gesture.original
    preview.value = {
      ...original,
      width: Math.max(8, Math.min(1000 - original.x, original.width + dx)),
      height: Math.max(8, Math.min(canvasHeight.value - original.y, original.height + dy)),
    }
  } else {
    const original = gesture.original
    preview.value = {
      ...original,
      x: Math.max(0, Math.min(1000 - original.width, original.x + dx)),
      y: Math.max(0, Math.min(canvasHeight.value - original.height, original.y + dy)),
    }
  }
}
function finishPointer(event: PointerEvent) {
  if (!gesture || gesture.pointer !== event.pointerId) return
  movePointer(event)
  const active = gesture
  if (active.mode === 'draw' && drawing.value && active.moved) {
    const shape = drawing.value
    if (shape.type === 'line' || (shape.width >= 8 && shape.height >= 8)) {
      commit({ ...layout.value, shapes: [...layout.value.shapes, shape] })
      selectShape(shape.id)
    }
  } else if (active.moved && preview.value) {
    if (active.mode === 'slot' && active.key)
      commit({
        ...layout.value,
        positions: { ...layout.value.positions, [active.key]: preview.value },
      })
    else if (active.shape)
      commit({
        ...layout.value,
        shapes: layout.value.shapes.map((shape) =>
          shape.id === active.shape!.id ? { ...shape, ...preview.value! } : shape,
        ),
      })
  } else if (active.slot) emit('inspect-slot', active.slot)
  cancelPointer()
}
function cancelPointer() {
  if (gesture && canvas.value?.hasPointerCapture(gesture.pointer))
    canvas.value.releasePointerCapture(gesture.pointer)
  gesture = null
  preview.value = null
  drawing.value = null
}
function patchShape(patch: Partial<LayoutShape>) {
  if (!selectedShape.value) return
  commit({
    ...layout.value,
    shapes: layout.value.shapes.map((shape) =>
      shape.id === selectedShapeId.value ? { ...shape, ...patch } : shape,
    ),
  })
}
function editNumber(field: keyof LayoutBox, event: Event) {
  if (!selectedShape.value) return
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  const shape = selectedShape.value
  const max =
    field === 'x'
      ? 1000 - shape.width
      : field === 'width'
        ? 1000 - shape.x
        : field === 'y'
          ? canvasHeight.value - shape.height
          : canvasHeight.value - shape.y
  const min = field === 'width' || field === 'height' ? 8 : 0
  patchShape({ [field]: Math.max(min, Math.min(max, value)) })
}
function deleteShape() {
  if (!selectedShape.value) return
  commit({
    ...layout.value,
    shapes: layout.value.shapes.filter((shape) => shape.id !== selectedShapeId.value),
  })
  selectedShapeId.value = null
}
async function uploadBackground(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file) return
  const version = ++imageVersion
  error.value = ''
  imageLoading.value = true
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
      throw new Error('Use a PNG, JPG or WebP image.')
    if (file.size > 2 * 1024 * 1024) throw new Error('The floor plan image must be 2 MB or less.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Unable to read image.'))
      reader.readAsDataURL(file)
    })
    const img = new Image()
    img.src = dataUrl
    await img.decode()
    if (version !== imageVersion) return
    commit({ ...layout.value, background: { name: file.name, dataUrl } })
  } catch (cause) {
    if (version === imageVersion)
      error.value = cause instanceof Error ? cause.message : 'Unable to load floor plan image.'
  } finally {
    if (version === imageVersion) imageLoading.value = false
  }
}
watch(
  () => props.modelValue,
  (next) => {
    if (next === layout.value) return
    cancelPointer()
    layout.value = next
    past.value = []
    future.value = []
    selectedShapeId.value = null
  },
)
onBeforeUnmount(() => {
  ++imageVersion
  cancelPointer()
})
</script>

<style scoped>
.layout-editor {
  border-top: 1px solid #e5e9f0;
  container-type: inline-size;
  background: #fff;
  color: #40536e;
}
.editor-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px;
}
.section-kicker {
  color: #5374aa;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.8px;
}
h3 {
  margin: 5px 0;
  font-size: 20px;
  color: #253751;
}
.editor-intro p,
.background-section p {
  margin: 4px 0 12px;
  color: #738197;
  font-size: 12px;
  line-height: 1.7;
}
.save-indicator {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #49725d;
  background: #f0f8f3;
  padding: 8px 11px;
  border-radius: 8px;
  font-size: 11px;
  max-width: 260px;
}
.save-indicator > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.save-indicator.failed {
  color: #b43d42;
  background: #fff1f2;
}
.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 24px 16px;
}
.tool-group,
.history-controls {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}
.tool-group {
  padding: 5px;
  border: 1px solid #e3e8ef;
  border-radius: 12px;
  background: #f7f9fc;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 38px;
  padding: 9px 11px;
  border: 1px solid #dce3ed;
  border-radius: 8px;
  background: white;
  font: inherit;
  font-size: 12px;
  color: #53647d;
  cursor: pointer;
}
button:hover:not(:disabled) {
  background: #edf3fc;
  border-color: #adbfdb;
}
.tool-group button {
  background: transparent;
  border-color: transparent;
}
.tool-group button.active {
  color: #fff;
  background: #315d9e;
  border-color: #315d9e;
  box-shadow: 0 2px 4px #24467920;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
svg:focus-visible,
summary:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 3px;
}
.zoom-control {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-left: 8px;
  color: #718096;
  font-size: 12px;
}
select {
  padding: 8px;
  border: 1px solid #dce3ed;
  border-radius: 8px;
  background: #fff;
  color: #334155;
}
.editor-help {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 24px 18px;
  padding: 12px 14px;
  background: #eef4fd;
  border: 1px solid #dce8fa;
  border-radius: 9px;
  color: #48658d;
  font-size: 12px;
  line-height: 1.7;
}
.editor-help > svg {
  flex-shrink: 0;
}
.editor-help strong {
  margin-right: 12px;
  color: #2d5081;
}
kbd {
  margin-left: auto;
  white-space: nowrap;
  padding: 2px 6px;
  border: 1px solid #cedcf1;
  border-radius: 4px;
  font: inherit;
  font-size: 10px;
}
.editor-error {
  margin: 0 24px 16px;
  color: #b43d42;
  font-size: 12px;
}
.editor-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  border-top: 1px solid #e5e9f0;
}
.canvas-panel {
  min-width: 0;
  background: #f7f9fc;
}
.canvas-heading,
.canvas-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  color: #718096;
  font-size: 11px;
}
.canvas-heading > span:first-child {
  color: #40536e;
  font-weight: 600;
}
.canvas-dimensions {
  color: #95a1b3;
  font-weight: 400;
  margin-left: 8px;
}
.canvas-scroll {
  overflow: auto;
  max-height: 640px;
  border-block: 1px solid #e5e9f0;
  background: #e9edf3;
}
.canvas-size {
  min-width: 650px;
}
.layout-canvas {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
  user-select: none;
}
.layout-canvas.drawing,
.layout-canvas.drawing .canvas-slot,
.layout-canvas.drawing .canvas-shape {
  cursor: crosshair;
}
.editor-inspector {
  border-left: 1px solid #e5e9f0;
  min-width: 0;
  background: #fff;
}
.background-section,
.properties-section {
  padding: 18px;
  border-bottom: 1px solid #e8edf4;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #40536e;
  margin-bottom: 10px;
}
h4 {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
}
.optional-label {
  margin-left: auto;
  color: #97a1b1;
  font-size: 10px;
}
.upload-button {
  width: 100%;
  border-style: dashed;
  color: #315d9e;
  background: #f7faff;
}
.file-hint {
  display: block;
  margin-top: 8px;
  text-align: center;
  color: #8a96a8;
  font-size: 10px;
}
.remove-background {
  width: 100%;
  border: 0;
  color: #a6535a;
  margin-top: 8px;
  min-height: 30px;
  font-size: 11px;
}
.background-preview {
  border: 1px solid #e3e8ef;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
}
.background-preview img {
  display: block;
  width: 100%;
  height: 90px;
  object-fit: contain;
  background: #f3f6fa;
}
.background-preview span {
  display: block;
  padding: 7px;
  font-size: 11px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #718096;
}
.selected-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 14px 0;
  font-size: 12px;
  color: #315d9e;
}
.selected-heading span {
  padding: 3px 7px;
  border-radius: 5px;
  background: #edf4ff;
  font-size: 10px;
}
.geometry-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.shape-properties label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  margin-bottom: 12px;
  color: #718096;
  font-size: 11px;
}
.shape-properties input {
  width: 100%;
  min-width: 0;
  border: 1px solid #dce3ed;
  border-radius: 7px;
  padding: 9px;
  font: inherit;
  font-size: 13px;
  color: #334155;
  background: #fff;
  box-sizing: border-box;
}
.shape-properties input[type='color'] {
  width: 48px;
  height: 32px;
  padding: 3px;
  cursor: pointer;
}
.shape-properties input[type='range'] {
  padding: 0;
  accent-color: #315d9e;
  cursor: pointer;
}
.opacity-value {
  color: #315d9e;
  font-weight: 600;
}
.resize-hint {
  color: #8a96a8;
  font-size: 11px;
  line-height: 1.7;
}
.delete-shape {
  width: 100%;
  color: #b43d42;
  border-color: #f0d6d8;
  background: #fff7f7;
}
.properties-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 4px 12px;
  color: #9aa9bd;
  text-align: center;
}
.properties-empty strong {
  color: #687b95;
  font-size: 12px;
}
.properties-empty p {
  margin: 0;
  font-size: 11px;
  line-height: 1.9;
}
.quick-guide {
  margin: 18px;
  font-size: 11px;
  line-height: 1.9;
  color: #7a899e;
}
.quick-guide summary {
  cursor: pointer;
  color: #4c6383;
  font-size: 12px;
}
.quick-guide ol {
  padding-left: 18px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@container (max-width:850px) {
  .editor-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .editor-inspector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-left: 0;
    border-top: 1px solid #e5e9f0;
  }
  .properties-section {
    border-left: 1px solid #e5e9f0;
  }
  .quick-guide {
    grid-column: 1 / -1;
  }
  .editor-intro {
    flex-wrap: wrap;
  }
  .editor-help span {
    display: block;
  }
}
@container (max-width:500px) {
  .editor-intro {
    padding: 18px 14px;
  }
  .editor-toolbar {
    padding: 0 14px 14px;
  }
  .tool-group {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }
  .editor-help {
    margin: 0 14px 14px;
  }
  .editor-help kbd {
    display: none;
  }
  .editor-inspector {
    grid-template-columns: 1fr;
  }
  .properties-section {
    border-left: 0;
  }
  .canvas-heading,
  .canvas-caption {
    flex-wrap: wrap;
  }
}
.canvas-slot {
  cursor: pointer;
}
.canvas-slot.moving {
  cursor: grab;
}
.canvas-slot.available {
  --slot-fill: #e2f5e9;
  --slot-stroke: #207c58;
}
.canvas-slot.occupied {
  --slot-fill: #fbe4e5;
  --slot-stroke: #b63c42;
}
.canvas-slot.incoming {
  --slot-fill: #fff0c6;
  --slot-stroke: #93630b;
}
.canvas-slot.disabled {
  --slot-fill: #e4e8ee;
  --slot-stroke: #757d89;
}
.canvas-slot:focus-visible {
  outline: 3px solid #2563eb;
}
.canvas-shape {
  cursor: move;
}
.resize-grip {
  cursor: nwse-resize;
}
</style>
