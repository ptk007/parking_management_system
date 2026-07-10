const express = require("express");
const vehicleController = require("../controllers/vehicleController");

const router = express.Router();

// Vehicle collection CRUD API routes.
router.post("/", vehicleController.createVehicle);
router.get("/", vehicleController.listVehicles);
router.get("/check-duplicate", vehicleController.checkDuplicateLicense);
router.get("/:id", vehicleController.getVehicle);
router.put("/:id", vehicleController.updateVehicle);
router.delete("/:id", vehicleController.deleteVehicle);

module.exports = router;
