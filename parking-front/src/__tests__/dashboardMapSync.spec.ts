import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DashboardMap from '@/components/parking/DashboardMap.vue'
import { floorService } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/services/api', () => ({
  floorService: {
    catalog: vi.fn(),
    setSlotStatuses: vi.fn(),
    resetSlotStatuses: vi.fn(),
    refreshModelSlotStatuses: vi.fn(),
  },
}))

const wrappers: VueWrapper[] = []
const floor = (status: 'available' | 'occupied', presetStatus: 'Enable' | 'Disable' = 'Enable') => ({
  _id: 'floor-1',
  building: { _id: 'building-1', building_name: 'Building 1' },
  floor: 1,
  veh_type: 'car',
  status: 'Available',
  camera_presets: [{ _id: 'camera-1', status: presetStatus, modelEnabled: presetStatus === 'Enable' }],
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

  it('resets map statuses only after all CCTV presets are disabled', async () => {
    const pinia = createPinia()
    const auth = useAuthStore(pinia)
    auth.token = 'test-token'
    auth.user = {
      _id: 'admin-1',
      id: 'admin-1',
      username: 'admin',
      name: 'Admin',
      fullName: 'Admin',
      role: 'admin',
      status: 'online',
    }
    vi.mocked(floorService.catalog).mockResolvedValue({
      data: { floors: [floor('occupied', 'Disable')] },
    } as never)
    vi.mocked(floorService.resetSlotStatuses).mockResolvedValue({
      data: {
        map: {
          slots: [
            {
              number: 1,
              zone: 'default',
              status: 'available',
              cameraPresetId: 'camera-1',
              parkingSlotName: 'zoneA_slot01',
            },
          ],
          layout: { shapes: [], positions: {} },
        },
      },
    } as never)
    const wrapper = mount(DashboardMap, { global: { plugins: [pinia] } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('.filter-toggle').trigger('click')
    await wrapper.get('select[aria-label="Building"]').setValue('building-1')
    await wrapper.get('select[aria-label="Floor"]').setValue('1')
    await wrapper.get('select[aria-label="Vehicle"]').setValue('car')

    const reset = wrapper.get('[aria-label="Reset parking slot status"]')
    expect((reset.element as HTMLButtonElement).disabled).toBe(false)
    await reset.trigger('click')
    expect(wrapper.get('[role="alertdialog"]').text()).toContain(
      'Are you sure to reset all slot status',
    )
    expect(floorService.resetSlotStatuses).not.toHaveBeenCalled()
    await wrapper.get('[role="alertdialog"] button:last-child').trigger('click')
    await flushPromises()
    expect(floorService.resetSlotStatuses).toHaveBeenCalledWith('floor-1')
    expect(wrapper.text()).toContain('Parking slot statuses reset to Available.')
    expect(wrapper.text()).toContain('Available')
  })

  it('requests manual status refresh from enabled Detection presets', async () => {
    const pinia = createPinia()
    const auth = useAuthStore(pinia)
    auth.token = 'test-token'
    auth.user = {
      _id: 'admin-1',
      id: 'admin-1',
      username: 'admin',
      name: 'Admin',
      fullName: 'Admin',
      role: 'admin',
      status: 'online',
    }
    vi.mocked(floorService.catalog).mockResolvedValue({
      data: { floors: [floor('available')] },
    } as never)
    vi.mocked(floorService.refreshModelSlotStatuses).mockResolvedValue({
      data: { success: true, message: 'Enabled Detection models will update their assigned parking slots', requestedSlots: 1 },
    } as never)
    const wrapper = mount(DashboardMap, { global: { plugins: [pinia] } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.get('.filter-toggle').trigger('click')
    await wrapper.get('select[aria-label="Building"]').setValue('building-1')
    await wrapper.get('select[aria-label="Floor"]').setValue('1')
    await wrapper.get('select[aria-label="Vehicle"]').setValue('car')

    const update = wrapper.get('[aria-label="Update slot status"]')
    expect((update.element as HTMLButtonElement).disabled).toBe(false)
    await update.trigger('click')
    await flushPromises()
    expect(floorService.refreshModelSlotStatuses).toHaveBeenCalledWith('floor-1')
    expect(wrapper.text()).toContain('1 slots')
  })
})
