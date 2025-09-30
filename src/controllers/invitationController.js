import Joi from "joi";
import { invitationService } from "../services/invitationService.js";
import { projectService } from "../services/projectService.js";
import { workspaceService } from "../services/workspaceService.js";

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const inviteSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid("MEMBER", "ADMIN").default("MEMBER"),
});

// route: POST /api/projects/:projectId/invitations
export const invitationController = {
  createInvite: async (req, res) => {
    try {
      const { error, value } = inviteSchema.validate(req.body);
      if (error)
        return res.status(400).json({ error: error.details[0].message });

      const projectId = Number(req.params.projectId);
      const { email, role } = value;
      const requesterId = req.user.userId;

      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      // check permissions: workspace creator or project admin
      const workspace = await workspaceService.getWorkspaceById(
        project.workspaceId
      );
      const isWorkspaceCreator =
        workspace && workspace.creatorId === Number(requesterId);
      const isProjectAdmin = await projectService.isProjectAdmin({
        projectId,
        userId: requesterId,
      });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res
          .status(403)
          .json({ error: "Not authorized to invite users" });
      }

      // if user exists, create membership immediately
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // create membership if does not exist
        const existingMembership = await prisma.membership.findFirst({
          where: { projectId, userId: existingUser.id },
        });
        if (existingMembership)
          return res.status(400).json({ error: "User already a member" });

        const membership = await prisma.membership.create({
          data: { projectId, userId: existingUser.id, role },
        });

        return res
          .status(201)
          .json({ message: "User exists — added to project", membership });
      }

      // otherwise create invitation (and send email)
      const invite = await invitationService.createInvitation({
        projectId,
        inviterId: requesterId,
        email,
        role,
      });

      return res
        .status(201)
        .json({ message: "Invitation sent", invitationId: invite.id });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // GET /api/invitations/verify?token=...
  verifyInvite: async (req, res) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).json({ error: "token required" });

      const { invite, user } = await invitationService.verifyInviteToken({
        token,
      });

      // If user exists, frontend can call endpoint to accept (or log in then accept)
      return res.json({
        invite: {
          id: invite.id,
          email: invite.email,
          projectId: invite.projectId,
          role: invite.role,
          expiresAt: invite.expiresAt,
        },
        userExists: Boolean(user),
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // POST /api/invitations/accept  (for existing user)

  acceptInviteForExistingUser: async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "token required" });

      // user must be authenticated (because we attach membership to current user)
      const userId = req.user.userId;
      const result = await invitationService.acceptInviteForExistingUser({
        token,
        userId,
      });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  // POST /api/invitations/register-and-accept

  registerAndAcceptInvite: async (req, res) => {
    try {
      const schema = Joi.object({
        token: Joi.string().required(),
        name: Joi.string().min(2).required(),
        password: Joi.string().min(6).required(),
      });
      const { error, value } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
      const newUser = await invitationService.registerAndAcceptInvite({
        token: value.token,
        name: value.name,
        password: value.password,
      });

      // optionally auto-login: issue access & refresh tokens here (depends on your flow)
      return res
        .status(201)
        .json({
          message: "Registered and added to project",
          user: { id: newUser.id, email: newUser.email, name: newUser.name },
        });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
  },
};
