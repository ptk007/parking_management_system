const mongoose = require("mongoose");

const PARKING_LOG_STATUSES = ["Parking", "Exited", "Not parking"];
const UNKNOWN_VEHICLE_DETAIL = "Unknown";
const LEGACY_ACTIVE_VEHICLE_INDEX = "buildingId_1_floorId_1_veh_type_1_license_num_1_province_1";

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
    trackedSlotSession: Boolean,
    vehicleDetailsEdited: Boolean,
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
    name: "active_identified_vehicle",
    unique: true,
    partialFilterExpression: {
      park_status: "Parking",
      $or: [
        { license_num: { $lt: UNKNOWN_VEHICLE_DETAIL } },
        { license_num: { $gt: UNKNOWN_VEHICLE_DETAIL } },
      ],
    },
  },
);
parkingLogSchema.index(
  { floorId: 1, cameraPresetId: 1, parkingSlotName: 1, park_slot: 1 },
  {
    name: "active_tracked_slot_session",
    unique: true,
    partialFilterExpression: { park_status: "Parking", trackedSlotSession: true },
  },
);
parkingLogSchema.index({ owner: 1, updatedAt: -1 });
parkingLogSchema.index({ park_status: 1, updatedAt: -1 });

module.exports = mongoose.model("ParkingLog", parkingLogSchema);
module.exports.PARKING_LOG_STATUSES = PARKING_LOG_STATUSES;
module.exports.UNKNOWN_VEHICLE_DETAIL = UNKNOWN_VEHICLE_DETAIL;
module.exports.prepareSessionIndexes = async function prepareSessionIndexes() {
  // Install the replacement uniqueness constraint before removing the old one.
  await this.createIndexes();
  try {
    await this.collection.dropIndex(LEGACY_ACTIVE_VEHICLE_INDEX);
  } catch (error) {
    if (error.code !== 27) throw error;
  }
};
