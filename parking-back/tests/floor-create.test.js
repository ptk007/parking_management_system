const test = require("node:test");
const assert = require("node:assert/strict");
const ParkingBuilding = require("../api/models/parkingBuildingModel");
const ParkingFloor = require("../api/models/parkingFloorModel");
const controller = require("../api/controllers/parkingFloorController");

test("creates a floor without zone or parking map input", async (t) => {
  const buildingId = "507f1f77bcf86cd799439011";
  t.mock.method(ParkingBuilding, "exists", async () => true);
  const floorExists = t.mock.method(ParkingFloor, "exists", async () => false);
  const createdFloor = { populate: async () => {} };
  const create = t.mock.method(ParkingFloor, "create", async () => createdFloor);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await controller.createFloor({
    body: { building: buildingId, floor: -8, veh_type: "car", status: "Available" },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.floor, createdFloor);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(create.mock.calls[0].arguments[0].building, buildingId);
  assert.equal(create.mock.calls[0].arguments[0].floor, -8);
  assert.equal("zone" in create.mock.calls[0].arguments[0], false);
  assert.equal(create.mock.calls[0].arguments[0].parking_slot_file, undefined);
  assert.equal(typeof create.mock.calls[0].arguments[0].date_updated, "string");
  assert.equal(typeof create.mock.calls[0].arguments[0].time_updated, "string");
  assert.deepEqual(floorExists.mock.calls[0].arguments[0], {
    building: buildingId,
    floor: -8,
    veh_type: "car",
  });
});

test("rejects a duplicate building, floor and vehicle type", async (t) => {
  const buildingId = "507f1f77bcf86cd799439011";
  t.mock.method(ParkingBuilding, "exists", async () => true);
  t.mock.method(ParkingFloor, "exists", async () => true);
  const create = t.mock.method(ParkingFloor, "create", async () => {
    throw new Error("duplicate floor was created");
  });
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await controller.createFloor({
    body: { building: buildingId, floor: 4, veh_type: "car", status: "Disable" },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /floor already exists/);
  assert.equal(create.mock.callCount(), 0);
});

test("rejects updating a floor to an existing vehicle-specific floor", async (t) => {
  const buildingId = "507f1f77bcf86cd799439011";
  const floor = {
    _id: buildingId,
    building: buildingId,
    floor: 3,
    veh_type: "car",
  };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  t.mock.method(ParkingBuilding, "exists", async () => true);
  const exists = t.mock.method(ParkingFloor, "exists", async () => true);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await controller.updateFloor({
    params: { id: buildingId },
    body: { floor: 4, veh_type: "car" },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /floor already exists/);
  assert.deepEqual(exists.mock.calls[0].arguments[0], {
    building: buildingId,
    floor: 4,
    veh_type: "car",
    _id: { $ne: buildingId },
  });
  assert.equal(floor.floor, 3);
});

test("normalizes legacy lowercase floor status and refreshes update timestamps", async (t) => {
  const buildingId = "507f1f77bcf86cd799439011";
  const floor = {
    _id: buildingId,
    building: buildingId,
    floor: 3,
    veh_type: "car",
    status: "Disable",
    async save() {},
    async populate() {},
  };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  t.mock.method(ParkingBuilding, "exists", async () => true);
  t.mock.method(ParkingFloor, "exists", async () => false);
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  await controller.updateFloor(
    {
      params: { id: buildingId },
      body: {
        building: buildingId,
        floor: 3,
        veh_type: "car",
        status: "available",
      },
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(floor.status, "Available");
  assert.match(floor.date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(floor.time_updated, /^\d{2}:\d{2}:\d{2}$/);
});
