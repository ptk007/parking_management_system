<template>
  <div class="layout-editor">
    <div class="editor-toolbar" aria-label="Layout drawing tools">
      <div class="tool-group">
        <button
          v-for="item in tools"
          :key="item.id"
          :class="{ active: tool === item.id }"
          :aria-pressed="tool === item.id"
          @click="chooseTool(item.id)"
        >
          <component :is="item.icon" :size="16" />{{ item.label }}
        </button>
      </div>
      <div class="tool-group">
        <button :disabled="!past.length" aria-label="Undo layout change" @click="undo">
          <Undo2 :size="16" />
        </button>
        <button :disabled="!future.length" aria-label="Redo layout change" @click="redo">
          <Redo2 :size="16" />
        </button>
        <label class="zoom-control"
          >Zoom<select v-model.number="zoom" aria-label="Layout zoom">
            <option :value="75">75%</option>
            <option :value="100">100%</option>
            <option :value="125">125%</option>
            <option :value="150">150%</option>
          </select></label
        >
      </div>
    </div>
    <div class="background-toolbar">
      <div>
        <button @click="backgroundInput?.click()" :disabled="imageLoading">
          <ImagePlus :size="16" />{{ imageLoading ? 'Loading…' : 'Upload floor plan' }}</button
        ><span>{{ layout.background?.name || 'PNG, JPG or WebP · up to 2 MB' }}</span>
      </div>
      <button v-if="layout.background" @click="commit({ ...layout, background: null })">
        Remove background
      </button>
      <input
        ref="backgroundInput"
        type="file"
        class="sr-only"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Upload floor plan image"
        @change="uploadBackground"
      />
    </div>
    <p class="editor-help">
      {{ helpText }} · Shape เป็นส่วนตกแต่ง ไม่เพิ่มจำนวนช่องจอด · บันทึกอัตโนมัติ
    </p>
    <p v-if="error" role="alert" class="editor-error">{{ error }}</p>
    <div class="canvas-scroll">
      <div class="canvas-size" :style="{ width: `${zoom}%` }">
        <svg
          ref="canvas"
          class="layout-canvas"
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
            <pattern id="parking-layout-grid" width="20" height="20" patternUnits="userSpaceOnUse">
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
              font-size="15"
              font-weight="700"
              fill="var(--slot-stroke)"
              pointer-events="none"
            >
              {{ slot.zone }} / {{ slot.number }}
            </text>
          </g>
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
        </svg>
      </div>
    </div>
    <div v-if="selectedShape" class="shape-properties" aria-label="Selected shape properties">
      <strong>{{ selectedShape.type }}</strong>
      <label v-for="field in ['x', 'y', 'width', 'height'] as const" :key="field"
        >{{ field
        }}<input
          type="number"
          :aria-label="`Shape ${field}`"
          :value="Math.round(selectedShape[field])"
          min="0"
          :max="field === 'x' || field === 'width' ? 1000 : canvasHeight"
          @change="editNumber(field, $event)"
      /></label>
      <label
        >Color<input
          type="color"
          aria-label="Shape color"
          :value="selectedShape.color"
          @change="patchShape({ color: ($event.target as HTMLInputElement).value })"
      /></label>
      <label
        >Opacity<input
          type="range"
          aria-label="Shape opacity"
          min="0.05"
          max="1"
          step="0.05"
          :value="selectedShape.opacity"
          @change="patchShape({ opacity: Number(($event.target as HTMLInputElement).value) })"
      /></label>
      <label v-if="selectedShape.type === 'text'" class="text-property"
        >Text<input
          type="text"
          aria-label="Shape text"
          maxlength="100"
          :value="selectedShape.text"
          @change="patchShape({ text: ($event.target as HTMLInputElement).value || 'Label' })"
      /></label>
      <button class="delete-shape" @click="deleteShape"><Trash2 :size="15" /> Delete shape</button>
    </div>
    <p v-else class="properties-empty">
      {{ layout.shapes.length }} shapes · เลือก Shape เพื่อแก้ไขสี ขนาด และข้อความ · Undo
      เพื่อย้อนการแก้ไข
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  Circle,
  ImagePlus,
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
import { statusLabels, type PreviewSlot } from './parkingMapPreview'
import type { LayoutBox, LayoutShape, ParkingLayout } from './parkingLayout'

const props = defineProps<{ slots: PreviewSlot[]; modelValue: ParkingLayout }>()
const emit = defineEmits<{
  'update:modelValue': [layout: ParkingLayout]
  'inspect-slot': [slot: PreviewSlot]
}>()
type Tool = 'select' | 'slots' | LayoutShape['type']
const tools = [
  { id: 'select' as const, label: 'Select', icon: MousePointer2 },
  { id: 'slots' as const, label: 'Move slots', icon: Move },
  { id: 'rectangle' as const, label: 'Rectangle', icon: Square },
  { id: 'ellipse' as const, label: 'Ellipse', icon: Circle },
  { id: 'line' as const, label: 'Line', icon: Minus },
  { id: 'text' as const, label: 'Text', icon: Type },
]
const tool = ref<Tool>('select')
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
        ? 'คลิกเพื่อเพิ่มข้อความ แล้วแก้ไขข้อความด้านล่าง'
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
}
.editor-toolbar,
.tool-group,
.background-toolbar,
.background-toolbar > div,
.shape-properties {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.editor-toolbar {
  padding: 12px 16px;
  justify-content: space-between;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid #e0e5ed;
  border-radius: 7px;
  background: white;
  font-size: 11px;
  color: #546176;
  cursor: pointer;
}
button.active {
  background: #293549;
  color: white;
  border-color: #293549;
}
button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
svg:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.zoom-control {
  font-size: 11px;
  color: #6b778b;
  display: flex;
  gap: 5px;
  align-items: center;
}
select {
  padding: 7px;
  border: 1px solid #e0e5ed;
  border-radius: 7px;
}
.background-toolbar {
  padding: 0 16px 10px;
  justify-content: space-between;
}
.background-toolbar span {
  font-size: 10px;
  color: #8490a2;
  max-width: 220px;
  overflow-wrap: anywhere;
}
.editor-help,
.editor-error {
  margin: 0;
  padding: 0 16px 12px;
  font-size: 11px;
  line-height: 1.6;
  color: #7e899b;
}
.editor-error {
  color: #b43d42;
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
.shape-properties {
  padding: 14px 16px;
  gap: 12px;
  background: #fcfdff;
}
.shape-properties strong {
  font-size: 12px;
  text-transform: capitalize;
}
.shape-properties label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  color: #758197;
  text-transform: capitalize;
}
.shape-properties input {
  border: 1px solid #dce2eb;
  border-radius: 5px;
  padding: 5px;
  font-size: 12px;
  width: 64px;
  color: #334155;
}
.shape-properties input[type='color'] {
  height: 28px;
  padding: 2px;
  width: 40px;
}
.shape-properties input[type='range'] {
  width: 80px;
}
.shape-properties .text-property input {
  width: 170px;
}
.delete-shape {
  color: #b43d42;
  margin-left: auto;
}
.properties-empty {
  padding: 15px 16px;
  font-size: 11px;
  color: #8791a1;
}
</style>
