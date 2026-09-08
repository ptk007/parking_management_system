const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// Authentication API routes for the user collection.
router.post("/login", userController.login);
router.post("/logout", userController.requireAuth, userController.logout);
router.get("/verify", userController.requireAuth, userController.verifyToken);

module.exports = router;
