const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const ParkingBuilding = require("../api/models/parkingBuildingModel");
const { listCameraSummaries } = require("../api/controllers/parkingCameraSummaryController");

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("camera totals match each building by name or ObjectId and retain unknown statuses", async (t) => {
  const id = new mongoose.Types.ObjectId();
  const buildings = [{ _id: id, building_name: "E4" }, { _id: "d1", building_name: "D1" }];
  t.mock.method(ParkingBuilding, "find", () => ({ select: () => ({ lean: async () => buildings }) }));
  t.mock.method(mongoose.connection, "collection", (name) => {
    assert.equal(name, "parking_cctv");
    return { aggregate: () => ({ toArray: async () => [
      { _id: { building: "E4", status: "online" }, count: 3 },
      { _id: { building: id, status: "offline" }, count: 2 },
      { _id: { building: "E4", status: "disable" }, count: 1 },
      { _id: { building: "E4", status: "Disabled" }, count: 1 },
      { _id: { building: "E4", status: "connecting" }, count: 1 },
      { _id: { building: "E4", status: null }, count: 1 },
      { _id: { building: "other", status: "online" }, count: 20 },
      { _id: { building: null, status: "online" }, count: 10 },
    ] }) };
  });
  const res = response();
  await listCameraSummaries({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.summaries[String(id)], { total: 9, online: 3, offline: 2, disabled: 2, unknown: 2 });
  assert.deepEqual(res.body.summaries.d1, { total: 0, online: 0, offline: 0, disabled: 0, unknown: 0 });
  assert.deepEqual(Object.keys(res.body), ["success", "summaries"]);
});

test("a database failure returns an error instead of zero camera counts", async (t) => {
  t.mock.method(console, "error", () => {});
  t.mock.method(ParkingBuilding, "find", () => ({ select: () => ({ lean: async () => [] }) }));
  t.mock.method(mongoose.connection, "collection", () => ({ aggregate: () => ({ toArray: async () => { throw new Error("unavailable"); } }) }));
  const res = response();
  await listCameraSummaries({}, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.summaries, undefined);
});
