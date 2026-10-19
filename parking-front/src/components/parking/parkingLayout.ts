export interface LayoutBox {
  x: number
  y: number
  width: number
  height: number
}
export interface LayoutShape extends LayoutBox {
  id: string
  type: 'rectangle' | 'ellipse' | 'line' | 'text'
  color: string
  opacity: number
  text: string
  reverse?: boolean
}
export interface ParkingLayout {
  background: { name: string; dataUrl: string } | null
  shapes: LayoutShape[]
  positions: Record<string, LayoutBox>
}
export const emptyParkingLayout = (): ParkingLayout => ({
  background: null,
  shapes: [],
  positions: {},
})

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const box = (value: unknown): value is LayoutBox =>
  record(value) &&
  finite(value.x, 0, 1000) &&
  finite(value.y, 0, 40000) &&
  finite(value.width, 0, 1000) &&
  finite(value.height, 0, 40000)

export function restoreParkingLayout(value: unknown): ParkingLayout {
  if (value === undefined || value === null) return emptyParkingLayout()
  if (
    !record(value) ||
    !Array.isArray(value.shapes) ||
    value.shapes.length > 300 ||
    !record(value.positions)
  ) {
    throw new Error('Invalid saved layout.')
  }
  const result = emptyParkingLayout()
  if (value.background !== null && value.background !== undefined) {
    const bg = value.background
    if (
      !record(bg) ||
      typeof bg.name !== 'string' ||
      typeof bg.dataUrl !== 'string' ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(bg.dataUrl) ||
      bg.dataUrl.length > 2800000
    ) {
      throw new Error('Invalid saved floor plan image.')
    }
    result.background = { name: bg.name.slice(0, 255), dataUrl: bg.dataUrl }
  }
  const ids = new Set<string>()
  for (const item of value.shapes) {
    if (
      !record(item) ||
      !box(item) ||
      typeof item.id !== 'string' ||
      ids.has(item.id) ||
      !['rectangle', 'ellipse', 'line', 'text'].includes(String(item.type)) ||
      typeof item.color !== 'string' ||
      !/^#[\da-f]{6}$/i.test(item.color) ||
      !finite(item.opacity, 0.05, 1) ||
      typeof item.text !== 'string' ||
      item.text.length > 100
    ) {
      throw new Error('Invalid saved shape.')
    }
    ids.add(item.id)
    result.shapes.push({
      id: item.id,
      type: item.type as LayoutShape['type'],
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      color: item.color,
      opacity: item.opacity,
      text: item.text,
      reverse: item.reverse === true,
    })
  }
  for (const [key, item] of Object.entries(value.positions)) {
    if (!box(item)) throw new Error('Invalid saved slot position.')
    // Keys are generated from [zone, number], never used as object prototype properties.
    if (!key.startsWith('[') || key.length > 100) throw new Error('Invalid saved slot key.')
    result.positions[key] = { x: item.x, y: item.y, width: item.width, height: item.height }
  }
  return result
}
