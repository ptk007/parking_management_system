const { randomBytes } = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/userModel");
const Ticket = require("../models/supportTicketModel");

const isSupport = (req) => req.supportUser.role === "staff";
const idOf = (value) => String(value?._id || value || "");
const populate = (query) =>
  query.populate("owner assignedSupport", "name username");
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });
const textField = (value, max, required = true) =>
  typeof value === "string" &&
  (!required || value.trim().length > 0) &&
  value.trim().length <= max;

function ticketFilter(req) {
  return {
    _id: req.params.id,
    ...(isSupport(req) ? {} : { owner: req.supportUser._id }),
  };
}

function formatTicket(ticket, viewerId, includeMessages = false) {
  const lastRead = ticket.readAt?.get(String(viewerId)) || new Date(0);
  const participant = (user) =>
    user
      ? { _id: idOf(user), name: user.name || user.username || "User" }
      : null;
  return {
    _id: idOf(ticket),
    ticketNumber: ticket.ticketNumber,
    owner: participant(ticket.owner),
    assignedSupport: participant(ticket.assignedSupport),
    subject: ticket.subject,
    category: ticket.category,
    location: ticket.location,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastMessage: ticket.messages.at(-1) || null,
    unreadCount: ticket.messages.filter(
      (message) =>
        idOf(message.sender) !== String(viewerId) &&
        message.timestamp > lastRead,
    ).length,
    ...(includeMessages ? { messages: ticket.messages } : {}),
  };
}

exports.requireParticipant = async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.auth?.userId))
    return fail(res, 401, "กรุณาเข้าสู่ระบบใหม่");
  const user = await User.findById(req.auth.userId).select(
    "name username role status",
  );
  if (!user || user.status === "disable")
    return fail(res, 401, "บัญชีนี้ไม่สามารถใช้งานได้");
  req.supportUser = user;
  next();
};

exports.validateTicketId = (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return fail(res, 404, "ไม่พบเรื่องที่ต้องการ");
  next();
};

exports.listTickets = async (req, res) => {
  const filter = isSupport(req) ? {} : { owner: req.supportUser._id };
  const tickets = await populate(Ticket.find(filter).sort({ updatedAt: -1 }));
  res.json({
    tickets: tickets.map((ticket) => formatTicket(ticket, req.supportUser._id)),
  });
};

exports.getTicket = async (req, res) => {
  const ticket = await populate(Ticket.findOne(ticketFilter(req)));
  if (!ticket) return fail(res, 404, "ไม่พบเรื่องที่ต้องการ");
  res.json({ ticket: formatTicket(ticket, req.supportUser._id, true) });
};

exports.createTicket = async (req, res) => {
  if (isSupport(req))
    return fail(res, 403, "บัญชี Staff ใช้สำหรับรับเรื่องและตอบกลับ");
  const {
    subject,
    message,
    category = "parking",
    location = "",
  } = req.body || {};
  if (
    !textField(subject, 120) ||
    !textField(message, 4000) ||
    !textField(location, 120, false) ||
    !["parking", "vehicle", "account", "other"].includes(category)
  ) {
    return fail(
      res,
      400,
      "กรุณากรอกหัวข้อและรายละเอียดปัญหาให้ครบถ้วนและไม่เกินจำนวนตัวอักษรที่กำหนด",
    );
  }
  const timestamp = new Date();
  const ticket = await Ticket.create({
    ticketNumber: `SUP-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`,
    owner: req.supportUser._id,
    subject: subject.trim(),
    category,
    location: location.trim(),
    messages: [
      {
        sender: req.supportUser._id,
        senderName: req.supportUser.name || req.supportUser.username,
        senderType: "user",
        message: message.trim(),
        timestamp,
      },
    ],
    readAt: { [String(req.supportUser._id)]: timestamp },
  });
  await populate(ticket);
  res
    .status(201)
    .json({ ticket: formatTicket(ticket, req.supportUser._id, true) });
};

exports.claimTicket = async (req, res) => {
  if (!isSupport(req))
    return fail(res, 403, "เฉพาะ Staff เท่านั้นที่รับเรื่องได้");
  const ticket = await populate(
    Ticket.findOneAndUpdate(
      { _id: req.params.id, status: "open", assignedSupport: null },
      { $set: { assignedSupport: req.supportUser._id, status: "in_progress" } },
      { returnDocument: "after" },
    ),
  );
  if (!ticket)
    return fail(
      res,
      409,
      "เรื่องนี้มีผู้รับดูแลแล้วหรือถูกปิดแล้ว กรุณารีเฟรชรายการ",
    );
  res.json({ ticket: formatTicket(ticket, req.supportUser._id, true) });
};

exports.sendMessage = async (req, res) => {
  const { message } = req.body || {};
  if (!textField(message, 4000))
    return fail(res, 400, "กรุณาพิมพ์ข้อความไม่เกิน 4,000 ตัวอักษร");
  const ticket = await Ticket.findOne(ticketFilter(req));
  if (!ticket) return fail(res, 404, "ไม่พบเรื่องที่ต้องการ");
  if (ticket.status === "done")
    return fail(
      res,
      409,
      "เรื่องนี้ปิดแล้ว กรุณาเปิดเรื่องอีกครั้งก่อนส่งข้อความ",
    );
  if (
    isSupport(req) &&
    idOf(ticket.assignedSupport) !== idOf(req.supportUser)
  ) {
    return fail(
      res,
      403,
      "กรุณารับเรื่องก่อนตอบกลับ หรือให้ Staff ที่รับเรื่องเป็นผู้ตอบ",
    );
  }
  const updated = await populate(
    Ticket.findOneAndUpdate(
      {
        ...ticketFilter(req),
        status: { $ne: "done" },
        ...(isSupport(req) ? { assignedSupport: req.supportUser._id } : {}),
      },
      {
        $push: {
          messages: {
            sender: req.supportUser._id,
            senderName: req.supportUser.name || req.supportUser.username,
            senderType: isSupport(req) ? "support" : "user",
            message: message.trim(),
            timestamp: new Date(),
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    ),
  );
  if (!updated)
    return fail(res, 409, "สถานะเรื่องเปลี่ยนแล้ว กรุณารีเฟรชก่อนส่งข้อความ");
  res
    .status(201)
    .json({ ticket: formatTicket(updated, req.supportUser._id, true) });
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body || {};
  if (!["open", "done"].includes(status))
    return fail(res, 400, "สถานะไม่ถูกต้อง");
  const ticket = await Ticket.findOne(ticketFilter(req));
  if (!ticket) return fail(res, 404, "ไม่พบเรื่องที่ต้องการ");
  if (
    status === "done" &&
    (!isSupport(req) || idOf(ticket.assignedSupport) !== idOf(req.supportUser))
  ) {
    return fail(res, 403, "เฉพาะ Staff ที่รับเรื่องเท่านั้นที่ปิดเรื่องได้");
  }
  if (
    status === "open" &&
    isSupport(req) &&
    idOf(ticket.assignedSupport) !== idOf(req.supportUser)
  ) {
    return fail(
      res,
      403,
      "เฉพาะเจ้าของเรื่องหรือ Staff ที่รับเรื่องเท่านั้นที่เปิดเรื่องอีกครั้งได้",
    );
  }
  const expectedStatus = status === "open" ? "done" : "in_progress";
  const updated = await populate(
    Ticket.findOneAndUpdate(
      {
        ...ticketFilter(req),
        status: expectedStatus,
        ...(isSupport(req) ? { assignedSupport: req.supportUser._id } : {}),
      },
      {
        $set: {
          status,
          ...(status === "open" ? { assignedSupport: null } : {}),
        },
      },
      { returnDocument: "after" },
    ),
  );
  if (!updated)
    return fail(res, 409, "สถานะเรื่องเปลี่ยนแล้ว กรุณารีเฟรชรายการ");
  res.json({ ticket: formatTicket(updated, req.supportUser._id, true) });
};

exports.markRead = async (req, res) => {
  const ticket = await Ticket.findOne(ticketFilter(req));
  if (!ticket) return fail(res, 404, "ไม่พบเรื่องที่ต้องการ");
  const message = ticket.messages.id(req.body?.messageId);
  if (!message) return fail(res, 400, "ไม่พบข้อความที่อ่าน");
  await Ticket.updateOne(
    ticketFilter(req),
    { $max: { [`readAt.${req.supportUser._id}`]: message.timestamp } },
    { timestamps: false },
  );
  res.json({ success: true });
};
