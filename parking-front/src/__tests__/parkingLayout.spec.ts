import { describe, expect, it } from 'vitest'
import { emptyParkingLayout, restoreParkingLayout } from '@/components/parking/parkingLayout'
import { restoreMapDraft } from '@/components/parking/parkingMapPreview'

describe('saved parking layout', () => {
  it('restores shapes and independent slot positions with the existing draft', () => {
    const layout = {
      ...emptyParkingLayout(),
      shapes: [
        {
          id: 'road',
          type: 'rectangle',
          x: 20,
          y: 100,
          width: 500,
          height: 50,
          color: '#64748b',
          opacity: 0.5,
          text: '',
        },
      ],
      positions: { '["A",1]': { x: 80, y: 200, width: 70, height: 48 } },
      zoom: 175,
    }
    const restored = restoreMapDraft(
      JSON.stringify({
        version: 2,
        slots: [{ number: 1, zone: 'A', status: 'occupied' }],
        sourceName: 'map.json',
        layout,
      }),
    )
    expect(restored.layout).toMatchObject(layout)
    expect(restored.slots[0]?.status).toBe('occupied')
    expect(restoreMapDraft(null).layout).toEqual(emptyParkingLayout())
    expect(restoreParkingLayout({ background: null, shapes: [], positions: {} }).zoom).toBe(100)
    expect(() => restoreParkingLayout({ ...emptyParkingLayout(), zoom: 275 })).toThrow(
      'Invalid saved map zoom.',
    )
  })

  it('rejects external images and invalid geometry in saved data', () => {
    expect(() =>
      restoreParkingLayout({
        ...emptyParkingLayout(),
        background: { name: 'external', dataUrl: 'https://example.com/image.png' },
      }),
    ).toThrow('Invalid saved floor plan')
    expect(() =>
      restoreParkingLayout({
        ...emptyParkingLayout(),
        positions: { '["A",1]': { x: -20, y: 0, width: 70, height: 48 } },
      }),
    ).toThrow('Invalid saved slot position')
  })

  it('restores elements beyond the original canvas edge', () => {
    const layout = restoreParkingLayout({
      ...emptyParkingLayout(),
      positions: { '["A",1]': { x: 1200, y: 20, width: 70, height: 48 } },
    })

    expect(layout.positions['["A",1]']?.x).toBe(1200)
  })
})
