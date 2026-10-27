import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import CCTVSetupList from '@/views/admin/CCTVSetupList.vue'
import AddCCTVPanel from '@/views/admin/AddCCTVPanel.vue'
import { floorService, type ParkingFloor } from '@/services/api'

vi.mock('@/services/api', () => ({ floorService: { importSlotFiles: vi.fn(), downloadSlotFile: vi.fn() } }))
let wrapper: VueWrapper
const floor: ParkingFloor = {
  _id: 'floor-1', building: { _id: 'b1', building_name: 'E5', building_image: null, date_add: '', time_add: '' },
  floor: 3, veh_type: 'motorcycle', zone: 1, parking_slot_file: null,
  parking_slot_files: [], status: 'disable', date_add: '', time_add: '',
}
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
afterEach(() => { wrapper?.unmount(); vi.resetAllMocks() })

describe('floor CCTV parking slot presets', () => {
  it('saves multiple original files under the selected floor and restores the list from floor data', async () => {
    wrapper = mount(CCTVSetupList, { props: { selectedFloor: floor } })
    const files = [file('A.json', '{"slots":[{"zone":"A","number":1}]}'), file('B.json', '{"slots":[{"zone":"B","number":1}]}')]
    const saved = { ...floor, parking_slot_files: files.map((f, i) => ({ _id: String(i), original_name: f.name, path: 'stored.json', size: f.size })) }
    vi.mocked(floorService.importSlotFiles).mockResolvedValue({ data: { floor: saved } } as never)
    await upload(files)
    expect(floorService.importSlotFiles).toHaveBeenCalledWith('floor-1', files)
    expect(wrapper.emitted('floor-updated')?.[0]).toEqual([saved])
    await wrapper.setProps({ selectedFloor: saved })
    expect(wrapper.findAll('.slot-file-list li')).toHaveLength(2)
    expect(wrapper.text()).toContain('A.json')
    expect(wrapper.text()).toContain('B.json')
    expect(wrapper.get('.cctv-heading').text()).toBe('E5 : Floor 3 CCTV')
    await upload([files[0]!])
    expect(wrapper.get('[role="alert"]').text()).toContain('File already imported')
    expect(floorService.importSlotFiles).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid JSON and duplicate slots without uploading any files', async () => {
    wrapper = mount(CCTVSetupList, { props: { selectedFloor: floor } })
    await upload([file('bad.json', 'broken')])
    expect(wrapper.get('[role="alert"]').text()).toContain('Invalid JSON')
    await upload([file('A.json', '[{"number":1}]'), file('B.json', '[{"number":1}]')])
    expect(wrapper.get('[role="alert"]').text()).toContain('Duplicate slot')
    expect(floorService.importSlotFiles).not.toHaveBeenCalled()
  })

  it('uses the shared edit form, retains current values, and selects an existing floor slot file', async () => {
    const selectedFloor = { ...floor, parking_slot_files: [
      { _id: 'slots-a', original_name: 'A.json', path: 'a.json', size: 100 },
      { _id: 'slots-b', original_name: 'B.json', path: 'b.json', size: 100 },
    ] }
    const camera = { name: 'Entrance', cameraSelector: 'camera-2', ipAddress: '192.168.1.20', rtspLink: 'rtsp://example.test/camera', cctvFileName: 'camera.json', parkingSlotFileId: 'slots-b' }
    wrapper = mount(AddCCTVPanel, { props: { mode: 'edit', selectedFloor, camera } })
    expect(wrapper.get('h2').text()).toContain('Edit CCTV')
    expect(wrapper.findAll('input[type="file"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Can add more than 1 file')
    expect(wrapper.text()).toContain('Current file: camera.json')
    expect((wrapper.get('select').element as HTMLSelectElement).value).toBe('slots-b')
    await wrapper.get('input[type="text"]').setValue('Updated entrance')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')?.[0]).toEqual([{ ...camera, name: 'Updated entrance' }, null])
    await wrapper.get('.add-cctv-cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('shows upload errors and permits retry', async () => {
    wrapper = mount(CCTVSetupList, { props: { selectedFloor: floor } })
    vi.mocked(floorService.importSlotFiles).mockRejectedValueOnce(new Error('offline'))
    const files = [file('A.json', '[{"number":1}]')]
    await upload(files)
    expect(wrapper.get('[role="alert"]').text()).toContain('offline')
    expect(wrapper.get('.slot-import-button').attributes('disabled')).toBeUndefined()
    expect(wrapper.emitted('floor-updated')).toBeUndefined()
    vi.mocked(floorService.importSlotFiles).mockResolvedValueOnce({ data: { floor } } as never)
    await upload(files)
    expect(wrapper.emitted('floor-updated')).toHaveLength(1)
  })
})
