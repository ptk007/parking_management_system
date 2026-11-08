const express = require("express");
const modelRuntimeController = require("../controllers/modelRuntimeController");
const requireModelApiKey = require("../middleware/requireModelApiKey");

const router = express.Router();

router.post("/sync", requireModelApiKey, modelRuntimeController.sync);

module.exports = router;
