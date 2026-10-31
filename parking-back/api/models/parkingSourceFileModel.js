const mongoose = require("mongoose");
module.exports = mongoose.model(
  "ParkingSourceFile",
  new mongoose.Schema(
    {
      original_name: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
    },
    { collection: "parking_source_files", timestamps: true },
  ),
);
