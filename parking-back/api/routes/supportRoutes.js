const express = require("express");
const { requireAuth } = require("../controllers/userController");
const support = require("../controllers/supportController");

const router = express.Router();
router.use(requireAuth, support.requireParticipant);
router.get("/tickets", support.listTickets);
router.post("/tickets", support.createTicket);
router.use("/tickets/:id", support.validateTicketId);
router.get("/tickets/:id", support.getTicket);
router.post("/tickets/:id/messages", support.sendMessage);
router.post("/tickets/:id/claim", support.claimTicket);
router.patch("/tickets/:id/status", support.updateStatus);
router.post("/tickets/:id/read", support.markRead);

module.exports = router;
