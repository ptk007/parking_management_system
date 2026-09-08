// Runs against a fresh, disposable database on the local MongoDB instance.
const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("node:crypto");

process.env.JWT_SECRET = "support-integration-test-only";
const app = require("../server");
const User = require("../api/models/userModel");
const Ticket = require("../api/models/supportTicketModel");
const database = `parking_support_test_${randomUUID().replaceAll("-", "")}`;
const actors = {};
let server;
let origin;

before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${database}`, {
    serverSelectionTimeoutMS: 3000,
  });
  for (const [name, role] of [
    ["owner", "user"],
    ["other", "user"],
    ["staff", "staff"],
    ["staff2", "staff"],
    ["admin", "admin"],
    ["disabled", "staff"],
  ]) {
    const _id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      _id,
      username: name,
      name,
      role,
      status: name === "disabled" ? "disable" : "online",
    });
    actors[name] = {
      _id,
      token: jwt.sign({ userId: String(_id), role }, process.env.JWT_SECRET),
    };
  }
  await Ticket.init();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  origin = `http://127.0.0.1:${server.address().port}/api/support`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (
    mongoose.connection.readyState === 1 &&
    mongoose.connection.name === database &&
    database.startsWith("parking_support_test_")
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function request(actor, route, method = "GET", data) {
  const response = await fetch(origin + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(actor ? { Authorization: `Bearer ${actors[actor].token}` } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

async function create() {
  const result = await request("owner", "/tickets", "POST", {
    subject: "Parking assistance",
    category: "parking",
    location: "E4 floor 4",
    message: "Please help me check my parking registration.",
  });
  assert.equal(result.status, 201);
  return result.body.ticket;
}

test("creates a persisted ticket using the authenticated owner and validates inputs", async () => {
  const ticket = await create();
  assert.equal(ticket.owner._id, String(actors.owner._id));
  assert.equal(ticket.status, "open");
  assert.equal(ticket.messages.length, 1);
  assert.equal(ticket.unreadCount, 0);
  assert.equal((await Ticket.findById(ticket._id)).messages.length, 1);
  assert.equal(
    (
      await request("owner", "/tickets", "POST", {
        subject: " ",
        message: "hello",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("owner", "/tickets", "POST", {
        subject: "Hello",
        message: "x".repeat(4001),
      })
    ).status,
    400,
  );
});

test("only the owner and Staff can access a conversation, including direct IDs", async () => {
  const ticket = await create();
  for (const actor of ["other", "admin"]) {
    assert.equal((await request(actor, "/tickets")).body.tickets.length, 0);
    assert.equal((await request(actor, `/tickets/${ticket._id}`)).status, 404);
    assert.equal(
      (
        await request(actor, `/tickets/${ticket._id}/messages`, "POST", {
          message: "unauthorized",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(actor, `/tickets/${ticket._id}/read`, "POST", {
          messageId: ticket.messages[0]._id,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request(actor, `/tickets/${ticket._id}/status`, "PATCH", {
          status: "open",
        })
      ).status,
      404,
    );
  }
  assert.equal((await request("staff", `/tickets/${ticket._id}`)).status, 200);
});

test("only Staff may claim; concurrent claims select exactly one assignee", async () => {
  const ticket = await create();
  for (const actor of ["owner", "admin"])
    assert.equal(
      (await request(actor, `/tickets/${ticket._id}/claim`, "POST")).status,
      403,
    );
  const claims = await Promise.all(
    ["staff", "staff2"].map((actor) =>
      request(actor, `/tickets/${ticket._id}/claim`, "POST"),
    ),
  );
  assert.deepEqual(claims.map((item) => item.status).sort(), [200, 409]);
  const saved = await Ticket.findById(ticket._id);
  assert.equal(saved.status, "in_progress");
  assert.ok(saved.assignedSupport);
});

test("both participants can chat, while an unassigned Staff cannot reply", async () => {
  const ticket = await create();
  assert.equal(
    (
      await request("staff", `/tickets/${ticket._id}/messages`, "POST", {
        message: "before claim",
      })
    ).status,
    403,
  );
  await request("staff", `/tickets/${ticket._id}/claim`, "POST");
  assert.equal(
    (
      await request("staff2", `/tickets/${ticket._id}/messages`, "POST", {
        message: "not my ticket",
      })
    ).status,
    403,
  );
  await request("owner", `/tickets/${ticket._id}/messages`, "POST", {
    message: "More details",
  });
  const reply = await request(
    "staff",
    `/tickets/${ticket._id}/messages`,
    "POST",
    {
      message: "I am checking this for you.",
      sender: actors.admin._id,
      senderType: "user",
    },
  );
  assert.equal(reply.status, 201);
  assert.equal(reply.body.ticket.messages.length, 3);
  assert.equal(reply.body.ticket.messages[2].sender, String(actors.staff._id));
  assert.equal(reply.body.ticket.messages[2].senderType, "support");
  assert.equal(
    (
      await request("owner", `/tickets/${ticket._id}/messages`, "POST", {
        message: " ",
      })
    ).status,
    400,
  );
});

test("only the assigned Staff resolves a ticket; the owner can reopen it", async () => {
  const ticket = await create();
  await request("staff", `/tickets/${ticket._id}/claim`, "POST");
  for (const actor of ["owner", "staff2"])
    assert.equal(
      (
        await request(actor, `/tickets/${ticket._id}/status`, "PATCH", {
          status: "done",
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await request("staff", `/tickets/${ticket._id}/status`, "PATCH", {
        status: "done",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request("owner", `/tickets/${ticket._id}/messages`, "POST", {
        message: "closed message",
      })
    ).status,
    409,
  );
  const reopened = await request(
    "owner",
    `/tickets/${ticket._id}/status`,
    "PATCH",
    { status: "open" },
  );
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.ticket.status, "open");
  assert.equal(reopened.body.ticket.assignedSupport, null);
  assert.equal(
    (await request("staff2", `/tickets/${ticket._id}/claim`, "POST")).status,
    200,
  );
});

test("tracks unread messages per viewer without marking later messages read", async () => {
  const ticket = await create();
  await request("staff", `/tickets/${ticket._id}/claim`, "POST");
  const initial = await request("staff", `/tickets/${ticket._id}`);
  assert.equal(initial.body.ticket.unreadCount, 1);
  await request("owner", `/tickets/${ticket._id}/messages`, "POST", {
    message: "Another detail",
  });
  const beforeRead = await Ticket.findById(ticket._id);
  await request("staff", `/tickets/${ticket._id}/read`, "POST", {
    messageId: ticket.messages[0]._id,
  });
  const afterRead = await request("staff", `/tickets/${ticket._id}`);
  assert.equal(afterRead.body.ticket.unreadCount, 1);
  assert.equal(
    afterRead.body.ticket.updatedAt,
    beforeRead.updatedAt.toISOString(),
  );
  await request("staff", `/tickets/${ticket._id}/read`, "POST", {
    messageId: afterRead.body.ticket.messages.at(-1)._id,
  });
  assert.equal(
    (await request("staff", `/tickets/${ticket._id}`)).body.ticket.unreadCount,
    0,
  );
  await request("staff", `/tickets/${ticket._id}/messages`, "POST", {
    message: "Support response",
  });
  assert.equal(
    (await request("owner", `/tickets/${ticket._id}`)).body.ticket.unreadCount,
    1,
  );
});

test("checks current database roles and rejects disabled or unauthenticated accounts", async () => {
  assert.equal((await request(null, "/tickets")).status, 401);
  assert.equal((await request("disabled", "/tickets")).status, 401);
  const ticket = await create();
  await User.collection.updateOne(
    { _id: actors.staff2._id },
    { $set: { role: "user" } },
  );
  assert.equal(
    (await request("staff2", `/tickets/${ticket._id}/claim`, "POST")).status,
    403,
  );
  assert.equal((await request("owner", "/tickets/invalid-id")).status, 404);
});
