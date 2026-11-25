const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const fs = require("node:fs/promises");
const path = require("node:path");
const User = require("../models/userModel");
const { getBangkokUpdatedDateTime } = require("../utils/dateTime");

const PUBLIC_USER_FIELDS =
  "_id username name role status date_updated time_updated user_image";
const USER_IMAGE_DIRECTORY = path.resolve(__dirname, "../../../images/user");

function getImagePath(file) {
  return file ? `images/user/${file.filename}` : undefined;
}

async function removeUploadedFile(file) {
  if (!file?.path) return;
  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not remove unused user image:", error.message);
  }
}

async function removeStoredImage(imagePath) {
  if (typeof imagePath !== "string" || !imagePath.startsWith("images/user/")) return;
  const absolutePath = path.resolve(__dirname, "../../../", imagePath);
  const relativePath = path.relative(USER_IMAGE_DIRECTORY, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return;
  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Could not remove user image:", error.message);
  }
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function sendError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "username already exists",
    });
  }

  if (error?.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}

// POST /api/users - Create a user and hash the submitted password.
exports.createUser = async (req, res) => {
  try {
    const { username, password, name, role } = req.body || {};
    if (role && role !== "staff") {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Staff Manager can only create staff accounts",
      });
    }
    const updatedAt = getBangkokUpdatedDateTime();

    const user = await User.create({
      username,
      password,
      name,
      role: "staff",
      status: "offline",
      ...updatedAt,
      user_image: getImagePath(req.file),
    });

    const safeUser = await User.findById(user._id).select(PUBLIC_USER_FIELDS);
    return res.status(201).json({ success: true, user: safeUser });
  } catch (error) {
    await removeUploadedFile(req.file);
    return sendError(res, error);
  }
};

// GET /api/users - List staff accounts without password hashes.
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "staff" })
      .select(PUBLIC_USER_FIELDS)
      .sort({ date_updated: -1, time_updated: -1 });

    return res.json({ success: true, count: users.length, users });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/users/check-duplicate?username=value - Check username availability.
exports.checkDuplicateUsername = async (req, res) => {
  try {
    if (!req.query.username) {
      return res.status(400).json({
        success: false,
        message: "username query parameter is required",
      });
    }

    const exists = await User.exists({ username: req.query.username });
    return res.json({ success: true, duplicate: Boolean(exists) });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/users/:id - Return one user by MongoDB ObjectId.
exports.getUser = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findById(req.params.id).select(PUBLIC_USER_FIELDS);
    if (!user || user.role !== "staff") {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/users/:id - Update a disabled staff profile; re-hash a new password.
exports.updateUser = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      await removeUploadedFile(req.file);
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findById(req.params.id).select("+password");
    if (!user) {
      await removeUploadedFile(req.file);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (user.role !== "staff") {
      await removeUploadedFile(req.file);
      return res.status(404).json({ success: false, message: "Staff account not found" });
    }
    if (user.status !== "disable") {
      await removeUploadedFile(req.file);
      return res.status(409).json({
        success: false,
        message: "A staff profile can only be edited while its status is disable",
      });
    }
    if (req.body?.role !== undefined || req.body?.status !== undefined) {
      await removeUploadedFile(req.file);
      return res.status(400).json({
        success: false,
        message: "Role and status must be changed through their dedicated operations",
      });
    }

    const previousImage = user.user_image;
    const allowedFields = ["username", "password", "name"];
    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    const imagePath = getImagePath(req.file);
    if (imagePath) {
      user.user_image = imagePath;
    }

    Object.assign(user, getBangkokUpdatedDateTime());

    await user.save();
    if (imagePath && previousImage && previousImage !== imagePath)
      await removeStoredImage(previousImage);
    const safeUser = await User.findById(user._id).select(PUBLIC_USER_FIELDS);
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    await removeUploadedFile(req.file);
    return sendError(res, error);
  }
};

// PATCH /api/users/:id/status - Admin can disable staff or return them offline.
exports.updateUserStatus = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const { status } = req.body || {};
    if (!["offline", "disable"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status can only be changed to offline or disable by an administrator",
      });
    }
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "staff") {
      return res.status(404).json({ success: false, message: "Staff account not found" });
    }
    user.status = status;
    Object.assign(user, getBangkokUpdatedDateTime());
    await user.save();
    const safeUser = await User.findById(user._id).select(PUBLIC_USER_FIELDS);
    return res.json({ success: true, user: safeUser });
  } catch (error) {
    return sendError(res, error);
  }
};

// DELETE /api/users/:id - Delete one user document.
exports.deleteUser = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findOneAndDelete({ _id: req.params.id, role: "staff" });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await removeStoredImage(user.user_image);
    return res.json({ success: true, message: "User deleted" });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/auth/register - Create a self-service parking account.
exports.register = async (req, res) => {
  try {
    const { accountType, name, username, password } = req.body || {};
    if (accountType !== "public" && accountType !== "student") {
      return res.status(400).json({
        success: false,
        message: "Choose Public User or Student to register",
      });
    }

    if (typeof name !== "string" || !name.trim() ||
        typeof username !== "string" || !username.trim()) {
      return res.status(400).json({
        success: false,
        message: "Full name and username are required",
      });
    }

    if (typeof password !== "string" || !password.trim() ||
        password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters and at most 72 UTF-8 bytes",
      });
    }

    await User.create({
      name: name.trim(),
      username: username.trim(),
      password,
      role: accountType === "public" ? "public" : "user",
      ...getBangkokUpdatedDateTime(),
    });

    return res.status(201).json({ success: true });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/auth/login - Verify credentials, mark user online, and issue a JWT.
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "username and password are required",
      });
    }

    const user = await User.findOne({ username }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    if (user.status === "disable") {
      return res.status(403).json({
        success: false,
        message: "User account is disabled",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is not configured",
      });
    }

    user.status = "online";
    Object.assign(user, getBangkokUpdatedDateTime());
    await user.save();

    const token = jwt.sign(
      { userId: user._id.toString(), role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    const safeUser = await User.findById(user._id).select(PUBLIC_USER_FIELDS);
    return res.json({ success: true, token, user: safeUser });
  } catch (error) {
    return sendError(res, error);
  }
};

// POST /api/auth/logout - Mark the authenticated user offline.
exports.logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.auth.userId, {
      status: "offline",
      ...getBangkokUpdatedDateTime(),
    });
    return res.json({ success: true, message: "Logged out" });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/auth/verify - Verify a JWT and return its current user.
exports.verifyToken = async (req, res) => {
  try {
    const user = await User.findById(req.auth.userId).select(PUBLIC_USER_FIELDS);
    if (!user || user.status === "disable") {
      return res.status(401).json({ success: false, message: "Invalid user" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return sendError(res, error);
  }
};

exports.requireAuth = async (req, res, next) => {
  const authorization = req.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: "Token is required" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "JWT_SECRET is not configured",
    });
  }

  let auth;
  try {
    auth = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  try {
    const user = await User.findById(auth.userId).select("role status");
    if (!user || user.status === "disable") {
      return res.status(401).json({ success: false, message: "Invalid or disabled user" });
    }
    req.auth = auth;
    req.currentUser = user;
    return next();
  } catch (error) {
    return sendError(res, error);
  }
};

exports.requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select("role status");
    if (!user || user.status === "disable") {
      return res.status(401).json({
        success: false,
        message: "Invalid user",
      });
    }

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access is required",
      });
    }

    return next();
  } catch (error) {
    return sendError(res, error);
  }
};
