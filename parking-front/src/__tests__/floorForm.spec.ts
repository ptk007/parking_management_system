import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import FloorFormPanel from '@/views/admin/FloorFormPanel.vue'
import { floorService, type ParkingBuilding, type ParkingFloor } from '@/services/api'
import { emptyParkingLayout } from '@/components/parking/parkingLayout'

vi.mock('@/services/api', () => ({
  floorService: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const buildings: ParkingBuilding[] = [
  { _id: 'building-e4', building_name: 'E4', building_image: null, date_add: '', time_add: '' },
  { _id: 'building-e5', building_name: 'E5', building_image: null, date_add: '', time_add: '' },
]

const wrappers: VueWrapper[] = []

beforeEach(() => vi.resetAllMocks())
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('admin floor form', () => {
  it('stores a new floor under the building selected by name', async () => {
    vi.mocked(floorService.create).mockResolvedValue({} as never)
    const wrapper = mount(FloorFormPanel, { props: { mode: 'add', buildings } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('select')).toHaveLength(2)

    await wrapper.findAll('select')[0]!.setValue('building-e5')
    await wrapper.findAll('input[type="number"]')[0]!.setValue('4')
    expect(wrapper.text()).not.toContain('Zone')
    expect(wrapper.find('input[type="file"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    const data = vi.mocked(floorService.create).mock.calls[0]?.[0]
    expect(data).toEqual({
      building: 'building-e5',
      floor: 4,
      veh_type: 'car',
      status: 'disable',
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual(['building-e5'])
  })

  it('allows the same floor number for another vehicle type and blocks exact duplicates', async () => {
    vi.mocked(floorService.create).mockResolvedValue({} as never)
    const existing: ParkingFloor = {
      _id: 'floor-car',
      building: buildings[0]!,
      floor: 4,
      veh_type: 'car',
      zone: 1,
      parking_slot_file: null,
      status: 'disable',
      date_add: '',
      time_add: '',
    }
    const wrapper = mount(FloorFormPanel, {
      props: { mode: 'add', buildings, floors: [existing] },
    })
    wrappers.push(wrapper)

    await wrapper.findAll('input[type="number"]')[0]!.setValue('4')
    await wrapper.findAll('select')[1]!.setValue('motorcycle')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(floorService.create).toHaveBeenCalledWith(
      expect.objectContaining({ building: 'building-e4', floor: 4, veh_type: 'motorcycle' }),
    )

    await wrapper.findAll('select')[1]!.setValue('car')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('already exists')
    expect(floorService.create).toHaveBeenCalledTimes(1)
  })

  it('shows floor status only when editing a floor with a parking map', () => {
    const floor: ParkingFloor = {
      _id: 'floor-2',
      building: buildings[0]!,
      floor: 2,
      veh_type: 'motorcycle',
      zone: 1,
      parking_slot_file: null,
      status: 'disable',
      date_add: '',
      time_add: '',
      parking_map: {
        version: 2,
        sourceName: 'map',
        slots: [],
        layout: emptyParkingLayout(),
      },
    }
    const wrapper = mount(FloorFormPanel, { props: { mode: 'edit', buildings, floor } })
    wrappers.push(wrapper)

    expect(wrapper.findAll('select')).toHaveLength(3)
    expect(wrapper.findAll('select')[2]!.element.value).toBe('disable')
  })

  it('deletes an existing floor only after confirmation', async () => {
    vi.mocked(floorService.remove).mockResolvedValue({} as never)
    const floor: ParkingFloor = {
      _id: 'floor-2',
      building: buildings[0]!,
      floor: 2,
      veh_type: 'motorcycle',
      zone: 1,
      parking_slot_file: null,
      status: 'disable',
      date_add: '',
      time_add: '',
    }
    const wrapper = mount(FloorFormPanel, { props: { mode: 'edit', buildings, floor } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('select')).toHaveLength(2)

    await wrapper.get('form .red-button').trigger('click')
    expect(floorService.remove).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alertdialog"]').text()).toContain('Delete Floor 2?')
    await wrapper.get('.floor-delete-dialog .red-button').trigger('click')
    await flushPromises()

    expect(floorService.remove).toHaveBeenCalledWith('floor-2')
    expect(wrapper.emitted('deleted')?.[0]).toEqual(['building-e4'])
  })
})
