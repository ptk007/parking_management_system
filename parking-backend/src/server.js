const http = require('http')
const { URL } = require('url')
const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')

loadEnvFile()

const PORT = Number(process.env.PORT || 3000)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/parking_management_system'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'parking-local-secret'
const ALLOW_DEMO_AUTH = process.env.ALLOW_DEMO_AUTH !== 'false'
const CCTV_RTSP_USERNAME = process.env.CCTV_RTSP_USERNAME || 'mfustream'
const CCTV_RTSP_PASSWORD = process.env.CCTV_RTSP_PASSWORD || 'Mediamfu2025'
const CCTV_RTSP_PATH = process.env.CCTV_RTSP_PATH || '/Streaming/Channels/101/'
const CCTV_MEDIA_TIMEOUT_MS = Number(process.env.CCTV_MEDIA_TIMEOUT_MS || 15000)
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg'

const schemaOptions = { versionKey: false }

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

const User = mongoose.model(
  'User',
  new mongoose.Schema(
    {
      username: String,
      password: String,
      pin_code: String,
      name: String,
      role: Number,
      status: Number,
      date_add: String,
      time_add: String,
    },
    schemaOptions,
  ),
  'users',
)

const Vehicle = mongoose.model(
  'Vehicle',
  new mongoose.Schema(
    {
      veh_type: Number,
      name: String,
      license_num: { type: String, unique: true },
      province: String,
      veh_des: String,
      driver_face: String,
    },
    schemaOptions,
  ),
  'vehicles',
)

const ParkingZone = mongoose.model(
  'ParkingZone',
  new mongoose.Schema(
    {
      building: mongoose.Schema.Types.Mixed,
      floor: mongoose.Schema.Types.Mixed,
      veh_type: Number,
      date_add: String,
      time_add: String,
      parking_status: Number,
      park_map: String,
    },
    schemaOptions,
  ),
  'parking_zone',
)

const History = mongoose.model(
  'History',
  new mongoose.Schema(
    {
      role: Number,
      name: String,
      building: mongoose.Schema.Types.Mixed,
      floor: mongoose.Schema.Types.Mixed,
      slot_num: String,
      date_edit: String,
      time_edit: String,
      change_to: Number,
    },
    schemaOptions,
  ),
  'history',
)

const ParkingLog = mongoose.model(
  'ParkingLog',
  new mongoose.Schema(
    {
      building: mongoose.Schema.Types.Mixed,
      floor: mongoose.Schema.Types.Mixed,
      veh_type: Number,
      name: String,
      license_num: String,
      province: String,
      veh_des: String,
      park_date: String,
      exit_date: String,
      park_time: String,
      exit_time: String,
      park_slot: String,
      park_status: Number,
      face_entrance: String,
      face_exit: String,
    },
    schemaOptions,
  ),
  'parking_log',
)

const ParkingCctv = mongoose.model(
  'ParkingCctv',
  new mongoose.Schema(
    {
      cctv_name: String,
      cctv_link: String,
      cctv_ip: String,
      status: String,
      date_latest: String,
      time_latest: String,
      building: mongoose.Schema.Types.Mixed,
      floor: mongoose.Schema.Types.Mixed,
      veh_type: Number,
    },
    schemaOptions,
  ),
  'Parking_cctv',
)

const ParkingSlot = mongoose.model(
  'ParkingSlot',
  new mongoose.Schema(
    {
      slot_num: { type: String, unique: true },
      slot_status: Number,
      building: mongoose.Schema.Types.Mixed,
      floor: mongoose.Schema.Types.Mixed,
      veh_type: Number,
    },
    schemaOptions,
  ),
  'parking_slots',
)

const cctvInfoSchema = new mongoose.Schema(
  {
    NO: String,
    'IP ADDRESS': String,
    'CAMERA NAME_NEW': String,
    BUILDING: mongoose.Schema.Types.Mixed,
    FLOOR: mongoose.Schema.Types.Mixed,
    POSITION: String,
    Latitude: String,
    Longtitude: String,
    Location: String,
    'enable rtsp': String,
    'ANPR&PTZ RTSP': String,
    PTZ: String,
  },
  { strict: false, versionKey: false },
)

const CctvInfo2 = mongoose.model('CctvInfo2', cctvInfoSchema, 'cctvinfo2')
const OldCctvInfo4 = mongoose.model('OldCctvInfo4', cctvInfoSchema, 'oldcctvinfo4')

const resources = {
  users: { model: User, unique: [] },
  vehicles: { model: Vehicle, unique: ['license_num'] },
  'parking-zones': { model: ParkingZone, unique: ['building', 'floor', 'veh_type'] },
  history: { model: History, unique: [] },
  'parking-logs': { model: ParkingLog, unique: [] },
  cctv: { model: ParkingCctv, unique: [] },
  'parking-slots': { model: ParkingSlot, unique: ['slot_num'] },
  cctvinfo2: { model: CctvInfo2, unique: [] },
  oldcctvinfo4: { model: OldCctvInfo4, unique: [] },
}

const roleLabels = { 1: 'user', 2: 'staff', 3: 'admin' }
const userStatusLabels = { 1: 'online', 2: 'offline', 3: 'disabled' }
const slotStatusLabels = { 1: 'available', 2: 'occupied', 3: 'incoming', 4: 'disabled' }
const slotStatusNumbers = { available: 1, occupied: 2, incoming: 3, disabled: 4, disable: 4 }
const vehicleTypeNumbers = { car: 1, cars: 1, motorcycle: 2, motorcycles: 2 }
const parkingStatusLabels = { 1: 'parking', 2: 'exited', 3: 'notParking' }

function todayParts() {
  const now = new Date()
  return {
    date: now.toLocaleDateString('en-GB'),
    time: now.toLocaleTimeString('en-GB', { hour12: false }),
    iso: now.toISOString(),
  }
}

function parseVehicleType(value) {
  if (value === undefined || value === null || value === '') return undefined
  const normalized = String(value).toLowerCase()
  return vehicleTypeNumbers[normalized] || Number(value)
}

function signToken(user) {
  const payload = {
    id: String(user._id),
    username: user.username,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000,
  }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')
  return `${body}.${signature}`
}

function verifyToken(token) {
  if (ALLOW_DEMO_AUTH && /^demo_token_\d+$/.test(token || '')) {
    return {
      id: 'demo',
      username: 'demo',
      role: 2,
      exp: Date.now() + 24 * 60 * 60 * 1000,
    }
  }
  if (!token || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(body).digest('base64url')
  if (Buffer.byteLength(signature) !== Buffer.byteLength(expected)) return null
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return payload.exp > Date.now() ? payload : null
  } catch (error) {
    return null
  }
}

function userDto(user) {
  return {
    id: String(user._id),
    username: user.username,
    fullName: user.name || user.username,
    role: roleLabels[user.role] || 'user',
    buildingId: 'E4',
    floorId: '4',
    status: userStatusLabels[user.status] || 'offline',
    avatar: (user.name || user.username || 'U').slice(0, 2).toUpperCase(),
  }
}

function slotDto(slot) {
  return {
    _id: String(slot._id),
    slotNumber: slot.slot_num,
    floorId: String(slot.floor ?? ''),
    vehicleType: parseVehicleType(slot.veh_type) === 2 ? 'motorcycles' : 'cars',
    status: slotStatusLabels[slot.slot_status] || 'available',
    currentVehicle: null,
    lastUpdated: new Date().toISOString(),
  }
}

function logDto(log) {
  return {
    _id: String(log._id),
    ownerName: log.name,
    licenseNumber: log.license_num,
    province: log.province,
    vehicleDescription: log.veh_des,
    entryTime: combineDateTime(log.park_date, log.park_time),
    exitTime: log.exit_date || log.exit_time ? combineDateTime(log.exit_date, log.exit_time) : null,
    parkingSlot: log.park_slot,
    parkingStatus: parkingStatusLabels[log.park_status] || 'notParking',
    faceRecognition: {
      entryPhoto: log.face_entrance || null,
      exitPhoto: log.face_exit || null,
    },
  }
}

function isRtspEnabled(camera) {
  const value = String(camera['enable rtsp'] || camera.enable_rtsp || '').trim().toLowerCase()
  return ['1', 'ok', 'true', 'yes', 'enable', 'enabled'].includes(value)
}

function defaultRtspPath() {
  return CCTV_RTSP_PATH.startsWith('/') ? CCTV_RTSP_PATH : `/${CCTV_RTSP_PATH}`
}

function defaultRtspUrl(ipAddress) {
  const ip = String(ipAddress || '').trim()
  if (!ip) return ''
  const host = /:\d+$/.test(ip) ? ip : `${ip}:554`
  const username = encodeURIComponent(CCTV_RTSP_USERNAME)
  const password = encodeURIComponent(CCTV_RTSP_PASSWORD)
  return `rtsp://${username}:${password}@${host}${defaultRtspPath()}`
}

function resolveCameraStreamUrl(camera) {
  const explicitUrl = camera.cctv_link || camera['ANPR&PTZ RTSP'] || camera.PTZ || ''
  if (explicitUrl) return explicitUrl
  if (!isRtspEnabled(camera)) return ''
  return defaultRtspUrl(camera.cctv_ip || camera['IP ADDRESS'])
}

function streamProtocol(streamUrl) {
  return String(streamUrl || '').split(':', 1)[0].toLowerCase()
}

function mediaPaths(cameraId, streamUrl) {
  if (!streamUrl) return { snapshotUrl: '', mjpegUrl: '' }
  return {
    snapshotUrl: `/api/staff/cctv/cameras/${cameraId}/snapshot.jpg`,
    mjpegUrl: `/api/staff/cctv/cameras/${cameraId}/mjpeg`,
  }
}

function cameraDto(camera) {
  const streamUrl = resolveCameraStreamUrl(camera)
  const paths = mediaPaths(camera._id, streamUrl)
  return {
    _id: String(camera._id),
    name: camera.cctv_name,
    ipAddress: camera.cctv_ip,
    buildingId: String(camera.building ?? ''),
    floorId: String(camera.floor ?? ''),
    status: String(camera.status || (streamUrl ? 'online' : 'offline')).toLowerCase(),
    streamUrl,
    streamProtocol: streamProtocol(streamUrl),
    ...paths,
    lastUpdate: combineDateTime(camera.date_latest, camera.time_latest),
  }
}

function rawCctvDto(camera) {
  const streamUrl = resolveCameraStreamUrl(camera)
  const paths = mediaPaths(camera._id, streamUrl)
  return {
    _id: String(camera._id),
    name: camera['CAMERA NAME_NEW'] || camera.Location || `Camera ${camera.NO || ''}`.trim(),
    ipAddress: camera['IP ADDRESS'] || '',
    buildingId: String(camera.BUILDING ?? ''),
    floorId: String(camera.FLOOR ?? ''),
    status: streamUrl ? 'online' : 'offline',
    streamUrl,
    streamProtocol: streamProtocol(streamUrl),
    ...paths,
    lastUpdate: null,
    sourceCollection: camera._sourceCollection,
    raw: camera,
  }
}

function historyDto(row) {
  return {
    _id: String(row._id),
    staffName: row.name,
    building: String(row.building ?? ''),
    floor: String(row.floor ?? ''),
    parkingSlots: row.slot_num ? String(row.slot_num).split(',').map((slot) => slot.trim()) : [],
    dateEdited: combineDateTime(row.date_edit, row.time_edit),
    timeEdited: row.time_edit,
    statusChangedTo: row.change_to === 1 ? 'enable' : 'disable',
  }
}

function combineDateTime(date, time) {
  if (!date && !time) return null
  const value = `${date || '1970-01-01'} ${time || '00:00:00'}`
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

function writeJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  })
  res.end(JSON.stringify(payload))
}

function writeMediaHeaders(res, status, headers) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Cache-Control': 'no-store',
    ...headers,
  })
}

function ffmpegInputArgs(streamUrl) {
  const args = ['-hide_banner', '-loglevel', 'error']
  if (streamProtocol(streamUrl) === 'rtsp') {
    args.push('-rtsp_transport', 'tcp', '-stimeout', '5000000')
  }
  args.push('-i', streamUrl)
  return args
}

function collectFfmpegError(child) {
  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
    if (stderr.length > 2000) stderr = stderr.slice(-2000)
  })
  return () => stderr.trim()
}

function proxyCameraSnapshot(res, camera) {
  if (!camera.streamUrl) return writeJson(res, 404, { message: 'Camera stream URL is not configured' })

  const args = [
    ...ffmpegInputArgs(camera.streamUrl),
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    'pipe:1',
  ]
  const ffmpeg = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const getStderr = collectFfmpegError(ffmpeg)
  const chunks = []
  let responded = false

  const timeout = setTimeout(() => {
    if (!responded) ffmpeg.kill()
  }, CCTV_MEDIA_TIMEOUT_MS)

  ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk))

  ffmpeg.on('error', (error) => {
    clearTimeout(timeout)
    if (responded) return
    responded = true
    writeJson(res, 502, { message: 'Unable to start ffmpeg for camera snapshot', error: error.message })
  })

  ffmpeg.on('close', () => {
    clearTimeout(timeout)
    if (responded) return
    responded = true
    if (chunks.length > 0) {
      writeMediaHeaders(res, 200, { 'Content-Type': 'image/jpeg' })
      return res.end(Buffer.concat(chunks))
    }
    return writeJson(res, 502, {
      message: 'Unable to capture camera snapshot',
      error: getStderr() || 'ffmpeg exited without image data',
    })
  })
}

function proxyCameraMjpeg(req, res, camera) {
  if (!camera.streamUrl) return writeJson(res, 404, { message: 'Camera stream URL is not configured' })

  const args = [
    ...ffmpegInputArgs(camera.streamUrl),
    '-an',
    '-vf',
    'fps=5',
    '-q:v',
    '5',
    '-f',
    'mpjpeg',
    '-boundary_tag',
    'ffmpeg',
    'pipe:1',
  ]
  const ffmpeg = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const getStderr = collectFfmpegError(ffmpeg)
  let responded = false

  const timeout = setTimeout(() => {
    if (!responded) ffmpeg.kill()
  }, CCTV_MEDIA_TIMEOUT_MS)

  const fail = (message, error) => {
    clearTimeout(timeout)
    if (responded || res.headersSent) return
    responded = true
    writeJson(res, 502, { message, error })
  }

  ffmpeg.stdout.on('data', (chunk) => {
    clearTimeout(timeout)
    if (!responded) {
      responded = true
      writeMediaHeaders(res, 200, {
        'Content-Type': 'multipart/x-mixed-replace;boundary=ffmpeg',
        Connection: 'close',
      })
    }
    res.write(chunk)
  })

  ffmpeg.on('error', (error) => {
    fail('Unable to start ffmpeg for camera stream', error.message)
  })

  ffmpeg.on('close', () => {
    clearTimeout(timeout)
    if (!responded) {
      return writeJson(res, 502, {
        message: 'Unable to open camera stream',
        error: getStderr() || 'ffmpeg exited without stream data',
      })
    }
    if (!res.writableEnded) res.end()
  })

  req.on('close', () => {
    if (!ffmpeg.killed) ffmpeg.kill()
  })
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      if (!data) return resolve({})
      try {
        resolve(JSON.parse(data))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function authUser(req, query) {
  const header = req.headers.authorization || ''
  const headerToken = header.replace(/^Bearer\s+/i, '')
  const queryToken = query?.get('token') || ''
  return verifyToken(headerToken || queryToken)
}

function buildFilter(query) {
  const filter = {}
  const building = query.get('building') || query.get('buildingId')
  const floor = query.get('floor') || query.get('floorId')
  const vehType = parseVehicleType(query.get('vehicleType') || query.get('veh_type'))
  if (building) filter.building = building
  if (floor) filter.floor = floor
  if (vehType) filter.veh_type = vehType
  return filter
}

function buildRawCctvFilter(query) {
  const filter = {}
  const building = query.get('building') || query.get('buildingId')
  const floor = query.get('floor') || query.get('floorId')
  if (building) filter.BUILDING = building
  if (floor) filter.FLOOR = { $in: [floor, '', null] }
  return filter
}

async function ensureIndexes() {
  await Vehicle.collection.createIndex({ license_num: 1 }, { unique: true })
  await ParkingSlot.collection.createIndex({ slot_num: 1 }, { unique: true })
  await ParkingZone.collection.createIndex({ building: 1, floor: 1, veh_type: 1 }, { unique: true })
  await CctvInfo2.collection.createIndex({ 'IP ADDRESS': 1 })
  await OldCctvInfo4.collection.createIndex({ 'IP ADDRESS': 1 })
}

async function seedJsonCollection(model, fileName) {
  const existingCount = await model.estimatedDocumentCount()
  if (existingCount > 0) return

  const filePath = path.join(__dirname, fileName)
  if (!fs.existsSync(filePath)) return

  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''))
  if (!Array.isArray(rows) || rows.length === 0) return
  await model.insertMany(rows, { ordered: false })
  console.log(`Seeded ${rows.length} documents into ${model.collection.name}`)
}

async function seedJsonCollections() {
  await seedJsonCollection(CctvInfo2, 'cctvinfo2.json')
  await seedJsonCollection(OldCctvInfo4, 'oldcctvinfo4.json')
}

async function findCameraDtoById(cameraId) {
  const camera = await ParkingCctv.findById(cameraId).lean()
  if (camera) return cameraDto(camera)

  const cctvInfo2 = await CctvInfo2.findById(cameraId).lean()
  if (cctvInfo2) return rawCctvDto({ ...cctvInfo2, _sourceCollection: 'cctvinfo2' })

  const oldCctvInfo4 = await OldCctvInfo4.findById(cameraId).lean()
  if (oldCctvInfo4) return rawCctvDto({ ...oldCctvInfo4, _sourceCollection: 'oldcctvinfo4' })

  return null
}

async function handleAuth(req, res, pathParts) {
  if (req.method === 'POST' && pathParts[2] === 'login') {
    const body = await readBody(req)
    const user = await User.findOne({ username: body.username, password: body.password, status: { $ne: 3 } })
    if (!user) return writeJson(res, 401, { message: 'Invalid username or password' })
    user.status = 1
    await user.save()
    return writeJson(res, 200, { token: signToken(user), user: userDto(user) })
  }

  const payload = authUser(req)
  if (!payload) return writeJson(res, 401, { message: 'Invalid or expired token', code: 'INVALID_TOKEN' })

  if (req.method === 'POST' && pathParts[2] === 'logout') {
    await User.findByIdAndUpdate(payload.id, { status: 2 })
    return writeJson(res, 200, { message: 'Logged out successfully' })
  }

  if (req.method === 'GET' && pathParts[2] === 'verify') {
    const user = await User.findById(payload.id)
    return writeJson(res, 200, { valid: Boolean(user), user: user ? userDto(user) : null })
  }

  return writeJson(res, 404, { message: 'Resource not found' })
}

async function handleStaff(req, res, pathParts, query) {
  const payload = authUser(req, query)
  if (!payload) return writeJson(res, 401, { message: 'Invalid or expired token', code: 'INVALID_TOKEN' })

  if (req.method === 'GET' && pathParts[2] === 'dashboard') {
    const filter = buildFilter(query)
    const slots = await ParkingSlot.find(filter).lean()
    const count = (status) => slots.filter((slot) => slot.slot_status === status).length
    return writeJson(res, 200, {
      totalSlots: slots.length,
      available: count(1),
      incoming: count(3),
      occupied: count(2),
      disabled: count(4),
    })
  }

  if (req.method === 'GET' && pathParts[2] === 'parking' && pathParts[3] === 'slots') {
    const slots = await ParkingSlot.find(buildFilter(query)).sort({ slot_num: 1 }).lean()
    return writeJson(res, 200, slots.map(slotDto))
  }

  if (req.method === 'PUT' && pathParts[2] === 'parking' && pathParts[3] === 'slots' && pathParts[4]) {
    const body = await readBody(req)
    const nextStatus = slotStatusNumbers[String(body.status || '').toLowerCase()]
    if (!nextStatus) return writeJson(res, 400, { message: 'Invalid slot status' })
    const slot = await ParkingSlot.findByIdAndUpdate(pathParts[4], { slot_status: nextStatus }, { new: true })
    if (!slot) return writeJson(res, 404, { message: 'Resource not found' })
    const staff = await User.findById(payload.id).lean()
    const parts = todayParts()
    await History.create({
      role: 2,
      name: staff?.name || staff?.username || 'staff',
      building: slot.building,
      floor: slot.floor,
      slot_num: slot.slot_num,
      date_edit: parts.date,
      time_edit: parts.time,
      change_to: nextStatus === 4 ? 2 : 1,
    })
    return writeJson(res, 200, slotDto(slot))
  }

  if (req.method === 'GET' && pathParts[2] === 'logs') {
    const logs = await ParkingLog.find(buildFilter(query)).sort({ _id: -1 }).lean()
    return writeJson(res, 200, logs.map(logDto))
  }

  if (req.method === 'GET' && pathParts[2] === 'cctv' && pathParts[3] === 'cameras' && !pathParts[4]) {
    const [cameras, cctvInfo2, oldCctvInfo4] = await Promise.all([
      ParkingCctv.find(buildFilter(query)).lean(),
      CctvInfo2.find(buildRawCctvFilter(query)).lean(),
      OldCctvInfo4.find(buildRawCctvFilter(query)).lean(),
    ])

    const rawCameras = [
      ...cctvInfo2.map((camera) => ({ ...camera, _sourceCollection: 'cctvinfo2' })),
      ...oldCctvInfo4.map((camera) => ({ ...camera, _sourceCollection: 'oldcctvinfo4' })),
    ]

    return writeJson(res, 200, [...cameras.map(cameraDto), ...rawCameras.map(rawCctvDto)])
  }

  if (req.method === 'GET' && pathParts[2] === 'cctv' && pathParts[3] === 'cameras' && pathParts[4]) {
    const camera = await findCameraDtoById(pathParts[4])
    if (!camera) return writeJson(res, 404, { message: 'Resource not found' })
    if (pathParts[5] === 'stream') {
      return writeJson(res, 200, { streamUrl: camera.streamUrl, protocol: camera.streamProtocol })
    }
    if (pathParts[5] === 'snapshot') {
      return writeJson(res, 200, { snapshotUrl: camera.snapshotUrl, sourceUrl: camera.streamUrl })
    }
    if (pathParts[5] === 'snapshot.jpg') return proxyCameraSnapshot(res, camera)
    if (pathParts[5] === 'mjpeg') return proxyCameraMjpeg(req, res, camera)
    return writeJson(res, 200, camera)
  }

  if (req.method === 'GET' && pathParts[2] === 'history') {
    const rows = await History.find({ role: 2 }).sort({ _id: -1 }).lean()
    return writeJson(res, 200, rows.map(historyDto))
  }

  if (req.method === 'GET' && pathParts[2] === 'profile') {
    const user = await User.findById(payload.id)
    if (!user) return writeJson(res, 404, { message: 'Resource not found' })
    if (pathParts[3] === 'assigned-area') {
      const slots = await ParkingSlot.find({ building: 'E4', floor: '4' }).select('slot_num').lean()
      return writeJson(res, 200, {
        building: { _id: 'E4', name: 'E4', floors: 4 },
        floor: { _id: '4', number: 4, totalSlots: slots.length },
        assignedSlots: slots.map((slot) => slot.slot_num),
      })
    }
    return writeJson(res, 200, userDto(user))
  }

  if (req.method === 'PUT' && pathParts[2] === 'profile') {
    const body = await readBody(req)
    const allowed = {}
    if (body.password) allowed.password = body.password
    if (body.pin_code) allowed.pin_code = body.pin_code
    await User.findByIdAndUpdate(payload.id, allowed)
    return writeJson(res, 200, { message: 'Profile updated successfully' })
  }

  if (pathParts[2] === 'chat') {
    return writeJson(res, 501, { message: 'Chat API needs a database collection before it can be persisted.' })
  }

  return writeJson(res, 404, { message: 'Resource not found' })
}

async function duplicateFilter(resource, body) {
  if (resource === 'vehicles') return body.license_num ? { license_num: body.license_num } : null
  if (resource === 'parking-slots') return body.slot_num ? { slot_num: body.slot_num } : null
  if (resource === 'parking-zones') {
    if (!body.building || !body.floor || !body.veh_type) return null
    return { building: body.building, floor: body.floor, veh_type: body.veh_type }
  }
  return null
}

async function handleResource(req, res, pathParts, query) {
  const resourceName = pathParts[1]
  const resource = resources[resourceName]
  if (!resource) return writeJson(res, 404, { message: 'Resource not found' })

  if (pathParts[2] === 'check-duplicate') {
    const filter = {}
    for (const [key, value] of query.entries()) filter[key] = key === 'veh_type' ? Number(value) : value
    const exists = Object.keys(filter).length > 0 ? await resource.model.exists(filter) : false
    return writeJson(res, 200, { duplicate: Boolean(exists) })
  }

  if (req.method === 'GET' && !pathParts[2]) {
    const rows = await resource.model.find({}).sort({ _id: -1 }).lean()
    return writeJson(res, 200, rows)
  }

  if (req.method === 'GET' && pathParts[2]) {
    const row = await resource.model.findById(pathParts[2]).lean()
    return row ? writeJson(res, 200, row) : writeJson(res, 404, { message: 'Resource not found' })
  }

  if (req.method === 'POST') {
    const body = await readBody(req)
    const filter = await duplicateFilter(resourceName, body)
    if (filter && (await resource.model.exists(filter))) {
      return writeJson(res, 409, { message: 'Duplicate value is not allowed' })
    }
    const created = await resource.model.create(body)
    return writeJson(res, 201, created)
  }

  if (req.method === 'PUT' && pathParts[2]) {
    const body = await readBody(req)
    const row = await resource.model.findByIdAndUpdate(pathParts[2], body, { new: true, runValidators: true })
    return row ? writeJson(res, 200, row) : writeJson(res, 404, { message: 'Resource not found' })
  }

  if (req.method === 'DELETE' && pathParts[2]) {
    const row = await resource.model.findByIdAndDelete(pathParts[2])
    return row ? writeJson(res, 200, { message: 'Deleted successfully' }) : writeJson(res, 404, { message: 'Resource not found' })
  }

  return writeJson(res, 405, { message: 'Method not allowed' })
}

async function requestHandler(req, res) {
  if (req.method === 'OPTIONS') return writeJson(res, 204, {})

  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const pathParts = url.pathname.split('/').filter(Boolean)

    if (url.pathname === '/health') {
      return writeJson(res, 200, { ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
    }

    if (pathParts[0] !== 'api') return writeJson(res, 404, { message: 'Resource not found' })
    if (pathParts[1] === 'auth') return handleAuth(req, res, pathParts)
    if (pathParts[1] === 'staff') return handleStaff(req, res, pathParts, url.searchParams)
    return handleResource(req, res, pathParts, url.searchParams)
  } catch (error) {
    const status = error?.code === 11000 ? 409 : 500
    writeJson(res, status, { message: status === 409 ? 'Duplicate value is not allowed' : 'Internal server error', error: error.message })
  }
}

async function start() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(MONGODB_URI)
  await ensureIndexes()
  await seedJsonCollections()

  http.createServer(requestHandler).listen(PORT, () => {
    console.log(`Parking API running on http://localhost:${PORT}`)
  })
}

start().catch((error) => {
  console.error('Failed to start API:', error)
  process.exit(1)
})
