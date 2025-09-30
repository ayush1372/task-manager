// src/controllers/membershipController.js
import Joi from "joi";
import { membershipService } from "../services/membershipService.js";
import { projectService } from "../services/projectService.js";
import { workspaceService } from "../services/workspaceService.js";

/**
 * Controller responsibilities:
 * - validate input
 * - enforce auth/ownership: workspace creator or project admin for admin actions
 * - call service methods
 */

/* Validation schemas */
const addSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid("MEMBER", "ADMIN").default("MEMBER"),
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid("MEMBER", "ADMIN").required(),
});

export const membershipController = {
  /**
   * POST /projects/:projectId/members
   * Body: { email, role }
   * Auth: workspace creator OR project admin
   */
  addMember: async (req, res) => {
    try {
      const { error, value } = addSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const projectId = Number(req.params.projectId);
      const { email, role } = value;
      const requesterId = req.user.userId;

      // load project (includes workspace)
      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      // allow if workspace creator
      const workspace = await workspaceService.getWorkspaceById(project.workspaceId);
      const isWorkspaceCreator = workspace && workspace.creatorId === Number(requesterId);

      // or project admin
      const isProjectAdmin = await projectService.isProjectAdmin({ projectId, userId: requesterId });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res.status(403).json({ error: "Not authorized to add members" });
      }

      const { membership, user } = await membershipService.addMemberByEmail({
        projectId,
        email,
        role,
      });

      return res.status(201).json({
        message: "User added to project",
        membership: {
          id: membership.id,
          userId: user.id,
          projectId: membership.projectId,
          role: membership.role,
          createdAt: membership.createdAt,
        },
      });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  /**
   * GET /projects/:projectId/members
   * Auth: must be a member (or workspace creator)
   */
  listMembers: async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const requesterId = req.user.userId;

      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      // workspace creator can see
      const workspace = await workspaceService.getWorkspaceById(project.workspaceId);
      const isWorkspaceCreator = workspace && workspace.creatorId === Number(requesterId);

      // or project member
      const isMember = await projectService.getProjectById(projectId) // already includes memberships in getProjectById
        .then((p) => (p ? p.memberships.some((m) => m.userId === Number(requesterId)) : false));

      if (!isWorkspaceCreator && !isMember) {
        return res.status(403).json({ error: "Not authorized to view members" });
      }

      const members = await membershipService.listMembers({ projectId });
      return res.json({ members });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  /**
   * PUT /projects/:projectId/members/:membershipId
   * Body: { role }
   * Auth: project admin or workspace creator
   */
  updateMemberRole: async (req, res) => {
    try {
      const { error, value } = updateRoleSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const projectId = Number(req.params.projectId);
      const membershipId = Number(req.params.memberId);
      const requesterId = req.user.userId;

      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const workspace = await workspaceService.getWorkspaceById(project.workspaceId);
      const isWorkspaceCreator = workspace && workspace.creatorId === Number(requesterId);
      const isProjectAdmin = await projectService.isProjectAdmin({ projectId, userId: requesterId });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res.status(403).json({ error: "Not authorized to update member roles" });
      }

      const updated = await membershipService.updateMemberRole({
        projectId,
        membershipId,
        role: value.role,
      });

      return res.json({ message: "Member role updated", membership: updated });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },

  /**
   * DELETE /projects/:projectId/members/:membershipId
   * Auth: project admin or workspace creator
   */
  removeMember: async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const membershipId = Number(req.params.memberId);
      const requesterId = req.user.userId;

      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const workspace = await workspaceService.getWorkspaceById(project.workspaceId);
      const isWorkspaceCreator = workspace && workspace.creatorId === Number(requesterId);
      const isProjectAdmin = await projectService.isProjectAdmin({ projectId, userId: requesterId });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res.status(403).json({ error: "Not authorized to remove members" });
      }

      await membershipService.removeMember({ projectId, membershipId });
      return res.json({ message: "Member removed from project" });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
};
