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
    searchCctvSource: vi.fn(),
    probeCctvSource: vi.fn(),
    streamCctvPreview: vi.fn(),
    get: vi.fn(),
    setCameraModelEnabled: vi.fn(),
    getCameraModelFrame: vi.fn(),
  },
}))
let wrapper: VueWrapper
let urlCreateObjectUrlDescriptor: PropertyDescriptor | undefined
let urlRevokeObjectUrlDescriptor: PropertyDescriptor | undefined
const floor: ParkingFloor = {
  _id: 'f1',
  building: { _id: 'b1', building_name: 'E5', building_image: null, date_updated: '', time_updated: '' },
  floor: 3,
  veh_type: 'motorcycle',
  parking_slot_file: null,
  status: 'Disable',
  date_updated: '',
  time_updated: '',
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
  urlCreateObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')
  urlRevokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL')
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:live-preview'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  vi.mocked(floorService.sourceFiles).mockResolvedValue({ data: { files: sources } } as never)
})
afterEach(() => {
  wrapper?.unmount()
  if (urlCreateObjectUrlDescriptor) {
    Object.defineProperty(URL, 'createObjectURL', urlCreateObjectUrlDescriptor)
  } else {
    delete (URL as Partial<typeof URL>).createObjectURL
  }
  if (urlRevokeObjectUrlDescriptor) {
    Object.defineProperty(URL, 'revokeObjectURL', urlRevokeObjectUrlDescriptor)
  } else {
    delete (URL as Partial<typeof URL>).revokeObjectURL
  }
})
function livePreviewResponse() {
  const frame = new TextEncoder().encode(
    '--frame\r\nContent-Type: image/jpeg\r\nContent-Length: 4\r\n\r\njpeg\r\n',
  )
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(frame)
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame' },
    },
  )
}
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
  it('allows re-importing the same name when the previous source file is missing', async () => {
    vi.mocked(floorService.sourceFiles).mockResolvedValue({
      data: { files: [{ ...sources[0]!, available: false }] },
    } as never)
    wrapper = mount(CCTVSetupList)
    await flushPromises()
    vi.mocked(floorService.importSourceFiles).mockResolvedValue({} as never)

    await upload([file('original.json', '{"cameras":[]}')])

    expect(floorService.importSourceFiles).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Missing — re-import required')
  })
  it('edits a saved camera without replacing its current slot JSON file', async () => {
    const camera = {
      _id: 'cam1',
      name: 'Entrance',
      cameraSelector: 'cam-2',
      ipAddress: '192.168.1.2',
      rtspLink: '',
      cctvFileName: 'original.json',
      parkingSlotFileId: 's1',
      parkingSlotData: {
        categories: [{ name: 'zoneA_slot01', supercategory: 'parking-slot' }],
      },
    }
    wrapper = mount(AddCCTVPanel, { props: { mode: 'edit', selectedFloor: floor, camera } })
    await flushPromises()
    expect((wrapper.findAll('select')[0]!.element as HTMLSelectElement).value).toBe('s1')
    const fields = wrapper.findAll('.add-cctv-fields > .add-cctv-field').map((f) => f.text())
    expect(fields[1]).toContain('Select 1 Original CCTV Source')
    expect(fields[3]).toContain('Parking Slot JSON File')
    vi.mocked(floorService.saveCamera).mockResolvedValue({ data: { floor } } as never)
    await wrapper.get('input[type="text"]').setValue('Updated entrance')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(floorService.saveCamera).toHaveBeenCalledWith('f1', {
      _id: camera._id,
      cameraSelector: camera.cameraSelector,
      cameraNo: 'cam-2',
      ipAddress: camera.ipAddress,
      sourceCameraName: '',
      rtspLink: camera.rtspLink,
      cctvFileName: camera.cctvFileName,
      parkingSlotFileId: camera.parkingSlotFileId,
      name: 'Updated entrance',
      status: 'Unknown',
    }, null)
    expect(wrapper.emitted('saved')?.[0]).toEqual([floor])
  })
  it('creates a preset from a parking-slot JSON file upload', async () => {
    wrapper = mount(AddCCTVPanel, { props: { mode: 'add', selectedFloor: floor } })
    await flushPromises()
    vi.mocked(floorService.saveCamera).mockResolvedValue({ data: { floor } } as never)
    await wrapper.findAll('select')[0]!.setValue('s1')
    const json = JSON.stringify({
      categories: [{ name: 'zoneA_slot01', supercategory: 'parking-slot' }],
    })
    const slotFile = file('slots.json', json)
    await upload([slotFile])
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(floorService.saveCamera).toHaveBeenCalledWith(
      'f1',
      expect.objectContaining({
        cctvFileName: 'original.json',
        cameraNo: '',
        sourceCameraName: '',
        parkingSlotFileId: null,
      }),
      slotFile,
    )
    expect(wrapper.emitted('saved')?.[0]).toEqual([floor])
  })
  it('searches camera fields and starts a live preview with matched details', async () => {
    const slotData = {
      images: [{ id: 1, width: 1918, height: 1078 }],
      categories: [{ id: 1, name: 'zoneA_slot01', supercategory: 'parking-slot' }],
      annotations: [{ image_id: 1, category_id: 1, bbox: [10, 20, 100, 40] }],
    }
    const match = {
      recordIndex: 2,
      cameraNo: 'CCTV-2',
      ipAddress: '192.0.2.2',
      sourceCameraName: 'North entrance',
      rtspLink: 'rtsp://camera.example/stream',
    }
    vi.mocked(floorService.searchCctvSource).mockResolvedValue({
      data: {
        matches: [match],
        camera: match,
        status: 'Unknown',
        message: 'Camera matched. Open the live preview to check its connection.',
      },
    } as never)
    vi.mocked(floorService.streamCctvPreview).mockImplementation(() =>
      Promise.resolve(livePreviewResponse()),
    )
    wrapper = mount(AddCCTVPanel, { props: { selectedFloor: floor } })
    await flushPromises()
    await wrapper.find('select').setValue('s1')
    await wrapper.findAll('input[type="text"]')[1]!.setValue('192.0.2.2')
    await upload([file('slots.json', JSON.stringify(slotData))])
    await wrapper.findAll('.add-cctv-search')[0]!.trigger('click')
    await flushPromises()

    expect(floorService.searchCctvSource).toHaveBeenCalledWith('s1', '192.0.2.2')
    expect(floorService.streamCctvPreview).toHaveBeenCalledWith(
      's1',
      2,
      slotData,
      expect.any(AbortSignal),
    )
    expect(wrapper.get('.add-cctv-connection-details').text()).toContain('CCTV-2')
    expect(wrapper.get('.add-cctv-connection-details').text()).toContain('North entrance')
    expect(wrapper.get('.add-cctv-status').text()).toBe('Online')
    expect(wrapper.text()).toContain('live preview is receiving camera frames')
    expect(wrapper.get('.add-cctv-frame').attributes('src')).toBe('blob:live-preview')
  })
  it('restarts the live preview for the selected camera', async () => {
    const camera = {
      recordIndex: 5,
      cameraNo: 'CCTV-5',
      ipAddress: '192.0.2.5',
      sourceCameraName: 'North entrance',
      rtspLink: 'rtsp://camera.example/stream',
    }
    vi.mocked(floorService.searchCctvSource).mockResolvedValue({
      data: {
        matches: [camera],
        camera,
        status: 'Unknown',
        message: 'Camera matched.',
      },
    } as never)
    vi.mocked(floorService.streamCctvPreview).mockImplementation(() =>
      Promise.resolve(livePreviewResponse()),
    )
    wrapper = mount(AddCCTVPanel, { props: { selectedFloor: floor } })
    await flushPromises()
    await wrapper.find('select').setValue('s1')
    await wrapper.findAll('input[type="text"]')[1]!.setValue('CCTV-5')
    await wrapper.findAll('.add-cctv-search')[0]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('.add-cctv-search')[1]!.trigger('click')
    await flushPromises()

    expect(floorService.streamCctvPreview).toHaveBeenCalledTimes(2)
    expect(wrapper.get('.add-cctv-status').text()).toBe('Online')
    expect(wrapper.get('.add-cctv-frame').attributes('src')).toBe('blob:live-preview')
  })
  it('aborts the active preview and releases its frame when the search changes', async () => {
    const camera = {
      recordIndex: 6,
      cameraNo: 'CCTV-6',
      ipAddress: '192.0.2.6',
      sourceCameraName: 'South entrance',
      rtspLink: 'rtsp://camera.example/south',
    }
    vi.mocked(floorService.searchCctvSource).mockResolvedValue({
      data: { matches: [camera], camera, status: 'Unknown', message: 'Camera matched.' },
    } as never)
    vi.mocked(floorService.streamCctvPreview).mockImplementation(() =>
      Promise.resolve(livePreviewResponse()),
    )
    wrapper = mount(AddCCTVPanel, { props: { selectedFloor: floor } })
    await flushPromises()
    await wrapper.find('select').setValue('s1')
    await wrapper.findAll('input[type="text"]')[1]!.setValue('CCTV-6')
    await wrapper.findAll('.add-cctv-search')[0]!.trigger('click')
    await flushPromises()
    const signal = vi.mocked(floorService.streamCctvPreview).mock.calls[0]![3]

    await wrapper.findAll('input[type="text"]')[1]!.setValue('CCTV-7')

    expect(signal.aborted).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:live-preview')
    expect(wrapper.find('.add-cctv-frame').exists()).toBe(false)
  })
  it('ignores a camera lookup response after the search input changes', async () => {
    const camera = {
      recordIndex: 7,
      cameraNo: 'CCTV-7',
      ipAddress: '192.0.2.7',
      sourceCameraName: 'East entrance',
      rtspLink: 'rtsp://camera.example/east',
    }
    let resolveSearch!: (result: unknown) => void
    vi.mocked(floorService.searchCctvSource).mockReturnValue(
      new Promise((resolve) => {
        resolveSearch = resolve
      }) as never,
    )
    wrapper = mount(AddCCTVPanel, { props: { selectedFloor: floor } })
    await flushPromises()
    await wrapper.find('select').setValue('s1')
    const queryInput = wrapper.findAll('input[type="text"]')[1]!
    await queryInput.setValue('CCTV-7')
    await wrapper.findAll('.add-cctv-search')[0]!.trigger('click')
    await queryInput.setValue('CCTV-8')
    resolveSearch({
      data: { matches: [camera], camera, status: 'Unknown', message: 'Camera matched.' },
    })
    await flushPromises()

    expect(wrapper.find('.add-cctv-connection-details').exists()).toBe(false)
    expect(floorService.streamCctvPreview).not.toHaveBeenCalled()
  })
  it('requires an explicit choice when exact search matches multiple records', async () => {
    const matches = [
      {
        recordIndex: 1,
        cameraNo: 'A-1',
        ipAddress: '192.0.2.1',
        sourceCameraName: 'North',
        rtspLink: 'rtsp://camera.example/north',
      },
      {
        recordIndex: 3,
        cameraNo: 'A-2',
        ipAddress: '192.0.2.2',
        sourceCameraName: 'South',
        rtspLink: 'rtsp://camera.example/south',
      },
    ]
    vi.mocked(floorService.searchCctvSource).mockResolvedValue({
      data: {
        matches,
        status: 'Unknown',
        message: 'More than one camera matched.',
      },
    } as never)
    vi.mocked(floorService.streamCctvPreview).mockResolvedValue(
      new Response(JSON.stringify({ message: 'The camera did not return a video frame.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    wrapper = mount(AddCCTVPanel, { props: { selectedFloor: floor } })
    await flushPromises()
    await wrapper.find('select').setValue('s1')
    await wrapper.findAll('input[type="text"]')[1]!.setValue('North')
    await wrapper.findAll('.add-cctv-search')[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Multiple exact matches found')
    await wrapper.findAll('select')[1]!.setValue('3')
    await flushPromises()

    expect(floorService.streamCctvPreview).toHaveBeenCalledWith(
      's1',
      3,
      null,
      expect.any(AbortSignal),
    )
    expect(wrapper.get('.add-cctv-status').text()).toBe('Offline')
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
  it('opens a live stream in the floor CCTV card using the saved camera and slot data', async () => {
    const camera = {
      _id: 'cam-e4-floor1',
      name: 'Floor1 E4',
      cameraSelector: '344',
      cameraNo: '344',
      ipAddress: '192.0.2.34',
      sourceCameraName: 'E4 Floor 1',
      rtspLink: 'rtsp://camera.example/e4-floor1',
      cctvFileName: 'original.json',
      parkingSlotFileId: null,
      parkingSlotData: {
        images: [{ id: 1, width: 1918, height: 1078 }],
        categories: [{ id: 1, name: 'zoneA_slot01' }],
        annotations: [{ image_id: 1, category_id: 1, bbox: [10, 20, 100, 40] }],
      },
    }
    const match = {
      recordIndex: 4,
      cameraNo: '344',
      ipAddress: '192.0.2.34',
      sourceCameraName: 'E4 Floor 1',
      rtspLink: 'rtsp://camera.example/e4-floor1',
    }
    vi.mocked(floorService.searchCctvSource).mockResolvedValue({
      data: { matches: [match], camera: match, status: 'Unknown', message: 'Camera matched.' },
    } as never)
    vi.mocked(floorService.streamCctvPreview).mockImplementation(() =>
      Promise.resolve(livePreviewResponse()),
    )
    wrapper = mount(CCTVSetupList, {
      props: { selectedFloor: { ...floor, camera_presets: [camera] } },
    })
    await flushPromises()
    await wrapper.get('[aria-label="Show live preview for Floor1 E4"]').trigger('click')
    await flushPromises()

    expect(floorService.searchCctvSource).toHaveBeenCalledWith('s1', camera.rtspLink)
    expect(floorService.streamCctvPreview).toHaveBeenCalledWith(
      's1',
      4,
      camera.parkingSlotData,
      expect.any(AbortSignal),
    )
    const signal = vi.mocked(floorService.streamCctvPreview).mock.calls[0]![3]
    expect(wrapper.get('.cctv-live-frame').attributes('src')).toBe('blob:live-preview')
    expect(wrapper.find('[aria-label="Stop live preview for Floor1 E4"]').exists()).toBe(true)
    await wrapper.find('[aria-label="Expand live preview for Floor1 E4"]').trigger('click')
    expect(document.body.querySelector('.cctv-expanded-overlay')).not.toBeNull()
    expect(document.body.querySelector('.cctv-expanded-frame')?.getAttribute('src')).toBe(
      'blob:live-preview',
    )
    document
      .body.querySelector<HTMLButtonElement>('[aria-label="Close expanded preview"]')
      ?.click()
    await flushPromises()
    expect(document.body.querySelector('.cctv-expanded-overlay')).toBeNull()
    expect(signal.aborted).toBe(false)
    await wrapper.find('[aria-label="Stop live preview for Floor1 E4"]').trigger('click')
    expect(signal.aborted).toBe(true)
    expect(wrapper.find('.cctv-live-frame').exists()).toBe(false)
  })

  it('shows annotated Python YOLO frames for an enabled preset', async () => {
    const camera = {
      _id: 'camera-yolo-preview',
      name: 'North entrance',
      cameraSelector: '344',
      cameraNo: '344',
      ipAddress: '192.0.2.34',
      rtspLink: '',
      cctvFileName: 'original.json',
      parkingSlotFileId: null,
      status: 'Online' as const,
      modelEnabled: true,
      modelRuntimeStatus: 'Online' as const,
      modelRuntimeUpdatedAt: new Date().toISOString(),
    }
    vi.mocked(floorService.getCameraModelFrame).mockResolvedValue({
      data: new Blob(['annotated-frame'], { type: 'image/jpeg' }),
    } as never)
    wrapper = mount(CCTVSetupList, {
      props: { selectedFloor: { ...floor, camera_presets: [camera] } },
    })
    await flushPromises()

    await wrapper.get('[aria-label="Show YOLO preview for North entrance"]').trigger('click')
    await flushPromises()

    expect(floorService.getCameraModelFrame).toHaveBeenCalledWith(
      floor._id,
      camera._id,
      expect.any(AbortSignal),
    )
    expect(floorService.streamCctvPreview).not.toHaveBeenCalled()
    expect(wrapper.get('.cctv-live-frame').attributes('src')).toBe('blob:live-preview')
    expect(wrapper.find('[aria-label="Stop YOLO preview for North entrance"]').exists()).toBe(true)
  })

  it('starts YOLO from the CCTV preset card and displays the persisted runtime status', async () => {
    const camera = {
      _id: 'camera-yolo',
      name: 'North entrance',
      cameraSelector: '344',
      cameraNo: '344',
      ipAddress: '192.0.2.34',
      rtspLink: '',
      cctvFileName: 'original.json',
      parkingSlotFileId: null,
      status: 'Online' as const,
      modelEnabled: false,
      modelRuntimeStatus: 'Offline' as const,
    }
    const startedCamera = {
      ...camera,
      modelEnabled: true,
      modelRuntimeStatus: 'Starting' as const,
      modelRuntimeUpdatedAt: new Date().toISOString(),
    }
    vi.mocked(floorService.setCameraModelEnabled).mockResolvedValue({
      data: { floor: { ...floor, camera_presets: [startedCamera] } },
    } as never)
    wrapper = mount(CCTVSetupList, {
      props: { selectedFloor: { ...floor, camera_presets: [camera] } },
    })
    await flushPromises()

    await wrapper.get('[aria-label="Turn YOLO on for North entrance"]').trigger('click')
    await flushPromises()
    await wrapper.setProps({ selectedFloor: { ...floor, camera_presets: [startedCamera] } })

    expect(floorService.setCameraModelEnabled).toHaveBeenCalledWith(
      floor._id,
      camera._id,
      true,
    )
    expect(wrapper.get('.cctv-model-toggle').text()).toContain('YOLO ON')
    expect(wrapper.get('.cctv-model-toggle').classes()).toContain('enabled')
    expect(wrapper.get('.cctv-model-status').text()).toBe('Starting')
    expect(wrapper.find('.cctv-edit').element.previousElementSibling).not.toBeNull()
  })

  it('explains that CCTV Online and YOLO worker status are independent', async () => {
    const camera = {
      _id: 'camera-yolo',
      name: 'North entrance',
      cameraSelector: '344',
      cameraNo: '344',
      ipAddress: '192.0.2.34',
      rtspLink: '',
      cctvFileName: 'original.json',
      parkingSlotFileId: null,
      status: 'Online' as const,
      modelEnabled: true,
      modelRuntimeStatus: 'Offline' as const,
    }
    wrapper = mount(CCTVSetupList, {
      props: { selectedFloor: { ...floor, camera_presets: [camera] } },
    })
    await flushPromises()

    expect(wrapper.get('.cctv-model-status').text()).toBe('Offline')
    expect(wrapper.get('.model-runtime-hint').text()).toContain(
      'CCTV Online only confirms camera connectivity',
    )
    expect(wrapper.get('.cctv-model-toggle').classes()).toContain('enabled')
  })
})
