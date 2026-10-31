const mongoose = require("mongoose");

const VEHICLE_TYPES = ["car", "motorcycle"];

const vehicleSchema = new mongoose.Schema(
  {
    veh_type: {
      type: String,
      required: [true, "veh_type is required"],
      enum: VEHICLE_TYPES,
    },
    name: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "name must contain the owner's user id"],
    },
    brand: {
      type: String,
      required: [true, "brand is required"],
      trim: true,
    },
    model: {
      type: String,
      required: [true, "model is required"],
      trim: true,
    },
    color: {
      type: String,
      required: [true, "color is required"],
      trim: true,
    },
    license_num: {
      type: String,
      required: [true, "license_num is required"],
      unique: true,
      trim: true,
    },
    province: {
      type: String,
      required: [true, "province is required"],
      trim: true,
    },
  },
  {
    collection: "vehicle",
    versionKey: false,
  },
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
