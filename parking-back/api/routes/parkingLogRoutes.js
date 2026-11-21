const express = require("express");
const { requireAuth } = require("../controllers/userController");
const parkingLogController = require("../controllers/parkingLogController");
const requireModelApiKey = require("../middleware/requireModelApiKey");

const router = express.Router();

router.post(
  "/model-events",
  requireModelApiKey,
  parkingLogController.createModelEvent,
);
router.post(
  "/model-slot-status",
  requireModelApiKey,
  parkingLogController.updateModelSlotStatus,
);
router.post("/export-sample", requireAuth, parkingLogController.exportSampleParkingLogs);
router.get("/export", requireAuth, parkingLogController.exportParkingLogs);
router.get("/me", requireAuth, parkingLogController.listMyParkingLogs);
router.get("/", requireAuth, parkingLogController.listParkingLogs);

module.exports = router;
