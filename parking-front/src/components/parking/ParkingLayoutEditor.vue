<template>
  <div
    :class="['layout-editor', { 'fit-viewport': fitToViewport }]"
    tabindex="0"
    @keydown="keyboard"
  >
    <header v-if="!readonly" class="editor-intro">
      <div>
        <strong>Layout editor</strong>
        <p>
          Draw a parking slot, then drag it into place. Drag an empty area or Shift-click to select
          multiple elements.
        </p>
      </div>
      <div class="save-controls">
        <label
          ><input
            type="checkbox"
            role="switch"
            aria-label="Autosave this floor"
            :checked="autosave"
            @change="emit('autosave', ($event.target as HTMLInputElement).checked)"
          />
          Autosave</label
        >
        <button class="primary" :disabled="!dirty && !saveFailed" @click="emit('save')">
          <Save :size="15" />Save now
        </button>
        <span :class="{ failed: saveFailed }" role="status">{{ saveMessage }}</span>
      </div>
    </header>
    <div class="editor-toolbar">
      <div v-if="!readonly" class="tools" aria-label="Layout drawing tools">
        <button
          v-for="item in tools"
          :key="item.id"
          :aria-label="item.label"
          :aria-pressed="tool === item.id"
          :class="{ active: tool === item.id }"
          :title="item.hint"
          @click="tool = item.id"
        >
          <component :is="item.icon" :size="17" />{{ item.label }}
        </button>
      </div>
      <div v-if="!readonly" class="history">
        <button
          aria-label="Undo layout change"
          title="Undo (Ctrl+Z)"
          :disabled="!past.length"
          @click="undo"
        >
          <Undo2 :size="17" />
        </button>
        <button
          aria-label="Redo layout change"
          title="Redo (Ctrl+Shift+Z)"
          :disabled="!future.length"
          @click="redo"
        >
          <Redo2 :size="17" />
        </button>
        <button
          aria-label="Duplicate selection"
          title="Duplicate (Ctrl+D)"
          :disabled="!selection.size"
          @click="duplicate"
        >
          <Copy :size="17" />
        </button>
        <button
          aria-label="Delete selection"
          title="Delete selected elements"
          :disabled="!selection.size"
          @click="deleteSelection"
        >
          <Trash2 :size="17" />
        </button>
        <label><input type="checkbox" v-model="snap" />Snap to grid</label>
      </div>
      <div class="zoom-tools">
        <button aria-label="Zoom out" @click="zoom = Math.max(25, zoom - 25)">
          <Minus :size="16" />
        </button>
        <button
          :aria-label="fitToViewport ? 'Fit map to screen' : 'Fit map to width'"
          :title="fitToViewport ? 'Fit entire map' : 'Fit map to width'"
          @click="resetZoom"
        >
          {{ zoom }}%
        </button>
        <button aria-label="Zoom in" @click="zoom = Math.min(250, zoom + 25)">
          <Plus :size="16" />
        </button>
      </div>
    </div>
    <div v-if="!readonly" class="editor-help">
      <MousePointer2 :size="15" /><span>{{ toolHint }}</span
      ><kbd>Ctrl+C/X/V | Ctrl+Z/Y | Shift+wheel Pan | Ctrl+wheel Zoom</kbd>
    </div>
    <div v-if="!readonly" class="properties" aria-label="Selected element properties">
      <template v-if="singleBox">
        <strong>{{ selectedSlot ? slotDisplayName(selectedSlot) : 'Selected element' }}</strong>
        <label v-for="field in fields" :key="field"
          >{{ field
          }}<input
            type="number"
            :aria-label="`Element ${field}`"
            :value="Math.round(singleBox[field])"
            @change="editGeometry(field, $event)"
        /></label>
        <label v-if="selectedShape?.type === 'text'"
          >Text<input
            aria-label="Shape text"
            :value="selectedShape.text"
            maxlength="100"
            @change="patchShape({ text: ($event.target as HTMLInputElement).value })"
        /></label>
        <label v-if="selectedShape"
          >Color<input
            type="color"
            aria-label="Shape color"
            :value="selectedShape.color"
            @change="patchShape({ color: ($event.target as HTMLInputElement).value })"
        /></label>
      </template>
      <span v-else>Select an element to change its size and position.</span>
    </div>
    <div v-if="!readonly" class="background-tools">
      <button @click="backgroundInput?.click()" :disabled="imageLoading">
        <ImagePlus :size="16" />{{
          state.layout.background ? 'Change floor plan image' : 'Add floor plan image'
        }}
      </button>
      <span v-if="state.layout.background">{{ state.layout.background.name }}</span>
      <button
        v-if="state.layout.background"
        @click="commit({ ...state, layout: { ...state.layout, background: null } })"
      >
        Remove image
      </button>
      <input
        ref="backgroundInput"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        class="hidden"
        aria-label="Upload floor plan image"
        @change="uploadBackground"
      />
    </div>
    <p v-if="error" role="alert" class="editor-error">{{ error }}</p>
    <div
      ref="scrollArea"
      class="canvas-scroll"
      :class="{ panning: spaceHeld || tool === 'pan' }"
      @wheel="wheel"
    >
      <svg
        ref="canvas"
        class="layout-canvas"
        :style="canvasStyle"
        :viewBox="canvasViewBox"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        :aria-label="readonly ? 'Parking Preview' : 'Editable parking floor plan'"
        tabindex="0"
        @pointerdown="beginCanvas"
        @pointermove="movePointer"
        @pointerup="finishPointer"
        @pointercancel="cancelPointer"
        @keydown.space.prevent="spaceHeld = true"
        @keyup.space="spaceHeld = false"
        @blur="spaceHeld = false"
      >
        <defs>
          <pattern :id="gridId" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e7ebf1" stroke-width="0.6" />
          </pattern>
        </defs>
        <rect width="1000" :height="canvasHeight" fill="#fafbfc" />
        <rect v-if="!readonly" width="1000" :height="canvasHeight" :fill="`url(#${gridId})`" />
        <image
          v-if="state.layout.background"
          :href="state.layout.background.dataUrl"
          width="1000"
          height="700"
          preserveAspectRatio="xMidYMid meet"
          pointer-events="none"
        />
        <g
          v-for="shape in state.layout.shapes"
          :key="shape.id"
          :data-shape="shape.id"
          @pointerdown.stop="beginElement($event, `shape:${shape.id}`)"
        >
          <rect
            v-if="shape.type === 'rectangle'"
            v-bind="shapeGeometry(shape)"
            :fill="shape.color"
            :fill-opacity="shape.opacity"
          />
          <ellipse
            v-else-if="shape.type === 'ellipse'"
            :cx="shapeGeometry(shape).x + shape.width / 2"
            :cy="shapeGeometry(shape).y + shape.height / 2"
            :rx="shape.width / 2"
            :ry="shape.height / 2"
            :fill="shape.color"
            :opacity="shape.opacity"
          />
          <line
            v-else-if="shape.type === 'line'"
            :x1="shapeGeometry(shape).x"
            :y1="shapeGeometry(shape).y + (shape.reverse ? shape.height : 0)"
            :x2="shapeGeometry(shape).x + shapeGeometry(shape).width"
            :y2="shapeGeometry(shape).y + (shape.reverse ? 0 : shapeGeometry(shape).height)"
            :stroke="shape.color"
            stroke-width="5"
            stroke-linecap="round"
          />
          <text
            v-else
            :x="shapeGeometry(shape).x"
            :y="shapeGeometry(shape).y + shape.height * 0.8"
            :font-size="Math.max(12, shape.height * 0.8)"
            :fill="shape.color"
          >
            {{ shape.text }}
          </text>
          <rect
            v-if="!readonly && selection.has(`shape:${shape.id}`)"
            v-bind="shapeGeometry(shape)"
            fill="none"
            stroke="#2563eb"
            stroke-width="2"
            stroke-dasharray="5 3"
            pointer-events="none"
          />
        </g>
        <g
          v-for="slot in state.slots"
          :key="slotKey(slot)"
          :data-layout-slot="slotKey(slot)"
          :data-slot="slot.number"
          :class="['canvas-slot', slot.status, { selected: selection.has(slotKey(slot)) }]"
          :transform="`translate(${slotBox(slot).x} ${slotBox(slot).y})`"
          :opacity="visibleKeys && !visibleKeys.has(slotKey(slot)) ? 0.18 : 1"
          role="button"
          tabindex="0"
          :aria-label="`Slot ${slotDisplayName(slot)}, ${statusLabels[slot.status]}`"
          :aria-pressed="selection.has(slotKey(slot))"
          @pointerdown.stop="beginElement($event, slotKey(slot))"
          @keydown.enter.prevent="selectSlot(slot, $event)"
        >
          <title>{{ slotDisplayName(slot) }} / {{ statusLabels[slot.status] }}</title>
          <rect
            :width="slotBox(slot).width"
            :height="slotBox(slot).height"
            fill="var(--slot-fill)"
            :stroke="selection.has(slotKey(slot)) ? '#2563eb' : 'var(--slot-stroke)'"
            :stroke-width="selection.has(slotKey(slot)) ? 3 : 1.5"
          />
          <text
            :x="slotBox(slot).width / 2"
            :y="slotBox(slot).height / 2 + 4"
            text-anchor="middle"
            :font-size="
              Math.min(
                16,
                Math.max(
                  8,
                  (slotBox(slot).width / Math.max(3, slotDisplayName(slot).length)) * 1.5,
                ),
              )
            "
            font-weight="600"
            fill="var(--slot-stroke)"
            pointer-events="none"
          >
            {{
              slotDisplayName(slot).length > 14
                ? `${slotDisplayName(slot).slice(0, 12)}...`
                : slotDisplayName(slot)
            }}
          </text>
        </g>
        <rect
          v-if="drawingBox"
          v-bind="drawingBox"
          fill="#cbd5e1"
          fill-opacity="0.4"
          stroke="#2563eb"
          stroke-width="2"
          stroke-dasharray="6 4"
          pointer-events="none"
        />
        <rect
          v-if="!readonly && selectionBounds"
          v-bind="selectionBounds"
          fill="none"
          stroke="#2563eb"
          stroke-width="1.5"
          pointer-events="none"
        />
        <rect
          v-if="!readonly && selectionBounds"
          class="resize-grip"
          :x="selectionBounds!.x + selectionBounds!.width - 5"
          :y="selectionBounds!.y + selectionBounds!.height - 5"
          width="10"
          height="10"
          fill="white"
          stroke="#2563eb"
          stroke-width="2"
          aria-label="Resize selected element"
          @pointerdown.stop="beginResize"
        />
        <text
          v-if="!state.slots.length && !state.layout.shapes.length && !state.layout.background"
          x="500"
          y="320"
          text-anchor="middle"
          fill="#94a3b8"
          font-size="18"
          pointer-events="none"
        >
          {{
            readonly
              ? 'Your parking map is empty. Open Layout editor to get started.'
              : 'Choose Parking slot, then drag to draw your first slot.'
          }}
        </text>
      </svg>
    </div>
    <footer class="canvas-caption">
      <span
        >{{ state.slots.length }} slots<span v-if="!readonly">
          / {{ selection.size }} selected</span
        ></span
      ><span>{{
        readonly
          ? 'Same positions and sizes as Layout editor'
          : 'Shift-click: multiple selection | Arrow keys: move | Shift+Arrow: move 10px'
      }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Copy,
  Hand,
  ImagePlus,
  Minus,
  MousePointer2,
  ParkingSquare,
  Plus,
  Redo2,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
} from 'lucide-vue-next'
import { slotKey } from './parkingMapJson'
import {
  defaultSlotBox,
  nextParkingSlot,
  slotDisplayName,
  type LayoutBox,
  type LayoutShape,
  type ParkingLayout,
  type ParkingMapState,
} from './parkingLayout'
import { statusLabels, type PreviewSlot } from './parkingMapPreview'
const props = defineProps<{
  slots: PreviewSlot[]
  modelValue: ParkingLayout
  readonly?: boolean
  fitToViewport?: boolean
  autosave?: boolean
  dirty?: boolean
  saveMessage: string
  saveFailed: boolean
  visibleKeys?: Set<string>
}>()
const emit = defineEmits<{
  change: [state: ParkingMapState]
  'inspect-slot': [slot: PreviewSlot]
  selection: [keys: string[]]
  autosave: [enabled: boolean]
  save: []
}>()
type Tool = 'select' | 'pan' | 'slot' | 'rectangle' | 'line' | 'text'
const tools = [
  {
    id: 'select' as const,
    label: 'Select',
    icon: MousePointer2,
    hint: 'Select, move and resize (V)',
  },
  { id: 'pan' as const, label: 'Pan', icon: Hand, hint: 'Drag to move around the map (H)' },
  {
    id: 'slot' as const,
    label: 'Parking slot',
    icon: ParkingSquare,
    hint: 'Draw a new rectangular parking slot (P)',
  },
  {
    id: 'rectangle' as const,
    label: 'Rectangle',
    icon: Square,
    hint: 'Draw a wall or other map element (R)',
  },
  { id: 'line' as const, label: 'Line', icon: Minus, hint: 'Draw a line (L)' },
  { id: 'text' as const, label: 'Text', icon: Type, hint: 'Add a label (T)' },
]
const tool = ref<Tool>('select'),
  zoom = ref(100),
  snap = ref(true),
  spaceHeld = ref(false)
const toolHint = computed(() =>
  tool.value === 'slot'
    ? 'Drag to draw a parking slot. Its number is generated automatically; new slots start Disabled.'
    : tools.find((item) => item.id === tool.value)?.hint,
)
const state = ref<ParkingMapState>({ slots: props.slots, layout: props.modelValue })
const past = ref<ParkingMapState[]>([]),
  future = ref<ParkingMapState[]>([]),
  selection = ref(new Set<string>())
const canvas = ref<SVGSVGElement | null>(null),
  scrollArea = ref<HTMLDivElement | null>(null),
  backgroundInput = ref<HTMLInputElement | null>(null)
const gridId = `map-grid-${crypto.randomUUID()}`
const error = ref(''),
  imageLoading = ref(false)
let imageVersion = 0
const fields = ['x', 'y', 'width', 'height'] as const
const clone = (value: ParkingMapState): ParkingMapState => JSON.parse(JSON.stringify(value))
const canvasHeight = computed(() =>
  Math.max(
    700,
    props.fitToViewport ? 0 : Math.ceil(state.value.slots.length / 12) * 90 + 60,
    ...(props.fitToViewport
      ? state.value.slots.map((slot, index) => {
          const box = state.value.layout.positions[slotKey(slot)] || defaultSlotBox(index)
          return box.y + box.height + 60
        })
      : []),
    ...Object.values(state.value.layout.positions).map((box) => box.y + box.height + 60),
    ...state.value.layout.shapes.map((shape) => shape.y + shape.height + 60),
  ),
)
const viewportSize = ref({ width: 0, height: 0 })
let viewportObserver: ResizeObserver | undefined
const canvasViewBox = computed(() => {
  if (!props.fitToViewport) return `0 0 1000 ${canvasHeight.value}`
  const boxes = [
    ...state.value.slots.map(
      (slot, index) => state.value.layout.positions[slotKey(slot)] || defaultSlotBox(index),
    ),
    ...state.value.layout.shapes,
    ...(state.value.layout.background ? [{ x: 0, y: 0, width: 1000, height: 700 }] : []),
  ]
  const content = bounds(boxes)
  if (!content) return `0 0 1000 ${canvasHeight.value}`
  const x = Math.max(0, content.x - 12),
    y = Math.max(0, content.y - 12)
  return `${x} ${y} ${Math.max(1, Math.min(1000 - x, content.x + content.width + 12 - x))} ${Math.max(1, content.y + content.height + 12 - y)}`
})
const canvasStyle = computed(() => {
  if (!props.fitToViewport || !viewportSize.value.width || !viewportSize.value.height)
    return { width: `${zoom.value}%` }
  return {
    width: `${(viewportSize.value.width * zoom.value) / 100}px`,
    height: `${(viewportSize.value.height * zoom.value) / 100}px`,
  }
})

function resetZoom() {
  zoom.value = 100
  if (scrollArea.value) {
    scrollArea.value.scrollLeft = 0
    scrollArea.value.scrollTop = 0
  }
}
onMounted(() => {
  if (!props.fitToViewport || !scrollArea.value || typeof ResizeObserver === 'undefined') return
  viewportObserver = new ResizeObserver(([entry]) => {
    if (entry)
      viewportSize.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  viewportObserver.observe(scrollArea.value)
})
const selectedSlot = computed(() =>
  selection.value.size === 1
    ? state.value.slots.find((slot) => selection.value.has(slotKey(slot)))
    : undefined,
)
const selectedShape = computed(() =>
  selection.value.size === 1
    ? state.value.layout.shapes.find((shape) => selection.value.has(`shape:${shape.id}`))
    : undefined,
)
function boxFor(key: string): LayoutBox | undefined {
  if (key.startsWith('shape:'))
    return state.value.layout.shapes.find((shape) => `shape:${shape.id}` === key)
  const index = state.value.slots.findIndex((slot) => slotKey(slot) === key)
  return index < 0 ? undefined : state.value.layout.positions[key] || defaultSlotBox(index)
}
const singleBox = computed(() =>
  selection.value.size === 1 ? displayedBox([...selection.value][0]!) : undefined,
)
function bounds(boxes: LayoutBox[]): LayoutBox | undefined {
  if (!boxes.length) return undefined
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y))
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  }
}
const selectionBounds = computed(() => bounds([...selection.value].map(displayedBox)))
function wheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    const area = scrollArea.value
    if (!area) return
    const rect = area.getBoundingClientRect(),
      old = zoom.value
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top
    zoom.value = Math.max(25, Math.min(250, zoom.value + (event.deltaY < 0 ? 5 : -5)))
    const ratio = zoom.value / old
    nextTick(() => {
      area.scrollLeft = (area.scrollLeft + x) * ratio - x
      area.scrollTop = (area.scrollTop + y) * ratio - y
    })
  } else if (event.shiftKey && scrollArea.value) {
    event.preventDefault()
    scrollArea.value.scrollLeft += event.deltaY || event.deltaX
  }
}
function commit(next: ParkingMapState) {
  if (props.readonly) return
  past.value = [...past.value.slice(-49), clone(state.value)]
  future.value = []
  state.value = next
  emit('change', next)
}
function notifySelection() {
  emit(
    'selection',
    [...selection.value].filter((key) => !key.startsWith('shape:')),
  )
}
function undo() {
  const item = past.value.pop()
  if (!item || props.readonly) return
  future.value.push(clone(state.value))
  state.value = item
  selection.value.clear()
  notifySelection()
  emit('change', item)
}
function redo() {
  const item = future.value.pop()
  if (!item || props.readonly) return
  past.value.push(clone(state.value))
  state.value = item
  selection.value.clear()
  notifySelection()
  emit('change', item)
}
function selectSlot(slot: PreviewSlot, event: KeyboardEvent) {
  choose(slotKey(slot), event.shiftKey || event.ctrlKey || event.metaKey)
  emit('inspect-slot', slot)
}
function choose(key: string, multiple: boolean) {
  if (multiple) {
    if (selection.value.has(key)) selection.value.delete(key)
    else selection.value.add(key)
  } else if (!selection.value.has(key)) selection.value = new Set([key])
  notifySelection()
}
type Gesture = {
  mode: 'move' | 'resize' | 'draw' | 'pan' | 'marquee'
  start: { x: number; y: number }
  pointer: number
  clientStart: { x: number; y: number }
  originals: Record<string, LayoutBox>
  dx: number
  dy: number
  moved: boolean
  scrollX: number
  scrollY: number
}
const gestureState = ref<Gesture | null>(null)
const delta = ref({ x: 0, y: 0 }),
  drawingBox = ref<LayoutBox | null>(null)
function point(event: PointerEvent) {
  const matrix = canvas.value?.getScreenCTM()
  if (!matrix) return { x: 0, y: 0 }
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  return { x: Math.max(0, Math.min(1000, p.x)), y: Math.max(0, Math.min(40000, p.y)) }
}
const rounded = (n: number) => (snap.value ? Math.round(n / 10) * 10 : Math.round(n))
function start(event: PointerEvent, mode: Gesture['mode']) {
  const originals = Object.fromEntries(
    [...selection.value].map((key) => [key, { ...boxFor(key)! }]),
  )
  gestureState.value = {
    mode,
    start: mode === 'pan' ? { x: event.clientX, y: event.clientY } : point(event),
    pointer: event.pointerId,
    clientStart: { x: event.clientX, y: event.clientY },
    originals,
    dx: 0,
    dy: 0,
    moved: false,
    scrollX: scrollArea.value?.scrollLeft || 0,
    scrollY: scrollArea.value?.scrollTop || 0,
  }
  canvas.value?.setPointerCapture(event.pointerId)
  event.preventDefault()
  canvas.value?.focus({ preventScroll: true })
}
function beginCanvas(event: PointerEvent) {
  if (event.button !== 0 || gestureState.value) return
  if (spaceHeld.value || tool.value === 'pan') {
    start(event, 'pan')
    return
  }
  if (!event.shiftKey) selection.value.clear()
  notifySelection()
  if (props.readonly) return
  if (tool.value === 'select') {
    start(event, 'marquee')
    return
  }
  if (tool.value === 'text') {
    const p = point(event)
    const shape: LayoutShape = {
      id: crypto.randomUUID(),
      type: 'text',
      x: Math.min(850, rounded(p.x)),
      y: rounded(p.y),
      width: 140,
      height: 26,
      color: '#334155',
      opacity: 1,
      text: 'Label',
    }
    commit({
      ...state.value,
      layout: { ...state.value.layout, shapes: [...state.value.layout.shapes, shape] },
    })
    selection.value = new Set([`shape:${shape.id}`])
    tool.value = 'select'
    return
  }
  start(event, 'draw')
}
function beginElement(event: PointerEvent, key: string) {
  if (event.button !== 0 || gestureState.value) return
  if (spaceHeld.value || tool.value === 'pan') {
    start(event, 'pan')
    return
  }
  if (!props.readonly && tool.value !== 'select') {
    beginCanvas(event)
    return
  }
  choose(key, event.shiftKey || event.ctrlKey || event.metaKey)
  const slot = state.value.slots.find((item) => slotKey(item) === key)
  if (slot) emit('inspect-slot', slot)
  if (!props.readonly && selection.value.has(key)) start(event, 'move')
}
function beginResize(event: PointerEvent) {
  if (!props.readonly && selection.value.size) start(event, 'resize')
}
function displayedBox(key: string): LayoutBox {
  const box = boxFor(key) || defaultSlotBox(0)
  if (!gestureState.value?.originals[key] || !gestureState.value.moved) return box
  const original = gestureState.value.originals[key]!
  if (gestureState.value.mode === 'resize') {
    const group = bounds(Object.values(gestureState.value.originals))!
    const minWidth =
      Math.min(...Object.values(gestureState.value.originals).map((b) => b.width)) || 1
    const minHeight =
      Math.min(...Object.values(gestureState.value.originals).map((b) => b.height)) || 1
    const sx = Math.max(
      20 / minWidth,
      Math.min((1000 - group.x) / group.width, (group.width + delta.value.x) / group.width),
    )
    const sy = Math.max(
      20 / minHeight,
      Math.min((40000 - group.y) / group.height, (group.height + delta.value.y) / group.height),
    )
    return {
      x: group.x + (original.x - group.x) * sx,
      y: group.y + (original.y - group.y) * sy,
      width: original.width * sx,
      height: original.height * sy,
    }
  }
  if (gestureState.value.mode === 'move')
    return { ...original, x: original.x + delta.value.x, y: original.y + delta.value.y }
  return box
}
function slotBox(slot: PreviewSlot) {
  return displayedBox(slotKey(slot))
}
function shapeGeometry(shape: LayoutShape) {
  const box = displayedBox(`shape:${shape.id}`)
  return { x: box.x, y: box.y, width: box.width, height: box.height }
}
function movePointer(event: PointerEvent) {
  if (!gestureState.value || gestureState.value.pointer !== event.pointerId) return
  if (gestureState.value.mode === 'pan') {
    if (scrollArea.value) {
      scrollArea.value.scrollLeft =
        gestureState.value.scrollX - (event.clientX - gestureState.value.start.x)
      scrollArea.value.scrollTop =
        gestureState.value.scrollY - (event.clientY - gestureState.value.start.y)
    }
    return
  }
  if (
    !gestureState.value.moved &&
    Math.abs(event.clientX - gestureState.value.clientStart.x) +
      Math.abs(event.clientY - gestureState.value.clientStart.y) <=
      3
  )
    return
  const p = point(event)
  let dx = p.x - gestureState.value.start.x,
    dy = p.y - gestureState.value.start.y
  if (event.shiftKey && gestureState.value.mode === 'move') {
    if (Math.abs(dx) > Math.abs(dy)) dy = 0
    else dx = 0
  }
  if (Math.abs(dx) + Math.abs(dy) > 3) gestureState.value.moved = true
  if (gestureState.value.mode === 'move') {
    const boxes = Object.values(gestureState.value.originals)
    if (boxes.length) {
      dx = Math.max(
        -Math.min(...boxes.map((b) => b.x)),
        Math.min(1000 - Math.max(...boxes.map((b) => b.x + b.width)), rounded(dx)),
      )
      dy = Math.max(
        -Math.min(...boxes.map((b) => b.y)),
        Math.min(40000 - Math.max(...boxes.map((b) => b.y + b.height)), rounded(dy)),
      )
    }
  }
  delta.value = { x: rounded(dx), y: rounded(dy) }
  gestureState.value.dx = dx
  gestureState.value.dy = dy
  if (gestureState.value.mode === 'draw' || gestureState.value.mode === 'marquee') {
    const x = Math.min(980, rounded(Math.min(p.x, gestureState.value.start.x)))
    const y = Math.min(39980, rounded(Math.min(p.y, gestureState.value.start.y)))
    drawingBox.value = {
      x,
      y,
      width: Math.min(1000 - x, Math.max(20, rounded(Math.abs(dx)))),
      height: Math.min(40000 - y, Math.max(20, rounded(Math.abs(dy)))),
    }
  }
}
function applyBoxes(boxes: Record<string, LayoutBox>) {
  const layout = {
    ...state.value.layout,
    positions: { ...state.value.layout.positions },
    shapes: state.value.layout.shapes.map((shape) =>
      boxes[`shape:${shape.id}`] ? { ...shape, ...boxes[`shape:${shape.id}`] } : shape,
    ),
  }
  for (const [key, box] of Object.entries(boxes))
    if (!key.startsWith('shape:')) layout.positions[key] = box
  commit({ ...state.value, layout })
}
function finishPointer(event: PointerEvent) {
  if (!gestureState.value || gestureState.value.pointer !== event.pointerId) return
  movePointer(event)
  if (gestureState.value.mode === 'marquee' && drawingBox.value) {
    const region = drawingBox.value
    const keys = [
      ...state.value.slots.map(slotKey),
      ...state.value.layout.shapes.map((shape) => `shape:${shape.id}`),
    ]
    const chosen = event.shiftKey ? new Set(selection.value) : new Set<string>()
    for (const key of keys) {
      const box = boxFor(key)!
      if (
        box.x <= region.x + region.width &&
        box.x + box.width >= region.x &&
        box.y <= region.y + region.height &&
        box.y + box.height >= region.y
      )
        chosen.add(key)
    }
    selection.value = chosen
    notifySelection()
  } else if (gestureState.value.moved && gestureState.value.mode === 'draw' && drawingBox.value) {
    const box = drawingBox.value
    if (tool.value === 'slot') {
      if (state.value.slots.length >= 5000) {
        error.value = 'A map supports up to 5000 slots.'
        cancelPointer()
        return
      }
      const slot = nextParkingSlot(state.value.slots)
      commit({
        slots: [...state.value.slots, slot],
        layout: {
          ...state.value.layout,
          positions: { ...state.value.layout.positions, [slotKey(slot)]: box },
        },
      })
      selection.value = new Set([slotKey(slot)])
      emit('inspect-slot', slot)
      notifySelection()
    } else if (tool.value === 'rectangle' || tool.value === 'line') {
      if (state.value.layout.shapes.length >= 300) {
        error.value = 'A map supports up to 300 elements.'
        cancelPointer()
        return
      }
      const shape: LayoutShape = {
        id: crypto.randomUUID(),
        type: tool.value,
        ...box,
        color: '#64748b',
        opacity: tool.value === 'line' ? 1 : 0.3,
        text: '',
        reverse: gestureState.value.dx * gestureState.value.dy < 0,
      }
      commit({
        ...state.value,
        layout: { ...state.value.layout, shapes: [...state.value.layout.shapes, shape] },
      })
      selection.value = new Set([`shape:${shape.id}`])
      notifySelection()
    }
    tool.value = 'select'
  } else if (
    gestureState.value.moved &&
    (gestureState.value.mode === 'move' || gestureState.value.mode === 'resize')
  ) {
    const boxes = Object.fromEntries(
      Object.keys(gestureState.value.originals).map((key) => [key, { ...displayedBox(key) }]),
    )
    cancelPointer()
    applyBoxes(boxes)
    return
  }
  cancelPointer()
}
function cancelPointer() {
  if (gestureState.value && canvas.value?.hasPointerCapture(gestureState.value.pointer))
    canvas.value.releasePointerCapture(gestureState.value.pointer)
  gestureState.value = null
  delta.value = { x: 0, y: 0 }
  drawingBox.value = null
}
function deleteSelection() {
  if (props.readonly || !selection.value.size) return
  const positions = { ...state.value.layout.positions }
  for (const key of selection.value) delete positions[key]
  commit({
    slots: state.value.slots.filter((slot) => !selection.value.has(slotKey(slot))),
    layout: {
      ...state.value.layout,
      positions,
      shapes: state.value.layout.shapes.filter(
        (shape) => !selection.value.has(`shape:${shape.id}`),
      ),
    },
  })
  selection.value.clear()
  notifySelection()
}
const clipboard = ref<{ slot?: PreviewSlot; shape?: LayoutShape; box: LayoutBox }[]>([])
function copySelection() {
  clipboard.value = [...selection.value].flatMap((key) => {
    const box = boxFor(key)
    if (!box) return []
    const slot = state.value.slots.find((s) => slotKey(s) === key)
    const shape = state.value.layout.shapes.find((s) => `shape:${s.id}` === key)
    return [
      {
        box: { ...box },
        ...(slot ? { slot: { ...slot } } : {}),
        ...(shape ? { shape: { ...shape } } : {}),
      },
    ]
  })
}
function pasteSelection() {
  if (props.readonly || !clipboard.value.length) return
  const next = clone(state.value),
    chosen: string[] = []
  for (const item of clipboard.value) {
    const moved = {
      ...item.box,
      x: Math.min(1000 - item.box.width, item.box.x + 20),
      y: Math.min(40000 - item.box.height, item.box.y + 20),
    }
    if (item.shape && next.layout.shapes.length < 300) {
      const shape = { ...item.shape, ...moved, id: crypto.randomUUID() }
      next.layout.shapes.push(shape)
      chosen.push(`shape:${shape.id}`)
    } else if (item.slot && next.slots.length < 5000) {
      const slot = nextParkingSlot(next.slots)
      next.slots.push(slot)
      next.layout.positions[slotKey(slot)] = moved
      chosen.push(slotKey(slot))
    }
  }
  commit(next)
  selection.value = new Set(chosen)
  notifySelection()
}
function duplicate() {
  copySelection()
  pasteSelection()
}
function editGeometry(field: keyof LayoutBox, event: Event) {
  const key = [...selection.value][0],
    box = singleBox.value,
    n = Number((event.target as HTMLInputElement).value)
  if (!key || !box || !Number.isFinite(n)) return
  const next = {
    ...box,
    [field]: Math.max(field === 'width' || field === 'height' ? 20 : 0, Math.round(n)),
  }
  next.width = Math.min(1000, next.width)
  next.x = Math.min(1000 - next.width, next.x)
  next.height = Math.min(40000, next.height)
  next.y = Math.min(40000 - next.height, next.y)
  applyBoxes({ [key]: next })
}
function patchShape(patch: Partial<LayoutShape>) {
  if (!selectedShape.value) return
  commit({
    ...state.value,
    layout: {
      ...state.value.layout,
      shapes: state.value.layout.shapes.map((shape) =>
        shape.id === selectedShape.value!.id ? { ...shape, ...patch } : shape,
      ),
    },
  })
}
function keyboard(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && !props.readonly) {
    event.preventDefault()
    emit('save')
    return
  }
  if ((event.target as HTMLElement).closest('input, textarea, select')) return
  if (event.key === 'Escape') {
    cancelPointer()
    selection.value.clear()
    notifySelection()
    tool.value = 'select'
    return
  }
  if (props.readonly) return
  if (event.ctrlKey || event.metaKey) {
    const key = event.key.toLowerCase()
    if (['z', 'y', 'd', 's', 'a', 'c', 'v', 'x'].includes(key)) event.preventDefault()
    if (key === 'z') event.shiftKey ? redo() : undo()
    if (key === 'y') redo()
    if (key === 'd') duplicate()
    if (key === 'c') copySelection()
    if (key === 'v') pasteSelection()
    if (key === 'x') {
      copySelection()
      deleteSelection()
    }
    if (key === 's') emit('save')
    if (key === 'a') {
      selection.value = new Set([
        ...state.value.slots.map(slotKey),
        ...state.value.layout.shapes.map((shape) => `shape:${shape.id}`),
      ])
      notifySelection()
    }
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    deleteSelection()
    return
  }
  const shortcuts: Record<string, Tool> = {
    v: 'select',
    h: 'pan',
    p: 'slot',
    r: 'rectangle',
    l: 'line',
    t: 'text',
  }
  if (shortcuts[event.key.toLowerCase()]) tool.value = shortcuts[event.key.toLowerCase()]!
  if (event.key.startsWith('Arrow') && selection.value.size) {
    event.preventDefault()
    const step = event.shiftKey ? 10 : 1
    const boxes = Object.fromEntries(
      [...selection.value].map((key) => {
        const box = boxFor(key)!
        return [
          key,
          {
            ...box,
            x: Math.max(
              0,
              Math.min(
                1000 - box.width,
                box.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0),
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                40000 - box.height,
                box.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0),
              ),
            ),
          },
        ]
      }),
    )
    applyBoxes(boxes)
  }
}
async function uploadBackground(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  if (!file || props.readonly) return
  const version = ++imageVersion
  imageLoading.value = true
  error.value = ''
  try {
    if (
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error('Choose a PNG, JPG or WebP image up to 2 MB.')
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Unable to read image.'))
      reader.readAsDataURL(file)
    })
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    if (version === imageVersion)
      commit({
        ...state.value,
        layout: { ...state.value.layout, background: { name: file.name, dataUrl } },
      })
  } catch (cause) {
    if (version === imageVersion)
      error.value = cause instanceof Error ? cause.message : 'Unable to load image.'
  } finally {
    if (version === imageVersion) imageLoading.value = false
  }
}
watch(
  () => [props.modelValue, props.slots] as const,
  () => {
    if (props.modelValue === state.value.layout && props.slots === state.value.slots) return
    cancelPointer()
    past.value = [...past.value.slice(-49), clone(state.value)]
    future.value = []
    state.value = { slots: props.slots, layout: props.modelValue }
    selection.value = new Set([...selection.value].filter((key) => boxFor(key)))
    notifySelection()
  },
)
watch(
  () => props.readonly,
  () => {
    cancelPointer()
    spaceHeld.value = false
    tool.value = 'select'
  },
)
onBeforeUnmount(() => {
  viewportObserver?.disconnect()
  ++imageVersion
  cancelPointer()
})
</script>

<style scoped>
.layout-editor {
  color: #475569;
  background: white;
  border-top: 1px solid #e2e8f0;
}
.editor-intro,
.editor-toolbar,
.editor-help,
.properties,
.background-tools,
.canvas-caption {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  flex-wrap: wrap;
  border-bottom: 1px solid #edf0f4;
}
.editor-intro {
  justify-content: space-between;
}
.editor-intro strong {
  color: #1e293b;
  font-size: 15px;
}
.editor-intro p {
  font-size: 12px;
  margin: 5px 0 0;
  color: #64748b;
}
.save-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
}
.save-controls > span {
  color: #16723b;
}
.save-controls .failed {
  color: #b42318;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  cursor: pointer;
  color: #475569;
}
button:hover {
  background: #f1f5f9;
}
button.active,
button.primary {
  color: white;
  background: #26354a;
  border-color: #26354a;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
button:focus-visible,
input:focus-visible,
svg:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.tools,
.history,
.zoom-tools {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}
.zoom-tools {
  margin-left: auto;
}
label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}
.editor-help {
  font-size: 12px;
  background: #f8fafc;
}
kbd {
  margin-left: auto;
  font-family: inherit;
  font-size: 11px;
  color: #64748b;
}
.properties {
  background: #f8faff;
  font-size: 12px;
  height: 64px;
  box-sizing: border-box;
  overflow: auto;
  align-content: center;
}
.properties input[type='number'] {
  width: 64px;
}
.properties input {
  border: 1px solid #dbe2eb;
  border-radius: 4px;
  padding: 5px;
  background: white;
}
.properties input[type='color'] {
  width: 35px;
  height: 30px;
}
.background-tools {
  font-size: 12px;
}
.hidden {
  display: none;
}
.canvas-scroll {
  overflow: auto;
  max-height: 70vh;
  min-height: 380px;
  overscroll-behavior: contain;
  background-color: #fafbfc;
  background-image:
    linear-gradient(#e7ebf1 1px, transparent 1px),
    linear-gradient(90deg, #e7ebf1 1px, transparent 1px);
  background-size: 10px 10px;
}
.layout-canvas {
  display: block;
  min-width: 0;
  touch-action: none;
  user-select: none;
}
.fit-viewport {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.fit-viewport .canvas-scroll {
  flex: 1;
  min-height: 0;
  max-height: none;
  background: #fafbfc;
}
.fit-viewport .layout-canvas {
  margin: 0 auto;
}
.fit-viewport .editor-toolbar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  padding: 4px;
  border: 0;
  border-radius: 8px;
  background: #ffffffed;
}
.fit-viewport .canvas-caption {
  display: none;
}
.fit-viewport .canvas-caption > span:last-child {
  display: none;
}
.panning svg {
  cursor: grab;
}
.resize-grip {
  cursor: nwse-resize;
}
.canvas-slot {
  cursor: pointer;
  --slot-fill: #f1f5f9;
  --slot-stroke: #64748b;
}
.canvas-slot.available {
  --slot-fill: #e7f7ee;
  --slot-stroke: #15803d;
}
.canvas-slot.occupied {
  --slot-fill: #fce9e9;
  --slot-stroke: #c23b45;
}
.canvas-slot.incoming {
  --slot-fill: #fff5df;
  --slot-stroke: #a36507;
}
.canvas-slot.disabled {
  --slot-fill: #e8ecf1;
  --slot-stroke: #6b7280;
}
.canvas-slot.selected {
  filter: drop-shadow(0 2px 3px #2563eb33);
}
.canvas-caption {
  justify-content: space-between;
  font-size: 11px;
  color: #64748b;
}
.editor-error {
  color: #b42318;
  padding: 10px 18px;
}
@media (max-width: 700px) {
  .editor-intro,
  .editor-toolbar,
  .properties {
    padding: 12px;
  }
  .editor-help kbd {
    display: none;
  }
  .tools button {
    padding: 9px;
  }
  .canvas-scroll {
    max-height: 60vh;
  }
  .save-controls {
    width: 100%;
  }
}
</style>
