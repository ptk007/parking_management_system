import type { PreviewSlot, SlotStatus } from './parkingMapPreview'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024
const MAX_SLOTS = 5000
type JsonObject = Record<string, unknown>
const object = (value: unknown): value is JsonObject =>
  !!value && typeof value === 'object' && !Array.isArray(value)
export const slotKey = (slot: Pick<PreviewSlot, 'zone' | 'number'>) =>
  JSON.stringify([slot.zone, slot.number])

function statusOf(value: unknown): SlotStatus {
  if (value === undefined) return 'available'
  if (typeof value !== 'string') throw new Error('Slot status must be text.')
  const status = value.trim().toLowerCase()
  if (status === 'disable') return 'disabled'
  if (
    status === 'available' ||
    status === 'occupied' ||
    status === 'incoming' ||
    status === 'disabled'
  )
    return status
  throw new Error(`Unknown status "${value}". Use available, occupied, incoming or disabled.`)
}

function slotOf(value: unknown, defaultZone?: string): PreviewSlot {
  if (!object(value)) throw new Error('Each slot must be a JSON object.')
  const rawNumber = value.number ?? value.slotNumber ?? value.slot_num ?? value.slot ?? value.name
  let number: number
  let inferredZone = defaultZone || 'A'
  if (typeof rawNumber === 'number') number = rawNumber
  else if (typeof rawNumber === 'string') {
    const text = rawNumber.trim()
    const named = text.match(/^zone(.+?)[_-]slot(\d+)$/i) || text.match(/^([a-zA-Z]+)[_-]?(\d+)$/)
    if (named) {
      inferredZone = named[1]!
      number = Number(named[2])
    } else if (/^\d+$/.test(text)) number = Number(text)
    else throw new Error(`Invalid slot number "${text}".`)
  } else throw new Error('Each slot needs number, slotNumber, slot_num or slot.')
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error('Slot numbers must be positive whole numbers.')
  const zone = value.zone ?? inferredZone
  if (
    typeof zone !== 'string' ||
    !zone.trim() ||
    zone.trim().length > 64 ||
    zone.trim() === 'All'
  ) {
    throw new Error('Zone must be non-empty text (up to 64 characters, other than "All").')
  }
  return { number, zone: zone.trim(), status: statusOf(value.status ?? value.slot_status) }
}

export function validateSlots(slots: PreviewSlot[]): PreviewSlot[] {
  if (!slots.length) throw new Error('No parking slots found in this file.')
  if (slots.length > MAX_SLOTS) throw new Error(`A map supports up to ${MAX_SLOTS} slots.`)
  const seen = new Set<string>()
  for (const slot of slots) {
    const key = slotKey(slot)
    if (seen.has(key))
      throw new Error(
        `Duplicate slot ${slot.zone} / ${slot.number}. Each slot must be unique within its zone.`,
      )
    seen.add(key)
  }
  return slots
}

function readMap(value: unknown): PreviewSlot[] {
  if (Array.isArray(value)) return value.map((item) => slotOf(item))
  if (!object(value)) throw new Error('Expected a parking map object or a list of slots.')
  if (Array.isArray(value.slots)) return value.slots.map((item) => slotOf(item))
  if (Array.isArray(value.parking_slots)) return value.parking_slots.map((item) => slotOf(item))

  // COCO exports may repeat a slot across training images. Use each referenced category once.
  if (Array.isArray(value.categories) && Array.isArray(value.annotations)) {
    const referenced = new Set(value.annotations.filter(object).map((item) => item.category_id))
    const categories = value.categories
      .filter(object)
      .filter(
        (item) =>
          referenced.has(item.id) &&
          typeof item.name === 'string' &&
          /^zone.+?[_-]slot\d+$/i.test(item.name),
      )
    return categories.map((item) => slotOf({ slot: item.name }))
  }
  if (object(value.rows)) {
    const statuses = object(value.slotStatus) ? value.slotStatus : {}
    const slots: PreviewSlot[] = []
    for (const [zone, row] of Object.entries(value.rows)) {
      if (!object(row) || !Array.isArray(row.positions))
        throw new Error(`Zone ${zone} needs a positions array.`)
      for (const position of row.positions) {
        if (!object(position)) throw new Error(`Invalid position in zone ${zone}.`)
        slots.push(slotOf({ ...position, zone, status: statuses[String(position.slot)] }))
      }
    }
    if (value.totalSlots !== undefined && value.totalSlots !== slots.length)
      throw new Error('totalSlots does not match the number of slots in rows.')
    return slots
  }
  // Legacy dashboard files wrap one map inside building / floor keys.
  const nested = Object.values(value)
    .filter(object)
    .flatMap((building) =>
      object(building.rows)
        ? [building]
        : Object.values(building).filter((item) => object(item) && object(item.rows)),
    )
  if (nested.length === 1) return readMap(nested[0])
  if (nested.length > 1)
    throw new Error('This file contains multiple floors. Import one floor at a time.')
  throw new Error(
    'Unsupported JSON. Use a slots list, dashboard rows or a COCO parking-slot export.',
  )
}

export function parseParkingMapJson(text: string): PreviewSlot[] {
  let value: unknown
  try {
    value = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('Invalid JSON. Check commas, quotes and brackets in the file.')
  }
  return validateSlots(readMap(value))
}
