import { describe, it, expect } from 'vitest'
import { nextParkingSlot } from '@/components/parking/parkingLayout'
import type { PreviewSlot } from '@/components/parking/parkingMapPreview'
const slot = (number: number, name = String(number)): PreviewSlot => ({
  number,
  name,
  zone: 'default',
  status: 'disabled',
})
describe('parking slot numbering', () => {
  it('reuses the lowest deleted number without colliding with an imported number or renamed label', () => {
    expect(nextParkingSlot([slot(1), slot(3)])).toMatchObject({ number: 2, name: '2' })
    expect(nextParkingSlot([slot(1), slot(3), slot(9, '2')])).toMatchObject({
      number: 4,
      name: '4',
    })
    expect(nextParkingSlot([])).toMatchObject({ number: 1, status: 'disabled' })
  })
})
