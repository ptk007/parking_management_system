const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const mongoose = require("mongoose");
const ExcelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

process.env.JWT_SECRET = "parking-log-integration-test-only";
process.env.PARKING_MODEL_API_KEY = "parking-log-model-test-only";
const app = require("../server");
const User = require("../api/models/userModel");
const Vehicle = require("../api/models/vehicleModel");
const ParkingBuilding = require("../api/models/parkingBuildingModel");
const ParkingLogCounter = require("../api/models/parkingLogCounterModel");
const ParkingFloor = require("../api/models/parkingFloorModel");
const ParkingLog = require("../api/models/parkingLogModel");
const pythonModelRuntime = require("../api/services/pythonModelRuntime");
const database = `parking_log_test_${randomUUID().replaceAll("-", "")}`;
const actorTokens = {};
let server;
let origin;
let building;
let floor;
let cameraId;
let owner;

before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, {
    serverSelectionTimeoutMS: 3000,
  });
  await Promise.all([
    User.init(),
    Vehicle.init(),
    ParkingBuilding.init(),
    ParkingLogCounter.init(),
    ParkingFloor.init(),
    ParkingLog.init(),
  ]);
  owner = await User.create({
    username: "parking-log-owner",
    password: "test-password",
    name: "Parking Owner",
    role: "user",
    status: "online",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
    date_add: "2026-11-04",
    time_add: "12:00:00",
  });
  const admin = await User.create({
    username: "parking-log-admin",
    password: "test-password",
    name: "Parking Admin",
    role: "admin",
    status: "online",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
    date_add: "2026-11-04",
    time_add: "12:00:00",
  });
  const other = await User.create({
    username: "parking-log-other",
    password: "test-password",
    name: "Other Owner",
    role: "user",
    status: "online",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
    date_add: "2026-11-04",
    time_add: "12:00:00",
  });
  for (const [name, user] of Object.entries({ owner, admin, other })) {
    actorTokens[name] = jwt.sign(
      { userId: String(user._id), role: user.role },
      process.env.JWT_SECRET,
    );
  }
  building = await ParkingBuilding.create({
    building_name: "Parking Log Test Building",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
  });
  const floorDocument = await ParkingFloor.create({
    building: building._id,
    floor: 4,
    veh_type: "car",
    status: "Disable",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
    camera_presets: [
      {
        name: "Test camera",
        cctvFileName: "camera-source.json",
        cameraNo: "CAM-1",
        parkingSlotData: {
          categories: [
            { name: "zoneA_slot01", supercategory: "parking-slot" },
          ],
        },
      },
    ],
    parking_map: {
      version: 2,
      sourceName: "Test map",
      slots: [
        {
          number: 7,
          zone: "default",
          status: "available",
          cameraPresetId: "",
          parkingSlotName: "zoneA_slot01",
        },
      ],
      layout: { shapes: [], positions: {} },
    },
  });
  cameraId = String(floorDocument.camera_presets[0]._id);
  floorDocument.parking_map.slots[0].cameraPresetId = cameraId;
  floorDocument.markModified("parking_map");
  await floorDocument.save();
  floor = floorDocument;
  await Vehicle.create({
    veh_type: "car",
    name: owner._id,
    brand: "Toyota",
    model: "Corolla",
    color: "Blue",
    license_num: "TEST-123",
    province: "เชียงราย",
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}/api/parking-logs`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    mongoose.connection.readyState === 1 &&
    mongoose.connection.name === database &&
    database.startsWith("parking_log_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function request(
  path,
  { method = "GET", actor, modelKey, body, baseUrl = origin, raw = false } = {},
) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(actor ? { Authorization: `Bearer ${actorTokens[actor]}` } : {}),
      ...(modelKey ? { "x-model-api-key": modelKey } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (raw) {
    return {
      status: response.status,
      headers: response.headers,
      body: Buffer.from(await response.arrayBuffer()),
    };
  }
  return {
    status: response.status,
    body: response.status === 204 ? null : await response.json(),
  };
}

function event(eventType, occurredAt = new Date().toISOString()) {
  return {
    event: eventType,
    floorId: String(floor._id),
    cameraPresetId: cameraId,
    license_plate: "TEST-123",
    province: "เชียงราย",
    parkingSlotName:
      eventType === "Not parking" ? undefined : "zoneA_slot01",
    occurredAt,
  };
}

test("model event endpoint requires its configured model key", async () => {
  const denied = await request("/model-events", {
    method: "POST",
    body: event("Parking"),
    modelKey: "wrong-key",
  });
  assert.equal(denied.status, 401);
});

test("parking creates an owned session, updates its map slot, exits, and re-entry creates a new log", async () => {
  const parked = await request("/model-events", {
    method: "POST",
    body: event("Parking", "2026-11-04T06:00:00.000Z"),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(parked.status, 201);
  assert.equal(parked.body.log.park_status, "Parking");
  assert.equal(parked.body.log.park_slot, 7);
  assert.equal(parked.body.log.building, building.building_name);
  assert.equal(parked.body.log.floor, 4);
  assert.equal(String(parked.body.log.owner), String(owner._id));
  const firstId = parked.body.log._id;
  let savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "occupied");

  const duplicate = await request("/model-events", {
    method: "POST",
    body: event("Parking", "2026-11-04T06:00:01.000Z"),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.created, false);
  assert.equal(await ParkingLog.countDocuments({ park_status: "Parking" }), 1);

  const exited = await request("/model-events", {
    method: "POST",
    body: event("Exited", "2026-11-04T07:00:00.000Z"),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(exited.status, 200);
  assert.equal(exited.body.log._id, firstId);
  assert.equal(exited.body.log.park_status, "Exited");
  assert.equal(exited.body.log.date_exit, "2026-11-04");
  savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "available");

  const reparked = await request("/model-events", {
    method: "POST",
    body: event("Parking", "2026-11-04T08:00:00.000Z"),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(reparked.status, 201);
  assert.notEqual(reparked.body.log._id, firstId);

  const disabledFloor = await ParkingFloor.findById(floor._id);
  disabledFloor.parking_map.slots[0].status = "disabled";
  disabledFloor.markModified("parking_map");
  await disabledFloor.save();
  const adminLogs = await request("/", { actor: "admin" });
  const activeLog = adminLogs.body.logs.find(
    (log) => log._id === reparked.body.log._id,
  );
  assert.equal(activeLog.slotDisabled, true);

  const exitedDisabledSlot = await request("/model-events", {
    method: "POST",
    body: event("Exited", "2026-11-04T09:00:00.000Z"),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(exitedDisabledSlot.body.log.park_status, "Exited");
  const stillDisabled = await ParkingFloor.findById(floor._id);
  assert.equal(stillDisabled.parking_map.slots[0].status, "disabled");
});

test("unmatched vehicles create sequential Guest logs immediately and remain out of user history", async () => {
  const guestParkingEvent = {
    ...event("Parking"),
    license_plate: "GUEST-123",
  };
  const parked = await request("/model-events", {
    method: "POST",
    body: guestParkingEvent,
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(parked.status, 201);
  assert.equal(parked.body.matchedVehicle, false);
  assert.equal(parked.body.log.owner, null);
  assert.equal(parked.body.log.name, "Guest 1");
  assert.equal(parked.body.log.brand, "Unknown");

  const repeated = await request("/model-events", {
    method: "POST",
    body: guestParkingEvent,
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.created, false);
  assert.equal(repeated.body.log._id, parked.body.log._id);

  const exited = await request("/model-events", {
    method: "POST",
    body: {
      ...guestParkingEvent,
      event: "Exited",
      occurredAt: new Date(Date.now() + 1000).toISOString(),
    },
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(exited.status, 200);
  assert.equal(exited.body.log.name, "Guest 1");
  assert.equal(exited.body.log.park_status, "Exited");

  const unmatchedDetection = await request("/model-events", {
    method: "POST",
    body: { ...event("Not parking"), license_plate: "GUEST-456" },
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(unmatchedDetection.status, 201);
  assert.equal(unmatchedDetection.body.log.name, "Guest 2");
  assert.equal(unmatchedDetection.body.log.park_status, "Not parking");

  const adminLogs = await request("/", { actor: "admin" });
  assert.ok(adminLogs.body.logs.some((log) => log.name === "Guest 1"));
  assert.ok(adminLogs.body.logs.some((log) => log.name === "Guest 2"));
  const ownHistory = await request("/me", { actor: "owner" });
  assert.ok(ownHistory.body.logs.every((log) => log.owner === String(owner._id)));
});

test("user history is owner-scoped and retains Exited and Not parking records beyond 24 hours", async () => {
  const notParkingTime = new Date();
  const notParking = await request("/model-events", {
    method: "POST",
    body: event("Not parking", notParkingTime.toISOString()),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(notParking.status, 201);
  assert.equal(notParking.body.log.park_status, "Not parking");
  const repeatedNotParking = await request("/model-events", {
    method: "POST",
    body: event("Not parking", new Date(notParkingTime.getTime() + 1000).toISOString()),
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(repeatedNotParking.status, 200);
  assert.equal(repeatedNotParking.body.created, false);

  const ownVisible = await request("/me", { actor: "owner" });
  assert.equal(ownVisible.status, 200);
  assert.ok(ownVisible.body.logs.length >= 1);
  const forbidden = await request("/", { actor: "owner" });
  assert.equal(forbidden.status, 403);
  const adminLogs = await request("/", { actor: "admin" });
  assert.equal(adminLogs.status, 200);

  const ownExited = await ParkingLog.findOne({ owner: owner._id, park_status: "Exited" });
  await ParkingLog.collection.updateMany(
    { owner: owner._id, park_status: "Exited" },
    { $set: { updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } },
  );
  const ownNotParking = await ParkingLog.findById(notParking.body.log._id);
  await ParkingLog.collection.updateOne(
    { _id: ownNotParking._id },
    { $set: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) } },
  );
  const otherVehicle = await Vehicle.create({
    veh_type: "car",
    name: (await User.findOne({ username: "parking-log-other" }))._id,
    brand: "Honda",
    model: "Civic",
    color: "White",
    license_num: "OTHER-123",
    province: "เชียงราย",
  });
  assert.ok(otherVehicle);
  const ownAfterExpiry = await request("/me", { actor: "owner" });
  assert.ok(
    ownAfterExpiry.body.logs.some((log) => log._id === String(ownExited._id)),
  );
  assert.ok(
    ownAfterExpiry.body.logs.some(
      (log) => log._id === String(ownNotParking._id),
    ),
  );
  assert.ok(
    ownAfterExpiry.body.logs.every(
      (log) => log.owner === String(owner._id),
    ),
  );
  const otherVisible = await request("/me", { actor: "other" });
  assert.deepEqual(otherVisible.body.logs, []);
});

test("model events bind by camera number and source filename and infer province", async () => {
  const registeredDetection = await request("/model-events", {
    method: "POST",
    body: {
      event: "Not parking",
      cameraNo: "CAM-1",
      cctvFileName: "camera-source.json",
      license_plate: "TEST-123",
    },
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(registeredDetection.status, 201);
  assert.equal(registeredDetection.body.log.province, "เชียงราย");
  assert.equal(String(registeredDetection.body.log.owner), String(owner._id));

  const guestDetection = await request("/model-events", {
    method: "POST",
    body: {
      event: "Not parking",
      cameraNo: "CAM-1",
      cctvFileName: "camera-source.json",
      license_plate: "UNKNOWN-789",
    },
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(guestDetection.status, 201);
  assert.equal(guestDetection.body.log.province, "Unknown");
  assert.equal(guestDetection.body.log.owner, null);
  assert.match(guestDetection.body.log.name, /^Guest \d+$/);
});

test("model events reject ambiguous camera/source bindings", async () => {
  await ParkingFloor.create({
    building: building._id,
    floor: 5,
    veh_type: "car",
    status: "Disable",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
    camera_presets: [
      {
        name: "Duplicate test camera",
        cctvFileName: "camera-source.json",
        cameraNo: "CAM-1",
      },
    ],
  });
  const ambiguous = await request("/model-events", {
    method: "POST",
    body: {
      event: "Not parking",
      cameraNo: "CAM-1",
      cctvFileName: "camera-source.json",
      license_plate: "AMBIGUOUS-1",
    },
    modelKey: process.env.PARKING_MODEL_API_KEY,
  });
  assert.equal(ambiguous.status, 409);
  assert.match(ambiguous.body.message, /ambiguous/i);
});

test("YOLO map-only status updates follow map names without writing parking history", async () => {
  floor.parking_map.slots[0].status = "available";
  floor.markModified("parking_map");
  await floor.save();
  const before = await ParkingLog.countDocuments({ floorId: floor._id });
  const updateSlotStatus = (slotStatus, licensePlateDetected) =>
    request("/model-slot-status", {
      method: "POST",
      modelKey: process.env.PARKING_MODEL_API_KEY,
      body: {
        floorId: String(floor._id),
        cameraPresetId: cameraId,
        parkingSlotName: "zoneA_slot01",
        slotStatus,
        ...(licensePlateDetected !== undefined ? { licensePlateDetected } : {}),
      },
    });

  const incoming = await updateSlotStatus("incoming");
  assert.equal(incoming.status, 200);
  let savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "incoming");
  assert.equal(await ParkingLog.countDocuments({ floorId: floor._id }), before);

  const occupied = await updateSlotStatus("occupied", false);
  assert.equal(occupied.status, 200);
  savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "occupied");
  assert.equal(savedFloor.parking_map.slots[0].licensePlateDetected, false);
  assert.equal(await ParkingLog.countDocuments({ floorId: floor._id }), before);

  const available = await updateSlotStatus("available");
  assert.equal(available.status, 200);
  savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "available");
  assert.equal(savedFloor.parking_map.slots[0].licensePlateDetected, undefined);
  assert.equal(await ParkingLog.countDocuments({ floorId: floor._id }), before);

  const occupiedWithoutPlate = await updateSlotStatus("occupied", false);
  assert.equal(occupiedWithoutPlate.status, 200);
  const recognizedPlateEvent = await request("/model-events", {
    method: "POST",
    modelKey: process.env.PARKING_MODEL_API_KEY,
    body: {
      event: "Parking",
      floorId: String(floor._id),
      cameraPresetId: cameraId,
      license_plate: "IDENTITY-READ-1",
      province: "à¹€à¸Šà¸µà¸¢à¸‡à¸£à¸²à¸¢",
      parkingSlotName: "zoneA_slot01",
    },
  });
  assert.equal(recognizedPlateEvent.status, 201);
  savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].licensePlateDetected, true);
  assert.equal(await ParkingLog.countDocuments({ floorId: floor._id }), before + 1);
});

test("disabled map slots are sent to Python while normal parking logs are retained", async () => {
  await ParkingFloor.deleteMany({ building: building._id, floor: 5 });
  floor.parking_map.slots[0].status = "disabled";
  floor.markModified("parking_map");
  await floor.save();

  const runtimeOrigin = origin.replace(/\/api\/parking-logs$/, "/api/model-runtime");
  const sync = await request("/sync", {
    method: "POST",
    modelKey: process.env.PARKING_MODEL_API_KEY,
    baseUrl: runtimeOrigin,
    body: {
      runtimeId: "disabled-slot-test-runtime",
      profiles: [
        {
          cameraNo: "CAM-1",
          cctvFileName: "camera-source.json",
          profileName: "test-profile",
          parkingEnabled: true,
          parkingSlotNames: ["zoneA_slot01"],
        },
      ],
      workers: [],
    },
  });
  assert.equal(sync.status, 200);
  assert.deepEqual(sync.body.commands[0].disabledParkingSlotNames, ["zoneA_slot01"]);

  const parked = await request("/model-events", {
    method: "POST",
    modelKey: process.env.PARKING_MODEL_API_KEY,
    body: {
      event: "Parking",
      floorId: String(floor._id),
      cameraPresetId: cameraId,
      license_plate: "DISABLED-SLOT-1",
      province: "Unknown",
      parkingSlotName: "zoneA_slot01",
    },
  });
  assert.equal(parked.status, 201);
  assert.equal(parked.body.log.park_status, "Parking");
  let savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "disabled");

  const exited = await request("/model-events", {
    method: "POST",
    modelKey: process.env.PARKING_MODEL_API_KEY,
    body: {
      event: "Exited",
      floorId: String(floor._id),
      cameraPresetId: cameraId,
      license_plate: "DISABLED-SLOT-1",
      province: "Unknown",
      parkingSlotName: "zoneA_slot01",
    },
  });
  assert.equal(exited.status, 200);
  assert.equal(exited.body.log.park_status, "Exited");
  savedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(savedFloor.parking_map.slots[0].status, "disabled");
});

test("parking log export writes a no-ID workbook for a selected location and rejects empty locations", async (t) => {
  const query = `?buildingId=${building._id}&floorId=${floor._id}&veh_type=car`;
  const exported = await request(`/export${query}`, {
    actor: "admin",
    raw: true,
  });
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get("content-type"), /spreadsheetml/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported.body);
  const sheet = workbook.getWorksheet("Parking Logs");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "No");
  assert.equal(sheet.getCell("B1").value, "Owner");
  assert.equal(sheet.getCell("S1").value, "Parking status");
  assert.ok(sheet.rowCount > 1);
  const workbookText = JSON.stringify(sheet.getSheetValues());
  for (const databaseId of [String(floor._id), String(building._id), cameraId, String(owner._id)])
    assert.equal(workbookText.includes(databaseId), false);

  const disposition = exported.headers.get("content-disposition");
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  assert.ok(filename?.endsWith(".xlsx"));
  const storedPath = path.resolve(__dirname, "../../logs", filename);
  t.after(() => fs.rm(storedPath, { force: true }));
  await fs.access(storedPath);

  const noData = await request(`/export?buildingId=${building._id}&floorId=${building._id}&veh_type=car`, {
    actor: "admin",
  });
  assert.equal(noData.status, 404);
  assert.match(noData.body.message, /No parking logs found/i);
});

test("sample parking logs can be exported to a workbook for testing", async (t) => {
  const before = await ParkingLog.countDocuments({});
  const exported = await request("/export-sample", {
    method: "POST",
    actor: "admin",
    body: {
      logs: [
        {
          owner: true,
          name: "Sample User",
          building: "E4 (Sample)",
          floor: 4,
          veh_type: "car",
          brand: "Toyota",
          model: "Corolla",
          color: "Blue",
          license_num: "SAMPLE-1001",
          province: "Sample Province",
          date_enter: "2026-11-04",
          park_time: "10:15:00",
          park_slot: 7,
          park_status: "Parking",
        },
      ],
    },
    raw: true,
  });
  assert.equal(exported.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(exported.body);
  const sheet = workbook.getWorksheet("Parking Logs");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A2").value, 1);
  assert.equal(sheet.getCell("C2").value, "Sample User");
  assert.equal(sheet.getCell("R2").value, 7);
  assert.equal(await ParkingLog.countDocuments({}), before);

  const filename = exported.headers.get("content-disposition").match(/filename="?([^";]+)"?/i)?.[1];
  const storedPath = path.resolve(__dirname, "../../logs", filename);
  t.after(() => fs.rm(storedPath, { force: true }));
  await fs.access(storedPath);
});

test("admin YOLO control persists the desired state and the Python runtime reports actual status", async () => {
  await ParkingFloor.deleteMany({ building: building._id, floor: 5 });
  const floorsOrigin = origin.replace(/\/api\/parking-logs$/, "/api/admin/system/floors");
  const originalStart = pythonModelRuntime.start;
  let runtimeLaunchRequested = false;
  pythonModelRuntime.start = () => {
    runtimeLaunchRequested = true;
    return {};
  };
  let control;
  try {
    control = await request(`/${floor._id}/cameras/${cameraId}/model`, {
      method: "PATCH",
      actor: "admin",
      body: { enabled: true },
      baseUrl: floorsOrigin,
    });
  } finally {
    pythonModelRuntime.start = originalStart;
  }
  assert.equal(runtimeLaunchRequested, true);
  assert.equal(control.status, 200);
  const enabledFloor = control.body.floor;
  assert.equal(enabledFloor.camera_presets[0].modelEnabled, true);
  assert.equal(enabledFloor.camera_presets[0].modelRuntimeStatus, "Starting");

  const runtimeOrigin = origin.replace(/\/api\/parking-logs$/, "/api/model-runtime");
  const sync = (workers, parkingSlotNames = ["zoneA_slot01"]) =>
    request("/sync", {
      method: "POST",
      modelKey: process.env.PARKING_MODEL_API_KEY,
      baseUrl: runtimeOrigin,
      body: {
        runtimeId: "test-runtime",
        profiles: [
          {
            cameraNo: "CAM-1",
            cctvFileName: "camera-source.json",
            profileName: "test-profile",
            parkingEnabled: true,
            parkingSlotNames,
          },
        ],
        workers,
      },
    });

  const starting = await sync([
    {
      cameraNo: "CAM-1",
      cctvFileName: "camera-source.json",
      status: "Starting",
    },
  ]);
  assert.equal(starting.status, 200);
  assert.equal(starting.body.commands[0].enabled, true);
  assert.equal(starting.body.commands[0].runnable, true, starting.body.commands[0].message);
  let updatedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(updatedFloor.camera_presets[0].modelRuntimeStatus, "Starting");

  const incompatibleProfile = await sync([], ["zoneB_slot99"]);
  assert.equal(incompatibleProfile.body.commands[0].runnable, false);
  assert.match(incompatibleProfile.body.commands[0].message, /missing mapped parking categories/i);
  updatedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(updatedFloor.camera_presets[0].modelRuntimeStatus, "Error");

  const online = await sync([
    {
      cameraNo: "CAM-1",
      cctvFileName: "camera-source.json",
      status: "Online",
    },
  ]);
  assert.equal(online.status, 200);
  updatedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(updatedFloor.camera_presets[0].modelRuntimeStatus, "Online");

  const presetStatus = (status) =>
    request(`/${floor._id}/cameras/${cameraId}/status`, {
      method: "PATCH",
      actor: "admin",
      body: { status },
      baseUrl: floorsOrigin,
    });
  const presetDisabled = await presetStatus("Disable");
  assert.equal(presetDisabled.status, 200);
  assert.equal(presetDisabled.body.floor.camera_presets[0].modelEnabled, true);
  const suspended = await sync([
    { cameraNo: "CAM-1", cctvFileName: "camera-source.json", status: "Offline" },
  ]);
  assert.equal(suspended.body.commands[0].enabled, false);

  const presetEnabled = await presetStatus("Enable");
  assert.equal(presetEnabled.status, 200);
  assert.equal(presetEnabled.body.floor.camera_presets[0].modelEnabled, true);
  const resumed = await sync([
    { cameraNo: "CAM-1", cctvFileName: "camera-source.json", status: "Online" },
  ]);
  assert.equal(resumed.body.commands[0].enabled, true);
  updatedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(updatedFloor.camera_presets[0].modelRuntimeStatus, "Online");

  const identity = "cam-1\0camera-source.json";
  const frameName = `${crypto.createHash("sha256").update(identity, "utf8").digest("hex")}.jpg`;
  const framePath = path.resolve(
    __dirname,
    "../../python-v2/results/runtime_frames",
    frameName,
  );
  await fs.mkdir(path.dirname(framePath), { recursive: true });
  const testFrame = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  await fs.writeFile(framePath, testFrame);
  try {
    const previewResponse = await request(
      `/${floor._id}/cameras/${cameraId}/model-preview`,
      { actor: "admin", baseUrl: floorsOrigin, raw: true },
    );
    assert.equal(previewResponse.status, 200);
    assert.equal(previewResponse.headers.get("content-type"), "image/jpeg");
    assert.deepEqual(previewResponse.body, testFrame);
  } finally {
    await fs.unlink(framePath);
  }

  const disabled = await request(`/${floor._id}/cameras/${cameraId}/model`, {
    method: "PATCH",
    actor: "admin",
    body: { enabled: false },
    baseUrl: floorsOrigin,
  });
  assert.equal(disabled.status, 200);
  const disabledFloor = disabled.body.floor;
  assert.equal(disabledFloor.camera_presets[0].modelEnabled, false);
  assert.equal(disabledFloor.camera_presets[0].modelRuntimeStatus, "Stopping");
  const stopped = await sync([
    {
      cameraNo: "CAM-1",
      cctvFileName: "camera-source.json",
      status: "Offline",
    },
  ]);
  assert.equal(stopped.status, 200);
  const stoppedFloor = await ParkingFloor.findById(floor._id);
  assert.equal(stoppedFloor.camera_presets[0].modelRuntimeStatus, "Offline");
});

test("Detection can run without map assignments and becomes runnable for preview", async (t) => {
  const noMapFloor = await ParkingFloor.create({
    building: building._id,
    floor: 6,
    veh_type: "car",
    status: "Disable",
    date_updated: "2026-11-04",
    time_updated: "12:00:00",
    camera_presets: [
      {
        name: "Preview only camera",
        cctvFileName: "preview-only-source.json",
        cameraNo: "CAM-PREVIEW-ONLY",
        rtspLink: "rtsp://127.0.0.1/preview-only",
        status: "Enable",
        sourceStatus: "Online",
        parkingSlotData: {
          categories: [
            { id: 1, name: "zoneA_slot01", supercategory: "parking-slot" },
          ],
          annotations: [{ category_id: 1 }],
        },
      },
    ],
    parking_map: null,
  });
  t.after(() => ParkingFloor.deleteOne({ _id: noMapFloor._id }));
  const noMapCameraId = String(noMapFloor.camera_presets[0]._id);
  const originalStart = pythonModelRuntime.start;
  pythonModelRuntime.start = () => ({});
  try {
    const floorsOrigin = origin.replace(/\/api\/parking-logs$/, "/api/admin/system/floors");
    const enabled = await request(`/${noMapFloor._id}/cameras/${noMapCameraId}/model`, {
      method: "PATCH",
      actor: "admin",
      body: { enabled: true },
      baseUrl: floorsOrigin,
    });
    assert.equal(enabled.status, 200);
    assert.equal(enabled.body.floor.camera_presets[0].modelEnabled, true);

    const runtimeOrigin = origin.replace(/\/api\/parking-logs$/, "/api/model-runtime");
    const sync = await request("/sync", {
      method: "POST",
      modelKey: process.env.PARKING_MODEL_API_KEY,
      baseUrl: runtimeOrigin,
      body: {
        runtimeId: "preview-only-runtime",
        profiles: [
          {
            cameraNo: "CAM-PREVIEW-ONLY",
            cctvFileName: "preview-only-source.json",
            profileName: "preview-only",
            parkingEnabled: true,
            parkingSlotNames: ["zoneA_slot01"],
          },
        ],
        workers: [],
      },
    });
    assert.equal(sync.status, 200);
    assert.equal(sync.body.commands[0].enabled, true);
    assert.equal(sync.body.commands[0].runnable, true);
    assert.deepEqual(sync.body.commands[0].mappedParkingSlotNames, []);
  } finally {
    const floorsOrigin = origin.replace(/\/api\/parking-logs$/, "/api/admin/system/floors");
    await request(`/${noMapFloor._id}/cameras/${noMapCameraId}/model`, {
      method: "PATCH",
      actor: "admin",
      body: { enabled: false },
      baseUrl: floorsOrigin,
    });
    pythonModelRuntime.start = originalStart;
  }
});

