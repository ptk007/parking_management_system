import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DashboardMap from '@/components/parking/DashboardMap.vue'
import { floorService } from '@/services/api'

vi.mock('@/services/api', () => ({
  floorService: {
    catalog: vi.fn(),
    setSlotStatuses: vi.fn(),
  },
}))

const wrappers: VueWrapper[] = []
const floor = (status: 'available' | 'occupied') => ({
  _id: 'floor-1',
  building: { _id: 'building-1', building_name: 'Building 1' },
  floor: 1,
  veh_type: 'car',
  status: 'Available',
  parking_map: {
    slots: [
      {
        number: 1,
        zone: 'default',
        status,
        cameraPresetId: 'camera-1',
        parkingSlotName: 'zoneA_slot01',
      },
    ],
    layout: { shapes: [], positions: {} },
  },
})

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

describe('Dashboard parking map sync', () => {
  it('refreshes parking slot status while visible and clears the timer on unmount', async () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    vi.mocked(floorService.catalog)
      .mockResolvedValueOnce({ data: { floors: [floor('available')] } } as never)
      .mockResolvedValueOnce({ data: { floors: [floor('occupied')] } } as never)

    const wrapper = mount(DashboardMap, { global: { plugins: [createPinia()] } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('.filter-toggle').trigger('click')
    await wrapper.get('select[aria-label="Building"]').setValue('building-1')
    await wrapper.get('select[aria-label="Floor"]').setValue('1')
    await wrapper.get('select[aria-label="Vehicle"]').setValue('car')
    expect(wrapper.text()).toContain('Available')
    expect(floorService.catalog).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(floorService.catalog).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Occupied')

    wrapper.unmount()
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(floorService.catalog).toHaveBeenCalledTimes(2)
  })
})
