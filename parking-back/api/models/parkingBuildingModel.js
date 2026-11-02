const mongoose = require("mongoose");

const parkingBuildingSchema = new mongoose.Schema(
  {
    building_name: {
      type: String,
      required: [true, "building_name is required"],
      unique: true,
      trim: true,
    },
    building_image: {
      type: String,
      default: null,
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
    collection: "parking_building",
    versionKey: false,
  },
);
module.exports = mongoose.model("ParkingBuilding", parkingBuildingSchema);
module.exports = mongoose.model("ParkingBuilding", parkingBuildingSchema);
