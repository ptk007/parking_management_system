const mongoose = require("mongoose");

const FLOOR_STATUSES = ["Available", "Disable"];
const VEHICLE_TYPES = ["car", "motorcycle"];
const CAMERA_PRESET_STATUSES = ["Online", "Offline", "Disable", "Unknown"];
const MODEL_RUNTIME_STATUSES = ["Offline", "Starting", "Online", "Stopping", "Error"];

const cameraPresetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    cctvFileName: String,
    cameraSelector: String,
    cameraNo: String,
    ipAddress: String,
    sourceCameraName: String,
    rtspLink: String,
    status: {
      type: String,
      enum: CAMERA_PRESET_STATUSES,
      default: "Unknown",
    },
    modelEnabled: { type: Boolean, default: false },
    modelRuntimeStatus: {
      type: String,
      enum: MODEL_RUNTIME_STATUSES,
      default: "Offline",
    },
    modelRuntimeMessage: { type: String, default: "" },
    modelRuntimeUpdatedAt: { type: Date, default: null },
    modelRuntimeId: { type: String, default: "" },
    parkingSlotFileId: String,
    parkingSlotData: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: { createdAt: "createAt", updatedAt: "updateAt" },
  },
);

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
    parking_slot_file: {
      type: String,
      default: null,
    },
    parking_slot_files: [{
      original_name: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
    }],
    parking_map: { type: mongoose.Schema.Types.Mixed, default: null },
    camera_presets: [cameraPresetSchema],
    status: {
      type: String,
      enum: FLOOR_STATUSES,
      default: "Disable",
    },
    date_updated: {
      type: String,
      required: true,
    },
    time_updated: {
      type: String,
      required: true,
    },
  },
  {
    collection: "parking_floor",
    versionKey: false,
  },
);

module.exports = mongoose.model("ParkingFloor", parkingFloorSchema);
module.exports.FLOOR_STATUSES = FLOOR_STATUSES;
module.exports.VEHICLE_TYPES = VEHICLE_TYPES;
module.exports.CAMERA_PRESET_STATUSES = CAMERA_PRESET_STATUSES;
module.exports.MODEL_RUNTIME_STATUSES = MODEL_RUNTIME_STATUSES;
