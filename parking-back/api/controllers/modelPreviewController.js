const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const ParkingFloor = require("../models/parkingFloorModel");

const RUNTIME_FRAME_DIR = path.resolve(
  __dirname,
  "../../../python-v2/results/runtime_frames",
);
const MAX_HEARTBEAT_AGE_MS = 20_000;

function runtimeFramePath(camera) {
  const cameraNo = String(camera.cameraNo || camera.cameraSelector || "")
    .trim()
    .toLowerCase();
  const cctvFileName = String(camera.cctvFileName || "").trim().toLowerCase();
  const identity = `${cameraNo}\0${cctvFileName}`;
  const digest = crypto.createHash("sha256").update(identity, "utf8").digest("hex");
  return path.join(RUNTIME_FRAME_DIR, `${digest}.jpg`);
}

exports.getCameraFrame = async (req, res) => {
  try {
    const { id, cameraId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(cameraId))
      return res.status(400).json({ message: "Invalid floor or camera id" });

    const floor = await ParkingFloor.findById(id);
    if (!floor) return res.status(404).json({ message: "Floor not found" });
    const camera = floor.camera_presets.id(cameraId);
    if (!camera) return res.status(404).json({ message: "Camera preset not found" });
    if (!camera.modelEnabled)
      return res.status(409).json({ message: "Turn YOLO on before opening its preview" });

    const updatedAt = camera.modelRuntimeUpdatedAt
      ? new Date(camera.modelRuntimeUpdatedAt).getTime()
      : 0;
    if (
      camera.modelRuntimeStatus !== "Online" ||
      !updatedAt ||
      Date.now() - updatedAt > MAX_HEARTBEAT_AGE_MS
    )
      return res.status(503).json({
        message:
          camera.modelRuntimeMessage ||
          "The Python YOLO worker is not online yet. Check the Python runtime and its backend connection.",
      });

    let frame;
    try {
      frame = await fs.readFile(runtimeFramePath(camera));
    } catch (error) {
      if (error.code === "ENOENT")
        return res.status(503).json({
          message: "The YOLO worker is online but has not published an annotated frame yet.",
        });
      throw error;
    }

    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      "Content-Type": "image/jpeg",
    });
    return res.send(frame);
  } catch (error) {
    console.error("Failed to read the YOLO preview frame:", error);
    return res.status(500).json({ message: "Failed to read the YOLO preview frame" });
  }
};
