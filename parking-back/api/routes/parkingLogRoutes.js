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
router.get("/me", requireAuth, parkingLogController.listMyParkingLogs);
router.get("/", requireAuth, parkingLogController.listParkingLogs);

module.exports = router;
