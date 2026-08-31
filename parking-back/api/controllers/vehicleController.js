const mongoose = require("mongoose");
const Vehicle = require("../models/vehicleModel");
const User = require("../models/userModel");

const OWNER_FIELDS = "_id username name";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function ownerExists(ownerId) {
  return isValidId(ownerId) && Boolean(await User.exists({ _id: ownerId }));
}

function sendError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "license_num already exists",
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

// POST /api/vehicles - Create a vehicle for an existing registered user.
exports.createVehicle = async (req, res) => {
  try {
    const { veh_type, name, license_num, province, veh_des } = req.body ?? {};

    if (!(await ownerExists(name))) {
      return res.status(400).json({
        success: false,
        message: "name must be an existing user id",
      });
    }

    if (
      license_num &&
      (await Vehicle.exists({ license_num: license_num.trim() }))
    ) {
      return res.status(409).json({
        success: false,
        message: "license_num already exists",
      });
    }

    const vehicle = await Vehicle.create({
      veh_type,
      name,
      license_num,
      province,
      veh_des,
    });
    await vehicle.populate("name", OWNER_FIELDS);

    return res.status(201).json({ success: true, vehicle });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/vehicles - List every vehicle with its registered owner.
exports.listVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find()
      .populate("name", OWNER_FIELDS)
      .sort({ _id: -1 });

    return res.json({
      success: true,
      count: vehicles.length,
      vehicles,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/vehicles/check-duplicate?license_num=value - Check license uniqueness.
exports.checkDuplicateLicense = async (req, res) => {
  try {
    if (!req.query.license_num) {
      return res.status(400).json({
        success: false,
        message: "license_num query parameter is required",
      });
    }

    const exists = await Vehicle.exists({
      license_num: req.query.license_num.trim(),
    });
    return res.json({ success: true, duplicate: Boolean(exists) });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/vehicles/:id - Return one vehicle by MongoDB ObjectId.
exports.getVehicle = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle id",
      });
    }

    const vehicle = await Vehicle.findById(req.params.id).populate(
      "name",
      OWNER_FIELDS,
    );
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    return res.json({ success: true, vehicle });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/vehicles/:id - Update allowed vehicle fields and verify a new owner.
exports.updateVehicle = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle id",
      });
    }

    const vehicle = await Vehicle.findById(req.params.id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    if (req.body?.name !== undefined && !(await ownerExists(req.body.name))) {
      return res.status(400).json({
        success: false,
        message: "name must be an existing user id",
      });
    }

    if (
      req.body?.license_num !== undefined &&
      (await Vehicle.exists({
        license_num: req.body.license_num.trim(),
        _id: { $ne: vehicle._id },
      }))
    ) {
      return res.status(409).json({
        success: false,
        message: "license_num already exists",
      });
    }

    const allowedFields = [
      "veh_type",
      "name",
      "license_num",
      "province",
      "veh_des",
    ];
    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        vehicle[field] = req.body[field];
      }
    }

    await vehicle.save();
    await vehicle.populate("name", OWNER_FIELDS);
    return res.json({ success: true, vehicle });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/vehicles/:id - Delete one vehicle document.
exports.deleteVehicle = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle id",
      });
    }

    const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    return res.json({ success: true, message: "Vehicle deleted" });
  } catch (error) {
    return sendError(res, error);
  }
};
