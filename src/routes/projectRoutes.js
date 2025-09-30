

import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { projectController } from "../controllers/projectController.js";

const router = express.Router();

// Create a new project inside a workspace
router.post(
  "/workspaces/:workspaceId/projects",
  authenticate,
  projectController.createProject
);

// Get all projects in a workspace
router.get(
  "/workspaces/:workspaceId/projects",
  authenticate,
  projectController.getProjects
);

// // Get single project by ID
// router.get(
//   "/projects/:id",
//   authenticate,
//   projectController.getProjectById
// );

// Update a project
router.put(
  "/projects/:id",
  authenticate,
  projectController.updateProject
);

// Delete a project
router.delete(
  "/projects/:id",
  authenticate,
  projectController.deleteProject
);

export default router;

