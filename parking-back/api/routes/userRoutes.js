const path = require("path");
const express = require("express");
const multer = require("multer");
const userController = require("../controllers/userController");

const router = express.Router();
const imageDirectory = path.resolve(__dirname, "../../../images/user");

const storage = multer.diskStorage({
  destination: imageDirectory,
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `user-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
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

// User collection CRUD API routes. The image form field name is "user_image".
router.post("/", upload.single("user_image"), userController.createUser);
router.get("/", userController.listUsers);
router.get("/check-duplicate", userController.checkDuplicateUsername);
router.get("/:id", userController.getUser);
router.put("/:id", upload.single("user_image"), userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
