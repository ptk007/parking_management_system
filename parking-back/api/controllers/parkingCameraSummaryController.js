const ParkingBuilding = require("../models/parkingBuildingModel");
const ParkingFloor = require("../models/parkingFloorModel");

function emptySummary() {
  return { total: 0, online: 0, offline: 0, disabled: 0, unknown: 0 };
}

function statusCategory(presetStatus, sourceStatus) {
  const preset = String(presetStatus || "").trim().toLowerCase();
  const source = String(sourceStatus || "").trim().toLowerCase();
  if (preset === "disable" || preset === "disabled") return "disabled";
  if (source === "online" || source === "offline") return source;
  // Continue recognizing legacy documents until their status migration runs.
  if (preset === "online" || preset === "offline") return preset;
  return "unknown";
}

// Count embedded CCTV presets from parking_floor, grouped for building and floor views.
exports.listCameraSummaries = async (req, res) => {
  try {
    const [buildings, groups] = await Promise.all([
      ParkingBuilding.find().select("building_name").lean(),
      ParkingFloor.aggregate([
        { $unwind: "$camera_presets" },
        {
          $group: {
            _id: {
              building: "$building",
              floor: "$_id",
              presetStatus: "$camera_presets.status",
              sourceStatus: "$camera_presets.sourceStatus",
            },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summaries = Object.fromEntries(
      buildings.map((building) => [String(building._id), emptySummary()]),
    );
    const floorSummaries = {};
    for (const group of groups) {
      const buildingId = String(group._id.building || "");
      if (!summaries[buildingId]) continue;
      const floorId = String(group._id.floor);
      const summary = statusCategory(
        group._id.presetStatus,
        group._id.sourceStatus,
      );
      const count = Number(group.count) || 0;
      floorSummaries[floorId] ||= emptySummary();
      summaries[buildingId].total += count;
      summaries[buildingId][summary] += count;
      floorSummaries[floorId].total += count;
      floorSummaries[floorId][summary] += count;
    }

    return res.json({ success: true, summaries, floorSummaries });
  } catch (error) {
    console.error("Failed to load parking-floor CCTV summaries:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to load camera summaries.",
    });
  }
};
