const ParkingFloor = require("../models/parkingFloorModel");
const { MODEL_RUNTIME_STATUSES } = require("../models/parkingFloorModel");

const VALID_WORKER_STATUSES = new Set(MODEL_RUNTIME_STATUSES);

exports.listProfiles = async (_req, res) => {
  try {
    const floors = await ParkingFloor.find().select(
      "floor veh_type camera_presets parking_map",
    ).lean();
    const profiles = [];
    for (const floor of floors) {
      for (const camera of floor.camera_presets || []) {
        profiles.push({
          floorId: String(floor._id),
          floor: floor.floor,
          veh_type: floor.veh_type,
          cameraPresetId: String(camera._id),
          name: camera.name,
          cameraNo: String(camera.cameraNo || camera.cameraSelector || "").trim(),
          cctvFileName: String(camera.cctvFileName || "").trim(),
          ipAddress: camera.ipAddress || "",
          sourceCameraName: camera.sourceCameraName || "",
          rtspLink: camera.rtspLink || "",
          status: camera.status,
          sourceStatus: camera.sourceStatus || "Unknown",
          modelEnabled: Boolean(camera.modelEnabled),
          slotStatusRefreshVersion: Number(camera.slotStatusRefreshVersion || 0),
          parkingSlotData: camera.parkingSlotData || null,
          mappedParkingSlotNames: [
            ...new Set(
              (floor.parking_map?.slots || [])
                .filter((slot) => String(slot.cameraPresetId) === String(camera._id))
                .map((slot) => String(slot.parkingSlotName || "").trim())
                .filter(Boolean),
            ),
          ],
        });
      }
    }
    if (profiles.length > 100)
      return res.status(400).json({
        message: "Python runtime supports at most 100 CCTV presets",
      });
    return res.json({ profiles });
  } catch (error) {
    console.error("Failed to load CCTV presets for Python runtime:", error);
    return res.status(500).json({ message: "Failed to load CCTV presets for Python runtime" });
  }
};

function identity(cameraNo, cctvFileName) {
  return `${String(cameraNo || "").trim().toLowerCase()}\0${String(cctvFileName || "")
    .trim()
    .toLowerCase()}`;
}

function getMappedCategories(floor, camera) {
  return [
    ...new Set(
      (floor.parking_map?.slots || [])
        .filter((slot) => String(slot.cameraPresetId) === String(camera._id))
        .map((slot) => String(slot.parkingSlotName || "").trim())
        .filter(Boolean),
    ),
  ];
}

function profileIssue(profile, { floor, camera }) {
  if (!profile.parkingEnabled)
    return "Parking detection is disabled in the Python runtime profile";
  if (!profile.parkingSlotNames.length)
    return "The Python runtime profile has no usable parking-slot categories";
  const mappedSlots = (floor.parking_map?.slots || []).filter(
    (slot) => String(slot.cameraPresetId) === String(camera._id),
  );
  if (mappedSlots.some((slot) => !String(slot.parkingSlotName || "").trim()))
    return "A parking map slot assigned to this preset has no category name";
  const missing = getMappedCategories(floor, camera).filter(
    (name) => !profile.parkingSlotNames.includes(name),
  );
  if (missing.length)
    return `The Python profile is missing mapped parking categories: ${missing.join(", ")}`;
  return "";
}

function validProfile(profile) {
  return (
    profile &&
    typeof profile.cameraNo === "string" &&
    profile.cameraNo.trim() &&
    typeof profile.cctvFileName === "string" &&
    profile.cctvFileName.trim() &&
    typeof profile.parkingEnabled === "boolean" &&
    Array.isArray(profile.parkingSlotNames) &&
    profile.parkingSlotNames.length <= 5000 &&
    profile.parkingSlotNames.every(
      (name) => typeof name === "string" && name.trim() && name.length <= 128,
    )
  );
}

exports.sync = async (req, res) => {
  try {
    const { runtimeId, profiles, workers } = req.body || {};
    if (
      typeof runtimeId !== "string" ||
      !runtimeId.trim() ||
      runtimeId.length > 100 ||
      !Array.isArray(profiles) ||
      profiles.length > 100 ||
      !profiles.every(validProfile) ||
      !Array.isArray(workers) ||
      workers.length > 100
    )
      return res.status(400).json({ message: "Invalid Python runtime status payload" });

    const workerStatuses = new Map();
    for (const worker of workers) {
      if (
        !worker ||
        typeof worker.cameraNo !== "string" ||
        typeof worker.cctvFileName !== "string" ||
        !VALID_WORKER_STATUSES.has(worker.status) ||
        (worker.message !== undefined && typeof worker.message !== "string")
      )
        return res.status(400).json({ message: "Invalid Python worker status" });
      workerStatuses.set(
        identity(worker.cameraNo, worker.cctvFileName),
        {
          status: worker.status,
          message: String(worker.message || "").slice(0, 500),
        },
      );
    }

    const floors = await ParkingFloor.find();
    const camerasByIdentity = new Map();
    for (const floor of floors) {
      for (const camera of floor.camera_presets || []) {
        const key = identity(
          camera.cameraNo || camera.cameraSelector,
          camera.cctvFileName,
        );
        if (!key.startsWith("\0") && !key.endsWith("\0")) {
          const matches = camerasByIdentity.get(key) || [];
          matches.push({ floor, camera });
          camerasByIdentity.set(key, matches);
        }
      }
    }

    const inventoryCounts = new Map();
    for (const profile of profiles) {
      const key = identity(profile.cameraNo, profile.cctvFileName);
      inventoryCounts.set(key, (inventoryCounts.get(key) || 0) + 1);
    }

    const commands = [];
    const issues = [];
    const touchedFloors = new Set();
    const matchedCameraIds = new Set();
    for (const profile of profiles) {
      const key = identity(profile.cameraNo, profile.cctvFileName);
      const matches = camerasByIdentity.get(key) || [];
      if (matches.length !== 1) {
        issues.push({
          cameraNo: profile.cameraNo,
          cctvFileName: profile.cctvFileName,
          message: matches.length
            ? "Camera number and CCTV source filename match multiple presets"
            : "No CCTV preset matches this Python profile",
        });
        if (matches.length > 1) {
          for (const { floor, camera } of matches) {
            if (camera.modelEnabled && camera.status === "Enable") {
              camera.modelRuntimeStatus = "Error";
              camera.modelRuntimeMessage =
                "Camera number and CCTV source filename match multiple presets";
              camera.modelRuntimeUpdatedAt = new Date();
              camera.modelRuntimeId = runtimeId;
              touchedFloors.add(floor);
            }
            matchedCameraIds.add(String(camera._id));
          }
        }
        continue;
      }
      const [{ floor, camera }] = matches;
      matchedCameraIds.add(String(camera._id));
      const duplicateProfile = inventoryCounts.get(key) > 1;
      const message = duplicateProfile
        ? "Multiple active Python profiles match this CCTV preset"
        : profileIssue(profile, { floor, camera });
      const disabledParkingSlotNames = [
        ...new Set(
          (floor.parking_map?.slots || [])
            .filter(
              (slot) =>
                String(slot.cameraPresetId) === String(camera._id) &&
                slot.status === "disabled",
            )
            .map((slot) => String(slot.parkingSlotName || "").trim())
            .filter(Boolean),
        ),
      ];
      const worker = workerStatuses.get(key);
      const enabled = Boolean(camera.modelEnabled && camera.status === "Enable");
      const runtimeStatus = !enabled
        ? ["Starting", "Online", "Stopping"].includes(worker?.status)
          ? "Stopping"
          : "Offline"
        : message
          ? "Error"
          : worker?.status || "Starting";
      camera.modelRuntimeId = runtimeId;
      camera.modelRuntimeStatus = runtimeStatus;
      camera.modelRuntimeMessage = !enabled
        ? runtimeStatus === "Stopping"
          ? "Stopping the Python worker"
          : ""
        : message || worker?.message || "";
      camera.modelRuntimeUpdatedAt = new Date();
      touchedFloors.add(floor);
      commands.push({
        cameraNo: profile.cameraNo,
        cctvFileName: profile.cctvFileName,
        floorId: String(floor._id),
        cameraPresetId: String(camera._id),
        enabled,
        runnable: !message,
        message,
        slotStatusRefreshVersion: Number(camera.slotStatusRefreshVersion || 0),
        disabledParkingSlotNames,
        mappedParkingSlotNames: getMappedCategories(floor, camera),
      });
    }

    for (const floor of floors) {
      let changed = false;
      for (const camera of floor.camera_presets || []) {
        if (
          !camera.modelEnabled ||
          camera.status !== "Enable" ||
          matchedCameraIds.has(String(camera._id))
        ) continue;
        camera.modelRuntimeStatus = "Error";
        camera.modelRuntimeMessage =
          "The Python runtime did not load this CCTV preset";
        camera.modelRuntimeUpdatedAt = new Date();
        camera.modelRuntimeId = runtimeId;
        changed = true;
      }
      if (changed) touchedFloors.add(floor);
    }

    await Promise.all([...touchedFloors].map((floor) => floor.save()));
    return res.json({ commands, issues });
  } catch (error) {
    console.error("Failed to synchronize Python model runtime:", error);
    return res.status(500).json({ message: "Failed to synchronize Python model runtime" });
  }
};
