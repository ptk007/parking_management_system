const mongoose = require("mongoose");

const PARKING_LOG_STATUSES = ["Parking", "Exited", "Not parking"];

const parkingLogSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    name: { type: String, default: "" },
    building: { type: String, required: true },
    buildingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingBuilding",
      required: true,
    },
    floor: { type: Number, required: true },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ParkingFloor",
      required: true,
    },
    veh_type: {
      type: String,
      enum: ["car", "motorcycle"],
      required: true,
    },
    cameraPresetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    parkingSlotName: { type: String, default: null },
    brand: { type: String, default: "Unknown" },
    model: { type: String, default: "Unknown" },
    color: { type: String, default: "Unknown" },
    license_num: { type: String, required: true, trim: true },
    province: { type: String, required: true, trim: true },
    date_enter: { type: String, required: true },
    park_time: { type: String, required: true },
    date_exit: { type: String, default: null },
    exit_time: { type: String, default: null },
    park_slot: { type: Number, default: null },
    park_status: {
      type: String,
      enum: PARKING_LOG_STATUSES,
      required: true,
    },
  },
  {
    collection: "parking_log",
    timestamps: true,
    versionKey: false,
  },
);

parkingLogSchema.index(
  {
    buildingId: 1,
    floorId: 1,
    veh_type: 1,
    license_num: 1,
    province: 1,
  },
  {
    unique: true,
    partialFilterExpression: { park_status: "Parking" },
  },
);
parkingLogSchema.index({ owner: 1, updatedAt: -1 });
parkingLogSchema.index({ park_status: 1, updatedAt: -1 });

module.exports = mongoose.model("ParkingLog", parkingLogSchema);
module.exports.PARKING_LOG_STATUSES = PARKING_LOG_STATUSES;
