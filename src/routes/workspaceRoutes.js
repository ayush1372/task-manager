import express from "express";
import { authenticate } from "../middlewares/authMiddleware.js";
import { workspaceController } from "../controllers/workspaceController.js";
import { projectController } from "../controllers/projectController.js";

const router = express.Router();

// Workspaces
router.post("/workspaces", authenticate, workspaceController.createWorkspace);
router.get("/workspaces", authenticate, workspaceController.getWorkspaces);
router.put("/workspaces/:id", authenticate, workspaceController.updateWorkspace);
router.delete("/workspaces/:id", authenticate, workspaceController.deleteWorkspace);

// Projects nested under workspace
router.post(
  "/workspaces/:workspaceId/projects",
  authenticate,
  projectController.createProject
);
router.get(
  "/workspaces/:workspaceId/projects",
  authenticate,
  projectController.getProjects
);

export default router;
