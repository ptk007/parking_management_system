import { describe, expect, it } from 'vitest'
import { parseParkingMapJson, slotKey, validateSlots } from '@/components/parking/parkingMapJson'
import { restoreMapDraft } from '@/components/parking/parkingMapPreview'
import legacy from '@/data/parking-slots.json'
import coco from '../../../python-v2/parking_slots/E4_zoneA_cars.json'

describe('parking map JSON import', () => {
  it('reads slots with shared numbers across zones and normalizes statuses', () => {
    const slots = parseParkingMapJson(
      JSON.stringify({
        slots: [
          { number: 1, zone: 'North', status: 'Available' },
          { slot_num: 'B01', slot_status: 'Disable' },
          { slot: 'zoneC_slot02' },
        ],
      }),
    )
    expect(slots).toEqual([
      { number: 1, zone: 'North', status: 'available' },
      { number: 1, zone: 'B', status: 'disabled' },
      { number: 2, zone: 'C', status: 'available' },
    ])
    expect(new Set(slots.map(slotKey)).size).toBe(3)
  })

  it('reads the existing dashboard JSON and Roboflow export from the project', () => {
    const slots = parseParkingMapJson(JSON.stringify(legacy))
    expect(slots).toHaveLength(124)
    expect(slots.find((slot) => slot.number === 4)?.status).toBe('occupied')
    const annotated = parseParkingMapJson(JSON.stringify(coco))
    expect(annotated).toHaveLength(6)
    expect(annotated.every((slot) => slot.zone === 'A' && slot.status === 'available')).toBe(true)
  })

  it.each([
    ['{', 'Invalid JSON'],
    ['{"slots":[]}', 'No parking slots'],
    ['{"slots":[{"number":0}]}', 'positive whole'],
    ['{"slots":[{"number":1,"status":"broken"}]}', 'Unknown status'],
    ['{"slots":[{"number":1},{"number":1}]}', 'Duplicate slot'],
    ['{"slots":[{"number":1,"zone":"All"}]}', 'Zone must'],
    ['{"unrelated":true}', 'Unsupported JSON'],
  ])('rejects malformed or ambiguous maps: %s', (json, message) => {
    expect(() => parseParkingMapJson(json)).toThrow(message)
  })

  it('rejects duplicates across files and multiple floors in a single legacy file', () => {
    const slots = parseParkingMapJson('[{"number":1}]')
    expect(() => validateSlots([...slots, ...slots])).toThrow('Duplicate slot')
    expect(() =>
      parseParkingMapJson(
        JSON.stringify({ E4: { floor1: legacy.E4.floor4, floor2: legacy.E4.floor4 } }),
      ),
    ).toThrow('multiple floors')
  })

  it('restores the complete imported layout and source, including occupied slots', () => {
    const slots = parseParkingMapJson(
      '{"slots":[{"number":800,"zone":"West","status":"occupied"}]}',
    )
    const restored = restoreMapDraft(JSON.stringify({ version: 2, sourceName: 'west.json', slots }))
    expect(restored).toMatchObject({ sourceName: 'west.json', slots })
  })
})
