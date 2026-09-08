const mongoose = require("mongoose");

const FLOOR_STATUSES = ["available", "unavailable", "disable"];
const VEHICLE_TYPES = ["car", "motorcycle"];

const parkingFloorSchema = new mongoose.Schema(
  {
    building: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingBuilding",
      required: [true, "building is required"],
    },
    floor: {
      type: Number,
      required: [true, "floor is required"],
      validate: {
        validator: Number.isInteger,
        message: "floor must be an integer",
      },
    },
    veh_type: {
      type: String,
      required: [true, "veh_type is required"],
      enum: VEHICLE_TYPES,
    },
    zone: {
      type: Number,
      required: [true, "zone is required"],
      min: [1, "zone must be a positive integer"],
      validate: {
        validator: Number.isInteger,
        message: "zone must be an integer",
      },
    },
    parking_slot_file: {
      type: String,
      required: [true, "parking_slot_file is required"],
    },
    status: {
      type: String,
      enum: FLOOR_STATUSES,
      default: "disable",
    },
    date_add: {
      type: String,
      required: true,
      immutable: true,
    },
    time_add: {
      type: String,
      required: true,
      immutable: true,
    },
  },
  {
    collection: "parking_floor",
    versionKey: false,
  },
);

parkingFloorSchema.index({ building: 1, zone: 1 }, { unique: true });

module.exports = mongoose.model("ParkingFloor", parkingFloorSchema);
module.exports.FLOOR_STATUSES = FLOOR_STATUSES;
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
