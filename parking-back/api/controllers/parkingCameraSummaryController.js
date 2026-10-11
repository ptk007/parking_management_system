const mongoose = require("mongoose");
const ParkingBuilding = require("../models/parkingBuildingModel");

// Return counts only; camera addresses and stream credentials stay on the server.
exports.listCameraSummaries = async (req, res) => {
  try {
    const [buildings, groups] = await Promise.all([
      ParkingBuilding.find().select("building_name").lean(),
      mongoose.connection.collection("parking_cctv").aggregate([
        { $group: { _id: { building: "$building", status: "$status" }, count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const summaries = Object.fromEntries(buildings.map((building) => [
      String(building._id), { total: 0, online: 0, offline: 0, disabled: 0, unknown: 0 },
    ]));
    const buildingIds = new Map(buildings.map((building) => [String(building._id), String(building._id)]));
    const buildingNames = new Map(buildings.map((building) => [building.building_name, String(building._id)]));

    for (const group of groups) {
      // Existing camera records use the building name; also accept a building ObjectId.
      const reference = String(group._id.building ?? "");
      const buildingId = buildingIds.get(reference) ?? buildingNames.get(reference);
      if (!buildingId) continue;
      const summary = summaries[buildingId];
      const status = String(group._id.status ?? "").trim().toLowerCase();
      const category = status === "online" || status === "offline"
        ? status
        : status === "disable" || status === "disabled" ? "disabled" : "unknown";
      summary.total += group.count;
      summary[category] += group.count;
    }
    return res.json({ success: true, summaries });
  } catch (error) {
    console.error("Failed to load building camera summaries:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load camera summaries." });
  }
};
