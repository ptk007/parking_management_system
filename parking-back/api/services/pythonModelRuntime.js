const path = require("path");
const { spawn } = require("child_process");
const ParkingFloor = require("../models/parkingFloorModel");

const runBatPath = path.resolve(__dirname, "../../../python-v2/run.bat");
const runtimeDirectory = path.dirname(runBatPath);
let runtimeProcess = null;
const intentionalStops = new WeakSet();

async function markEnabledPresetsError(message) {
  try {
    await ParkingFloor.updateMany(
      { camera_presets: { $elemMatch: { modelEnabled: true, status: "Enable" } } },
      {
        $set: {
          "camera_presets.$[camera].modelRuntimeStatus": "Error",
          "camera_presets.$[camera].modelRuntimeMessage": message.slice(0, 500),
          "camera_presets.$[camera].modelRuntimeUpdatedAt": new Date(),
        },
      },
      { arrayFilters: [{ "camera.modelEnabled": true, "camera.status": "Enable" }] },
    );
  } catch (error) {
    console.error("Could not record YOLO runtime launch failure:", error.message);
  }
}

function isRunning() {
  return runtimeProcess && runtimeProcess.exitCode === null && !runtimeProcess.killed;
}

function buildCommandLine(batPath = runBatPath) {
  return `/d /s /c ""${batPath}""`;
}

function start() {
  if (process.platform !== "win32")
    throw new Error("Automatic YOLO startup requires the backend to run on Windows");
  if (isRunning()) return runtimeProcess;

  const child = spawn(
    "cmd.exe",
    [buildCommandLine()],
    {
      windowsVerbatimArguments: true,
      cwd: runtimeDirectory,
      env: { ...process.env, PARKING_LAUNCHED_BY_BACKEND: "1" },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  runtimeProcess = child;
  child.stdout?.on("data", (chunk) => process.stdout.write(`[YOLO runtime] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[YOLO runtime] ${chunk}`));
  child.on("error", (error) => {
    console.error("Could not launch python-v2/run.bat:", error.message);
    void markEnabledPresetsError(`Could not launch run.bat: ${error.message}`);
  });
  child.on("close", (code) => {
    if (runtimeProcess === child) runtimeProcess = null;
    console.log(`[YOLO runtime] run.bat exited with code ${code}`);
    const intentional = intentionalStops.has(child);
    intentionalStops.delete(child);
    if (code !== 0 && !intentional)
      void markEnabledPresetsError(`run.bat exited with code ${code}`);
  });
  return child;
}

function getState() {
  return { running: Boolean(isRunning()), runBatPath };
}

function stop() {
  const child = runtimeProcess;
  if (!child || child.exitCode !== null) {
    runtimeProcess = null;
    return Promise.resolve();
  }
  runtimeProcess = null;
  intentionalStops.add(child);

  if (process.platform !== "win32" || !child.pid) {
    child.kill();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const killer = spawn(
      "taskkill.exe",
      ["/PID", String(child.pid), "/T", "/F"],
      { windowsHide: true, stdio: "ignore" },
    );
    killer.once("error", () => {
      child.kill();
      finish();
    });
    killer.once("close", finish);
    const timeout = setTimeout(() => {
      if (child.exitCode === null) child.kill();
      finish();
    }, 3000);
    timeout.unref();
  });
}

module.exports = { buildCommandLine, getState, runBatPath, start, stop };
