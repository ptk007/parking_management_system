const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const ParkingBuilding = require("../models/parkingBuildingModel");
const ParkingFloor = require("../models/parkingFloorModel");
const ParkingLog = require("../models/parkingLogModel");
const { UNKNOWN_VEHICLE_DETAIL } = ParkingLog;
const ParkingLogCounter = require("../models/parkingLogCounterModel");
const ParkingSlotStatusLog = require("../models/parkingSlotStatusLogModel");
const ParkingSourceFile = require("../models/parkingSourceFileModel");
const Vehicle = require("../models/vehicleModel");
const { getBangkokDateTime } = require("../utils/dateTime");
const pythonModelRuntime = require("../services/pythonModelRuntime");

const FILE_ROOT = path.resolve(__dirname, "../../../json_file/parking_slots");
const BUILDING_FIELDS = "_id building_name building_image date_updated time_updated";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getFilePath(file) {
  return file ? `json_file/parking_slots/${file.filename}` : undefined;
}

function getUpdatedAt() {
  const timestamp = getBangkokDateTime();
  return {
    date_updated: timestamp.date_add,
    time_updated: timestamp.time_add,
  };
}

async function getNextGuestName() {
  const counter = await ParkingLogCounter.findOneAndUpdate(
    { _id: "guest" },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return `Guest ${counter.sequence}`;
}

function getChangedEmptySlots(beforeSlots, afterSlots) {
  const afterByKey = new Map(
    afterSlots.map((slot) => [JSON.stringify([slot.zone, slot.number]), slot]),
  );
  return beforeSlots
    .filter((slot) => ["available", "disabled"].includes(slot.status))
    .filter((slot) => {
      const after = afterByKey.get(JSON.stringify([slot.zone, slot.number]));
      return after && after.status !== slot.status && ["available", "disabled"].includes(after.status);
    })
    .map((slot) => ({
      zone: String(slot.zone ?? "default"),
      number: Number(slot.number),
      name: slot.parkingSlotName || slot.name || String(slot.number),
    }));
}

async function recordSlotStatusChange(user, floor, slots, status) {
  if (!slots.length) return;
  const populatedBuildingName = floor.building?.building_name;
  const buildingRecord = populatedBuildingName || !floor.building
    ? null
    : await ParkingBuilding.findById(floor.building).select("building_name");
  const timestamp = getBangkokDateTime();
  await ParkingSlotStatusLog.create({
    name: user.name,
    role: user.role,
    building: populatedBuildingName || buildingRecord?.building_name || String(floor.building || ""),
    floor: floor.floor,
    veh_type: floor.veh_type,
    slots,
    date_updated: timestamp.date_add,
    time_updated: timestamp.time_add,
    status,
  });
}

function normalizeFloorStatus(status) {
  if (typeof status !== "string") {
    return status;
  }

  const normalized = status.trim().toLowerCase();
  if (normalized === "available") return "Available";
  if (normalized === "disable") return "Disable";
  return status;
}

function getParkingSlotNames(data) {
  if (!data || !Array.isArray(data.categories)) {
    throw new Error("Parking slot JSON must contain a categories array");
  }

  const names = data.categories
    .filter(
      (category) =>
        category &&
        category.supercategory === "parking-slot" &&
        typeof category.name === "string" &&
        category.name.trim(),
    )
    .map((category) => category.name.trim());

  if (!names.length) {
    throw new Error("Parking slot JSON contains no parking-slot categories");
  }
  return names;
}

function mapWithSlotConnectionStatus(map, cameraPresets = []) {
  if (!map || !Array.isArray(map.slots)) return map;
  const presets = Array.from(cameraPresets || []);
  return {
    ...map,
    slots: map.slots.map((slot) => {
      if (slot.connectionStatus === "Disconnect") return slot;
      const hasCameraPreset = Boolean(String(slot.cameraPresetId || "").trim());
      const hasParkingSlot = Boolean(String(slot.parkingSlotName || "").trim());
      if (!hasCameraPreset && !hasParkingSlot)
        return { ...slot, connectionStatus: "None" };
      if (!hasCameraPreset && hasParkingSlot)
        return { ...slot, connectionStatus: "Disconnect" };
      if (!hasParkingSlot) return { ...slot, connectionStatus: "None" };
      const camera = presets.find(
        (preset) => String(preset._id) === String(slot.cameraPresetId),
      );
      if (!camera) return { ...slot, connectionStatus: "Disconnect" };
      try {
        return {
          ...slot,
          connectionStatus: getParkingSlotNames(camera.parkingSlotData).includes(
            slot.parkingSlotName,
          )
            ? "Connect"
            : "Disconnect",
        };
      } catch {
        return { ...slot, connectionStatus: "Disconnect" };
      }
    }),
  };
}

function floorWithSlotConnectionStatus(floor) {
  const result = typeof floor?.toObject === "function" ? floor.toObject() : { ...floor };
  result.parking_map = mapWithSlotConnectionStatus(
    result.parking_map,
    result.camera_presets,
  );
  return result;
}

async function readParkingSlotJson(filePath) {
  const absolutePath = path.resolve(__dirname, "../../..", filePath);
  const relativePath = path.relative(FILE_ROOT, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid parking slot file path");
  }
  return JSON.parse((await fs.readFile(absolutePath, "utf8")).replace(/^\uFEFF/, ""));
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
      message: "floor already exists for this vehicle type in this building",
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

// POST /api/admin/system/floors - Create a floor; legacy slot-file uploads remain optional.
exports.createFloor = async (req, res) => {
  try {
    const {
      building,
      floor,
      veh_type,
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
      floor !== undefined &&
      veh_type !== undefined &&
      (await ParkingFloor.exists({ building, floor, veh_type }))
    ) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "floor already exists for this vehicle type in this building",
      });
    }

    const parkingFloor = await ParkingFloor.create({
      building,
      floor,
      veh_type,
      status: normalizeFloorStatus(status),
      parking_slot_file: getFilePath(req.file),
      ...getUpdatedAt(),
    });
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
      .sort({ date_updated: -1, time_updated: -1 });

    return res.json({
      success: true,
      count: floors.length,
      floors: floors.map(floorWithSlotConnectionStatus),
    });
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

    const floor = floorWithSlotConnectionStatus(parkingFloor);
    const slots = floor.parking_map?.slots;
    const occupied = Array.isArray(slots) ? slots.filter((slot) => slot.status === "occupied") : [];
    if (occupied.length) {
      const logs = await ParkingLog.find({
        floorId: floor._id,
        park_status: "Parking",
      }).select("cameraPresetId parkingSlotName park_slot license_num province").lean();
      const slotKey = (camera, name, number) => JSON.stringify([String(camera), name, number]);
      const logsBySlot = new Map(logs.map((log) => [
        slotKey(log.cameraPresetId, log.parkingSlotName, log.park_slot), log,
      ]));
      for (const slot of occupied) {
        const log = logsBySlot.get(slotKey(slot.cameraPresetId, slot.parkingSlotName, slot.number));
        if (!log) continue;
        slot.license_num = log.license_num;
        slot.province = log.province;
      }
    }
    return res.json({ success: true, floor });
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
    const nextFloor = req.body?.floor ?? parkingFloor.floor;
    const nextVehicleType = req.body?.veh_type ?? parkingFloor.veh_type;
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
        floor: nextFloor,
        veh_type: nextVehicleType,
        _id: { $ne: parkingFloor._id },
      })
    ) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "floor already exists for this vehicle type in this building",
      });
    }

    const previousFile = parkingFloor.parking_slot_file;
    for (const field of ["building", "floor", "veh_type", "status"]) {
      if (req.body?.[field] !== undefined) {
        parkingFloor[field] =
          field === "status"
            ? normalizeFloorStatus(req.body[field])
            : req.body[field];
      }
    }

    const newFilePath = getFilePath(req.file);
    if (newFilePath) {
      parkingFloor.parking_slot_file = newFilePath;
    }
    Object.assign(parkingFloor, getUpdatedAt());

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

// Store the original slot JSON files on the selected floor.
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
        $set: getUpdatedAt(),
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
      .select(
        "building floor veh_type status parking_map camera_presets._id camera_presets.parkingSlotData",
      )
      .populate("building", "_id building_name")
      .sort({ floor: 1 });
    res.json({
      floors: floors.map((floor) => {
        const result = floorWithSlotConnectionStatus(floor);
        delete result.camera_presets;
        if (Array.isArray(result.parking_map?.slots)) {
          result.parking_map.slots = result.parking_map.slots.map(
            ({ license_num, province, ...slot }) => slot,
          );
        }
        return result;
      }),
    });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.dashboardCameraPresets = async (req, res) => {
  try {
    const buildingName = String(req.query.buildingName || "").trim();
    const floorNumber = Number(req.query.floor || 0);
    const vehicleType = String(req.query.veh_type || "").trim();
    if (!buildingName || !Number.isInteger(floorNumber) || floorNumber < 1 ||
        !["car", "motorcycle"].includes(vehicleType))
      return res.status(400).json({ message: "Building, floor, and vehicle type are required" });
    const escapedName = buildingName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const building = await ParkingBuilding.findOne({
      building_name: new RegExp(`^${escapedName}$`, "i"),
    }).select("_id");
    if (!building) return res.json({ cameras: [] });
    const floors = await ParkingFloor.find({
      building: building._id,
      floor: floorNumber,
      veh_type: vehicleType,
    }).select("_id building floor veh_type camera_presets");
    const cameras = floors.flatMap((floor) =>
      (floor.camera_presets || []).map((camera) => {
        const preset =
          typeof camera.toObject === "function" ? camera.toObject() : { ...camera };
        return {
          ...preset,
          floorId: String(floor._id),
          floor: floor.floor,
          veh_type: floor.veh_type,
          buildingId: String(floor.building),
        };
      }),
    );
    return res.json({ cameras });
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
    const previousSlotsByKey = new Map(
      (floor.parking_map?.slots || []).map((slot) => [
        JSON.stringify([slot.zone, slot.number]),
        slot,
      ]),
    );
    map.slots = map.slots.map((slot) => {
      const previous = previousSlotsByKey.get(
        JSON.stringify([slot.zone, slot.number]),
      );
      const preserveDisconnect =
        Boolean(previous) && slot.connectionStatus === "Disconnect";
      return {
        ...slot,
        connectionStatus: preserveDisconnect
          ? "Disconnect"
          : slot.cameraPresetId && slot.parkingSlotName
            ? "Connect"
            : "None",
      };
    });
    const plateDetectionBySlot = new Map(
      (floor.parking_map?.slots || []).map((slot) => [
        JSON.stringify([slot.zone, slot.number]),
        {
          licensePlateDetected: slot.licensePlateDetected,
          license_num: slot.license_num,
          province: slot.province,
          date_updated: slot.date_updated,
          time_updated: slot.time_updated,
        },
      ]),
    );
    map.slots = map.slots.map((slot) => {
      const { licensePlateDetected: _untrustedDetection, ...cleanSlot } = slot;
      const previousDetails = plateDetectionBySlot.get(
        JSON.stringify([slot.zone, slot.number]),
      );
      if (slot.status !== "occupied" || !previousDetails) return cleanSlot;
      return {
        ...cleanSlot,
        ...(typeof previousDetails.licensePlateDetected === "boolean"
          ? { licensePlateDetected: previousDetails.licensePlateDetected }
          : {}),
        ...(previousDetails.license_num ? { license_num: previousDetails.license_num } : {}),
        ...(previousDetails.province ? { province: previousDetails.province } : {}),
        ...(previousDetails.date_updated ? { date_updated: previousDetails.date_updated } : {}),
        ...(previousDetails.time_updated ? { time_updated: previousDetails.time_updated } : {}),
      };
    });
    for (const slot of map.slots) {
      const hasCameraPreset = slot.cameraPresetId !== undefined;
      const hasParkingSlot = slot.parkingSlotName !== undefined;
      if (!hasCameraPreset && !hasParkingSlot) continue;
      if (slot.connectionStatus === "Disconnect") continue;
      if (typeof slot.cameraPresetId !== "string" || !slot.cameraPresetId.trim())
        return res.status(400).json({
          message: "A parking slot name requires a CCTV preset",
        });
      const camera = Array.from(floor.camera_presets || []).find(
        (preset) => String(preset._id) === slot.cameraPresetId,
      );
      if (!camera)
        return res.status(400).json({
          message: "Selected CCTV preset does not belong to this floor",
        });
      if (!hasParkingSlot) continue;
      if (typeof slot.parkingSlotName !== "string" || !slot.parkingSlotName.trim())
        return res.status(400).json({
          message: "Parking slot name must not be empty",
        });
      let names;
      try {
        names = getParkingSlotNames(camera.parkingSlotData);
      } catch {
        return res.status(400).json({
          message: "Selected CCTV preset has no parking-slot categories",
        });
      }
      if (!names.includes(slot.parkingSlotName))
        return res.status(400).json({
          message: "Selected parking slot does not belong to this CCTV preset",
        });
    }
    if (floor.status === "Available") {
      const previous = floor.parking_map;
      const geometry = (value) =>
        JSON.stringify({
          layout: value?.layout,
          slots: value?.slots?.map(({ status, connectionStatus, ...slot }) => slot),
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
      { $set: { parking_map: map, ...getUpdatedAt() } },
      { new: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({ message: "Floor status changed. Reload and try again." });
    res.json({ floor: floorWithSlotConnectionStatus(updated) });
  } catch (error) {
    return sendError(res, error);
  }
};
exports.saveCameraPreset = async (req, res) => {
  const uploadedFile = req.file;
  let sourceFile;
  let saved = false;
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Invalid floor id" });
    if (req.params.cameraId && !isValidId(req.params.cameraId))
      return res.status(400).json({ message: "Invalid camera id" });
    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const existingCamera = req.params.cameraId
      ? floor.camera_presets.id(req.params.cameraId)
      : null;
    if (req.params.cameraId && !existingCamera)
      return res.status(404).json({ message: "Camera preset not found" });
    const data = req.body || {};
    if (typeof data.name !== "string" || !data.name.trim())
      return res
        .status(400)
        .json({ message: "Camera preset name is required" });

    let parkingSlotData;
    let parkingSlotFileId = null;
    if (uploadedFile) {
      const contents = (
        await fs.readFile(uploadedFile.path, "utf8")
      ).replace(/^\uFEFF/, "");
      try {
        parkingSlotData = JSON.parse(contents);
      } catch (error) {
        return res.status(400).json({
          message: `Invalid parking slot JSON: ${error.message}`,
        });
      }
      try {
        getParkingSlotNames(parkingSlotData);
      } catch (error) {
        return res.status(400).json({
          message: error.message,
        });
      }
      sourceFile = await ParkingSourceFile.create({
        original_name: uploadedFile.originalname,
        path: getFilePath(uploadedFile),
        size: uploadedFile.size,
        fileType: "parking-slot",
      });
      parkingSlotFileId = String(sourceFile._id);
    } else if (
      Object.hasOwn(data, "parkingSlotData") &&
      !data.parkingSlotFileId
    ) {
      try {
        parkingSlotData =
          typeof data.parkingSlotData === "string"
            ? JSON.parse(data.parkingSlotData)
            : data.parkingSlotData;
      } catch (error) {
        return res.status(400).json({
          message: `Invalid parking slot JSON: ${error.message}`,
        });
      }
      try {
        getParkingSlotNames(parkingSlotData);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }
    } else {
      parkingSlotFileId = data.parkingSlotFileId || existingCamera?.parkingSlotFileId || null;
      if (parkingSlotFileId) {
        if (!isValidId(parkingSlotFileId))
          return res.status(400).json({
            message: "Invalid parking slot file id",
          });
        sourceFile = await ParkingSourceFile.findOne({
          _id: parkingSlotFileId,
          fileType: "parking-slot",
        });
        if (!sourceFile)
          return res.status(400).json({
            message: "Parking slot JSON file not found",
          });
        parkingSlotData = await readParkingSlotJson(sourceFile.path);
        try {
          getParkingSlotNames(parkingSlotData);
        } catch (error) {
          return res.status(400).json({ message: error.message });
        }
      } else {
        parkingSlotData = existingCamera?.parkingSlotData;
        if (parkingSlotData) getParkingSlotNames(parkingSlotData);
      }
    }

    const cctvFileName =
      typeof data.cctvFileName === "string"
        ? data.cctvFileName.trim()
        : existingCamera?.cctvFileName || "";
    const preset = {
      name: data.name.trim(),
      cctvFileName,
      cameraSelector: data.cameraSelector ?? existingCamera?.cameraSelector,
      cameraNo: data.cameraNo ?? existingCamera?.cameraNo,
      ipAddress: data.ipAddress ?? existingCamera?.ipAddress,
      sourceCameraName:
        data.sourceCameraName ?? existingCamera?.sourceCameraName,
      rtspLink: data.rtspLink ?? existingCamera?.rtspLink,
      parkingSlotFileId,
      parkingSlotData,
    };

    const sourceStatus = ["Online", "Offline", "Unknown"].includes(
      data.sourceStatus,
    )
      ? data.sourceStatus
      : existingCamera?.sourceStatus || "Unknown";
    const presetStatus = ["Enable", "Disable"].includes(data.status)
      ? data.status
      : existingCamera?.status || "Enable";
    const hasValidSlotData = (() => {
      try {
        getParkingSlotNames(preset.parkingSlotData);
        return true;
      } catch {
        return false;
      }
    })();
    const autoEnableModel =
      !existingCamera &&
      hasValidSlotData &&
      presetStatus === "Enable" &&
      sourceStatus === "Online";
    if (existingCamera) {
      const previousSourceIdentity = [
        existingCamera.cameraNo || existingCamera.cameraSelector || "",
        existingCamera.cctvFileName || "",
      ]
        .map((value) => String(value).trim().toLowerCase())
        .join("\0");
      const nextSourceIdentity = [
        preset.cameraNo || preset.cameraSelector || "",
        preset.cctvFileName || "",
      ]
        .map((value) => String(value).trim().toLowerCase())
        .join("\0");
      const sourceIdentityChanged = previousSourceIdentity !== nextSourceIdentity;
      let nextParkingSlotNames = [];
      if (hasValidSlotData) {
        try {
          nextParkingSlotNames = getParkingSlotNames(preset.parkingSlotData);
        } catch {
          nextParkingSlotNames = [];
        }
      }
      if (floor.parking_map?.slots?.length) {
        floor.parking_map = {
          ...floor.parking_map,
          slots: floor.parking_map.slots.map((slot) => {
            if (
              String(slot.cameraPresetId) !== String(existingCamera._id) ||
              !slot.parkingSlotName ||
              slot.connectionStatus === "Disconnect"
            )
              return slot;
            if (
              !sourceIdentityChanged &&
              nextParkingSlotNames.includes(slot.parkingSlotName)
            )
              return slot;
            const disconnected = { ...slot, connectionStatus: "Disconnect" };
            delete disconnected.parkingSlotName;
            return disconnected;
          }),
        };
      }
      const previousIdentity = [
        existingCamera.cameraNo || existingCamera.cameraSelector || "",
        existingCamera.cctvFileName || "",
        existingCamera.parkingSlotFileId || "",
        JSON.stringify(existingCamera.parkingSlotData?.categories || []),
      ]
        .map((value) => String(value).trim().toLowerCase())
        .join("\0");
      const nextIdentity = [
        preset.cameraNo || preset.cameraSelector || "",
        preset.cctvFileName || "",
        preset.parkingSlotFileId || "",
        JSON.stringify(preset.parkingSlotData?.categories || []),
      ]
        .map((value) => String(value).trim().toLowerCase())
        .join("\0");
      Object.assign(existingCamera, {
        ...preset,
        status: presetStatus,
        sourceStatus,
      });
      if (presetStatus === "Disable") {
        existingCamera.modelEnabled = false;
        existingCamera.modelRuntimeStatus = "Offline";
        existingCamera.modelRuntimeMessage = "";
        existingCamera.modelRuntimeId = "";
      }
      if (previousIdentity !== nextIdentity) {
        existingCamera.modelEnabled = false;
        existingCamera.modelRuntimeStatus = "Offline";
        existingCamera.modelRuntimeMessage = "";
        existingCamera.modelRuntimeUpdatedAt = new Date();
        existingCamera.modelRuntimeId = "";
      }
    } else {
      floor.camera_presets.push({
        ...preset,
        status: presetStatus,
        sourceStatus,
        modelEnabled: autoEnableModel,
        modelRuntimeStatus: autoEnableModel ? "Starting" : "Offline",
        modelRuntimeMessage: autoEnableModel
          ? "Waiting for the Python runtime"
          : "",
        modelRuntimeUpdatedAt: autoEnableModel ? new Date() : null,
      });
    }

    Object.assign(floor, getUpdatedAt());
    await floor.save();
    if (autoEnableModel) {
      try {
        pythonModelRuntime.start();
      } catch (runtimeError) {
        const createdCamera = floor.camera_presets[floor.camera_presets.length - 1];
        createdCamera.modelRuntimeStatus = "Error";
        createdCamera.modelRuntimeMessage = runtimeError.message.slice(0, 500);
        createdCamera.modelRuntimeUpdatedAt = new Date();
        await floor.save();
      }
    }
    await floor.populate("building", BUILDING_FIELDS);
    saved = true;
    return res.json({ success: true, floor });
  } catch (error) {
    return sendError(res, error);
  } finally {
    if (uploadedFile && !saved) {
      const cleanup = [removeUploadedFile(uploadedFile)];
      if (sourceFile?._id) {
        cleanup.push(ParkingSourceFile.deleteOne({ _id: sourceFile._id }));
      }
      const results = await Promise.allSettled(cleanup);
      for (const result of results) {
        if (result.status === "rejected") console.error(result.reason);
      }
    }
  }
};

exports.updateCameraPresetStatus = async (req, res) => {
  try {
    const { id, cameraId } = req.params;
    const { status } = req.body || {};
    if (!isValidId(id) || !isValidId(cameraId))
      return res.status(400).json({ message: "Invalid floor or camera id" });
    if (!["Enable", "Disable"].includes(status))
      return res.status(400).json({
        message: "Camera preset status must be Enable or Disable",
      });

    const floor = await ParkingFloor.findById(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const camera = floor.camera_presets.id(cameraId);
    if (!camera)
      return res.status(404).json({ message: "Camera preset not found" });

    camera.status = status;
    // Keep the Detection preference while the preset is disabled. Runtime sync
    // gates the worker on both switches, so re-enabling the preset restores it.
    camera.modelRuntimeUpdatedAt = new Date();
    Object.assign(floor, getUpdatedAt());
    await floor.save();
    await floor.populate("building", BUILDING_FIELDS);
    return res.json({ success: true, floor });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.deleteCameraPreset = async (req, res) => {
  try {
    const { id, cameraId } = req.params;
    if (!isValidId(id) || !isValidId(cameraId))
      return res.status(400).json({ message: "Invalid floor or camera id" });
    const floor = await ParkingFloor.findById(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const camera = floor.camera_presets.id(cameraId);
    if (!camera) return res.status(404).json({ message: "Camera preset not found" });

    if (floor.parking_map?.slots?.length) {
      const map = floor.parking_map;
      floor.parking_map = {
        ...map,
        slots: map.slots.map((slot) => {
        if (String(slot.cameraPresetId) !== String(camera._id)) return slot;
        const unassigned = { ...slot };
        const wasConnected = Boolean(slot.parkingSlotName);
        delete unassigned.cameraPresetId;
        delete unassigned.parkingSlotName;
        unassigned.connectionStatus =
          wasConnected || slot.connectionStatus === "Disconnect"
            ? "Disconnect"
            : "None";
        return unassigned;
        }),
      };
    }
    floor.camera_presets.pull(cameraId);
    Object.assign(floor, getUpdatedAt());
    await floor.save();
    await floor.populate("building", BUILDING_FIELDS);
    return res.json({ success: true, floor });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.updateCameraModelState = async (req, res) => {
  try {
    const { id, cameraId } = req.params;
    const { enabled } = req.body || {};
    if (!isValidId(id) || !isValidId(cameraId))
      return res.status(400).json({ message: "Invalid floor or camera id" });
    if (typeof enabled !== "boolean")
      return res.status(400).json({ message: "Model enabled must be a boolean" });

    const floor = await ParkingFloor.findById(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const camera = floor.camera_presets.id(cameraId);
    if (!camera)
      return res.status(404).json({ message: "Camera preset not found" });
    if (enabled && camera.status !== "Enable")
      return res.status(409).json({
        message: "Enable this CCTV preset before starting detection",
      });
    if (enabled) {
      const cameraNo = String(camera.cameraNo || camera.cameraSelector || "").trim();
      const cctvFileName = String(camera.cctvFileName || "").trim();
      if (!cameraNo || !cctvFileName)
        return res.status(400).json({
          message: "Camera number and original CCTV source filename are required to run YOLO",
        });

      const sourcePattern = new RegExp(
        `^${cctvFileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      );
      const otherPresets = await ParkingFloor.find({
        _id: { $ne: floor._id },
        "camera_presets.cctvFileName": sourcePattern,
      }).select("camera_presets");
      const sameFloorMatches = Array.from(floor.camera_presets || []).filter(
        (preset) =>
          String(preset._id) !== String(camera._id) &&
          String(preset.cameraNo || preset.cameraSelector || "").trim().toLowerCase() ===
            cameraNo.toLowerCase() &&
          String(preset.cctvFileName || "").trim().toLowerCase() ===
            cctvFileName.toLowerCase(),
      );
      const otherMatches = otherPresets.flatMap((item) =>
        Array.from(item.camera_presets || []).filter(
          (preset) =>
            String(preset.cameraNo || preset.cameraSelector || "").trim().toLowerCase() ===
              cameraNo.toLowerCase() &&
            String(preset.cctvFileName || "").trim().toLowerCase() ===
              cctvFileName.toLowerCase(),
        ),
      );
      if (sameFloorMatches.length || otherMatches.length)
        return res.status(409).json({
          message: "This camera number and CCTV source filename match multiple presets",
        });

      let categories;
      try {
        categories = getParkingSlotNames(camera.parkingSlotData);
      } catch {
        return res.status(400).json({
          message: "A valid parking-slot JSON is required before starting YOLO",
        });
      }
      const mappedSlots = (floor.parking_map?.slots || []).filter(
        (slot) => String(slot.cameraPresetId) === String(camera._id),
      );
      const invalidSlot = mappedSlots.find(
        (slot) => !slot.parkingSlotName || !categories.includes(slot.parkingSlotName),
      );
      if (invalidSlot)
        return res.status(400).json({
          message: "A parking map slot uses a category missing from this CCTV preset",
        });

      camera.modelEnabled = true;
      camera.modelRuntimeStatus = "Starting";
      camera.modelRuntimeMessage = "Waiting for the Python runtime";
      camera.modelRuntimeId = "";
    } else {
      camera.modelEnabled = false;
      const lastRuntimeUpdate = camera.modelRuntimeUpdatedAt
        ? new Date(camera.modelRuntimeUpdatedAt).getTime()
        : 0;
      const runtimeWasActive =
        ["Starting", "Online"].includes(camera.modelRuntimeStatus) &&
        Date.now() - lastRuntimeUpdate <= 20000;
      camera.modelRuntimeStatus = runtimeWasActive ? "Stopping" : "Offline";
      camera.modelRuntimeMessage = runtimeWasActive ? "Stopping the Python worker" : "";
      camera.modelRuntimeId = "";
    }
    camera.modelRuntimeUpdatedAt = new Date();
    Object.assign(floor, getUpdatedAt());
    await floor.save();
    if (enabled) {
      try {
        pythonModelRuntime.start();
      } catch (runtimeError) {
        camera.modelEnabled = false;
        camera.modelRuntimeStatus = "Error";
        camera.modelRuntimeMessage = runtimeError.message;
        camera.modelRuntimeUpdatedAt = new Date();
        await floor.save();
        return res.status(503).json({
          success: false,
          message: runtimeError.message,
          floor,
        });
      }
    }
    await floor.populate("building", BUILDING_FIELDS);
    return res.json({ success: true, floor });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.listCameraParkingSlotCategories = async (req, res) => {
  try {
    const { id, cameraId } = req.params;
    if (!isValidId(id) || !isValidId(cameraId))
      return res.status(400).json({ message: "Invalid floor or camera id" });
    const floor = await ParkingFloor.findById(id).select("camera_presets");
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const camera = floor.camera_presets.id(cameraId);
    if (!camera)
      return res.status(404).json({ message: "Camera preset not found" });
    try {
      return res.json({
        categories: getParkingSlotNames(camera.parkingSlotData),
      });
    } catch (error) {
      return res
        .status(400)
        .json({ message: error.message });
    }
  } catch (error) {
    return sendError(res, error);
  }
};
exports.listSourceFiles = async (req, res) => {
  try {
    const floors = await ParkingFloor.find().select("parking_slot_files");
    const legacy = floors.flatMap((floor) =>
      Array.from(floor.parking_slot_files || []),
    );
    if (legacy.length)
      await ParkingSourceFile.bulkWrite(
        legacy.map((file) => ({
          updateOne: {
            filter: { _id: file._id },
            update: {
              $setOnInsert: {
                original_name: file.original_name,
                path: file.path,
                size: file.size,
              },
              $set: { fileType: "parking-slot" },
            },
            upsert: true,
          },
        })),
      );
    const files = await ParkingSourceFile.find().sort({ createdAt: -1 });
    const filesWithAvailability = await Promise.all(
      files.map(async (file) => {
        const document = typeof file.toObject === "function" ? file.toObject() : { ...file };
        if (typeof document.path !== "string" || !document.path) {
          return { ...document, available: false };
        }
        const absolutePath = path.resolve(__dirname, "../../..", document.path);
        const relative = path.relative(FILE_ROOT, absolutePath);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
          return { ...document, available: false };
        }
        try {
          await fs.access(absolutePath);
          return { ...document, available: true };
        } catch (error) {
          if (error.code === "ENOENT") {
            return { ...document, available: false };
          }
          throw error;
        }
      }),
    );
    res.json({ files: filesWithAvailability });
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
    // Validate the entire batch before writing any records.
    const docs = files.map((file) => ({
      _id: new mongoose.Types.ObjectId(),
      original_name: file.originalname,
      path: getFilePath(file),
      size: file.size,
      fileType: "cctv",
    }));
    try {
      await ParkingSourceFile.insertMany(docs, { ordered: true });
    } catch (error) {
      await ParkingSourceFile.deleteMany({ _id: { $in: docs.map((doc) => doc._id) } });
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
    const file = await ParkingSourceFile.findById(req.params.fileId);
    if (!file) return res.status(404).json({ message: "File not found" });
    const absolutePath = path.resolve(__dirname, "../../..", file.path);
    const relative = path.relative(FILE_ROOT, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      throw new Error("Invalid source file path");
    try {
      await fs.access(absolutePath);
    } catch (error) {
      if (error.code === "ENOENT")
        return res.status(404).json({
          message: "Source file is missing from the server. Re-import the JSON file.",
        });
      throw error;
    }
    return res.download(absolutePath, file.original_name);
  } catch (error) {
    return sendError(res, error);
  }
};

exports.setSlotStatuses = async (req, res) => {
  try {
    const user = await require("../models/userModel")
      .findById(req.auth.userId)
      .select("name role status");
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
    const originalSlots = floor.parking_map.slots;
    const selected = new Set(keys);
    const slots = floor.parking_map.slots.map((slot) =>
      selected.has(JSON.stringify([slot.zone, slot.number])) &&
      ["available", "disabled"].includes(slot.status)
        ? (() => {
            const updatedSlot = { ...slot, status };
            delete updatedSlot.licensePlateDetected;
            delete updatedSlot.license_num;
            delete updatedSlot.province;
            delete updatedSlot.date_updated;
            delete updatedSlot.time_updated;
            return updatedSlot;
          })()
        : slot,
    );
    const map = { ...floor.parking_map, slots };
    const updated = await ParkingFloor.findOneAndUpdate(
      { _id: floor._id, parking_map: floor.parking_map },
      { $set: { parking_map: map, ...getUpdatedAt() } },
      { new: true },
    );
    if (!updated)
      return res
        .status(409)
        .json({ message: "Map changed. Reload and try again." });
    const changedSlots = getChangedEmptySlots(originalSlots, slots);
    await recordSlotStatusChange(user, floor, changedSlots, status);
    res.json({ map });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.updateOccupiedSlotVehicleDetails = async (req, res) => {
  try {
    const user = await require("../models/userModel")
      .findById(req.auth.userId)
      .select("role status");
    if (!user || user.status === "disable" || !["admin", "staff"].includes(user.role))
      return res.status(403).json({ message: "Parking management access required" });
    const { key, license_num, province } = req.body || {};
    if (
      !isValidId(req.params.id) ||
      typeof key !== "string" ||
      key.length > 256 ||
      typeof license_num !== "string" ||
      !license_num.trim() ||
      license_num.trim().toLowerCase() === UNKNOWN_VEHICLE_DETAIL.toLowerCase() ||
      license_num.trim().length > 100 ||
      typeof province !== "string" ||
      !province.trim() ||
      province.trim().length > 100
    )
      return res.status(400).json({ message: "License plate and province are required" });
    let identity;
    try {
      identity = JSON.parse(key);
    } catch {
      return res.status(400).json({ message: "Invalid parking slot key" });
    }
    if (
      !Array.isArray(identity) ||
      identity.length !== 2 ||
      typeof identity[0] !== "string" ||
      !Number.isSafeInteger(identity[1]) ||
      identity[1] < 1
    )
      return res.status(400).json({ message: "Invalid parking slot key" });
    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor?.parking_map)
      return res.status(404).json({ message: "Parking map not found" });
    const target = floor.parking_map.slots.find(
      (slot) => slot.zone === identity[0] && slot.number === identity[1],
    );
    if (!target) return res.status(404).json({ message: "Parking map slot not found" });
    if (target.status !== "occupied")
      return res.status(409).json({ message: "Vehicle details can only be saved for an occupied slot" });
    const buildingId = String(floor.building?._id || floor.building || "");
    const slotLogIdentity = target.cameraPresetId && target.parkingSlotName
      ? {
          buildingId,
          floorId: floor._id,
          veh_type: floor.veh_type,
          park_slot: target.number,
          cameraPresetId: target.cameraPresetId,
          parkingSlotName: target.parkingSlotName,
          park_status: "Parking",
        }
      : null;
    let activeLog = slotLogIdentity
      ? await ParkingLog.findOne(slotLogIdentity)
      : null;
    if (!activeLog) {
      const candidates = await ParkingLog.find({
        floorId: floor._id,
        veh_type: floor.veh_type,
        park_slot: target.number,
        park_status: "Parking",
      }).limit(10);
      const identityMatches = candidates.filter(
        (log) =>
          (!target.cameraPresetId || String(log.cameraPresetId) === String(target.cameraPresetId)) &&
          (!target.parkingSlotName || log.parkingSlotName === target.parkingSlotName),
      );
      if (identityMatches.length === 1) activeLog = identityMatches[0];
      else if (identityMatches.length > 1 || candidates.length > 1)
        return res.status(409).json({
          message: "More than one active parking log matches this slot. Reload the map and try again.",
        });
      else if (candidates.length === 1) activeLog = candidates[0];
    }
    if (
      activeLog &&
      (activeLog.license_num !== license_num.trim() || activeLog.province !== province.trim())
    ) {
      const duplicateActiveLog = await ParkingLog.exists({
        buildingId,
        floorId: floor._id,
        veh_type: floor.veh_type,
        license_num: license_num.trim(),
        province: province.trim(),
        park_status: "Parking",
        _id: { $ne: activeLog._id },
      });
      if (duplicateActiveLog)
        return res.status(409).json({ message: "This vehicle already has an active parking log on this floor" });
    }
    let vehicle = null;
    let activeLogUpdate = null;
    if (activeLog) {
      vehicle = await Vehicle.findOne({
        license_num: license_num.trim(),
        province: province.trim(),
        veh_type: floor.veh_type,
      }).populate("name", "name username");
      const owner = vehicle?.name;
      const ownerId = owner && typeof owner === "object" ? owner._id : owner || null;
      const ownerName = owner && typeof owner === "object"
        ? owner.name || owner.username || ""
        : "";
      const logName = ownerName || (!activeLog.owner ? activeLog.name : "") || await getNextGuestName();
      activeLogUpdate = {
        license_num: license_num.trim(),
        province: province.trim(),
        owner: ownerId,
        name: logName,
        brand: vehicle?.brand || UNKNOWN_VEHICLE_DETAIL,
        model: vehicle?.model || UNKNOWN_VEHICLE_DETAIL,
        color: vehicle?.color || UNKNOWN_VEHICLE_DETAIL,
        vehicleDetailsEdited: true,
      };
    }
    const timestamp = getUpdatedAt();
    const map = {
      ...floor.parking_map,
      slots: floor.parking_map.slots.map((slot) =>
        slot.zone === identity[0] && slot.number === identity[1]
          ? {
              ...slot,
              license_num: license_num.trim(),
              province: province.trim(),
              licensePlateDetected: true,
              ...timestamp,
            }
          : slot,
      ),
    };
    const updated = await ParkingFloor.findOneAndUpdate(
      { _id: floor._id, parking_map: floor.parking_map },
      { $set: { parking_map: map, ...timestamp } },
      { new: true },
    );
    if (!updated)
      return res.status(409).json({ message: "Map changed. Reload and try again." });
    let activeLogUpdated = false;
    let updatedLog = null;
    let removedHistoryCount = 0;
    if (activeLog) {
      updatedLog = await ParkingLog.findOneAndUpdate(
        { _id: activeLog._id, park_status: "Parking" },
        { $set: activeLogUpdate },
        { new: true },
      );
      activeLogUpdated = Boolean(updatedLog);
      if (
        activeLogUpdated &&
        activeLog.license_num !== UNKNOWN_VEHICLE_DETAIL &&
        (activeLog.license_num !== activeLogUpdate.license_num ||
          activeLog.province !== activeLogUpdate.province) &&
        vehicle && activeLogUpdate.owner
      ) {
        const deletion = await ParkingLog.deleteMany({
          owner: activeLogUpdate.owner,
          veh_type: floor.veh_type,
          license_num: license_num.trim(),
          province: province.trim(),
          park_status: { $in: ["Exited", "Not parking"] },
          _id: { $ne: activeLog._id },
        });
        removedHistoryCount = deletion.deletedCount || 0;
      }
    }
    return res.json({
      success: true,
      map: updated.parking_map,
      log: updatedLog,
      activeLogFound: Boolean(activeLog),
      activeLogUpdated,
      removedHistoryCount,
    });
  } catch (error) {
    if (error?.code === 11000)
      return res.status(409).json({ message: "This vehicle already has an active parking log on this floor" });
    return sendError(res, error);
  }
};

exports.resetSlotStatuses = async (req, res) => {
  try {
    const user = await require("../models/userModel")
      .findById(req.auth.userId)
      .select("name role status");
    if (
      !user ||
      user.status === "disable" ||
      !["admin", "staff"].includes(user.role)
    )
      return res.status(403).json({ message: "Parking management access required" });
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Invalid floor id" });

    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor?.parking_map)
      return res.status(404).json({ message: "Parking map not found" });
    const originalSlots = floor.parking_map.slots;
    const presets = floor.camera_presets || [];
    if (!presets.length || presets.some((camera) => camera.status !== "Disable"))
      return res.status(409).json({
        message: "Disable every CCTV preset on this floor before resetting parking slots",
      });

    const map = {
      ...floor.parking_map,
      slots: floor.parking_map.slots.map((slot) => {
        const updatedSlot = { ...slot, status: "available" };
        delete updatedSlot.licensePlateDetected;
        delete updatedSlot.license_num;
        delete updatedSlot.province;
        delete updatedSlot.date_updated;
        delete updatedSlot.time_updated;
        return updatedSlot;
      }),
    };
    const updated = await ParkingFloor.findOneAndUpdate(
      { _id: floor._id, parking_map: floor.parking_map },
      { $set: { parking_map: map, ...getUpdatedAt() } },
      { new: true },
    );
    if (!updated)
      return res.status(409).json({ message: "Map changed. Reload and try again." });
    const changedSlots = getChangedEmptySlots(originalSlots, map.slots);
    await recordSlotStatusChange(user, floor, changedSlots, "available");
    return res.json({ map: updated.parking_map });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.listSlotStatusLogs = async (req, res) => {
  try {
    const user = await require("../models/userModel")
      .findById(req.auth.userId)
      .select("role status");
    if (!user || user.status === "disable" || !["staff", "admin"].includes(user.role))
      return res.status(403).json({ message: "Parking management access required" });
    const rolesParam = req.query.roles;
    let roles = ["staff", "admin"];
    if (rolesParam !== undefined) {
      roles = String(rolesParam)
        .split(",")
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);
      if (!roles.length || roles.some((role) => !["staff", "admin"].includes(role)))
        return res.status(400).json({ message: "Invalid role filter" });
    }
    const logs = await ParkingSlotStatusLog.find({ role: { $in: roles } })
      .sort({ date_updated: -1, time_updated: -1, _id: -1 })
      .lean();
    return res.json({ logs });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.refreshModelSlotStatuses = async (req, res) => {
  try {
    const user = await require("../models/userModel")
      .findById(req.auth.userId)
      .select("role status");
    if (!user || user.status === "disable" || !["admin", "staff"].includes(user.role))
      return res.status(403).json({ message: "Parking management access required" });
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Invalid floor id" });

    const floor = await ParkingFloor.findById(req.params.id);
    if (!floor?.parking_map)
      return res.status(404).json({ message: "Parking map not found" });
    const activePresets = (floor.camera_presets || []).filter(
      (camera) => camera.status === "Enable" && camera.modelEnabled,
    );
    const assignedSlots = (floor.parking_map.slots || []).filter(
      (slot) =>
        String(slot.parkingSlotName || "").trim() &&
        activePresets.some((camera) => String(camera._id) === String(slot.cameraPresetId)),
    );
    const assignedCameraIds = new Set(assignedSlots.map((slot) => String(slot.cameraPresetId)));
    const refreshPresets = activePresets.filter((camera) =>
      assignedCameraIds.has(String(camera._id)),
    );
    if (!refreshPresets.length)
      return res.status(409).json({
        message: "Enable Detection and assign its parking-map slots before updating slot status",
      });

    for (const camera of refreshPresets) camera.slotStatusRefreshVersion += 1;
    Object.assign(floor, getUpdatedAt());
    await floor.save();
    return res.json({
      success: true,
      message: "Enabled Detection models will update their assigned parking slots",
      requestedSlots: assignedSlots.length,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
