import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import FloorFormPanel from '@/views/admin/FloorFormPanel.vue'
import { floorService, type ParkingBuilding, type ParkingFloor } from '@/services/api'
import { emptyParkingLayout } from '@/components/parking/parkingLayout'

vi.mock('@/services/api', () => ({
  floorService: { create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

const buildings: ParkingBuilding[] = [
  { _id: 'building-e4', building_name: 'E4', building_image: null, date_updated: '', time_updated: '' },
  { _id: 'building-e5', building_name: 'E5', building_image: null, date_updated: '', time_updated: '' },
]

const wrappers: VueWrapper[] = []

beforeEach(() => vi.resetAllMocks())
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))

describe('admin floor form', () => {
  it('stores a new floor under the building selected by name', async () => {
    vi.mocked(floorService.create).mockResolvedValue({} as never)
    const wrapper = mount(FloorFormPanel, { props: { mode: 'add', buildings } })
    wrappers.push(wrapper)
    const labels = wrapper.findAll('.floor-field span').map((label) => label.text())
    expect(labels).toEqual(['Building *', 'Floor *', 'Vehicle *'])
    expect(wrapper.findAll('select')).toHaveLength(2)
    expect(wrapper.get('.floor-field:last-of-type').element.nextElementSibling).toBe(
      wrapper.get('.floor-actions').element,
    )

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
      status: 'Disable',
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
      parking_slot_file: null,
      status: 'Disable',
      date_updated: '',
      time_updated: '',
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

  it('shows editable floor status above the edit actions', () => {
    const floor: ParkingFloor = {
      _id: 'floor-2',
      building: buildings[0]!,
      floor: 2,
      veh_type: 'motorcycle',
      parking_slot_file: null,
      status: 'Disable',
      date_updated: '',
      time_updated: '',
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
    expect(wrapper.findAll('select')[2]!.element.value).toBe('Disable')
    expect(wrapper.findAll('select')[2]!.element.disabled).toBe(false)
    const labels = wrapper.findAll('.floor-field span').map((label) => label.text())
    expect(labels).toEqual(['Building *', 'Floor *', 'Vehicle *', 'Status'])
    expect(wrapper.get('.floor-field:last-of-type').element.compareDocumentPosition(
      wrapper.get('.floor-actions').element,
    ) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('closes the edit form immediately when Cancel is clicked', async () => {
    const floor: ParkingFloor = {
      _id: 'floor-2',
      building: buildings[0]!,
      floor: 2,
      veh_type: 'motorcycle',
      parking_slot_file: null,
      status: 'Disable',
      date_updated: '',
      time_updated: '',
    }
    const wrapper = mount(FloorFormPanel, { props: { mode: 'edit', buildings, floor } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('select')).toHaveLength(3)

    await wrapper.get('form .cancel-button').trigger('click')
    expect(floorService.remove).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
