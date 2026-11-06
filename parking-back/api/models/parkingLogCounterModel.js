const mongoose = require("mongoose");

const parkingLogCounterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  {
    collection: "parking_log_counters",
    versionKey: false,
  },
);

module.exports = mongoose.model("ParkingLogCounter", parkingLogCounterSchema);
