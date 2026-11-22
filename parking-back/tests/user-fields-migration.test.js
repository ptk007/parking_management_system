const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const User = require("../api/models/userModel");
const migrateUserFields = require("../api/utils/migrateUserFields");
require("../api/routes/userRoutes");

test("user schema stores only updated timestamps", () => {
  assert.equal(User.schema.path("date_add"), undefined);
  assert.equal(User.schema.path("time_add"), undefined);
  assert.equal(User.schema.path("date_updated").instance, "String");
  assert.equal(User.schema.path("time_updated").instance, "String");
});

test("user startup migration renames old timestamps and removes legacy fields", async (t) => {
  const updateMany = t.mock.method(User.collection, "updateMany", async () => ({}));

  await migrateUserFields();

  assert.equal(updateMany.mock.callCount(), 3);
  assert.deepEqual(updateMany.mock.calls[0].arguments, [
    {
      date_add: { $exists: true },
      $or: [{ date_updated: { $exists: false } }, { date_updated: null }],
    },
    { $rename: { date_add: "date_updated" } },
  ]);
  assert.deepEqual(updateMany.mock.calls[1].arguments, [
    {
      time_add: { $exists: true },
      $or: [{ time_updated: { $exists: false } }, { time_updated: null }],
    },
    { $rename: { time_add: "time_updated" } },
  ]);
  assert.deepEqual(updateMany.mock.calls[2].arguments[1], {
    $unset: { date_add: "", time_add: "" },
  });
});

test("user image upload directory is created under images/user", async () => {
  const imageDirectory = path.resolve(__dirname, "../../images/user");
  const directory = await fs.stat(imageDirectory);
  assert.equal(directory.isDirectory(), true);
});
