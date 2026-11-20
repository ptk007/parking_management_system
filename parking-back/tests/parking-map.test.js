const test = require("node:test");
const assert = require("node:assert/strict");
const { validateParkingMap } = require("../api/utils/parkingMap");
const ParkingFloor = require("../api/models/parkingFloorModel");
const User = require("../api/models/userModel");
const ParkingLog = require("../api/models/parkingLogModel");
const Vehicle = require("../api/models/vehicleModel");
const ParkingSlotStatusLog = require("../api/models/parkingSlotStatusLogModel");
const controller = require("../api/controllers/parkingFloorController");
const id = "507f1f77bcf86cd799439011";
const map = () => ({
  version: 2,
  sourceName: "map",
  slots: [
    { number: 1, zone: "default", name: "1", status: "disabled" },
    { number: 2, zone: "default", name: "2", status: "occupied" },
  ],
  layout: {
    background: null,
    shapes: [],
    positions: { '["default",1]': { x: 20, y: 20, width: 60, height: 80 } },
  },
});
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
test("validates map geometry, unique slot identities and embedded-only images", () => {
  assert.equal(validateParkingMap(map()).slots.length, 2);
  assert.equal(validateParkingMap(map()).slots[0].connectionStatus, "None");
  const empty = map();
  empty.slots = [];
  empty.layout.positions = {};
  assert.equal(validateParkingMap(empty).slots.length, 0);
  const duplicate = map();
  duplicate.slots.push({ ...duplicate.slots[0] });
  assert.throws(() => validateParkingMap(duplicate), /Duplicate/);
  const invalid = map();
  invalid.layout.positions['["default",1]'].x = -1;
  assert.throws(() => validateParkingMap(invalid), /position/);
  const external = map();
  external.layout.background = {
    name: "image",
    dataUrl: "https://example.test/x.png",
  };
  assert.throws(() => validateParkingMap(external), /background/);
  const wide = map();
  wide.layout.positions['["default",1]'].x = 1200;
  assert.equal(validateParkingMap(wide).layout.positions['["default",1]'].x, 1200);
  wide.layout.zoom = 251;
  assert.throws(() => validateParkingMap(wide), /zoom/);
});
test("serializes empty parking-map position objects for new layouts", () => {
  const floor = new ParkingFloor({
    building: id,
    floor: 1,
    veh_type: "car",
    status: "Disable",
    date_updated: "2026-11-18",
    time_updated: "12:00:00",
    parking_map: {
      version: 2,
      sourceName: "New map",
      slots: [],
      layout: { background: null, shapes: [], positions: {}, zoom: 100 },
    },
  });

  const serialized = JSON.parse(JSON.stringify(floor));
  assert.deepEqual(serialized.parking_map.layout.positions, {});
});
test("rejects layout edits on Available floors at the API and permits status-only changes", async (t) => {
  const floor = { _id: id, status: "Available", parking_map: map() };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const update = t.mock.method(
    ParkingFloor,
    "findOneAndUpdate",
    async () => floor,
  );
  const changed = map();
  changed.layout.positions['["default",1]'].x = 50;
  const rejected = response();
  await controller.saveMap({ params: { id }, body: changed }, rejected);
  assert.equal(rejected.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);
  const status = map();
  status.slots[0].status = "available";
  const accepted = response();
  await controller.saveMap({ params: { id }, body: status }, accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(update.mock.calls[0].arguments[0].status, "Available");
});
test("persists layouts on disabled floors and reports a concurrent floor activation", async (t) => {
  t.mock.method(ParkingFloor, "findById", async () => ({
    _id: id,
    status: "Disable",
    parking_map: null,
  }));
  t.mock.method(ParkingFloor, "findOneAndUpdate", async () => null);
  const res = response();
  await controller.saveMap({ params: { id }, body: map() }, res);
  assert.equal(res.statusCode, 409);
});
test("saves slot-to-camera category assignments only when they belong to the floor preset", async (t) => {
  const cameraId = "507f1f77bcf86cd799439012";
  const camera = {
    _id: cameraId,
    parkingSlotData: {
      categories: [
        { name: "all", supercategory: "none" },
        { name: "zoneA_slot01", supercategory: "parking-slot" },
      ],
    },
  };
  const floor = {
    _id: id,
    status: "Available",
    status: "Disable",
    parking_map: null,
    camera_presets: [camera],
  };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const update = t.mock.method(ParkingFloor, "findOneAndUpdate", async () => floor);
  const assignedMap = map();
  assignedMap.slots[0].cameraPresetId = cameraId;
  assignedMap.slots[0].parkingSlotName = "zoneA_slot01";
  const saved = response();
  await controller.saveMap({ params: { id }, body: assignedMap }, saved);
  assert.equal(saved.statusCode, 200);
  assert.equal(
    update.mock.calls[0].arguments[1].$set.parking_map.slots[0].cameraPresetId,
    cameraId,
  );
  assert.equal(
    update.mock.calls[0].arguments[1].$set.parking_map.slots[0].parkingSlotName,
    "zoneA_slot01",
  );
  assert.equal(
    update.mock.calls[0].arguments[1].$set.parking_map.slots[0].connectionStatus,
    "Connect",
  );
  assert.equal(
    update.mock.calls[0].arguments[1].$set.parking_map.slots[0].status,
    "disabled",
  );

  const cameraOnlyMap = map();
  cameraOnlyMap.slots[0].cameraPresetId = cameraId;
  const cameraOnlySaved = response();
  await controller.saveMap(
    { params: { id }, body: cameraOnlyMap },
    cameraOnlySaved,
  );
  assert.equal(cameraOnlySaved.statusCode, 200);
  assert.equal(
    update.mock.calls[1].arguments[1].$set.parking_map.slots[0].connectionStatus,
    "None",
  );
  assert.equal(
    update.mock.calls[1].arguments[1].$set.parking_map.slots[0].cameraPresetId,
    cameraId,
  );
  assert.equal(
    update.mock.calls[1].arguments[1].$set.parking_map.slots[0].parkingSlotName,
    undefined,
  );

  const invalidMap = map();
  invalidMap.slots[0].parkingSlotName = "zoneA_slot02";
  const rejected = response();
  await controller.saveMap({ params: { id }, body: invalidMap }, rejected);
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body.message, /requires a CCTV preset/);
  assert.equal(update.mock.callCount(), 2);

  const invalidCategoryMap = map();
  invalidCategoryMap.slots[0].cameraPresetId = cameraId;
  invalidCategoryMap.slots[0].parkingSlotName = "zoneA_slot02";
  const invalidCategory = response();
  await controller.saveMap(
    { params: { id }, body: invalidCategoryMap },
    invalidCategory,
  );
  assert.equal(invalidCategory.statusCode, 400);
  assert.match(invalidCategory.body.message, /does not belong to this CCTV preset/);
  assert.equal(update.mock.callCount(), 2);
});
test("staff slot changes preserve camera occupancy; users cannot call the same write API", async (t) => {
  let role = "user";
  const auditWrite = t.mock.method(ParkingSlotStatusLog, "create", async () => ({}));
  t.mock.method(User, "findById", () => ({
    select: async () => ({ name: "Test Staff", role, status: "online" }),
  }));
  const floor = { _id: id, parking_map: map() };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const update = t.mock.method(
    ParkingFloor,
    "findOneAndUpdate",
    async () => floor,
  );
  const req = {
    auth: { userId: id },
    params: { id },
    body: { keys: ['["default",1]', '["default",2]'], status: "available" },
  };
  const denied = response();
  await controller.setSlotStatuses(req, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(update.mock.callCount(), 0);
  role = "staff";
  const allowed = response();
  await controller.setSlotStatuses(req, allowed);
  assert.equal(allowed.statusCode, 200);
  const slots = update.mock.calls[0].arguments[1].$set.parking_map.slots;
  assert.equal(slots[0].status, "available");
  assert.equal(slots[1].status, "occupied");
  assert.equal(auditWrite.mock.callCount(), 1);
  const audit = auditWrite.mock.calls[0].arguments[0];
  assert.equal(audit.name, "Test Staff");
  assert.equal(audit.role, "staff");
  assert.deepEqual(audit.slots, [{ zone: "default", number: 1, name: "1" }]);
  assert.equal(audit.status, "available");
  assert.match(audit.date_updated, /^\d{4}-\d{2}-\d{2}$/);
});

test("manual vehicle details update only occupied parking-map slots", async (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role: "staff", status: "online" }),
  }));
  const floor = { _id: id, parking_map: map() };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const update = t.mock.method(ParkingFloor, "findOneAndUpdate", async (_filter, updateDoc) => ({
    parking_map: updateDoc.$set.parking_map,
  }));
  t.mock.method(ParkingLog, "find", () => ({ limit: async () => [] }));
  const req = {
    auth: { userId: id },
    params: { id },
    body: {
      key: '["default",2]',
      license_num: "ABC 1234",
      province: "Chiang Mai",
    },
  };
  const saved = response();
  await controller.updateOccupiedSlotVehicleDetails(req, saved);
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.map.slots[1].license_num, "ABC 1234");
  assert.equal(saved.body.map.slots[1].province, "Chiang Mai");
  assert.match(saved.body.map.slots[1].date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(saved.body.map.slots[1].time_updated, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(saved.body.activeLogUpdated, false);
  assert.equal(update.mock.callCount(), 1);

  floor.parking_map.slots[1].status = "available";
  const rejected = response();
  await controller.updateOccupiedSlotVehicleDetails(req, rejected);
  assert.equal(rejected.statusCode, 409);
  assert.equal(update.mock.callCount(), 1);
});

test("manual details can match an active log by floor and slot when its CCTV assignment changed", async (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role: "admin", status: "online" }),
  }));
  const floor = {
    _id: id,
    building: "507f1f77bcf86cd799439014",
    floor: 4,
    veh_type: "car",
    parking_map: map(),
  };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  t.mock.method(ParkingFloor, "findOneAndUpdate", async (_filter, updateDoc) => ({
    parking_map: updateDoc.$set.parking_map,
  }));
  const guestLog = {
    _id: "507f1f77bcf86cd799439016",
    cameraPresetId: "507f1f77bcf86cd799439015",
    parkingSlotName: "zoneA_slot02",
    license_num: "OLD 2",
    province: "Bangkok",
    name: "Guest 2",
    owner: null,
  };
  t.mock.method(ParkingLog, "find", () => ({ limit: async () => [guestLog] }));
  t.mock.method(ParkingLog, "exists", async () => null);
  t.mock.method(Vehicle, "findOne", () => ({ populate: async () => null }));
  const updateLog = t.mock.method(
    ParkingLog,
    "findOneAndUpdate",
    async (_filter, updateDoc) => ({ ...guestLog, ...updateDoc.$set }),
  );
  const res = response();
  await controller.updateOccupiedSlotVehicleDetails(
    {
      auth: { userId: id },
      params: { id },
      body: {
        key: '["default",2]',
        license_num: "CORRECTED 2",
        province: "Chiang Mai",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeLogUpdated, true);
  assert.equal(String(res.body.log._id), guestLog._id);
  assert.equal(updateLog.mock.callCount(), 1);
});

test("manual vehicle details update the matching active parking log", async (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role: "admin", status: "online" }),
  }));
  const buildingId = "507f1f77bcf86cd799439014";
  const cameraPresetId = "507f1f77bcf86cd799439015";
  const floor = {
    _id: id,
    building: buildingId,
    floor: 4,
    veh_type: "car",
    parking_map: map(),
  };
  Object.assign(floor.parking_map.slots[1], {
    cameraPresetId,
    parkingSlotName: "zoneA_slot02",
  });
  t.mock.method(ParkingFloor, "findById", async () => floor);
  t.mock.method(ParkingFloor, "findOneAndUpdate", async (_filter, updateDoc) => ({
    parking_map: updateDoc.$set.parking_map,
  }));
  const activeLog = {
    _id: "507f1f77bcf86cd799439016",
    license_num: "OLD 1",
    province: "Bangkok",
    name: "Guest 1",
    owner: null,
  };
  const findActive = t.mock.method(ParkingLog, "findOne", async (filter) => {
    assert.equal(filter.park_slot, 2);
    assert.equal(filter.cameraPresetId, cameraPresetId);
    assert.equal(filter.park_status, "Parking");
    return activeLog;
  });
  t.mock.method(ParkingLog, "exists", async () => null);
  const vehicleOwnerId = "507f1f77bcf86cd799439017";
  t.mock.method(Vehicle, "findOne", () => ({
    populate: async () => ({
      name: { _id: vehicleOwnerId, name: "Registered Owner", username: "owner" },
    }),
  }));
  const updateActive = t.mock.method(
    ParkingLog,
    "findOneAndUpdate",
    async (_filter, updateDoc) => ({ _id: activeLog._id, ...activeLog, ...updateDoc.$set }),
  );
  const deleteHistory = t.mock.method(ParkingLog, "deleteMany", async () => ({ deletedCount: 2 }));
  const res = response();
  await controller.updateOccupiedSlotVehicleDetails(
    {
      auth: { userId: id },
      params: { id },
      body: {
        key: '["default",2]',
        license_num: "NEW 2",
        province: "Chiang Mai",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.activeLogUpdated, true);
  assert.equal(String(res.body.log._id), activeLog._id);
  assert.equal(res.body.log.owner, vehicleOwnerId);
  assert.equal(res.body.log.name, "Registered Owner");
  assert.equal(res.body.removedHistoryCount, 2);
  assert.equal(findActive.mock.callCount(), 1);
  assert.deepEqual(updateActive.mock.calls[0].arguments[1].$set, {
    license_num: "NEW 2",
    province: "Chiang Mai",
    owner: vehicleOwnerId,
    name: "Registered Owner",
  });
  assert.deepEqual(deleteHistory.mock.calls[0].arguments[0], {
    owner: vehicleOwnerId,
    veh_type: "car",
    license_num: "NEW 2",
    province: "Chiang Mai",
    park_status: { $in: ["Exited", "Not parking"] },
    _id: { $ne: activeLog._id },
  });
});

test("correcting an unmatched vehicle keeps the existing Guest log name and ID", async (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role: "admin", status: "online" }),
  }));
  const floor = {
    _id: id,
    building: "507f1f77bcf86cd799439014",
    floor: 4,
    veh_type: "car",
    parking_map: map(),
  };
  Object.assign(floor.parking_map.slots[1], {
    cameraPresetId: "507f1f77bcf86cd799439015",
    parkingSlotName: "zoneA_slot02",
  });
  t.mock.method(ParkingFloor, "findById", async () => floor);
  t.mock.method(ParkingFloor, "findOneAndUpdate", async (_filter, updateDoc) => ({
    parking_map: updateDoc.$set.parking_map,
  }));
  const guestLog = {
    _id: "507f1f77bcf86cd799439016",
    license_num: "OLD 1",
    province: "Bangkok",
    name: "Guest 7",
    owner: null,
  };
  t.mock.method(ParkingLog, "findOne", async () => guestLog);
  t.mock.method(ParkingLog, "exists", async () => null);
  t.mock.method(Vehicle, "findOne", () => ({ populate: async () => null }));
  const updateActive = t.mock.method(
    ParkingLog,
    "findOneAndUpdate",
    async (_filter, updateDoc) => ({ ...guestLog, ...updateDoc.$set }),
  );
  const res = response();
  await controller.updateOccupiedSlotVehicleDetails(
    {
      auth: { userId: id },
      params: { id },
      body: {
        key: '["default",2]',
        license_num: "CORRECTED 7",
        province: "Chiang Mai",
      },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(String(res.body.log._id), guestLog._id);
  assert.equal(res.body.log.name, "Guest 7");
  assert.equal(res.body.log.owner, null);
  assert.equal(updateActive.mock.callCount(), 1);
});

test("reset slot statuses requires every preset disabled and resets every map status", async (t) => {
  let role = "admin";
  const auditWrite = t.mock.method(ParkingSlotStatusLog, "create", async () => ({}));
  t.mock.method(User, "findById", () => ({
    select: async () => ({ name: "Test Admin", role, status: "online" }),
  }));
  const floor = {
    _id: id,
    parking_map: map(),
    camera_presets: [{ status: "Disable" }, { status: "Disable" }],
  };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const update = t.mock.method(ParkingFloor, "findOneAndUpdate", async (_filter, updateDoc) => {
    floor.parking_map = updateDoc.$set.parking_map;
    return floor;
  });

  const blocked = response();
  floor.camera_presets[1].status = "Enable";
  await controller.resetSlotStatuses({ auth: { userId: id }, params: { id } }, blocked);
  assert.equal(blocked.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);

  floor.camera_presets[1].status = "Disable";
  const reset = response();
  await controller.resetSlotStatuses({ auth: { userId: id }, params: { id } }, reset);
  assert.equal(reset.statusCode, 200);
  assert.deepEqual(reset.body.map.slots.map((slot) => slot.status), ["available", "available"]);
  assert.equal(update.mock.callCount(), 1);
  assert.equal(auditWrite.mock.callCount(), 1);
  assert.equal(auditWrite.mock.calls[0].arguments[0].status, "available");
  assert.equal(auditWrite.mock.calls[0].arguments[0].slots.length, 1);
});

test("manual slot refresh queues a status update for enabled Detection presets", async (t) => {
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role: "admin", status: "online" }),
  }));
  const cameraId = "507f1f77bcf86cd799439012";
  const floor = {
    _id: id,
    status: "Available",
    parking_map: {
      ...map(),
      slots: [
        {
          number: 1,
          zone: "default",
          status: "available",
          cameraPresetId: cameraId,
          parkingSlotName: "zoneA_slot01",
        },
      ],
    },
    camera_presets: [
      { _id: cameraId, status: "Enable", modelEnabled: true, slotStatusRefreshVersion: 0 },
      { _id: "507f1f77bcf86cd799439013", status: "Enable", modelEnabled: false, slotStatusRefreshVersion: 0 },
    ],
    async save() {},
  };
  t.mock.method(ParkingFloor, "findById", async () => floor);

  const responseOk = response();
  await controller.refreshModelSlotStatuses({ auth: { userId: id }, params: { id } }, responseOk);
  assert.equal(responseOk.statusCode, 200);
  assert.equal(responseOk.body.requestedSlots, 1);
  assert.equal(floor.camera_presets[0].slotStatusRefreshVersion, 1);
  assert.equal(floor.camera_presets[1].slotStatusRefreshVersion, 0);

  floor.status = "Disable";
  const unavailableFloorUpdate = response();
  await controller.refreshModelSlotStatuses(
    { auth: { userId: id }, params: { id } },
    unavailableFloorUpdate,
  );
  assert.equal(unavailableFloorUpdate.statusCode, 200);
  assert.equal(floor.camera_presets[0].slotStatusRefreshVersion, 2);
});
