const mongoose = require("mongoose");
const fs = require("fs/promises");
const path = require("path");
const ExcelJS = require("exceljs");
const ParkingBuilding = require("../models/parkingBuildingModel");
const ParkingFloor = require("../models/parkingFloorModel");
const ParkingLogCounter = require("../models/parkingLogCounterModel");
const ParkingLog = require("../models/parkingLogModel");
const User = require("../models/userModel");
const Vehicle = require("../models/vehicleModel");
const { getBangkokDateTime } = require("../utils/dateTime");

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MODEL_EVENTS = ["Parking", "Exited", "Not parking"];
const EXPORT_DIRECTORY = path.resolve(__dirname, "../../../logs");

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function fail(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function buildParkingLogWorkbook(logs, presetNames = new Map()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Parking Management System";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Parking Logs");
  sheet.columns = [
    { header: "No", key: "no", width: 8 },
    { header: "Owner", key: "owner", width: 24 },
    { header: "Name", key: "name", width: 24 },
    { header: "Building", key: "building", width: 26 },
    { header: "Floor", key: "floor", width: 10 },
    { header: "Vehicle type", key: "vehicleType", width: 16 },
    { header: "CCTV preset", key: "cameraPreset", width: 24 },
    { header: "Parking slot name", key: "parkingSlotName", width: 22 },
    { header: "Brand", key: "brand", width: 18 },
    { header: "Model", key: "model", width: 18 },
    { header: "Color", key: "color", width: 16 },
    { header: "License number", key: "licenseNumber", width: 20 },
    { header: "Province", key: "province", width: 22 },
    { header: "Entry date", key: "entryDate", width: 16 },
    { header: "Entry time", key: "entryTime", width: 16 },
    { header: "Exit date", key: "exitDate", width: 16 },
    { header: "Exit time", key: "exitTime", width: 16 },
    { header: "Parking slot number", key: "slotNumber", width: 20 },
    { header: "Parking status", key: "parkingStatus", width: 18 },
    { header: "Created at", key: "createdAt", width: 24 },
    { header: "Updated at", key: "updatedAt", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF7F1D1D" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "U1" };
  logs.forEach((log, index) => {
    sheet.addRow({
      no: index + 1,
      owner: log.owner ? log.name : "",
      name: log.name,
      building: log.building,
      floor: log.floor,
      vehicleType: log.veh_type,
      cameraPreset: presetNames.get(String(log.cameraPresetId)) || "",
      parkingSlotName: log.parkingSlotName,
      brand: log.brand,
      model: log.model,
      color: log.color,
      licenseNumber: log.license_num,
      province: log.province,
      entryDate: log.date_enter,
      entryTime: log.park_time,
      exitDate: log.date_exit,
      exitTime: log.exit_time,
      slotNumber: log.park_slot,
      parkingStatus: log.park_status,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    });
  });
  return workbook;
}

async function saveAndDownloadWorkbook(res, workbook, filename) {
  await fs.mkdir(EXPORT_DIRECTORY, { recursive: true });
  const filePath = path.join(EXPORT_DIRECTORY, filename);
  await workbook.xlsx.writeFile(filePath);
  return res.download(filePath, filename);
}

function getEventTime(value) {
  if (value === undefined) return new Date();
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getSlot(floor, cameraPresetId, parkingSlotName) {
  const slots = floor.parking_map?.slots;
  if (!Array.isArray(slots)) return { error: "Parking map not found" };
  const matches = slots.filter(
    (slot) =>
      slot.cameraPresetId === cameraPresetId &&
      slot.parkingSlotName === parkingSlotName,
  );
  if (!matches.length) return { error: "Parking map slot assignment not found" };
  if (matches.length > 1)
    return { error: "Parking slot assignment is ambiguous" };
  return { slot: matches[0] };
}

async function updateMapSlot(
  floor,
  targetSlot,
  status,
  eventTime,
  licensePlateDetected,
) {
  if (targetSlot.status === "disabled") return true;

  const currentMap = floor.parking_map;
  const nextMap = {
    ...currentMap,
    slots: currentMap.slots.map((slot) => {
      if (slot.number !== targetSlot.number || slot.zone !== targetSlot.zone)
        return slot;
      const updated = { ...slot, status };
      if (status === "available") {
        delete updated.licensePlateDetected;
      } else if (typeof licensePlateDetected === "boolean") {
        updated.licensePlateDetected = licensePlateDetected;
      }
      return updated;
    }),
  };
  const nextSlot = nextMap.slots.find(
    (slot) => slot.number === targetSlot.number && slot.zone === targetSlot.zone,
  );
  if (
    targetSlot.status === status &&
    targetSlot.licensePlateDetected === nextSlot?.licensePlateDetected
  )
    return true;
  const timestamp = getBangkokDateTime(eventTime);
  const updated = await ParkingFloor.findOneAndUpdate(
    { _id: floor._id, parking_map: currentMap },
    {
      $set: {
        parking_map: nextMap,
        date_updated: timestamp.date_add,
        time_updated: timestamp.time_add,
      },
    },
    { returnDocument: "after" },
  );
  return Boolean(updated);
}

async function findVehicle(licenseNum, province, vehicleType) {
  return Vehicle.findOne({
    license_num: licenseNum,
    province,
    veh_type: vehicleType,
  }).populate("name", "name username");
}

async function findVehicleByPlate(licenseNum, vehicleType) {
  return Vehicle.findOne({
    license_num: licenseNum,
    veh_type: vehicleType,
  }).populate("name", "name username");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveCameraPreset({
  floorId,
  cameraPresetId,
  cameraNo,
  cctvFileName,
}) {
  if (floorId && cameraPresetId) {
    if (!isValidId(floorId) || !isValidId(cameraPresetId))
      return { error: { status: 400, message: "Invalid floor or CCTV preset id" } };
    const floor = await ParkingFloor.findById(floorId);
    if (!floor) return { error: { status: 404, message: "Floor not found" } };
    const camera = Array.from(floor.camera_presets || []).find(
      (preset) => String(preset._id) === cameraPresetId,
    );
    if (!camera)
      return { error: { status: 404, message: "Camera preset not found on this floor" } };
    return { floor, camera };
  }

  if (
    typeof cameraNo !== "string" ||
    !cameraNo.trim() ||
    cameraNo.trim().length > 100 ||
    typeof cctvFileName !== "string" ||
    !cctvFileName.trim() ||
    cctvFileName.trim().length > 255
  )
    return {
      error: {
        status: 400,
        message: "Provide floor/preset ids or a camera number and CCTV source filename",
      },
    };

  const sourcePattern = new RegExp(
    `^${escapeRegex(cctvFileName.trim())}$`,
    "i",
  );
  const floors = await ParkingFloor.find({
    "camera_presets.cctvFileName": sourcePattern,
  });
  const matches = [];
  for (const floor of floors) {
    for (const camera of floor.camera_presets || []) {
      const savedCameraNo = String(camera.cameraNo || camera.cameraSelector || "").trim();
      if (
        sourcePattern.test(String(camera.cctvFileName || "")) &&
        savedCameraNo === cameraNo.trim()
      )
        matches.push({ floor, camera });
    }
  }
  if (!matches.length)
    return {
      error: {
        status: 404,
        message: "No CCTV preset matches this camera number and source filename",
      },
    };
  if (matches.length > 1)
    return {
      error: {
        status: 409,
        message:
          "Camera binding is ambiguous. Configure explicit floorId and cameraPresetId values.",
      },
    };
  return matches[0];
}

function getOwnerId(vehicle) {
  const owner = vehicle?.name;
  return owner && typeof owner === "object" ? owner._id : owner || null;
}

function getOwnerName(vehicle) {
  const owner = vehicle?.name;
  return owner && typeof owner === "object"
    ? owner.name || owner.username || ""
    : "";
}

async function getNextGuestName() {
  const counter = await ParkingLogCounter.findOneAndUpdate(
    { _id: "guest" },
    { $inc: { sequence: 1 } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  return `Guest ${counter.sequence}`;
}

function getLogFields({
  vehicle,
  guestName,
  floor,
  building,
  cameraPresetId,
  slot,
  licenseNum,
  province,
  eventTime,
}) {
  const timestamp = getBangkokDateTime(eventTime);
  return {
    owner: getOwnerId(vehicle),
    name: getOwnerName(vehicle) || guestName,
    building: building.building_name,
    buildingId: building._id,
    floor: floor.floor,
    floorId: floor._id,
    veh_type: floor.veh_type,
    cameraPresetId,
    parkingSlotName: slot?.parkingSlotName ?? null,
    brand: vehicle?.brand || "Unknown",
    model: vehicle?.model || "Unknown",
    color: vehicle?.color || "Unknown",
    license_num: licenseNum,
    province,
    date_enter: timestamp.date_add,
    park_time: timestamp.time_add,
    date_exit: null,
    exit_time: null,
    park_slot: slot?.number ?? null,
  };
}

async function addSlotDisabled(logs) {
  const floorIds = [...new Set(logs.map((log) => String(log.floorId)))];
  if (!floorIds.length) return logs.map((log) => ({ ...toPlain(log), slotDisabled: false }));
  const floors = await ParkingFloor.find({ _id: { $in: floorIds } })
    .select("parking_map")
    .lean();
  const maps = new Map(floors.map((floor) => [String(floor._id), floor.parking_map]));
  return logs.map((value) => {
    const log = toPlain(value);
    const parkingSlot = maps
      .get(String(log.floorId))
      ?.slots?.find(
        (slot) =>
          String(slot.cameraPresetId) === String(log.cameraPresetId) &&
          slot.parkingSlotName === log.parkingSlotName &&
          slot.number === log.park_slot,
      );
    return { ...log, slotDisabled: parkingSlot?.status === "disabled" };
  });
}

function toPlain(value) {
  return value?.toObject ? value.toObject() : value;
}

async function currentUser(req) {
  if (!isValidId(req.auth?.userId)) return null;
  const user = await User.findById(req.auth.userId).select("role status");
  return user && user.status !== "disable" ? user : null;
}

exports.listMyParkingLogs = async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Invalid user");
    const logs = await ParkingLog.find({
      owner: user._id,
    }).sort({ updatedAt: -1 });
    return res.json({ logs: await addSlotDisabled(logs) });
  } catch (error) {
    console.error("Failed to load user parking history:", error);
    return fail(res, 500, "Failed to load parking history");
  }
};

exports.listParkingLogs = async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Invalid user");
    if (!["admin", "staff"].includes(user.role))
      return fail(res, 403, "Parking log access required");
    const visibleSince = new Date(Date.now() - HISTORY_WINDOW_MS);
    const filter = {
      $or: [
        { park_status: "Parking" },
        { park_status: "Exited", updatedAt: { $gte: visibleSince } },
        { park_status: "Not parking", createdAt: { $gte: visibleSince } },
      ],
    };
    if (req.query.buildingId) {
      if (!isValidId(req.query.buildingId))
        return fail(res, 400, "Invalid building id");
      filter.buildingId = req.query.buildingId;
    }
    if (req.query.floorId) {
      if (!isValidId(req.query.floorId))
        return fail(res, 400, "Invalid floor id");
      filter.floorId = req.query.floorId;
    }
    if (req.query.veh_type) {
      if (!["car", "motorcycle"].includes(req.query.veh_type))
        return fail(res, 400, "Invalid vehicle type");
      filter.veh_type = req.query.veh_type;
    }
    const logs = await ParkingLog.find(filter).sort({ updatedAt: -1 });
    return res.json({ logs: await addSlotDisabled(logs) });
  } catch (error) {
    console.error("Failed to load parking logs:", error);
    return fail(res, 500, "Failed to load parking logs");
  }
};

exports.exportParkingLogs = async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Invalid user");
    if (!["admin", "staff"].includes(user.role))
      return fail(res, 403, "Parking log access required");

    const { buildingId, floorId, veh_type: vehicleType } = req.query;
    if (!isValidId(buildingId) || !isValidId(floorId))
      return fail(res, 400, "Select a valid building and floor");
    if (!["car", "motorcycle"].includes(vehicleType))
      return fail(res, 400, "Select a valid vehicle type");

    const floor = await ParkingFloor.findById(floorId)
      .select("building floor veh_type camera_presets")
      .populate("building", "building_name")
      .lean();
    if (
      !floor ||
      String(floor.building?._id) !== String(buildingId) ||
      floor.veh_type !== vehicleType
    )
      return fail(res, 404, "No parking logs found for this building, floor, and vehicle");

    const logs = await ParkingLog.find({
      buildingId,
      floorId,
      veh_type: vehicleType,
    }).sort({ updatedAt: -1 }).lean();
    if (!logs.length)
      return fail(res, 404, "No parking logs found for this building, floor, and vehicle");

    const presetNames = new Map(
      (floor.camera_presets || []).map((camera) => [
        String(camera._id),
        camera.name || "",
      ]),
    );
    const workbook = buildParkingLogWorkbook(logs, presetNames);

    const safeBuilding = String(floor.building.building_name || "building")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "building";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `parking-log-${safeBuilding}-floor-${floor.floor}-${vehicleType}-${timestamp}.xlsx`;
    return saveAndDownloadWorkbook(res, workbook, filename);
  } catch (error) {
    console.error("Failed to export parking logs:", error);
    return fail(res, 500, "Failed to export parking logs");
  }
};

exports.exportSampleParkingLogs = async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return fail(res, 401, "Invalid user");
    if (!["admin", "staff"].includes(user.role))
      return fail(res, 403, "Parking log access required");

    const sampleRows = req.body?.logs;
    if (!Array.isArray(sampleRows) || sampleRows.length < 1 || sampleRows.length > 500)
      return fail(res, 400, "Provide between 1 and 500 sample logs");
    const textFields = [
      "name", "building", "veh_type", "parkingSlotName", "brand", "model",
      "color", "license_num", "province", "date_enter", "park_time",
      "date_exit", "exit_time", "park_status", "createdAt", "updatedAt",
    ];
    const logs = [];
    for (const row of sampleRows) {
      if (!row || typeof row !== "object" || Array.isArray(row))
        return fail(res, 400, "Invalid sample log");
      for (const field of textFields) {
        if (row[field] !== undefined && row[field] !== null && typeof row[field] !== "string")
          return fail(res, 400, "Invalid sample log");
      }
      if (!Number.isInteger(row.floor) || !["car", "motorcycle"].includes(row.veh_type))
        return fail(res, 400, "Invalid sample log");
      if (row.park_slot !== null && row.park_slot !== undefined && !Number.isFinite(row.park_slot))
        return fail(res, 400, "Invalid sample log");
      logs.push({
        ...Object.fromEntries(textFields.map((field) => [field, row[field] || ""])),
        floor: row.floor,
        park_slot: row.park_slot ?? null,
        owner: row.owner ? "sample-owner" : null,
      });
    }

    const workbook = buildParkingLogWorkbook(logs);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `parking-log-sample-${timestamp}.xlsx`;
    return saveAndDownloadWorkbook(res, workbook, filename);
  } catch (error) {
    console.error("Failed to export sample parking logs:", error);
    return fail(res, 500, "Failed to export sample parking logs");
  }
};

exports.createModelEvent = async (req, res) => {
  try {
    const {
      event,
      floorId,
      cameraPresetId,
      cameraNo,
      cctvFileName,
      license_plate: rawLicensePlate,
      province: rawProvince,
      parkingSlotName,
    } = req.body || {};
    if (Boolean(floorId) !== Boolean(cameraPresetId))
      return fail(res, 400, "Provide both floor and CCTV preset ids");
    if (
      !MODEL_EVENTS.includes(event) ||
      typeof rawLicensePlate !== "string" ||
      !rawLicensePlate.trim() ||
      rawLicensePlate.trim().length > 32 ||
      (rawProvince !== undefined &&
        (typeof rawProvince !== "string" ||
          !rawProvince.trim() ||
          rawProvince.trim().length > 100))
    )
      return fail(res, 400, "Invalid parking model event");

    const eventTime = getEventTime(req.body.occurredAt);
    if (!eventTime) return fail(res, 400, "Invalid event time");
    const licenseNum = rawLicensePlate.trim();
    const binding = await resolveCameraPreset({
      floorId,
      cameraPresetId,
      cameraNo,
      cctvFileName,
    });
    if (binding.error) return fail(res, binding.error.status, binding.error.message);
    const { floor, camera } = binding;
    const resolvedCameraPresetId = String(camera._id);

    let slot = null;
    if (event !== "Not parking") {
      if (typeof parkingSlotName !== "string" || !parkingSlotName.trim())
        return fail(res, 400, "Parking slot category is required");
      const categories = camera.parkingSlotData?.categories;
      if (
        !Array.isArray(categories) ||
        !categories.some(
          (category) =>
            category?.supercategory === "parking-slot" &&
            category.name === parkingSlotName,
        )
      )
        return fail(res, 400, "Parking slot category does not belong to this CCTV preset");
      const result = getSlot(floor, resolvedCameraPresetId, parkingSlotName);
      if (result.error) return fail(res, 404, result.error);
      slot = result.slot;
    }

    const buildingId = String(floor.building?._id || floor.building || "");
    const building =
      typeof floor.building === "object" && floor.building?.building_name
        ? floor.building
        : await ParkingBuilding.findById(buildingId);
    if (!building) return fail(res, 404, "Building not found");

    const registeredVehicle = rawProvince
      ? await findVehicle(licenseNum, rawProvince.trim(), floor.veh_type)
      : await findVehicleByPlate(licenseNum, floor.veh_type);
    const province = rawProvince?.trim() || registeredVehicle?.province || "Unknown";
    const matchedVehicle = registeredVehicle;
    const vehicle =
      getOwnerId(matchedVehicle) && getOwnerName(matchedVehicle)
        ? matchedVehicle
        : null;
    if (event === "Parking") {
      const sessionFilter = {
        buildingId: building._id,
        floorId: floor._id,
        veh_type: floor.veh_type,
        license_num: licenseNum,
        province,
        park_status: "Parking",
      };
      const existing = await ParkingLog.findOne(sessionFilter);
      if (existing) {
        if (
          existing.park_slot !== slot.number ||
          String(existing.cameraPresetId) !== resolvedCameraPresetId ||
          existing.parkingSlotName !== parkingSlotName
        )
          return fail(res, 409, "Vehicle already has an active parking session");
        if (!(await updateMapSlot(floor, slot, "occupied", eventTime, true)))
          return fail(res, 409, "Parking map changed; retry the event");
        return res.json({
          success: true,
          log: existing,
          matchedVehicle: Boolean(vehicle),
          created: false,
        });
      }
      if (!(await updateMapSlot(floor, slot, "occupied", eventTime, true)))
        return fail(res, 409, "Parking map changed; retry the event");

      const fields = getLogFields({
        vehicle,
        guestName: vehicle ? undefined : await getNextGuestName(),
        floor,
        building,
        cameraPresetId: resolvedCameraPresetId,
        slot,
        licenseNum,
        province,
        eventTime,
      });
      const log = await ParkingLog.create({
        ...fields,
        park_status: "Parking",
        createdAt: eventTime,
        updatedAt: eventTime,
      });
      return res.status(201).json({
        success: true,
        log,
        matchedVehicle: Boolean(vehicle),
        created: true,
      });
    }

    if (event === "Exited") {
      const active = await ParkingLog.findOne({
        buildingId: building._id,
        floorId: floor._id,
        veh_type: floor.veh_type,
        license_num: licenseNum,
        province,
        park_status: "Parking",
      });
      if (
        active &&
        (active.park_slot !== slot.number ||
          String(active.cameraPresetId) !== resolvedCameraPresetId ||
          active.parkingSlotName !== parkingSlotName)
      )
        return fail(res, 409, "Exit event does not match the active parking slot");
      if (!active) {
        if (!(await updateMapSlot(floor, slot, "available", eventTime)))
          return fail(res, 409, "Parking map changed; retry the event");
        return res.json({
          success: true,
          log: null,
          matchedVehicle: Boolean(vehicle),
        });
      }
      if (eventTime.getTime() < new Date(active.createdAt).getTime())
        return fail(res, 400, "Exit event is earlier than the parking event");
      const timestamp = getBangkokDateTime(eventTime);
      const log = await ParkingLog.findOneAndUpdate(
        { _id: active._id, park_status: "Parking" },
        {
          $set: {
            park_status: "Exited",
            date_exit: timestamp.date_add,
            exit_time: timestamp.time_add,
            updatedAt: eventTime,
          },
        },
        { returnDocument: "after", timestamps: false },
      );
      if (!log) return fail(res, 409, "Parking session changed; retry the event");
      if (!(await updateMapSlot(floor, slot, "available", eventTime)))
        return fail(res, 409, "Parking map changed; retry the event");
      return res.json({ success: true, log, matchedVehicle: Boolean(vehicle) });
    }

    const active = await ParkingLog.findOne({
      buildingId: building._id,
      floorId: floor._id,
      veh_type: floor.veh_type,
      license_num: licenseNum,
      province,
      park_status: "Parking",
    });
    if (active)
      return res.json({
        success: true,
        log: active,
        matchedVehicle: Boolean(vehicle),
        created: false,
      });
    const existing = await ParkingLog.findOne({
      buildingId: building._id,
      floorId: floor._id,
      veh_type: floor.veh_type,
      license_num: licenseNum,
      province,
      park_status: "Not parking",
      createdAt: { $gte: new Date(eventTime.getTime() - HISTORY_WINDOW_MS) },
    });
    if (existing)
      return res.json({
        success: true,
        log: existing,
        matchedVehicle: Boolean(vehicle),
        created: false,
      });
    const fields = getLogFields({
      vehicle,
      guestName: vehicle ? undefined : await getNextGuestName(),
      floor,
      building,
      cameraPresetId: resolvedCameraPresetId,
      slot: null,
      licenseNum,
      province,
      eventTime,
    });
    const log = await ParkingLog.create({
      ...fields,
      park_status: "Not parking",
      createdAt: eventTime,
      updatedAt: eventTime,
    });
    return res.status(201).json({
      success: true,
      log,
      matchedVehicle: Boolean(vehicle),
      created: true,
    });
  } catch (error) {
    if (error?.code === 11000)
      return fail(res, 409, "Vehicle already has an active parking session");
    console.error("Failed to process parking model event:", error);
    return fail(res, 500, "Failed to process parking model event");
  }
};

exports.updateModelSlotStatus = async (req, res) => {
  try {
    const {
      floorId,
      cameraPresetId,
      cameraNo,
      cctvFileName,
      parkingSlotName,
      slotStatus,
      licensePlateDetected,
    } = req.body || {};
    if (Boolean(floorId) !== Boolean(cameraPresetId))
      return fail(res, 400, "Provide both floor and CCTV preset ids");
    if (
      !["incoming", "occupied", "available"].includes(slotStatus) ||
      typeof parkingSlotName !== "string" ||
      !parkingSlotName.trim() ||
      (licensePlateDetected !== undefined && typeof licensePlateDetected !== "boolean")
    )
      return fail(res, 400, "Invalid model parking-slot status");

    const eventTime = getEventTime(req.body.occurredAt);
    if (!eventTime) return fail(res, 400, "Invalid event time");
    const binding = await resolveCameraPreset({
      floorId,
      cameraPresetId,
      cameraNo,
      cctvFileName,
    });
    if (binding.error) return fail(res, binding.error.status, binding.error.message);
    const { floor, camera } = binding;
    const categoryExists = (camera.parkingSlotData?.categories || []).some(
      (category) =>
        category?.supercategory === "parking-slot" &&
        category.name === parkingSlotName,
    );
    if (!categoryExists)
      return fail(res, 400, "Parking slot category does not belong to this CCTV preset");
    const result = getSlot(floor, String(camera._id), parkingSlotName);
    if (result.error) return fail(res, 404, result.error);
    if (
      !(await updateMapSlot(
        floor,
        result.slot,
        slotStatus,
        eventTime,
        licensePlateDetected,
      ))
    )
      return fail(res, 409, "Parking map changed; retry the slot status update");

    return res.json({
      success: true,
      parkingSlotName,
      slotStatus: result.slot.status === "disabled" ? "disabled" : slotStatus,
      licensePlateDetected:
        slotStatus === "occupied" && typeof licensePlateDetected === "boolean"
          ? licensePlateDetected
          : undefined,
    });
  } catch (error) {
    console.error("Failed to update model parking-slot status:", error);
    return fail(res, 500, "Failed to update parking-slot status");
  }
};
