import Joi from "joi";
import { projectService } from "../services/projectService.js";
import { workspaceService } from "../services/workspaceService.js";
import { invitationService } from "../services/invitationService.js";
import { membershipService } from "../services/membershipService.js";
import { supabase } from "../config/supabase.js";

const inviteSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid("MEMBER", "ADMIN").default("MEMBER"),
});

export const invitationController = {
  createInvite: async (req, res) => {
    try {
      const { error, value } = inviteSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const projectId = Number(req.params.projectId);
      const { email, role } = value;
      const requesterId = req.user.userId;

      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      // check permissions: workspace creator or project admin
      const workspace = await workspaceService.getWorkspaceById(project.workspaceId);
      const isWorkspaceCreator = workspace && workspace.creatorId === Number(requesterId);
      const isProjectAdmin = await projectService.isProjectAdmin({
        projectId,
        userId: requesterId,
      });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res.status(403).json({ error: "Not authorized to invite members" });
      }

      // if user exists, create membership immediately
      const { data: existingUser } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (existingUser) {
        // Check if already a member
        const { data: existingMembership } = await supabase
          .from("memberships")
          .select("*")
          .eq("projectId", projectId)
          .eq("userId", existingUser.id)
          .single();

        if (existingMembership) {
          return res.status(400).json({ error: "User is already a member of this project" });
        }

        // Add membership directly
        const { membership } = await membershipService.addMemberByEmail({
          projectId,
          email,
          role,
        });

        return res.status(201).json({
          message: "User already registered, added to project",
          membership: {
            id: membership.id,
            userId: existingUser.id,
            projectId: membership.projectId,
            role: membership.role,
            createdAt: membership.createdAt,
          },
        });
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
      if (!token) return res.status(400).json({ error: "Token required" });

      const { invite, user } = await invitationService.verifyInviteToken({ token });

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
      if (!token) return res.status(400).json({ error: "Token required" });

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
      const { token, name, password } = req.body;
      if (!token || !name || !password) {
        return res.status(400).json({ error: "Token, name, and password required" });
      }
      const user = await invitationService.registerAndAcceptInvite({ token, name, password });
      return res.status(201).json({ message: "User registered and added to project", user });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};