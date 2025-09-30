import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { invitationController } from "../controllers/invitationController.js";

const router = express.Router();

// Invite flow (project-scoped) - only authenticated inviter
router.post("/projects/:projectId/invitations", authenticate, invitationController.createInvite);

// Verify invite token (public)
router.get("/invitations/verify", invitationController.verifyInvite);

//accept invite (existing logged in user)
router.post("/invitations/accept", authenticate, invitationController.acceptInviteForExistingUser);

// register new user and accept invite (public)
router.post("/invitations/register-and-accept", invitationController.registerAndAcceptInvite);

export default router; 