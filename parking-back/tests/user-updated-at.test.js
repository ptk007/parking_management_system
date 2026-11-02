const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../api/models/userModel");
const userController = require("../api/controllers/userController");

function response() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("new users get updated date and time initialized to their creation date and time", async (t) => {
  let createdUser;
  const user = { _id: "507f1f77bcf86cd799439011" };
  t.mock.method(User, "create", async (data) => {
    createdUser = data;
    return user;
  });
  t.mock.method(User, "findById", () => ({
    select: async () => user,
  }));

  const res = response();
  await userController.createUser({ body: {} }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.date_updated, createdUser.date_add);
  assert.equal(createdUser.time_updated, createdUser.time_add);
  assert.match(createdUser.date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(createdUser.time_updated, /^\d{2}:\d{2}:\d{2}$/);
});

test("user edits update date and time and include them in the returned user fields", async (t) => {
  const user = {
    _id: "507f1f77bcf86cd799439011",
    date_updated: "2000-01-01",
    time_updated: "00:00:00",
    save: async () => {},
  };
  let selectCalls = 0;
  t.mock.method(User, "findById", () => ({
    select: async (fields) => {
      selectCalls += 1;
      if (selectCalls === 1) {
        assert.equal(fields, "+password");
        return user;
      }
      assert.match(fields, /\bdate_updated\b/);
      assert.match(fields, /\btime_updated\b/);
      return user;
    },
  }));

  const res = response();
  await userController.updateUser(
    { params: { id: user._id }, body: { name: "Updated name" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(user.name, "Updated name");
  assert.match(user.date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(user.time_updated, /^\d{2}:\d{2}:\d{2}$/);
  assert.notEqual(user.date_updated, "2000-01-01");
});
