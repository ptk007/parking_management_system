const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const ParkingFloor = require("../api/models/parkingFloorModel");
const SourceFile = require("../api/models/parkingSourceFileModel");
const controller = require("../api/controllers/parkingFloorController");
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
async function upload(t, text, name = "source.json") {
  const dir = path.resolve(__dirname, "../../json_file/parking_slots");
  await fs.mkdir(dir, { recursive: true });
  const filename = `test-source-${crypto.randomUUID()}.json`,
    target = path.join(dir, filename);
  await fs.writeFile(target, text);
  t.after(() => fs.rm(target, { force: true }));
  return {
    path: target,
    filename,
    originalname: name,
    size: Buffer.byteLength(text),
  };
}
test("stores original source files centrally without a building or floor and preserves original bytes", async (t) => {
  const text = '{ "camera": "original", "slots": [1,2] }',
    file = await upload(t, text);
  const insert = t.mock.method(SourceFile, "insertMany", async () => []);
  const res = response();
  await controller.importSourceFiles({ files: [file] }, res);
  assert.equal(res.statusCode, 201);
  const doc = insert.mock.calls[0].arguments[0][0];
  assert.equal(doc.original_name, "source.json");
  assert.equal("floor" in doc, false);
  assert.equal(await fs.readFile(file.path, "utf8"), text);
});
test("rejects an invalid source batch before storing any database records and cleans up every file", async (t) => {
  const files = [
    await upload(t, "{}", "good.json"),
    await upload(t, "broken", "bad.json"),
  ];
  const insert = t.mock.method(SourceFile, "insertMany", async () => []);
  const res = response();
  await controller.importSourceFiles({ files }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(insert.mock.callCount(), 0);
  for (const file of files)
    await assert.rejects(fs.access(file.path), { code: "ENOENT" });
});
test("promotes legacy floor imports to the shared library with their original IDs", async (t) => {
  const file = {
    _id: "507f1f77bcf86cd799439012",
    original_name: "old.json",
    path: "old.json",
    size: 10,
  };
  t.mock.method(ParkingFloor, "find", () => ({
    select: async () => [{ parking_slot_files: [file] }],
  }));
  const migrate = t.mock.method(SourceFile, "bulkWrite", async () => {});
  t.mock.method(SourceFile, "find", () => ({ sort: async () => [file] }));
  const res = response();
  await controller.listSourceFiles({}, res);
  assert.deepEqual(res.body.files, [file]);
  assert.equal(
    migrate.mock.calls[0].arguments[0][0].updateOne.filter._id,
    file._id,
  );
});
test("deleting a floor keeps a promoted source used by other floors", async (t) => {
  const id = "507f1f77bcf86cd799439011";
  t.mock.method(ParkingFloor, "findById", async () => ({
    _id: id,
    parking_slot_files: [{ path: "json_file/parking_slots/shared.json" }],
    deleteOne: async () => {},
  }));
  t.mock.method(SourceFile, "exists", async () => true);
  const unlink = t.mock.method(fs, "unlink", async () => {
    throw new Error("Shared files must survive");
  });
  const res = response();
  await controller.deleteFloor({ params: { id } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(unlink.mock.callCount(), 0);
});
