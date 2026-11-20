const mongoose = require("mongoose");
module.exports = mongoose.model(
  "ParkingSourceFile",
  new mongoose.Schema(
    {
      original_name: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
      fileType: {
        type: String,
        enum: ["cctv", "parking-slot"],
        default: "cctv",
      },
    },
    { collection: "parking_source_files", timestamps: true },
  ),
);
