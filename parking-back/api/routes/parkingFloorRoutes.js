const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const userController = require("../controllers/userController");
const floorController = require("../controllers/parkingFloorController");
const cctvSourceController = require("../controllers/cctvSourceController");
const modelPreviewController = require("../controllers/modelPreviewController");

const router = express.Router();
const fileDirectory = path.resolve(
  __dirname,
  "../../../json_file/parking_slots",
);
fs.mkdirSync(fileDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: fileDirectory,
  filename: (req, file, callback) => {
    callback(
      null,
      `parking-slots-${Date.now()}-${Math.round(Math.random() * 1e9)}.json`,
    );
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== ".json") {
      return callback(new Error("Only JSON files are allowed"));
    }
    return callback(null, true);
  },
});

router.use(userController.requireAuth);
router.get("/catalog", floorController.dashboardCatalog);
router.patch("/catalog/:id/slot-statuses", floorController.setSlotStatuses);
router.use(userController.requireAdmin);

// Admin-only parking_floor collection CRUD API routes.
router.post(
  "/",
  upload.single("parking_slot_file"),
  floorController.createFloor,
);
router.get("/", floorController.listFloors);
const slotUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, callback) =>
    callback(
      null,
      path.extname(file.originalname).toLowerCase() === ".json",
    ),
});
const presetFileUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (path.extname(file.originalname).toLowerCase() !== ".json") {
      return callback(new Error("Only JSON files are allowed"));
    }
    return callback(null, true);
  },
});
router.get("/source-files", floorController.listSourceFiles);
router.post(
  "/source-files/:fileId/cameras/search",
  cctvSourceController.searchCameraSource,
);
router.post(
  "/source-files/:fileId/cameras/:recordIndex/probe",
  cctvSourceController.probeCameraSource,
);
router.post(
  "/source-files/:fileId/cameras/:recordIndex/preview",
  cctvSourceController.streamCameraPreview,
);
router.post(
  "/source-files",
  slotUpload.array("files", 20),
  floorController.importSourceFiles,
);
router.get("/source-files/:fileId", floorController.downloadSourceFile);
router.put("/:id/map", floorController.saveMap);
router.post(
  "/:id/cameras",
  presetFileUpload.single("parking_slot_file"),
  floorController.saveCameraPreset,
);
router.patch("/:id/cameras/:cameraId/status", floorController.updateCameraPresetStatus);
router.patch("/:id/cameras/:cameraId/model", floorController.updateCameraModelState);
router.get(
  "/:id/cameras/:cameraId/model-preview",
  modelPreviewController.getCameraFrame,
);
router.get(
  "/:id/cameras/:cameraId/parking-slot-categories",
  floorController.listCameraParkingSlotCategories,
);
router.patch(
  "/:id/cameras/:cameraId",
  presetFileUpload.single("parking_slot_file"),
  floorController.saveCameraPreset,
);
router.post("/:id/slot-files", slotUpload.array("files", 20), floorController.importSlotFiles);
router.get("/:id/slot-files/:fileId", floorController.downloadSlotFile);
router.get("/:id", floorController.getFloor);
router.patch(
  "/:id",
  upload.single("parking_slot_file"),
  floorController.updateFloor,
);
router.delete("/:id", floorController.deleteFloor);

module.exports = router;
