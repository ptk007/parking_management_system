import { describe, expect, it } from 'vitest'
import { createDashboardLayout } from '../components/parking/dashboardLayoutTemplate'
import { restoreParkingLayout } from '../components/parking/parkingLayout'
import { createPreviewSlots, type PreviewSlot } from '../components/parking/parkingMapPreview'
import { slotKey } from '../components/parking/parkingMapJson'

describe('Dashboard layout template', () => {
  it('places every E4 slot in the Dashboard islands without changing slot data', () => {
    const slots = createPreviewSlots()
    const original = structuredClone(slots)
    const layout = createDashboardLayout(slots)
    expect(Object.keys(layout.positions)).toHaveLength(124)
    expect(slots).toEqual(original)
    expect(layout.positions[slotKey(slots[0]!)]).toMatchObject({ x: 112, y: 125 })
    expect(layout.positions[slotKey(slots[48]!)]?.x).toBe(112)
    expect(layout.positions[slotKey(slots[48]!)]?.y).toBeCloseTo(220.7)
    expect(restoreParkingLayout(layout)).toEqual(layout)
    const positions = Object.values(layout.positions)
    for (const [i, a] of positions.entries()) {
      expect(a.x + a.width).toBeLessThanOrEqual(1000)
      for (const b of positions.slice(i + 1)) {
        expect(
          a.x + a.width <= b.x ||
            b.x + b.width <= a.x ||
            a.y + a.height <= b.y ||
            b.y + b.height <= a.y,
        ).toBe(true)
      }
    }
  })

  it('preserves imported identities across zones and places overflow slots', () => {
    const slots: PreviewSlot[] = Array.from({ length: 150 }, (_, index) => ({
      number: (index % 75) + 1,
      zone: index < 75 ? 'North' : 'South',
      status: 'disabled',
    }))
    const layout = createDashboardLayout(slots)
    expect(Object.keys(layout.positions)).toHaveLength(150)
    expect(new Set(Object.values(layout.positions).map((p) => `${p.x},${p.y}`)).size).toBe(150)
    expect(restoreParkingLayout(layout)).toEqual(layout)
  })
})
