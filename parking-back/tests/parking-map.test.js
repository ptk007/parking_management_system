const test = require("node:test");
const assert = require("node:assert/strict");
const { validateParkingMap } = require("../api/utils/parkingMap");
const ParkingFloor = require("../api/models/parkingFloorModel");
const User = require("../api/models/userModel");
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
test("rejects layout edits on Available floors at the API and permits status-only changes", async (t) => {
  const floor = { _id: id, status: "available", parking_map: map() };
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
  assert.equal(update.mock.calls[0].arguments[0].status, "available");
});
test("persists layouts on disabled floors and reports a concurrent floor activation", async (t) => {
  t.mock.method(ParkingFloor, "findById", async () => ({
    _id: id,
    status: "disable",
    parking_map: null,
  }));
  t.mock.method(ParkingFloor, "findOneAndUpdate", async () => null);
  const res = response();
  await controller.saveMap({ params: { id }, body: map() }, res);
  assert.equal(res.statusCode, 409);
});
test("staff slot changes preserve camera occupancy; users cannot call the same write API", async (t) => {
  let role = "user";
  t.mock.method(User, "findById", () => ({
    select: async () => ({ role, status: "online" }),
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
});
