import parkingSlotData from '@/data/parking-slots.json'
import { parseParkingMapJson } from './parkingMapJson'
import { restoreParkingLayout, type ParkingLayout } from './parkingLayout'

export type SlotStatus = 'available' | 'occupied' | 'incoming' | 'disabled'
export interface PreviewSlot {
  name?: string
  number: number
  zone: string
  status: SlotStatus
}

// Row boundaries follow the existing ReferenceParkingMap floor plan.
export const previewZones = [
  { name: 'A', start: 1, end: 26 },
  { name: 'B', start: 27, end: 49 },
  { name: 'C', start: 50, end: 72 },
  { name: 'D', start: 73, end: 94 },
  { name: 'E', start: 95, end: 104 },
  { name: 'F', start: 105, end: 124 },
]

export const statusLabels: Record<SlotStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  incoming: 'Incoming',
  disabled: 'Disabled',
}

export const isEditableSlot = (slot: PreviewSlot) =>
  slot.status === 'available' || slot.status === 'disabled'

export function createPreviewSlots(): PreviewSlot[] {
  const statuses = parkingSlotData.E4.floor4.slotStatus as Record<string, string>
  return previewZones.flatMap((zone) =>
    Array.from({ length: zone.end - zone.start + 1 }, (_, index) => {
      const number = zone.start + index
      const source = statuses[String(number)]
      const status: SlotStatus =
        source === 'occupied' || source === 'incoming' || source === 'disabled'
          ? source
          : 'available'
      return { number, zone: zone.name, status }
    }),
  )
}

export function restorePreviewDraft(raw: string | null): PreviewSlot[] {
  const slots = createPreviewSlots()
  if (!raw) return slots
  const draft: unknown = JSON.parse(raw)
  if (draft && typeof draft === 'object' && 'version' in draft && draft.version === 2) {
    if ('slots' in draft && Array.isArray(draft.slots) && !draft.slots.length) return []
    return parseParkingMapJson(JSON.stringify(draft))
  }
  if (
    !draft ||
    typeof draft !== 'object' ||
    !('version' in draft) ||
    draft.version !== 1 ||
    !('statuses' in draft) ||
    !draft.statuses ||
    typeof draft.statuses !== 'object'
  ) {
    throw new Error('Invalid parking map draft')
  }
  const statuses = draft.statuses as Record<string, unknown>
  for (const slot of slots) {
    const status = statuses[String(slot.number)]
    // Drafts can only enable/disable editable slots; occupancy stays in the sample data.
    if (isEditableSlot(slot) && (status === 'available' || status === 'disabled'))
      slot.status = status
  }
  return slots
}

export function restoreMapDraft(raw: string | null): {
  slots: PreviewSlot[]
  sourceName: string
  layout: ParkingLayout
} {
  const slots = restorePreviewDraft(raw)
  const draft = raw ? JSON.parse(raw) : null
  return {
    slots,
    layout: restoreParkingLayout(draft?.layout),
    sourceName:
      draft?.version === 2 && typeof draft.sourceName === 'string'
        ? draft.sourceName.slice(0, 1000)
        : 'E4 sample',
  }
}
