const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const { getBangkokDateTime } = require("../utils/dateTime");

const PUBLIC_USER_FIELDS =
  "_id username name role status date_add time_add user_image";

function getImagePath(file) {
  return file ? `images/user/${file.filename}` : undefined;
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
    const { username, password, name, role } = req.body;
    const createdAt = getBangkokDateTime();

    const user = await User.create({
      username,
      password,
      name,
      role,
      status: "offline",
      ...createdAt,
      user_image: getImagePath(req.file),
    });

    const safeUser = await User.findById(user._id).select(PUBLIC_USER_FIELDS);
    return res.status(201).json({ success: true, user: safeUser });
  } catch (error) {
    return sendError(res, error);
  }
};

// GET /api/users - List every stored user without password hashes.
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select(PUBLIC_USER_FIELDS)
      .sort({ date_add: -1, time_add: -1 });

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
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user });
  } catch (error) {
    return sendError(res, error);
  }
};

// PUT /api/users/:id - Update allowed user fields; re-hash a new password.
exports.updateUser = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const user = await User.findById(req.params.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const allowedFields = ["username", "password", "name", "role", "status"];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }

    const imagePath = getImagePath(req.file);
    if (imagePath) {
      user.user_image = imagePath;
    }

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

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, message: "User deleted" });
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
    await User.findByIdAndUpdate(req.auth.userId, { status: "offline" });
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

exports.requireAuth = (req, res, next) => {
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

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
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
