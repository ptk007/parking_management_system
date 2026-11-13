const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const ParkingFloor = require("../models/parkingFloorModel");
const ParkingSourceFile = require("../models/parkingSourceFileModel");
const { getBangkokDateTime } = require("./dateTime");

const FILE_ROOT = path.resolve(__dirname, "../../../json_file/parking_slots");

function getTimestamp(value, fallback) {
  const timestamp = value ? new Date(value) : fallback;
  return Number.isNaN(timestamp.getTime()) ? fallback : timestamp;
}

async function ensureLegacySlotSource(floorId, camera) {
  const { parkingSlotData } = camera;
  if (!parkingSlotData || !Array.isArray(parkingSlotData.categories)) {
    return null;
  }

  const filename = `legacy-camera-slot-${floorId}-${camera._id}.json`;
  const relativePath = `json_file/parking_slots/${filename}`;
  const absolutePath = path.join(FILE_ROOT, filename);
  const existing = await ParkingSourceFile.collection.findOne({
    path: relativePath,
    fileType: "parking-slot",
  });
  if (!existing) {
    const content = JSON.stringify(parkingSlotData);
    await fs.mkdir(FILE_ROOT, { recursive: true });
    await fs.writeFile(absolutePath, content, { flag: "w" });
    const timestamp = new Date();
    const result = await ParkingSourceFile.collection.insertOne({
      original_name:
        camera.cctvFileName || `parking-slots-${camera._id}.json`,
      path: relativePath,
      size: Buffer.byteLength(content),
      fileType: "parking-slot",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return {
      _id: result.insertedId,
      original_name:
        camera.cctvFileName || `parking-slots-${camera._id}.json`,
      fileType: "parking-slot",
    };
  }

  try {
    await fs.access(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const content = JSON.stringify(parkingSlotData);
    await fs.mkdir(FILE_ROOT, { recursive: true });
    await fs.writeFile(absolutePath, content, { flag: "w" });
    await ParkingSourceFile.collection.updateOne(
      { _id: existing._id },
      { $set: { size: Buffer.byteLength(content) } },
    );
  }

  return existing;
}

async function migrateCameraPresets(floors) {
  const updates = [];
  for (const floor of floors) {
    const cameras = Array.isArray(floor.camera_presets)
      ? floor.camera_presets.map((camera) => ({ ...camera }))
      : [];
    let changed = false;
    for (const camera of cameras) {
      const original = { ...camera };
      let cctvSource = null;
      if (mongoose.Types.ObjectId.isValid(camera.parkingSlotFileId)) {
        cctvSource = await ParkingSourceFile.collection.findOne({
          _id: new mongoose.Types.ObjectId(camera.parkingSlotFileId),
        });
      }

      const alreadyMigrated = cctvSource?.fileType === "parking-slot";
      if (!alreadyMigrated && (camera.parkingSlotData || cctvSource)) {
        const slotSource = await ensureLegacySlotSource(floor._id, camera);
        camera.cctvFileName = cctvSource?.original_name || "";
        camera.parkingSlotFileId = slotSource
          ? String(slotSource._id)
          : null;
        if (
          camera.status !== "Disable" &&
          camera.status !== "Online" &&
          camera.status !== "Offline"
        ) {
          camera.status = "Unknown";
        }
      } else if (alreadyMigrated) {
        camera.parkingSlotFileId = String(cctvSource._id);
      }

      const legacyStatus = String(camera.status || "Unknown").toLowerCase();
      const currentSourceStatus = String(camera.sourceStatus || "").toLowerCase();
      camera.status =
        legacyStatus === "disable" || legacyStatus === "disabled"
          ? "Disable"
          : legacyStatus === "enable" || legacyStatus === "enabled"
            ? "Enable"
            : "Enable";
      camera.sourceStatus =
        currentSourceStatus === "online" || legacyStatus === "online"
          ? "Online"
          : currentSourceStatus === "offline" || legacyStatus === "offline"
            ? "Offline"
            : "Unknown";
      const now = new Date();
      camera.createAt = getTimestamp(
        camera.createAt || cctvSource?.createdAt,
        now,
      );
      camera.updateAt = getTimestamp(
        camera.updateAt || cctvSource?.updatedAt,
        now,
      );
      changed =
        changed ||
        Object.keys(camera).some((key) => {
          if (camera[key] instanceof Date && original[key] instanceof Date) {
            return camera[key].getTime() !== original[key].getTime();
          }
          return camera[key] !== original[key];
        });
    }

    if (changed) {
      updates.push({
        updateOne: {
          filter: { _id: floor._id },
          update: { $set: { camera_presets: cameras } },
        },
      });
    }
  }
  if (updates.length) {
    await ParkingFloor.collection.bulkWrite(updates);
  }
}

async function migrateParkingFloorFields() {
  const floors = await ParkingFloor.collection.find({}).toArray();
  const floorCollectionExists = await ParkingFloor.db.db
    .listCollections({ name: ParkingFloor.collection.name }, { nameOnly: true })
    .hasNext();
  if (floorCollectionExists) {
    const indexList = await ParkingFloor.collection.indexes();
    for (const index of indexList) {
      if (index.name !== "_id_" && index.key?.zone) {
        await ParkingFloor.collection.dropIndex(index.name);
      }
    }
  }

  const sourceCollection = ParkingSourceFile.collection;
  const embeddedSlotFiles = floors.flatMap((floor) =>
    Array.isArray(floor.parking_slot_files) ? floor.parking_slot_files : [],
  );
  if (embeddedSlotFiles.length) {
    await sourceCollection.bulkWrite(
      embeddedSlotFiles.map((file) => ({
        updateOne: {
          filter: { _id: file._id },
          update: {
            $setOnInsert: {
              original_name: file.original_name,
              path: file.path,
              size: file.size,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            $set: { fileType: "parking-slot" },
          },
          upsert: true,
        },
      })),
    );
  }

  await sourceCollection.updateMany(
    { fileType: { $exists: false } },
    { $set: { fileType: "cctv" } },
  );
  await migrateCameraPresets(floors);

  const timestamp = getBangkokDateTime();
  const operations = floors.flatMap((floor) => {
    const dateUpdated =
      floor.date_updated || floor.date_add || timestamp.date_add;
    const timeUpdated =
      floor.time_updated || floor.time_add || timestamp.time_add;
    const oldStatus = String(floor.status || "Disable").toLowerCase();
    const status = oldStatus === "available" ? "Available" : "Disable";
    const update = {
      $set: {
        date_updated: dateUpdated,
        time_updated: timeUpdated,
        status,
      },
      $unset: {
        date_add: "",
        time_add: "",
        zone: "",
      },
    };
    if (
      dateUpdated !== floor.date_updated ||
      timeUpdated !== floor.time_updated ||
      status !== floor.status ||
      floor.date_add !== undefined ||
      floor.time_add !== undefined ||
      floor.zone !== undefined
    ) {
      return [{ updateOne: { filter: { _id: floor._id }, update } }];
    }
    return [];
  });
  if (operations.length) {
    await ParkingFloor.collection.bulkWrite(operations);
  }
}

module.exports = migrateParkingFloorFields;
