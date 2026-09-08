const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const ParkingBuilding = require("../models/parkingBuildingModel");
const { getBangkokDateTime } = require("../utils/dateTime");

const IMAGE_ROOT = path.resolve(__dirname, "../../../images/parking_building");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getImagePath(file) {
  return file ? `images/parking_building/${file.filename}` : undefined;
}

async function deleteImage(imagePath) {
  if (!imagePath) {
    return;
  }

  const absolutePath = path.resolve(__dirname, "../../..", imagePath);
  const relativePath = path.relative(IMAGE_ROOT, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Refusing to delete an image outside images/parking_building");
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
  if (file?.path) {
    await deleteImage(getImagePath(file));
  }
}

function sendError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "building_name already exists",
    });
  }

  if (error?.name === "ValidationError") {
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

// POST /api/admin/system/buildings - Create a parking building.
exports.createBuilding = async (req, res) => {
  try {
    const { building_name, building_status } = req.body ?? {};

    if (
      building_name &&
      (await ParkingBuilding.exists({ building_name: building_name.trim() }))
    ) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "building_name already exists",
      });
    }

    const building = await ParkingBuilding.create({
      building_name,
      building_status,
      building_image: getImagePath(req.file),
      ...getBangkokDateTime(),
    });

    return res.status(201).json({ success: true, building });
  } catch (error) {
    try {
      await removeUploadedFile(req.file);
    } catch (fileError) {
      console.error(fileError);
    }
    return sendError(res, error);
  }
};

// GET /api/admin/system/buildings - List every parking building.
exports.listBuildings = async (req, res) => {
  try {
    const buildings = await ParkingBuilding.find().sort({
      date_add: -1,
      time_add: -1,
    });
    return res.json({
      success: true,
      count: buildings.length,
      buildings,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/admin/system/buildings/check-duplicate?building_name=value
// Check whether a building name is already registered.
exports.checkDuplicateBuilding = async (req, res) => {
  try {
    if (!req.query.building_name) {
      return res.status(400).json({
        success: false,
        message: "building_name query parameter is required",
      });
    }

    const exists = await ParkingBuilding.exists({
      building_name: req.query.building_name.trim(),
    });
    return res.json({ success: true, duplicate: Boolean(exists) });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/admin/system/buildings/:id - Return one parking building.
exports.getBuilding = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid building id",
      });
    }

    const building = await ParkingBuilding.findById(req.params.id);
    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    return res.json({ success: true, building });
  } catch (error) {
    return sendError(res, error);
  }
};

// PATCH /api/admin/system/buildings/:id - Update building fields and image.
exports.updateBuilding = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Invalid building id",
      });
    }

    const building = await ParkingBuilding.findById(req.params.id);
    if (!building) {
      await removeUploadedFile(req.file);
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    if (
      req.body?.building_name !== undefined &&
      (await ParkingBuilding.exists({
        building_name: req.body.building_name.trim(),
        _id: { $ne: building._id },
      }))
    ) {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "building_name already exists",
      });
    }

    const previousImage = building.building_image;
    for (const field of ["building_name", "building_status"]) {
      if (req.body?.[field] !== undefined) {
        building[field] = req.body[field];
      }
    }

    const imagePath = getImagePath(req.file);
    if (imagePath) {
      building.building_image = imagePath;
    }

    await building.save();
    if (imagePath && previousImage) {
      try {
        await deleteImage(previousImage);
      } catch (fileError) {
        console.error(fileError);
      }
    }

    return res.json({ success: true, building });
  } catch (error) {
    try {
      await removeUploadedFile(req.file);
    } catch (fileError) {
      console.error(fileError);
    }
    return sendError(res, error);
  }
};

// DELETE /api/admin/system/buildings/:id - Delete a building and its image.
exports.deleteBuilding = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid building id",
      });
    }

    const building = await ParkingBuilding.findById(req.params.id);
    if (!building) {
      return res.status(404).json({
        success: false,
        message: "Building not found",
      });
    }

    await building.deleteOne();
    try {
      await deleteImage(building.building_image);
    } catch (fileError) {
      console.error(fileError);
    }

    return res.json({ success: true, message: "Building deleted" });
  } catch (error) {
    return sendError(res, error);
  }
};
