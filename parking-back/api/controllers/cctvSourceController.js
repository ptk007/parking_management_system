const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");
const ParkingSourceFile = require("../models/parkingSourceFileModel");

const FILE_ROOT = path.resolve(__dirname, "../../../json_file/parking_slots");
const PYTHON_PROJECT = path.resolve(__dirname, "../../../python-v2");
const PROBE_SCRIPT = path.join(PYTHON_PROJECT, "probe_camera.py");
const PREVIEW_SCRIPT = path.join(PYTHON_PROJECT, "stream_camera_preview.py");
const PROBE_TIMEOUT_MS = 18000;
const PREVIEW_START_TIMEOUT_MS = 20000;
const MAX_ACTIVE_PREVIEWS = 2;
const MAX_PROBE_OUTPUT_CHARS = 2_000_000;
const MAX_FRAME_BASE64_CHARS = 1_400_000;
const MAX_QUERY_LENGTH = 200;
const activePreviews = new Set();
const CAMERA_FIELDS = {
  cameraNo: "NO",
  ipAddress: "IP ADDRESS",
  sourceCameraName: "CAMERA NAME_NEW",
  rtspLink: "ANPR&PTZ RTSP",
};

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalize(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function extractRecords(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["cameras", "data", "results", "items"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
}

function mapCameraRecord(record, recordIndex) {
  return {
    recordIndex,
    cameraNo: String(record[CAMERA_FIELDS.cameraNo] ?? "").trim(),
    ipAddress: String(record[CAMERA_FIELDS.ipAddress] ?? "").trim(),
    sourceCameraName: String(record[CAMERA_FIELDS.sourceCameraName] ?? "").trim(),
    rtspLink: String(record[CAMERA_FIELDS.rtspLink] ?? "").trim(),
  };
}

function findCameraMatches(data, query) {
  const search = normalize(query);
  return extractRecords(data)
    .map((record, recordIndex) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return null;
      const camera = mapCameraRecord(record, recordIndex);
      return Object.values(camera)
        .filter((value) => typeof value === "string")
        .some((value) => normalize(value) === search)
        ? camera
        : null;
    })
    .filter(Boolean);
}

async function loadSourceFile(fileId) {
  if (!isValidId(fileId)) {
    return { error: { status: 400, message: "Invalid CCTV source file id" } };
  }
  const source = await ParkingSourceFile.findOne({
    _id: fileId,
    fileType: "cctv",
  });
  if (!source) {
    return { error: { status: 404, message: "CCTV source file not found" } };
  }

  const absolutePath = path.resolve(__dirname, "../../..", source.path);
  const relativePath = path.relative(FILE_ROOT, absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid CCTV source file path");
  }
  let contents;
  try {
    contents = (await fs.readFile(absolutePath, "utf8")).replace(/^\uFEFF/, "");
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        error: {
          status: 404,
          message: "CCTV source file is missing from the server. Re-import the JSON file.",
        },
      };
    }
    throw error;
  }
  let data;
  try {
    data = JSON.parse(contents);
  } catch {
    return { error: { status: 400, message: "CCTV source file contains invalid JSON" } };
  }
  if (!extractRecords(data).length) {
    return { error: { status: 400, message: "CCTV source JSON contains no camera records" } };
  }
  return { data };
}

function validateRtspUrl(value) {
  try {
    const url = new URL(value);
    return ["rtsp:", "rtsps:"].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function probeCameraConnection(rtspUrl) {
  return new Promise((resolve, reject) => {
    const pythonExecutable =
      process.env.PARKING_PYTHON_EXECUTABLE ||
      (process.platform === "win32"
        ? String.raw`C:\py_venv\.venv\Scripts\python.exe`
        : "python3");
    const child = spawn(pythonExecutable, [PROBE_SCRIPT], {
      cwd: PYTHON_PROJECT,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    let stdout = "";
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      finish(resolve, { online: false });
    }, PROBE_TIMEOUT_MS);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > MAX_PROBE_OUTPUT_CHARS) {
        child.kill();
        finish(reject, new Error("CCTV connection probe returned too much output"));
      }
    });
    child.on("error", (error) => {
      finish(reject, error);
    });
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(reject, new Error("CCTV connection probe failed"));
        return;
      }
      try {
        const result = JSON.parse(stdout.trim());
        if (typeof result.online !== "boolean") {
          throw new Error("Invalid CCTV connection probe result");
        }
        if (result.online) {
          if (
            typeof result.frameBase64 !== "string" ||
            result.frameBase64.length > MAX_FRAME_BASE64_CHARS ||
            !/^[A-Za-z0-9+/]+={0,2}$/.test(result.frameBase64)
          ) {
            throw new Error("CCTV connection probe returned an invalid frame");
          }
          finish(resolve, {
            online: true,
            frameData: `data:image/jpeg;base64,${result.frameBase64}`,
          });
          return;
        }
        finish(resolve, { online: false });
      } catch (error) {
        finish(reject, error);
      }
    });
    child.stdin.on("error", (error) => {
      finish(reject, error);
    });
    child.stdin.end(JSON.stringify({ rtspUrl }));
  });
}

async function getCameraStatus(camera) {
  if (!camera.rtspLink) {
    return { status: "Unknown", message: "RTSP link is missing in the source file." };
  }
  if (!validateRtspUrl(camera.rtspLink)) {
    return { status: "Unknown", message: "Source record has an invalid RTSP link." };
  }
  try {
    const result = await module.exports.probeCameraConnection(camera.rtspLink);
    return result.online
      ? {
          status: "Online",
          message: "A video frame was received from the camera.",
          frameData: result.frameData,
        }
      : { status: "Offline", message: "The camera did not return a video frame." };
  } catch {
    return {
      status: "Unknown",
      message: "Connection check is unavailable. Verify the backend Python/OpenCV configuration.",
    };
  }
}

exports.findCameraMatches = findCameraMatches;
exports.probeCameraConnection = probeCameraConnection;
exports.searchCameraSource = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { query } = req.body || {};
    if (
      typeof query !== "string" ||
      !query.trim() ||
      query.trim().length > MAX_QUERY_LENGTH
    ) {
      return res.status(400).json({ message: "Enter a search value up to 200 characters" });
    }

    const loaded = await loadSourceFile(fileId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const matches = module.exports.findCameraMatches(loaded.data, query.trim());
    if (!matches.length) {
      return res.json({
        matches: [],
        status: "Unknown",
        message: "No exact camera match was found in the selected CCTV source.",
      });
    }
    if (matches.length > 1) {
      return res.json({
        matches,
        status: "Unknown",
        message: "More than one camera matched. Select the intended camera to check its connection.",
      });
    }

    const camera = matches[0];
    const message = !camera.rtspLink
      ? "RTSP link is missing in the source file."
      : !validateRtspUrl(camera.rtspLink)
        ? "Source record has an invalid RTSP link."
        : "Camera matched. Open the live preview to check its connection.";
    return res.json({
      matches,
      camera,
      status: "Unknown",
      message,
    });
  } catch (error) {
    console.error("Failed to search CCTV source:", error.message);
    return res.status(500).json({ message: "Failed to search CCTV source" });
  }
};

exports.probeCameraSource = async (req, res) => {
  try {
    const recordIndex = Number(req.params.recordIndex);
    if (!Number.isSafeInteger(recordIndex) || recordIndex < 0) {
      return res.status(400).json({ message: "Invalid camera record index" });
    }
    const loaded = await loadSourceFile(req.params.fileId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const record = extractRecords(loaded.data)[recordIndex];
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return res.status(404).json({ message: "Camera record not found" });
    }
    const camera = mapCameraRecord(record, recordIndex);
    return res.json({ camera, ...(await getCameraStatus(camera)) });
  } catch (error) {
    console.error("Failed to check CCTV connection:", error.message);
    return res.status(500).json({ message: "Failed to check CCTV connection" });
  }
};

exports.streamCameraPreview = async (req, res) => {
  let child;
  let settled = false;
  let streaming = false;
  let startupBuffer = Buffer.alloc(0);
  let startupTimeout;

  const stopChild = () => {
    if (child && child.exitCode === null && !child.killed) child.kill();
  };
  const cleanup = () => {
    clearTimeout(startupTimeout);
    if (child) activePreviews.delete(child);
  };
  const sendStartupError = (status, message) => {
    if (settled || res.headersSent) return;
    settled = true;
    cleanup();
    res.status(status).json({ message });
    stopChild();
  };
  const writeStreamData = (chunk) => {
    if (res.destroyed || !res.write(chunk)) {
      if (!res.destroyed) {
        child.stdout.pause();
        res.once("drain", () => child.stdout.resume());
      }
    }
  };

  try {
    const recordIndex = Number(req.params.recordIndex);
    if (!Number.isSafeInteger(recordIndex) || recordIndex < 0) {
      return res.status(400).json({ message: "Invalid camera record index" });
    }
    const loaded = await loadSourceFile(req.params.fileId);
    if (loaded.error) {
      return res.status(loaded.error.status).json({ message: loaded.error.message });
    }
    const record = extractRecords(loaded.data)[recordIndex];
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      return res.status(404).json({ message: "Camera record not found" });
    }
    const camera = mapCameraRecord(record, recordIndex);
    if (!camera.rtspLink || !validateRtspUrl(camera.rtspLink)) {
      return res.status(400).json({ message: "Camera source has no valid RTSP link." });
    }
    if (activePreviews.size >= MAX_ACTIVE_PREVIEWS) {
      return res.status(429).json({ message: "Too many live previews are active. Close another preview and retry." });
    }

    const pythonExecutable =
      process.env.PARKING_PYTHON_EXECUTABLE ||
      (process.platform === "win32"
        ? String.raw`C:\py_venv\.venv\Scripts\python.exe`
        : "python3");
    const parkingSlotData = req.body?.parkingSlotData;
    child = spawn(pythonExecutable, [PREVIEW_SCRIPT], {
      cwd: PYTHON_PROJECT,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    activePreviews.add(child);
    res.on("close", () => {
      if (!res.writableEnded) stopChild();
      cleanup();
    });
    req.on("aborted", stopChild);

    startupTimeout = setTimeout(() => {
      sendStartupError(504, "Timed out waiting for the camera preview.");
    }, PREVIEW_START_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      if (streaming) {
        writeStreamData(chunk);
        return;
      }

      startupBuffer = Buffer.concat([startupBuffer, chunk]);
      if (startupBuffer.length > 1024 * 1024) {
        sendStartupError(502, "Camera preview returned invalid startup data.");
        return;
      }
      const newline = startupBuffer.indexOf(0x0a);
      if (newline < 0) return;

      let status;
      try {
        status = JSON.parse(startupBuffer.subarray(0, newline).toString("utf8"));
      } catch {
        sendStartupError(502, "Camera preview returned invalid startup data.");
        return;
      }
      if (status.online !== true) {
        sendStartupError(503, status.message || "The camera did not return a video frame.");
        return;
      }

      settled = true;
      streaming = true;
      clearTimeout(startupTimeout);
      res.status(200);
      res.set({
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        "X-Accel-Buffering": "no",
      });
      writeStreamData(startupBuffer.subarray(newline + 1));
      startupBuffer = Buffer.alloc(0);
    });
    child.on("error", () => {
      if (!streaming) {
        sendStartupError(503, "Camera preview service is unavailable.");
      } else {
        res.end();
      }
    });
    child.on("close", () => {
      cleanup();
      if (!streaming) {
        sendStartupError(503, "The camera preview could not be started.");
      } else if (!res.writableEnded) {
        res.end();
      }
    });
    child.stdin.on("error", () => {
      if (!streaming) {
        sendStartupError(503, "Camera preview service is unavailable.");
      }
    });
    child.stdin.end(
      JSON.stringify({
        rtspUrl: camera.rtspLink,
        parkingSlotData:
          parkingSlotData && typeof parkingSlotData === "object" && !Array.isArray(parkingSlotData)
            ? parkingSlotData
            : null,
      }),
    );
  } catch (error) {
    console.error("Failed to start CCTV live preview:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to start CCTV live preview" });
    } else {
      res.end();
    }
    stopChild();
    cleanup();
  }
};
