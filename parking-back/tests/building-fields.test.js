const test = require("node:test");
const assert = require("node:assert/strict");
const ParkingBuilding = require("../api/models/parkingBuildingModel");
const buildingController = require("../api/controllers/parkingBuildingController");
const migrateParkingBuildingFields = require("../api/utils/migrateParkingBuildingFields");

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("parking building schema uses updated timestamps and has no status field", () => {
  assert.equal(ParkingBuilding.schema.path("building_status"), undefined);
  assert.equal(ParkingBuilding.schema.path("date_add"), undefined);
  assert.equal(ParkingBuilding.schema.path("time_add"), undefined);
  assert.equal(ParkingBuilding.schema.path("date_updated").instance, "String");
  assert.equal(ParkingBuilding.schema.path("time_updated").instance, "String");
  assert.equal(ParkingBuilding.schema.path("date_updated").options.immutable, undefined);
});

test("building creation stores date_updated and time_updated without building_status", async (t) => {
  let created;
  t.mock.method(ParkingBuilding, "exists", async () => false);
  t.mock.method(ParkingBuilding, "create", async (data) => {
    created = data;
    return data;
  });

  const res = response();
  await buildingController.createBuilding(
    { body: { building_name: "E4", building_status: "available" } },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal("building_status" in created, false);
  assert.match(created.date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(created.time_updated, /^\d{2}:\d{2}:\d{2}$/);
  assert.equal("date_add" in created, false);
  assert.equal("time_add" in created, false);
});

test("building edits refresh updated timestamps and ignore removed status", async (t) => {
  const building = {
    _id: "507f1f77bcf86cd799439011",
    building_name: "E4",
    building_image: null,
    date_updated: "2000-01-01",
    time_updated: "00:00:00",
    save: async () => {},
  };
  t.mock.method(ParkingBuilding, "findById", async () => building);
  t.mock.method(ParkingBuilding, "exists", async () => false);

  const res = response();
  await buildingController.updateBuilding(
    {
      params: { id: building._id },
      body: { building_name: "E5", building_status: "available" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(building.building_name, "E5");
  assert.equal("building_status" in building, false);
  assert.match(building.date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(building.time_updated, /^\d{2}:\d{2}:\d{2}$/);
  assert.notEqual(building.date_updated, "2000-01-01");
});

test("startup migration renames old timestamps and unsets building_status", async (t) => {
  const updateMany = t.mock.method(
    ParkingBuilding.collection,
    "updateMany",
    async () => ({}),
  );

  await migrateParkingBuildingFields();

  assert.equal(updateMany.mock.callCount(), 3);
  assert.deepEqual(updateMany.mock.calls[0].arguments, [
    { date_add: { $exists: true }, date_updated: { $exists: false } },
    { $rename: { date_add: "date_updated" } },
  ]);
  assert.deepEqual(updateMany.mock.calls[1].arguments, [
    { time_add: { $exists: true }, time_updated: { $exists: false } },
    { $rename: { time_add: "time_updated" } },
  ]);
  assert.deepEqual(updateMany.mock.calls[2].arguments[1], {
    $unset: { building_status: "", date_add: "", time_add: "" },
  });
});
