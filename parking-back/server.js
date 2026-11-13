const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const userRoutes = require("./api/routes/userRoutes");
const authRoutes = require("./api/routes/authRoutes");
const vehicleRoutes = require("./api/routes/vehicleRoutes");
const parkingBuildingRoutes = require("./api/routes/parkingBuildingRoutes");
const parkingFloorRoutes = require("./api/routes/parkingFloorRoutes");
const supportRoutes = require("./api/routes/supportRoutes");
const parkingLogRoutes = require("./api/routes/parkingLogRoutes");
const modelRuntimeRoutes = require("./api/routes/modelRuntimeRoutes");
const pythonModelRuntime = require("./api/services/pythonModelRuntime");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/parking_management_system";

app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use("/images", express.static(path.resolve(__dirname, "../images")));

// API routes backed by MongoDB's user collection.
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/admin/system/buildings", parkingBuildingRoutes);
app.use("/api/admin/system/floors", parkingFloorRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/parking-logs", parkingLogRoutes);
app.use("/api/model-runtime", modelRuntimeRoutes);

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
    await require("./api/utils/migrateParkingBuildingFields")();
    await require("./api/utils/migrateParkingFloorFields")();
    console.log("Connected to MongoDB");

    const server = app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      if (process.platform === "win32") {
        try {
          pythonModelRuntime.start();
          console.log("YOLO runtime started in CCTV standby mode.");
        } catch (error) {
          console.error("Could not start YOLO runtime standby:", error.message);
        }
      }
    });

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      server.close();
      void pythonModelRuntime.stop().finally(() => process.exit(0));
      const forceExit = setTimeout(() => process.exit(1), 5000);
      forceExit.unref();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}

if (require.main === module) startServer();

module.exports = app;
