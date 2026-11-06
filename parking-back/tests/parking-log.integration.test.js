const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
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

async function request(path, { method = "GET", actor, modelKey, body } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      ...(actor ? { Authorization: `Bearer ${actorTokens[actor]}` } : {}),
      ...(modelKey ? { "x-model-api-key": modelKey } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
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
