import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import CCTVSetupList from '@/views/admin/CCTVSetupList.vue'
import AddCCTVPanel from '@/views/admin/AddCCTVPanel.vue'
import { floorService, type ParkingFloor } from '@/services/api'
vi.mock('@/services/api', () => ({
  floorService: {
    sourceFiles: vi.fn(),
    importSourceFiles: vi.fn(),
    downloadSourceFile: vi.fn(),
    saveCamera: vi.fn(),
  },
}))
let wrapper: VueWrapper
const floor: ParkingFloor = {
  _id: 'f1',
  building: { _id: 'b1', building_name: 'E5', building_image: null, date_add: '', time_add: '' },
  floor: 3,
  veh_type: 'motorcycle',
  zone: 1,
  parking_slot_file: null,
  status: 'disable',
  date_add: '',
  time_add: '',
}
const sources = [{ _id: 's1', original_name: 'original.json', path: 'a.json', size: 10 }]
function file(name: string, text: string) {
  const value = new File([text], name, { type: 'application/json' })
  Object.defineProperty(value, 'text', { value: async () => text })
  return value
}
async function upload(files: File[]) {
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: files, configurable: true })
  await input.trigger('change')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(floorService.sourceFiles).mockResolvedValue({ data: { files: sources } } as never)
})
afterEach(() => wrapper?.unmount())
describe('shared CCTV source library and per-floor presets', () => {
  it('shows the same central files for different floors and imports without a floor', async () => {
    wrapper = mount(CCTVSetupList, { props: { selectedFloor: floor } })
    await flushPromises()
    expect(wrapper.text()).toContain('original.json')
    await wrapper.setProps({ selectedFloor: { ...floor, _id: 'f2', floor: 4 } })
    expect(wrapper.text()).toContain('original.json')
    await wrapper.setProps({ selectedFloor: null })
    vi.mocked(floorService.importSourceFiles).mockResolvedValue({} as never)
    const files = [file('new.json', '{"camera":"source"}')]
    await upload(files)
    expect(floorService.importSourceFiles).toHaveBeenCalledWith(files)
    expect(wrapper.text()).toContain('Imported 1 file successfully')
  })
  it('rejects malformed JSON but allows independent source files to contain the same slot', async () => {
    wrapper = mount(CCTVSetupList)
    await flushPromises()
    await upload([file('bad.json', 'broken')])
    expect(wrapper.get('[role="alert"]').text()).toContain('Invalid JSON')
    expect(floorService.importSourceFiles).not.toHaveBeenCalled()
    vi.mocked(floorService.importSourceFiles).mockResolvedValue({} as never)
    await upload([file('a.json', '[{"number":1}]'), file('b.json', '[{"number":1}]')])
    expect(floorService.importSourceFiles).toHaveBeenCalledTimes(1)
  })
  it('edits a saved camera using the original source selector before the Parking Slot File upload', async () => {
    const camera = {
      _id: 'cam1',
      name: 'Entrance',
      cameraSelector: 'cam-2',
      ipAddress: '192.168.1.2',
      rtspLink: '',
      cctvFileName: 'slots.json',
      parkingSlotFileId: 's1',
      parkingSlotData: { slots: [{ number: 1 }] },
    }
    wrapper = mount(AddCCTVPanel, { props: { mode: 'edit', selectedFloor: floor, camera } })
    await flushPromises()
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('s1')
    const fields = wrapper.findAll('.add-cctv-fields > .add-cctv-field').map((f) => f.text())
    expect(fields[1]).toContain('Select 1 Original CCTV Source')
    expect(fields[3]).toContain('Parking Slot File')
    vi.mocked(floorService.saveCamera).mockResolvedValue({ data: { floor } } as never)
    await wrapper.get('input[type="text"]').setValue('Updated entrance')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(floorService.saveCamera).toHaveBeenCalledWith('f1', {
      ...camera,
      name: 'Updated entrance',
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([floor])
  })
  it('shows upload errors and permits retry', async () => {
    wrapper = mount(CCTVSetupList)
    await flushPromises()
    vi.mocked(floorService.importSourceFiles).mockRejectedValueOnce(new Error('offline'))
    const files = [file('new.json', '{}')]
    await upload(files)
    expect(wrapper.get('[role="alert"]').text()).toContain('offline')
    expect(wrapper.get('.slot-import-button').attributes('disabled')).toBeUndefined()
    vi.mocked(floorService.importSourceFiles).mockResolvedValueOnce({} as never)
    await upload(files)
    expect(wrapper.text()).toContain('Imported 1 file successfully')
  })
})
