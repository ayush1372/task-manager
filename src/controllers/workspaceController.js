import Joi from "joi";
import { workspaceService } from "../services/workspaceService.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
});

export const workspaceController = {
  createWorkspace: async (req, res) => {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const creatorId = req.user.userId;
      const workspace = await workspaceService.createWorkspace({
        name: value.name,
        creatorId,
      });
      return res.status(201).json(workspace);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getWorkspaces: async (req, res) => {
    try {
      const userId = req.user.userId;
      const workspaces = await workspaceService.getUserWorkspaces(userId);
      return res.json(workspaces);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  updateWorkspace: async (req, res) => {
    try {
      const workspaceId = Number(req.params.id);
      const { name } = req.body;
      const userId = req.user.userId;

      const workspace = await workspaceService.getWorkspaceById(workspaceId);
      if (!workspace) return res.status(404).json({ error: "Workspace not found" });

      if (workspace.creatorId !== Number(userId)) {
        return res.status(403).json({ error: "Not authorized to update workspace" });
      }

      const updated = await workspaceService.updateWorkspace({ workspaceId, name });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  deleteWorkspace: async (req, res) => {
    try {
      const workspaceId = Number(req.params.id);
      const userId = req.user.userId;

      const workspace = await workspaceService.getWorkspaceById(workspaceId);
      if (!workspace) return res.status(404).json({ error: "Workspace not found" });

      if (workspace.creatorId !== Number(userId)) {
        return res.status(403).json({ error: "Not authorized to delete workspace" });
      }

      await workspaceService.deleteWorkspace(workspaceId);

      return res.json({ message: "Workspace deleted" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};