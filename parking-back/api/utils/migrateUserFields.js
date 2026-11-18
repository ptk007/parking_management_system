const User = require("../models/userModel");

async function migrateUserFields() {
  await User.collection.updateMany(
    {
      date_add: { $exists: true },
      $or: [{ date_updated: { $exists: false } }, { date_updated: null }],
    },
    { $rename: { date_add: "date_updated" } },
  );
  await User.collection.updateMany(
    {
      time_add: { $exists: true },
      $or: [{ time_updated: { $exists: false } }, { time_updated: null }],
    },
    { $rename: { time_add: "time_updated" } },
  );
  await User.collection.updateMany(
    {
      $or: [{ date_add: { $exists: true } }, { time_add: { $exists: true } }],
    },
    { $unset: { date_add: "", time_add: "" } },
  );
}

module.exports = migrateUserFields;
