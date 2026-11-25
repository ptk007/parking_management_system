const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "registration-integration-test-secret";

const app = require("../server");
const User = require("../api/models/userModel");
const database = `parking_registration_${randomUUID().replaceAll("-", "")}`;
const credentials = { name: "Parking User", username: "parking-user", password: "test-password" };
let server;

before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, {
    serverSelectionTimeoutMS: 3000,
  });
  await User.init();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === database) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

function post(path, body) {
  return fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

for (const [accountType, role] of [["public", "public"], ["student", "user"]]) {
  test(`${accountType} registration persists a hashed password and can log in`, async () => {
    const username = `new-${accountType}`;
    const response = await post("register", {
      ...credentials,
      username: ` ${username} `,
      accountType,
      role: "admin",
      status: "disable",
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { success: true });

    const saved = await User.findOne({ username }).select("+password");
    assert.equal(saved.role, role);
    assert.equal(saved.status, "offline");
    assert.notEqual(saved.password, credentials.password);

    const login = await post("login", { username, password: credentials.password });
    assert.equal(login.status, 200);
    const session = await login.json();
    assert.equal(session.user.role, role);
    assert.equal(session.user.password, undefined);
    assert.ok(session.token);
  });
}

test("rejects privileged account types and invalid registration fields", async () => {
  for (const fields of [
    { accountType: "staff" },
    { accountType: "admin" },
    { name: "   " },
    { username: { invalid: true } },
    { password: "short" },
    { password: "ก".repeat(25) },
  ]) {
    const response = await post("register", { ...credentials, accountType: "public", ...fields });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).success, false);
  }
  assert.equal(await User.exists({ username: credentials.username }), null);
});

test("a username can only be registered once across account types", async () => {
  const responses = await Promise.all([
    post("register", { ...credentials, username: "shared-name", accountType: "public" }),
    post("register", { ...credentials, username: "shared-name", accountType: "student" }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ username: "shared-name" }), 1);
});
