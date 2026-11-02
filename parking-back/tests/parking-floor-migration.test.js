const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const ParkingFloor = require("../api/models/parkingFloorModel");
const ParkingSourceFile = require("../api/models/parkingSourceFileModel");
const migrate = require("../api/utils/migrateParkingFloorFields");

test("migrates legacy floor fields and camera file meanings without duplicating slot files", async (t) => {
  const floorId = new mongoose.Types.ObjectId();
  const cameraId = new mongoose.Types.ObjectId();
  const cctvId = new mongoose.Types.ObjectId();
  const migratedSlotId = new mongoose.Types.ObjectId();
  const filePath = path.resolve(
    __dirname,
    "../../json_file/parking_slots",
    `legacy-camera-slot-${floorId}-${cameraId}.json`,
  );
  t.after(() => fs.rm(filePath, { force: true }));

  const legacyFloor = {
    _id: floorId,
    status: "available",
    zone: 2,
    date_add: "2026-01-02",
    time_add: "03:04:05",
    camera_presets: [
      {
        _id: cameraId,
        name: "North",
        cctvFileName: "slot-file.json",
        parkingSlotFileId: String(cctvId),
        parkingSlotData: {
          categories: [
            { name: "zoneA_slot01", supercategory: "parking-slot" },
          ],
        },
        status: "unknown",
      },
    ],
  };
  const existingSlotSource = {
    _id: migratedSlotId,
    original_name: "slot-file.json",
    path: `json_file/parking_slots/legacy-camera-slot-${floorId}-${cameraId}.json`,
    fileType: "parking-slot",
  };
  const cameraUpdates = [];
  const floorUpdates = [];
  const droppedIndexes = [];
  let indexDropped = false;
  const originalDbDescriptor = Object.getOwnPropertyDescriptor(
    ParkingFloor.db,
    "db",
  );
  Object.defineProperty(ParkingFloor.db, "db", {
    configurable: true,
    value: {
      listCollections: () => ({ hasNext: async () => true }),
    },
  });
  t.after(() => {
    if (originalDbDescriptor) {
      Object.defineProperty(ParkingFloor.db, "db", originalDbDescriptor);
    } else {
      delete ParkingFloor.db.db;
    }
  });
  let insertedSources = 0;

  t.mock.method(ParkingFloor.collection, "find", () => ({
    toArray: async () => [legacyFloor],
  }));
  t.mock.method(ParkingFloor.collection, "indexes", async () =>
    indexDropped
      ? [{ name: "_id_", key: { _id: 1 } }]
      : [
          { name: "_id_", key: { _id: 1 } },
          { name: "building_1_zone_1", key: { building: 1, zone: 1 } },
        ],
  );
  t.mock.method(ParkingFloor.collection, "dropIndex", async (name) => {
    droppedIndexes.push(name);
    indexDropped = true;
  });
  t.mock.method(ParkingFloor.collection, "bulkWrite", async (operations) => {
    if (operations[0]?.updateOne?.update?.$set?.camera_presets) {
      cameraUpdates.push(...operations);
    } else {
      floorUpdates.push(...operations);
    }
  });
  t.mock.method(ParkingSourceFile.collection, "bulkWrite", async () => {});
  t.mock.method(ParkingSourceFile.collection, "updateMany", async () => {});
  t.mock.method(ParkingSourceFile.collection, "findOne", async (query) => {
    if (query.path) {
      return insertedSources
        ? existingSlotSource
        : null;
    }
    return {
      _id: cctvId,
      original_name: "camera-north.json",
      fileType: "cctv",
    };
  });
  t.mock.method(ParkingSourceFile.collection, "insertOne", async () => {
    insertedSources += 1;
    return { insertedId: migratedSlotId };
  });

  await migrate();
  await migrate();

  assert.deepEqual(droppedIndexes, ["building_1_zone_1"]);
  assert.equal(insertedSources, 1);
  const camera = cameraUpdates[0].updateOne.update.$set.camera_presets[0];
  assert.equal(camera.cctvFileName, "camera-north.json");
  assert.equal(camera.parkingSlotFileId, String(migratedSlotId));
  assert.equal(camera.status, "Unknown");
  assert.ok(camera.createAt instanceof Date);
  assert.ok(camera.updateAt instanceof Date);
  assert.deepEqual(
    JSON.parse(await fs.readFile(filePath, "utf8")).categories,
    legacyFloor.camera_presets[0].parkingSlotData.categories,
  );

  const floorUpdate = floorUpdates[0].updateOne.update;
  assert.equal(floorUpdate.$set.status, "Available");
  assert.equal(floorUpdate.$set.date_updated, "2026-01-02");
  assert.equal(floorUpdate.$set.time_updated, "03:04:05");
  assert.deepEqual(floorUpdate.$unset, {
    date_add: "",
    time_add: "",
    zone: "",
  });
});
