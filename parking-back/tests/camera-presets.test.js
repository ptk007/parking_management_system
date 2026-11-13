const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const ParkingFloor = require("../api/models/parkingFloorModel");
const ParkingSourceFile = require("../api/models/parkingSourceFileModel");
const controller = require("../api/controllers/parkingFloorController");
const pythonModelRuntime = require("../api/services/pythonModelRuntime");

const floorId = "507f1f77bcf86cd799439011";
const cameraId = "507f1f77bcf86cd799439012";
const slotFileId = new mongoose.Types.ObjectId();

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

function makeFloor(camera = null) {
  const cameras = camera ? [camera] : [];
  cameras.id = (id) => cameras.find((item) => String(item._id) === String(id));
  return {
    _id: floorId,
    camera_presets: cameras,
    async save() {},
    async populate() {},
  };
}

async function upload(t, json) {
  const root = path.resolve(__dirname, "../../json_file/parking_slots");
  await fs.mkdir(root, { recursive: true });
  const filename = `test-preset-${crypto.randomUUID()}.json`;
  const target = path.join(root, filename);
  const text = JSON.stringify(json);
  await fs.writeFile(target, text);
  t.after(() => fs.rm(target, { force: true }));
  return {
    path: target,
    filename,
    originalname: "parking-slots.json",
    size: Buffer.byteLength(text),
  };
}

test("floor and camera schemas expose the revised fields and title-case statuses", () => {
  const floorSchema = ParkingFloor.schema;
  const cameraSchema = floorSchema.path("camera_presets").schema;
  assert.equal(floorSchema.path("zone"), undefined);
  assert.equal(floorSchema.path("date_add"), undefined);
  assert.equal(floorSchema.path("time_add"), undefined);
  assert.deepEqual(floorSchema.path("status").enumValues, ["Available", "Disable"]);
  assert.equal(floorSchema.path("status").defaultValue, "Disable");
  assert.deepEqual(cameraSchema.path("status").enumValues, ["Enable", "Disable"]);
  assert.equal(cameraSchema.path("status").defaultValue, "Enable");
  assert.deepEqual(cameraSchema.path("sourceStatus").enumValues, [
    "Online",
    "Offline",
    "Unknown",
  ]);
  assert.equal(cameraSchema.path("cameraNo").instance, "String");
  assert.equal(cameraSchema.path("sourceCameraName").instance, "String");
  assert.equal(cameraSchema.path("modelEnabled").defaultValue, false);
  assert.deepEqual(cameraSchema.path("modelRuntimeStatus").enumValues, [
    "Offline",
    "Starting",
    "Online",
    "Stopping",
    "Error",
  ]);
  assert.equal(cameraSchema.path("modelRuntimeUpdatedAt").instance, "Date");
  assert.equal(cameraSchema.path("createAt").instance, "Date");
  assert.equal(cameraSchema.path("updateAt").instance, "Date");
  assert.equal(cameraSchema.options.timestamps.createdAt, "createAt");
  assert.equal(cameraSchema.options.timestamps.updatedAt, "updateAt");
});

test("camera creation stores the uploaded slot JSON and separates the original CCTV name", async (t) => {
  const categories = {
    categories: [
      { name: "all", supercategory: "none" },
      { name: "zoneA_slot01", supercategory: "parking-slot" },
    ],
  };
  const file = await upload(t, categories);
  const floor = new ParkingFloor({
    building: new mongoose.Types.ObjectId(),
    floor: 2,
    veh_type: "car",
    status: "Disable",
    date_updated: "2026-01-01",
    time_updated: "12:00:00",
  });
  t.mock.method(floor, "save", async () => {});
  t.mock.method(floor, "populate", async () => floor);
  t.mock.method(ParkingFloor, "findById", async () => floor);
  t.mock.method(ParkingSourceFile, "create", async (data) => ({
    _id: slotFileId,
    ...data,
  }));
  const res = response();

  await controller.saveCameraPreset(
    {
      params: { id: floorId },
      body: {
        name: "North camera",
        cctvFileName: "camera-north.json",
        cameraSelector: "0",
      },
      file,
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  const camera = floor.camera_presets[0];
  assert.equal(camera.cctvFileName, "camera-north.json");
  assert.equal(camera.parkingSlotFileId, String(slotFileId));
  assert.deepEqual(camera.parkingSlotData, categories);
  assert.equal(camera.status, "Enable");
  assert.equal(camera.sourceStatus, "Unknown");
  assert.equal(
    ParkingSourceFile.create.mock.calls[0].arguments[0].fileType,
    "parking-slot",
  );
});

test("camera creation accepts embedded slot JSON without creating a physical file", async (t) => {
  const parkingSlotData = {
    categories: [
      { name: "all", supercategory: "none" },
      { name: "zoneA_slot01", supercategory: "parking-slot" },
    ],
  };
  const floor = makeFloor();
  t.mock.method(floor, "save", async () => {});
  t.mock.method(floor, "populate", async () => floor);
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const createSource = t.mock.method(ParkingSourceFile, "create", async () => {
    throw new Error("Embedded JSON must not create a source file");
  });
  const findSource = t.mock.method(ParkingSourceFile, "findOne", async () => {
    throw new Error("Embedded JSON must not look up a source file");
  });
  const res = response();

  await controller.saveCameraPreset(
    {
      params: { id: floorId },
      body: {
        name: "North camera",
        cctvFileName: "camera-north.json",
        parkingSlotData,
        cameraNo: "CAM-5",
        sourceCameraName: "North entrance",
        status: "Disable",
        sourceStatus: "Offline",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(floor.camera_presets[0].parkingSlotFileId, null);
  assert.deepEqual(floor.camera_presets[0].parkingSlotData, parkingSlotData);
  assert.equal(floor.camera_presets[0].cameraNo, "CAM-5");
  assert.equal(floor.camera_presets[0].sourceCameraName, "North entrance");
  assert.equal(floor.camera_presets[0].status, "Disable");
  assert.equal(floor.camera_presets[0].sourceStatus, "Offline");
  assert.equal(createSource.mock.callCount(), 0);
  assert.equal(findSource.mock.callCount(), 0);
});

test("new online enabled CCTV preset enables YOLO and starts the Python runtime", async (t) => {
  const parkingSlotData = {
    categories: [
      { name: "all", supercategory: "none" },
      { name: "zoneA_slot01", supercategory: "parking-slot" },
    ],
  };
  const floor = makeFloor();
  t.mock.method(floor, "save", async () => {});
  t.mock.method(floor, "populate", async () => floor);
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const start = t.mock.method(pythonModelRuntime, "start", () => ({}));
  const res = response();

  await controller.saveCameraPreset(
    {
      params: { id: floorId },
      body: {
        name: "North camera",
        cctvFileName: "camera-north.json",
        cameraNo: "CAM-5",
        parkingSlotData,
        status: "Enable",
        sourceStatus: "Online",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(floor.camera_presets[0].modelEnabled, true);
  assert.equal(floor.camera_presets[0].modelRuntimeStatus, "Starting");
  assert.equal(start.mock.callCount(), 1);
});

test("new offline CCTV preset leaves YOLO disabled", async (t) => {
  const floor = makeFloor();
  t.mock.method(floor, "save", async () => {});
  t.mock.method(floor, "populate", async () => floor);
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const start = t.mock.method(pythonModelRuntime, "start", () => ({}));
  const res = response();

  await controller.saveCameraPreset(
    {
      params: { id: floorId },
      body: {
        name: "North camera",
        cctvFileName: "camera-north.json",
        parkingSlotData: {
          categories: [
            { name: "all", supercategory: "none" },
            { name: "zoneA_slot01", supercategory: "parking-slot" },
          ],
        },
        status: "Enable",
        sourceStatus: "Offline",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(floor.camera_presets[0].modelEnabled, false);
  assert.equal(start.mock.callCount(), 0);
});

test("rejects embedded JSON without a named parking-slot category", async (t) => {
  const floor = makeFloor();
  t.mock.method(floor, "save", async () => {});
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const res = response();

  await controller.saveCameraPreset(
    {
      params: { id: floorId },
      body: {
        name: "North camera",
        parkingSlotData: {
          categories: [{ name: "all", supercategory: "none" }],
        },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /no parking-slot categories/);
  assert.equal(floor.camera_presets.length, 0);
});

test("rejects slot JSON without slot categories and removes the upload", async (t) => {
  const file = await upload(t, {
    categories: [{ name: "all", supercategory: "none" }],
  });
  t.mock.method(ParkingFloor, "findById", async () => makeFloor());
  const create = t.mock.method(ParkingSourceFile, "create", async () => {
    throw new Error("Invalid input must not create a source file");
  });
  const res = response();

  await controller.saveCameraPreset(
    {
      params: { id: floorId },
      body: { name: "North camera" },
      file,
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.equal(create.mock.callCount(), 0);
  await assert.rejects(fs.access(file.path), { code: "ENOENT" });
});

test("the category endpoint returns only parking-slot category names", async (t) => {
  const camera = {
    _id: cameraId,
    parkingSlotData: {
      categories: [
        { name: "all", supercategory: "none" },
        { name: "zoneA_slot01", supercategory: "parking-slot" },
        { name: "zoneA_slot02", supercategory: "parking-slot" },
      ],
    },
  };
  const floor = makeFloor(camera);
  t.mock.method(ParkingFloor, "findById", () => ({
    select: async () => floor,
  }));
  const res = response();

  await controller.listCameraParkingSlotCategories(
    { params: { id: floorId, cameraId } },
    res,
  );

  assert.deepEqual(res.body, {
    categories: ["zoneA_slot01", "zoneA_slot02"],
  });
});

test("preset enable state is separate from the original CCTV source status", async (t) => {
  const camera = { _id: cameraId, status: "Enable", sourceStatus: "Online", modelEnabled: true };
  const floor = makeFloor(camera);
  t.mock.method(ParkingFloor, "findById", async () => floor);
  const disabled = response();
  await controller.updateCameraPresetStatus(
    { params: { id: floorId, cameraId }, body: { status: "Disable" } },
    disabled,
  );
  assert.equal(disabled.statusCode, 200);
  assert.equal(camera.status, "Disable");
  assert.equal(camera.modelEnabled, true, "preset disable should preserve Detection preference");

  const reset = response();
  await controller.updateCameraPresetStatus(
    { params: { id: floorId, cameraId }, body: { status: "Enable" } },
    reset,
  );
  assert.equal(reset.statusCode, 200);
  assert.equal(camera.status, "Enable");
  assert.equal(camera.sourceStatus, "Online");
  assert.equal(camera.modelEnabled, true, "preset re-enable should restore Detection preference");
  assert.equal(typeof floor.date_updated, "string");
  assert.equal(typeof floor.time_updated, "string");

  const rejected = response();
  await controller.updateCameraPresetStatus(
    { params: { id: floorId, cameraId }, body: { status: "Offline" } },
    rejected,
  );
  assert.equal(rejected.statusCode, 400);
});
