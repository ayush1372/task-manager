import Joi from "joi";
import { projectService } from "../services/projectService.js";
import { workspaceService } from "../services/workspaceService.js";

const createSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow("", null),
});

export const projectController = {
  createProject: async (req, res) => {
    try {
      const { error, value } = createSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });

      const workspaceId = Number(req.params.workspaceId);
      const userId = req.user.userId;

      const workspace = await workspaceService.getWorkspaceById(workspaceId);
      if (!workspace) return res.status(404).json({ error: "Workspace not found" });

      // Only workspace creator can create projects
      if (workspace.creatorId !== Number(userId)) {
        return res.status(403).json({ error: "Not authorized to create project" });
      }

      const project = await projectService.createProject({
        workspaceId,
        name: value.name,
        description: value.description,
      });

      return res.status(201).json(project);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  getProjects: async (req, res) => {
    try {
      const workspaceId = Number(req.params.workspaceId);
      const userId = req.user.userId;

      const projects = await projectService.getProjectsForUser({ workspaceId, userId });
      return res.json(projects);
    } catch (err) {
      // if workspace not found, service throws error -> handle accordingly
      if (err.message === "Workspace not found") return res.status(404).json({ error: err.message });
      return res.status(500).json({ error: err.message });
    }
  },

  updateProject: async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const userId = req.user.userId;
      const { name, description } = req.body;

      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const isWorkspaceCreator = project.workspace.creatorId === Number(userId);
      const isProjectAdmin = await projectService.isProjectAdmin({ projectId, userId });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res.status(403).json({ error: "Not authorized to update project" });
      }

      const updated = await projectService.updateProject({
        projectId,
        data: { name, description },
      });
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  deleteProject: async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const userId = req.user.userId;
      
      console.log("hhhhhhhhhhhhhhhhhhhhhh");
      const project = await projectService.getProjectById(projectId);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const isWorkspaceCreator = project.workspace.creatorId === Number(userId);
      const isProjectAdmin = await projectService.isProjectAdmin({ projectId, userId });

      if (!isWorkspaceCreator && !isProjectAdmin) {
        return res.status(403).json({ error: "Not authorized to delete project" });
      }

      await projectService.deleteProject({ projectId });
      return res.json({ message: "Project deleted" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
