const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const ParkingBuilding = require("../api/models/parkingBuildingModel");
const SourceFile = require("../api/models/parkingSourceFileModel");
const ParkingFloor = require("../api/models/parkingFloorModel");
const controller = require("../api/controllers/parkingBuildingController");

test("deleting a building removes its floors and stored files", async (t) => {
  t.mock.method(SourceFile, "exists", async () => false);
  const id = "507f1f77bcf86cd799439011";
  const removedFiles = [];
  const building = {
    _id: id,
    building_image: "images/parking_building/e4.jpg",
    deleteOne: t.mock.fn(async () => {}),
  };
  const floors = [
    { parking_slot_file: "json_file/parking_slots/e4-floor-1.json" },
    { parking_slot_file: "json_file/parking_slots/e4-floor-2.json" },
  ];

  t.mock.method(ParkingBuilding, "findById", async () => building);
  t.mock.method(ParkingFloor, "find", () => ({ select: async () => floors }));
  const deleteFloors = t.mock.method(ParkingFloor, "deleteMany", async () => ({}));
  t.mock.method(fs, "unlink", async (filePath) => removedFiles.push(filePath));

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await controller.deleteBuilding({ params: { id } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(deleteFloors.mock.callCount(), 1);
  assert.equal(deleteFloors.mock.calls[0].arguments[0].building, id);
  assert.equal(building.deleteOne.mock.callCount(), 1);
  assert.equal(removedFiles.length, 3);
  assert.ok(removedFiles.some((file) => file.endsWith("e4.jpg")));
  assert.ok(removedFiles.some((file) => file.endsWith("e4-floor-1.json")));
  assert.ok(removedFiles.some((file) => file.endsWith("e4-floor-2.json")));
});
