const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const migrateParkingBuildingFields = require("../api/utils/migrateParkingBuildingFields");

const database = `parking_building_migration_${randomUUID().replaceAll("-", "")}`;
let collection;

before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, {
    serverSelectionTimeoutMS: 3000,
  });
  collection = mongoose.connection.collection("parking_building");
});

after(async () => {
  if (
    mongoose.connection.readyState === 1 &&
    mongoose.connection.name === database &&
    database.startsWith("parking_building_migration_")
  ) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

test("migrates existing building documents and removes legacy fields", async () => {
  await collection.insertMany([
    {
      _id: new mongoose.Types.ObjectId(),
      building_name: "legacy",
      building_image: null,
      building_status: "available",
      date_add: "2026-06-29",
      time_add: "11:00:00",
    },
    {
      _id: new mongoose.Types.ObjectId(),
      building_name: "already-updated",
      building_image: null,
      building_status: "disable",
      date_add: "2026-01-01",
      time_add: "01:00:00",
      date_updated: "2026-11-02",
      time_updated: "10:00:00",
    },
  ]);

  await migrateParkingBuildingFields();

  const buildings = await collection.find().toArray();
  const legacy = buildings.find((building) => building.building_name === "legacy");
  const updated = buildings.find(
    (building) => building.building_name === "already-updated",
  );
  assert.equal(legacy.date_updated, "2026-06-29");
  assert.equal(legacy.time_updated, "11:00:00");
  assert.equal(updated.date_updated, "2026-11-02");
  assert.equal(updated.time_updated, "10:00:00");
  for (const building of buildings) {
    assert.equal("building_status" in building, false);
    assert.equal("date_add" in building, false);
    assert.equal("time_add" in building, false);
  }
});
