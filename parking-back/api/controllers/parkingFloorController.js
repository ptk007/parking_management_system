const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const ParkingBuilding = require("../models/parkingBuildingModel");
const ParkingFloor = require("../models/parkingFloorModel");
const { getBangkokDateTime } = require("../utils/dateTime");

const FILE_ROOT = path.resolve(__dirname, "../../../json_file/parking_slots");
const BUILDING_FIELDS = "_id building_name building_status building_image";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getFilePath(file) {
  return file ? `json_file/parking_slots/${file.filename}` : undefined;
}

async function deleteParkingSlotFile(filePath) {
  if (!filePath) {
    return;
  }

  const absolutePath = path.resolve(__dirname, "../../..", filePath);
  const relativePath = path.relative(FILE_ROOT, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      "Refusing to delete a file outside json_file/parking_slots",
    );
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function removeUploadedFile(file) {
  if (file) {
    await deleteParkingSlotFile(getFilePath(file));
  }
}

async function isValidJsonFile(file) {
  if (!file) {
    return false;
  }

  try {
    JSON.parse((await fs.readFile(file.path, "utf8")).replace(/^\uFEFF/, ""));
    return true;
  } catch {
    return false;
  }
}

async function buildingExists(buildingId) {
  return (
    isValidId(buildingId) &&
    Boolean(await ParkingBuilding.exists({ _id: buildingId }))
  );
}

function sendError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "zone already exists in this building",
    });
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

// POST /api/admin/system/floors - Create a floor; legacy map uploads remain optional.
exports.createFloor = async (req, res) => {
  try {
    const {
      building,
      floor,
      veh_type,
      zone: requestedZone,
      status,
    } = req.body ?? {};

    if (req.file && !(await isValidJsonFile(req.file))) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "parking_slot_file must contain valid JSON",
      });
    }

    if (!(await buildingExists(building))) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "building must be an existing parking_building id",
      });
    }

    if (
      requestedZone !== undefined &&
      (await ParkingFloor.exists({ building, zone: requestedZone }))
    ) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "zone already exists in this building",
      });
    }

    let parkingFloor;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      // Existing databases still enforce a unique (building, zone) index.
      // Assign that internal value automatically when the form omits it.
      const lastFloor =
        requestedZone === undefined
          ? await ParkingFloor.findOne({ building })
              .sort({ zone: -1 })
              .select("zone")
          : null;
      const zone = requestedZone ?? Number(lastFloor?.zone || 0) + 1;
      try {
        parkingFloor = await ParkingFloor.create({
          building,
          floor,
          veh_type,
          zone,
          status,
          parking_slot_file: getFilePath(req.file),
          ...getBangkokDateTime(),
        });
        break;
      } catch (error) {
        if (requestedZone === undefined && error?.code === 11000 && attempt < 2)
          continue;
        throw error;
      }
    }
    await parkingFloor.populate("building", BUILDING_FIELDS);

    return res.status(201).json({ success: true, floor: parkingFloor });
  } catch (error) {
    try {
      await removeUploadedFile(req.file);
    } catch (fileError) {
      console.error(fileError);
    }
    return sendError(res, error);
  }
};

// GET /api/admin/system/floors - List floors with their building details.
exports.listFloors = async (req, res) => {
  try {
    const floors = await ParkingFloor.find()
      .populate("building", BUILDING_FIELDS)
      .sort({ date_add: -1, time_add: -1 });

    return res.json({ success: true, count: floors.length, floors });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/admin/system/floors/check-duplicate?building=id&zone=number
// Check whether a zone is already used within a building.
exports.checkDuplicateZone = async (req, res) => {
  try {
    const { building, zone } = req.query;
    if (!building || zone === undefined) {
      return res.status(400).json({
        success: false,
        message: "building and zone query parameters are required",
      });
    }

    const exists = await ParkingFloor.exists({ building, zone });
    return res.json({ success: true, duplicate: Boolean(exists) });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/admin/system/floors/:id - Return one floor by MongoDB ObjectId.
exports.getFloor = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid floor id",
      });
    }

    const parkingFloor = await ParkingFloor.findById(req.params.id).populate(
      "building",
      BUILDING_FIELDS,
    );
    if (!parkingFloor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    return res.json({ success: true, floor: parkingFloor });
  } catch (error) {
    return sendError(res, error);
  }
};

// PATCH /api/admin/system/floors/:id - Update floor data or replace its JSON.
exports.updateFloor = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Invalid floor id",
      });
    }

    const parkingFloor = await ParkingFloor.findById(req.params.id);
    if (!parkingFloor) {
      await removeUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    if (req.file && !(await isValidJsonFile(req.file))) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "parking_slot_file must contain valid JSON",
      });
    }

    const nextBuilding = req.body?.building ?? parkingFloor.building;
    const nextZone = req.body?.zone ?? parkingFloor.zone;
    if (!(await buildingExists(nextBuilding))) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "building must be an existing parking_building id",
      });
    }

    if (
      await ParkingFloor.exists({
        building: nextBuilding,
        zone: nextZone,
        _id: { $ne: parkingFloor._id },
      })
    ) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "zone already exists in this building",
      });
    }

    const previousFile = parkingFloor.parking_slot_file;
    for (const field of ["building", "floor", "veh_type", "zone", "status"]) {
      if (req.body?.[field] !== undefined) {
        parkingFloor[field] = req.body[field];
      }
    }

    const newFilePath = getFilePath(req.file);
    if (newFilePath) {
      parkingFloor.parking_slot_file = newFilePath;
    }

    await parkingFloor.save();
    if (newFilePath) {
      try {
        await deleteParkingSlotFile(previousFile);
      } catch (fileError) {
        console.error(fileError);
      }
    }

    await parkingFloor.populate("building", BUILDING_FIELDS);
    return res.json({ success: true, floor: parkingFloor });
  } catch (error) {
    try {
      await removeUploadedFile(req.file);
    } catch (fileError) {
      console.error(fileError);
    }
    return sendError(res, error);
  }
};

// DELETE /api/admin/system/floors/:id - Delete a floor and its JSON file.
exports.deleteFloor = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid floor id",
      });
    }

    const parkingFloor = await ParkingFloor.findById(req.params.id);
    if (!parkingFloor) {
      return res.status(404).json({
        success: false,
        message: "Floor not found",
      });
    }

    await parkingFloor.deleteOne();
    for (const file of parkingFloor.parking_slot_files || []) {
      try {
        if (
          !(await require("../models/parkingSourceFileModel").exists({
            path: file.path,
          }))
        )
          await deleteParkingSlotFile(file.path);
      } catch (error) {
        console.error(error);
      }
    }
    try {
      await deleteParkingSlotFile(parkingFloor.parking_slot_file);
    } catch (fileError) {
      console.error(fileError);
    }

    return res.json({ success: true, message: "Floor deleted" });
  } catch (error) {
    return sendError(res, error);
  }
};

// Store the original slot JSON files under the selected floor preset.
exports.importSlotFiles = async (req, res) => {
  const files = req.files || [];
  let saved = false;
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Invalid floor id" });
    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    if (!files.length)
      return res.status(400).json({ message: "Choose at least one JSON file" });
    const existing = floor.parking_slot_files || [];
    if (
      files.reduce((sum, file) => sum + file.size, 0) +
        existing.reduce((sum, file) => sum + file.size, 0) >
      5 * 1024 * 1024
    )
      return res
        .status(400)
        .json({ message: "The files for a floor must total 5 MB or less" });
    const names = new Set(existing.map((file) => file.original_name));
    for (const file of files) {
      if (names.has(file.originalname))
        return res
          .status(409)
          .json({ message: `File already imported: ${file.originalname}` });
      names.add(file.originalname);
      if (!(await isValidJsonFile(file)))
        return res
          .status(400)
          .json({ message: `Invalid JSON: ${file.originalname}` });
    }
    // An atomic append preserves concurrent imports into the same floor.
    const updated = await ParkingFloor.findOneAndUpdate(
      {
        _id: floor._id,
        ...(existing.length
          ? { parking_slot_files: floor.parking_slot_files }
          : {
              $or: [
                { parking_slot_files: [] },
                { parking_slot_files: { $exists: false } },
              ],
            }),
      },
      {
        $push: {
          parking_slot_files: {
            $each: files.map((file) => ({
              original_name: file.originalname,
              path: getFilePath(file),
              size: file.size,
            })),
          },
        },
      },
      { new: true, runValidators: true },
    ).populate("building", BUILDING_FIELDS);
    if (!updated)
      return res
        .status(409)
        .json({ message: "The floor changed. Reload and try again." });
    saved = true;
    return res.status(201).json({ success: true, floor: updated });
  } catch (error) {
    return sendError(res, error);
  } finally {
    if (!saved) await Promise.allSettled(files.map(removeUploadedFile));
  }
};

exports.downloadSlotFile = async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.fileId))
      return res.status(400).json({ message: "Invalid floor or file id" });
    const floor = await ParkingFloor.findById(req.params.id);
    const file = floor?.parking_slot_files?.id(req.params.fileId);
    if (!file) return res.status(404).json({ message: "File not found" });
    const absolutePath = path.resolve(__dirname, "../../..", file.path);
    const relative = path.relative(FILE_ROOT, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Invalid slot file path");
    return res.download(absolutePath, file.original_name);
  } catch (error) {
    return sendError(res, error);
  }
};

// Shared dashboard catalog contains floor maps, without camera connection credentials.
exports.dashboardCatalog = async (req, res) => {
  try {
    const floors = await ParkingFloor.find()
      .select("building floor veh_type status parking_map")
      .populate("building", "_id building_name")
      .sort({ floor: 1 });
    res.json({ floors });
  } catch (error) {
    return sendError(res, error);
  }
};
exports.saveMap = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Invalid floor id" });
    let map;
    try {
      map = require("../utils/parkingMap").validateParkingMap(req.body);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    if (floor.status === "available") {
      const previous = floor.parking_map;
      const geometry = (value) =>
        JSON.stringify({
          layout: value?.layout,
          slots: value?.slots?.map(({ status, ...slot }) => slot),
        });
      if (
        !previous ||
        geometry(previous) !== geometry(map) ||
        previous.slots.some(
          (slot) =>
            ["occupied", "incoming"].includes(slot.status) &&
            map.slots.find(
              (item) => item.number === slot.number && item.zone === slot.zone,
            )?.status !== slot.status,
        )
      )
        return res
          .status(409)
          .json({ message: "Disable this floor before editing its layout" });
    }
    // Compare status as part of the write, so a concurrent activation cannot accept a layout change.
    const updated = await ParkingFloor.findOneAndUpdate(
      { _id: floor._id, status: floor.status },
      { $set: { parking_map: map } },
      { new: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({ message: "Floor status changed. Reload and try again." });
    res.json({ floor: updated });
  } catch (error) {
    return sendError(res, error);
  }
};
exports.saveCameraPreset = async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Invalid floor id" });
    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const data = req.body || {};
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      !data.parkingSlotFileId ||
      !data.parkingSlotData
    )
      return res
        .status(400)
        .json({
          message:
            "Name, original CCTV source and parking slot file are required",
        });
    const SourceFile = require("../models/parkingSourceFileModel");
    const sourceExists =
      isValidId(data.parkingSlotFileId) &&
      ((await SourceFile.exists({ _id: data.parkingSlotFileId })) ||
        (await ParkingFloor.exists({
          "parking_slot_files._id": data.parkingSlotFileId,
        })));
    if (!sourceExists)
      return res
        .status(400)
        .json({ message: "Original CCTV source not found" });
    const preset = Object.fromEntries(
      [
        "name",
        "cameraSelector",
        "ipAddress",
        "rtspLink",
        "cctvFileName",
        "parkingSlotFileId",
        "parkingSlotData",
      ].map((key) => [key, data[key]]),
    );
    if (req.params.cameraId) {
      const camera = floor.camera_presets.id(req.params.cameraId);
      if (!camera) return res.status(404).json({ message: "Camera not found" });
      Object.assign(camera, preset);
    } else {
      floor.camera_presets.push(preset);
    }
    await floor.save();
    await floor.populate("building", BUILDING_FIELDS);
    res.json({ floor });
  } catch (error) {
    return sendError(res, error);
  }
};
exports.listSourceFiles = async (req, res) => {
  try {
    const SourceFile = require("../models/parkingSourceFileModel");
    const floors = await ParkingFloor.find().select("parking_slot_files");
    const legacy = floors.flatMap((floor) =>
      Array.from(floor.parking_slot_files || []),
    );
    if (legacy.length)
      await SourceFile.bulkWrite(
        legacy.map((file) => ({
          updateOne: {
            filter: { _id: file._id },
            update: {
              $setOnInsert: {
                original_name: file.original_name,
                path: file.path,
                size: file.size,
              },
            },
            upsert: true,
          },
        })),
      );
    const files = await SourceFile.find().sort({ createdAt: -1 });
    res.json({ files });
  } catch (error) {
    return sendError(res, error);
  }
};
exports.importSourceFiles = async (req, res) => {
  const files = req.files || [];
  let saved = false;
  try {
    if (
      !files.length ||
      files.reduce((sum, file) => sum + file.size, 0) > 5 * 1024 * 1024
    )
      return res
        .status(400)
        .json({ message: "Choose JSON files totalling 5 MB or less" });
    for (const file of files)
      if (!(await isValidJsonFile(file)))
        return res
          .status(400)
          .json({ message: `Invalid JSON: ${file.originalname}` });
    const SourceFile = require("../models/parkingSourceFileModel");
    // Validate the entire batch before writing any records.
    const docs = files.map((file) => ({
      _id: new mongoose.Types.ObjectId(),
      original_name: file.originalname,
      path: getFilePath(file),
      size: file.size,
    }));
    try {
      await SourceFile.insertMany(docs, { ordered: true });
    } catch (error) {
      await SourceFile.deleteMany({ _id: { $in: docs.map((doc) => doc._id) } });
      throw error;
    }
    saved = true;
    res.status(201).json({ success: true });
  } catch (error) {
    return sendError(res, error);
  } finally {
    if (!saved) await Promise.allSettled(files.map(removeUploadedFile));
  }
};
exports.downloadSourceFile = async (req, res) => {
  try {
    if (!isValidId(req.params.fileId))
      return res.status(400).json({ message: "Invalid file id" });
    const file = await require("../models/parkingSourceFileModel").findById(
      req.params.fileId,
    );
    if (!file) return res.status(404).json({ message: "File not found" });
    const absolutePath = path.resolve(__dirname, "../../..", file.path);
    const relative = path.relative(FILE_ROOT, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Invalid source file path");
    return res.download(absolutePath, file.original_name);
  } catch (error) {
    return sendError(res, error);
  }
};

exports.setSlotStatuses = async (req, res) => {
  try {
    const user = await require("../models/userModel")
      .findById(req.auth.userId)
      .select("role status");
    if (
      !user ||
      user.status === "disable" ||
      !["admin", "staff"].includes(user.role)
    )
      return res
        .status(403)
        .json({ message: "Parking management access required" });
    const { keys, status } = req.body || {};
    if (
      !isValidId(req.params.id) ||
      !Array.isArray(keys) ||
      keys.length > 5000 ||
      !keys.every((key) => typeof key === "string") ||
      !["available", "disabled"].includes(status)
    )
      return res.status(400).json({ message: "Invalid slot status update" });
    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor?.parking_map)
      return res.status(404).json({ message: "Parking map not found" });
    const selected = new Set(keys);
    const slots = floor.parking_map.slots.map((slot) =>
      selected.has(JSON.stringify([slot.zone, slot.number])) &&
      ["available", "disabled"].includes(slot.status)
        ? { ...slot, status }
        : slot,
    );
    const map = { ...floor.parking_map, slots };
    const updated = await ParkingFloor.findOneAndUpdate(
      { _id: floor._id, parking_map: floor.parking_map },
      { $set: { parking_map: map } },
      { new: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({ message: "Map changed. Reload and try again." });
    res.json({ map });
  } catch (error) {
    return sendError(res, error);
  }
};
