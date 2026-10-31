const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const path = require("path");
const ParkingFloor = require("../api/models/parkingFloorModel");
const controller = require("../api/controllers/parkingFloorController");
const floorId = "507f1f77bcf86cd799439011";
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
async function upload(t, text) {
  const root = path.resolve(__dirname, "../../json_file/parking_slots");
  await fs.mkdir(root, { recursive: true });
  const filename = `test-slot-${crypto.randomUUID()}.json`;
  const target = path.join(root, filename);
  await fs.writeFile(target, text);
  t.after(() => fs.rm(target, { force: true }));
  return { path: target, filename, originalname: "zone-a.json", size: Buffer.byteLength(text) };
}

test("imports original JSON files into only the selected floor and keeps their bytes", async (t) => {
  const file = await upload(t, '{"slots":[{"number":1}]}');
  const floor = { _id: floorId, parking_slot_files: [] };
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const update = t.mock.method(ParkingFloor, "findOneAndUpdate", () => ({ populate: async () => floor }));
  const res = response();
  await controller.importSlotFiles({ params: { id: floorId }, files: [file] }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(update.mock.calls[0].arguments[0]._id, floorId);
  assert.equal(update.mock.calls[0].arguments[1].$push.parking_slot_files.$each[0].original_name, "zone-a.json");
  assert.equal(await fs.readFile(file.path, "utf8"), '{"slots":[{"number":1}]}');
});

test("invalid JSON removes uploaded files and leaves the preset unchanged", async (t) => {
  const file = await upload(t, "invalid JSON");
  t.mock.method(ParkingFloor, "findById", async () => ({ _id: floorId, parking_slot_files: [] }));
  const update = t.mock.method(ParkingFloor, "findOneAndUpdate", () => { throw new Error("should not update"); });
  const res = response();
  await controller.importSlotFiles({ params: { id: floorId }, files: [file] }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(update.mock.callCount(), 0);
  await assert.rejects(fs.access(file.path), { code: "ENOENT" });
});

test("duplicate names and concurrent preset changes reject uploads and clean up files", async (t) => {
  const file = await upload(t, "[]");
  t.mock.method(ParkingFloor, "findById", async () => ({ _id: floorId, parking_slot_files: [{ original_name: file.originalname, size: 2 }] }));
  const res = response();
  await controller.importSlotFiles({ params: { id: floorId }, files: [file] }, res);
  assert.equal(res.statusCode, 409);
  await assert.rejects(fs.access(file.path), { code: "ENOENT" });
  const second = await upload(t, "[]");
  ParkingFloor.findById = async () => ({ _id: floorId, parking_slot_files: [] });
  t.mock.method(ParkingFloor, "findOneAndUpdate", () => ({ populate: async () => null }));
  const conflict = response();
  await controller.importSlotFiles({ params: { id: floorId }, files: [second] }, conflict);
  assert.equal(conflict.statusCode, 409);
  await assert.rejects(fs.access(second.path), { code: "ENOENT" });
});
