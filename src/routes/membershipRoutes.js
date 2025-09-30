// src/routes/membershipRoutes.js
import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { membershipController } from "../controllers/membershipController.js";

const router = express.Router();

/**
 * NOTE: endpoints are project-scoped :projectId
 * - POST   /projects/:projectId/members      -> add member by email
 * - GET    /projects/:projectId/members      -> list members
 * - PUT    /projects/:projectId/members/:memberId -> update role
 * - DELETE /projects/:projectId/members/:memberId -> remove member
 */

router.post("/projects/:projectId/members", authenticate, membershipController.addMember);
router.get("/projects/:projectId/members", authenticate, membershipController.listMembers);
router.put(
  "/projects/:projectId/members/:memberId",
  authenticate,
  membershipController.updateMemberRole
);
router.delete(
  "/projects/:projectId/members/:memberId",
  authenticate,
  membershipController.removeMember
);

export default router;
