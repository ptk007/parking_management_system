const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const userController = require("../controllers/userController");
const floorController = require("../controllers/parkingFloorController");

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

router.use(userController.requireAuth, userController.requireAdmin);

// Admin-only parking_floor collection CRUD API routes.
router.post(
  "/",
  upload.single("parking_slot_file"),
  floorController.createFloor,
);
router.get("/", floorController.listFloors);
router.get("/check-duplicate", floorController.checkDuplicateZone);
router.get("/:id", floorController.getFloor);
router.patch(
  "/:id",
  upload.single("parking_slot_file"),
  floorController.updateFloor,
);
router.delete("/:id", floorController.deleteFloor);

module.exports = router;
