const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderName: { type: String, required: true },
  senderType: { type: String, enum: ["user", "support"], required: true },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  timestamp: { type: Date, default: Date.now },
});

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, required: true, unique: true },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["parking", "vehicle", "account", "other"],
      default: "parking",
    },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    status: {
      type: String,
      enum: ["open", "in_progress", "done"],
      default: "open",
    },
    assignedSupport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    messages: { type: [messageSchema], default: [] },
    readAt: { type: Map, of: Date, default: () => ({}) },
  },
  { collection: "support_ticket", timestamps: true, versionKey: false },
);

ticketSchema.index({ owner: 1, updatedAt: -1 });
ticketSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("SupportTicket", ticketSchema);
