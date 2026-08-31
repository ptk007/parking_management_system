require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const userRoutes = require("./api/routes/userRoutes");
const authRoutes = require("./api/routes/authRoutes");
const vehicleRoutes = require("./api/routes/vehicleRoutes");
const parkingBuildingRoutes = require("./api/routes/parkingBuildingRoutes");
const parkingFloorRoutes = require("./api/routes/parkingFloorRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/parking_management_system";

app.use(cors());
app.use(express.json());
app.use("/images", express.static(path.resolve(__dirname, "../images")));

// API routes backed by MongoDB's user collection.
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/admin/system/buildings", parkingBuildingRoutes);
app.use("/api/admin/system/floors", parkingFloorRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Parking management API is running" });
});

app.use((error, req, res, next) => {
  if (
    error.name === "MulterError" ||
    error.message?.includes("images are allowed") ||
    error.message?.includes("JSON files are allowed")
  ) {
    return res.status(400).json({ success: false, message: error.message });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}

startServer();
