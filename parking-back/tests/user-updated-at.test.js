const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
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

test("new staff get date_updated and time_updated initialized at creation", async (t) => {
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
  await userController.createUser(
    {
      body: { name: "Staff One", username: "staff-one", password: "secret", role: "staff" },
      file: { filename: "staff-one.png" },
    },
    res,
  );

  assert.equal(res.statusCode, 201);
  assert.equal(createdUser.role, "staff");
  assert.equal(createdUser.user_image, "images/user/staff-one.png");
  assert.equal(createdUser.date_add, undefined);
  assert.equal(createdUser.time_add, undefined);
  assert.match(createdUser.date_updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(createdUser.time_updated, /^\d{2}:\d{2}:\d{2}$/);
});

test("user edits update date and time and include them in the returned user fields", async (t) => {
  const user = {
    _id: "507f1f77bcf86cd799439011",
    role: "staff",
    status: "disable",
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

test("a staff profile cannot be edited until the account is disabled", async (t) => {
  const user = {
    _id: "507f1f77bcf86cd799439011",
    role: "staff",
    status: "offline",
    save: async () => assert.fail("an active staff profile must not be saved"),
  };
  t.mock.method(User, "findById", () => ({ select: async () => user }));

  const res = response();
  await userController.updateUser(
    { params: { id: user._id }, body: { name: "Updated name" } },
    res,
  );

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /only be edited while its status is disable/);
});

test("JWT middleware rejects staff accounts disabled after login", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "user-middleware-test-secret";
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const userId = "507f1f77bcf86cd799439011";
  const token = jwt.sign({ userId, role: "staff" }, process.env.JWT_SECRET);
  t.mock.method(User, "findById", () => ({ select: async () => ({ status: "disable" }) }));
  let nextCalled = false;
  const req = { get: () => `Bearer ${token}` };
  const res = response();

  await userController.requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.match(res.body.message, /disabled user/);
});
