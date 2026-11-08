const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const ParkingBuilding = require("../models/parkingBuildingModel");
const ParkingFloor = require("../models/parkingFloorModel");
const ParkingSourceFile = require("../models/parkingSourceFileModel");
const { getBangkokDateTime } = require("../utils/dateTime");

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

    return res.json({ success: true, count: floors.length, floors });
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
    for (const slot of map.slots) {
      const hasCameraPreset = slot.cameraPresetId !== undefined;
      const hasParkingSlot = slot.parkingSlotName !== undefined;
      if (!hasCameraPreset && !hasParkingSlot) continue;
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
      { $set: { parking_map: map, ...getUpdatedAt() } },
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
        try {
          getParkingSlotNames(parkingSlotData);
        } catch {
          return res.status(400).json({
            message: "Provide parkingSlotData or a parking slot JSON file",
          });
        }
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

    const connectionStatus = ["Online", "Offline", "Unknown"].includes(
      data.status,
    )
      ? data.status
      : "Unknown";
    if (existingCamera) {
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
        status: existingCamera.status === "Disable"
          ? "Disable"
          : connectionStatus,
      });
      if (previousIdentity !== nextIdentity) {
        existingCamera.modelEnabled = false;
        existingCamera.modelRuntimeStatus = "Offline";
        existingCamera.modelRuntimeMessage = "";
        existingCamera.modelRuntimeUpdatedAt = new Date();
        existingCamera.modelRuntimeId = "";
      }
    } else {
      floor.camera_presets.push({ ...preset, status: connectionStatus });
    }

    Object.assign(floor, getUpdatedAt());
    await floor.save();
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
    if (!["Disable", "Unknown"].includes(status))
      return res.status(400).json({
        message: "Camera preset status must be Disable or Unknown",
      });

    const floor = await ParkingFloor.findById(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const camera = floor.camera_presets.id(cameraId);
    if (!camera)
      return res.status(404).json({ message: "Camera preset not found" });

    camera.status = status;
    if (status === "Disable") {
      camera.modelEnabled = false;
      camera.modelRuntimeStatus = "Offline";
      camera.modelRuntimeMessage = "";
      camera.modelRuntimeUpdatedAt = new Date();
      camera.modelRuntimeId = "";
    }
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
    if (enabled && camera.status === "Disable")
      return res.status(409).json({
        message: "Enable this CCTV preset before starting YOLO",
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
      if (!mappedSlots.length)
        return res.status(400).json({
          message: "Assign this CCTV preset's parking slots on the parking map before starting YOLO",
        });
      const invalidSlot = mappedSlots.find(
        (slot) => !slot.parkingSlotName || !categories.includes(slot.parkingSlotName),
      );
      if (invalidSlot)
        return res.status(400).json({
          message: "A parking map slot uses a category missing from this CCTV preset",
        });

      camera.modelEnabled = true;
      camera.modelRuntimeStatus = "Starting";
      camera.modelRuntimeMessage = "Waiting for the local Python runtime";
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
      { $set: { parking_map: map, ...getUpdatedAt() } },
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
