const mongoose = require("mongoose");

const BUILDING_STATUSES = ["available", "unavailable", "disable"];

const parkingBuildingSchema = new mongoose.Schema(
  {
    building_name: {
      type: String,
      required: [true, "building_name is required"],
      unique: true,
      trim: true,
    },
    building_status: {
      type: String,
      enum: BUILDING_STATUSES,
      default: "disable",
    },
    building_image: {
      type: String,
      default: null,
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
    collection: "parking_building",
    versionKey: false,
  },
);

module.exports = mongoose.model("ParkingBuilding", parkingBuildingSchema);
module.exports.BUILDING_STATUSES = BUILDING_STATUSES;
