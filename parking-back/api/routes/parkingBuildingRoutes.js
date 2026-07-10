const path = require("path");
const express = require("express");
const multer = require("multer");
const userController = require("../controllers/userController");
const buildingController = require("../controllers/parkingBuildingController");

const router = express.Router();
const imageDirectory = path.resolve(
  __dirname,
  "../../../images/parking_building",
);

const storage = multer.diskStorage({
  destination: imageDirectory,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(
      null,
      `building-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`,
    );
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Only JPG, PNG, and WebP images are allowed"));
    }
    return callback(null, true);
  },
});

router.use(userController.requireAuth, userController.requireAdmin);

// Admin-only parking_building collection CRUD API routes.
router.post(
  "/",
  upload.single("building_image"),
  buildingController.createBuilding,
);
router.get("/", buildingController.listBuildings);
router.get(
  "/check-duplicate",
  buildingController.checkDuplicateBuilding,
);
router.get("/:id", buildingController.getBuilding);
router.patch(
  "/:id",
  upload.single("building_image"),
  buildingController.updateBuilding,
);
router.delete("/:id", buildingController.deleteBuilding);

module.exports = router;
