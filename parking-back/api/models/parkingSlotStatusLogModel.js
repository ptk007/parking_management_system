const mongoose = require("mongoose");

const parkingSlotStatusLogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ["staff", "admin"] },
    building: { type: String, required: true },
    floor: { type: Number, required: true },
    veh_type: { type: String, required: true, enum: ["car", "motorcycle"] },
    slots: {
      type: [{
        zone: { type: String, required: true },
        number: { type: Number, required: true },
        name: { type: String, required: true },
      }],
      required: true,
    },
    date_updated: { type: String, required: true },
    time_updated: { type: String, required: true },
    status: { type: String, required: true, enum: ["available", "disabled"] },
  },
  { collection: "parking_slot_status_log", versionKey: false },
);

parkingSlotStatusLogSchema.index({ date_updated: -1, time_updated: -1 });
parkingSlotStatusLogSchema.index({ role: 1, date_updated: -1, time_updated: -1 });

module.exports = mongoose.model("ParkingSlotStatusLog", parkingSlotStatusLogSchema);
