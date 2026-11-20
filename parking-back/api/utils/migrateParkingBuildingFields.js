const ParkingBuilding = require("../models/parkingBuildingModel");

async function migrateParkingBuildingFields() {
  await ParkingBuilding.collection.updateMany(
    { date_add: { $exists: true }, date_updated: { $exists: false } },
    { $rename: { date_add: "date_updated" } },
  );
  await ParkingBuilding.collection.updateMany(
    { time_add: { $exists: true }, time_updated: { $exists: false } },
    { $rename: { time_add: "time_updated" } },
  );
  await ParkingBuilding.collection.updateMany(
    {
      $or: [
        { building_status: { $exists: true } },
        { date_add: { $exists: true } },
        { time_add: { $exists: true } },
      ],
    },
    { $unset: { building_status: "", date_add: "", time_add: "" } },
  );
}

module.exports = migrateParkingBuildingFields;
