const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const ParkingBuilding = require("../api/models/parkingBuildingModel");
const ParkingFloor = require("../api/models/parkingFloorModel");
const { listCameraSummaries } = require("../api/controllers/parkingCameraSummaryController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("camera totals are counted from parking-floor presets by building and floor", async (t) => {
  const id = new mongoose.Types.ObjectId();
  const floorId = new mongoose.Types.ObjectId();
  const secondFloorId = new mongoose.Types.ObjectId();
  const buildings = [{ _id: id, building_name: "E4" }, { _id: "d1", building_name: "D1" }];
  t.mock.method(ParkingBuilding, "find", () => ({ select: () => ({ lean: async () => buildings }) }));
  let pipeline;
  t.mock.method(ParkingFloor, "aggregate", (query) => {
    pipeline = query;
    return Promise.resolve([
      { _id: { building: id, floor: floorId, presetStatus: "Enable", sourceStatus: "Online" }, count: 3 },
      { _id: { building: id, floor: floorId, presetStatus: "Enable", sourceStatus: "Offline" }, count: 2 },
      { _id: { building: id, floor: floorId, presetStatus: "Disable", sourceStatus: "Online" }, count: 1 },
      { _id: { building: id, floor: floorId, presetStatus: "Disable", sourceStatus: "Unknown" }, count: 1 },
      { _id: { building: id, floor: secondFloorId, presetStatus: "Enable", sourceStatus: "Unknown" }, count: 2 },
      { _id: { building: "other", floor: new mongoose.Types.ObjectId(), presetStatus: "Enable", sourceStatus: "Online" }, count: 20 },
    ]);
  });
  const res = response();
  await listCameraSummaries({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.summaries[String(id)], { total: 9, online: 3, offline: 2, disabled: 2, unknown: 2 });
  assert.deepEqual(res.body.floorSummaries[String(floorId)], { total: 7, online: 3, offline: 2, disabled: 2, unknown: 0 });
  assert.deepEqual(res.body.floorSummaries[String(secondFloorId)], { total: 2, online: 0, offline: 0, disabled: 0, unknown: 2 });
  assert.deepEqual(res.body.summaries.d1, { total: 0, online: 0, offline: 0, disabled: 0, unknown: 0 });
  assert.deepEqual(pipeline[0], { $unwind: "$camera_presets" });
  assert.deepEqual(Object.keys(res.body), ["success", "summaries", "floorSummaries"]);
});

test("a database failure returns an error instead of zero camera counts", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(ParkingBuilding, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  t.mock.method(ParkingFloor, "aggregate", () => Promise.reject(new Error("unavailable")));
  const res = response();
  await listCameraSummaries({}, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.summaries, undefined);
});
