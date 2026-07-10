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
    veh_des: {
      type: String,
      maxlength: [100, "veh_des cannot exceed 100 characters"],
      trim: true,
      default: "",
    },
  },
  {
    collection: "vehicle",
    versionKey: false,
  },
);

module.exports = mongoose.model("Vehicle", vehicleSchema);
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
