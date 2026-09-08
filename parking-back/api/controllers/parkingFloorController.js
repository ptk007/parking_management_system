const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const ParkingBuilding = require("../models/parkingBuildingModel");
const ParkingFloor = require("../models/parkingFloorModel");
const { getBangkokDateTime } = require("../utils/dateTime");

const FILE_ROOT = path.resolve(
  __dirname,
  "../../../json_file/parking_slots",
);
const BUILDING_FIELDS =
  "_id building_name building_status building_image";

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
    JSON.parse(await fs.readFile(file.path, "utf8"));
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

// POST /api/admin/system/floors - Create a floor with a required JSON file.
exports.createFloor = async (req, res) => {
  try {
    const { building, floor, veh_type, zone, status } = req.body ?? {};

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "parking_slot_file is required",
      });
    }

    if (!(await isValidJsonFile(req.file))) {
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

    if (await ParkingFloor.exists({ building, zone })) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "zone already exists in this building",
      });
    }

    const parkingFloor = await ParkingFloor.create({
      building,
      floor,
      veh_type,
      zone,
      status,
      parking_slot_file: getFilePath(req.file),
      ...getBangkokDateTime(),
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
    for (const field of [
      "building",
      "floor",
      "veh_type",
      "zone",
      "status",
    ]) {
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
