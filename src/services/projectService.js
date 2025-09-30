import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Create a project inside a workspace.
 * Only allowed if requester is the workspace creator (owner).
 */

export const projectService = {
  createProject: async ({ workspaceId, name, description }) => {
    return prisma.project.create({
      data: {
        name,
        description,
        workspaceId: Number(workspaceId),
      },
    });
  },

  /**
   * Get projects in a workspace accessible to the user:
   * - If workspace creator => return all projects
   * - Else return only projects where user has a membership
   */

  getProjectsForUser: async ({ workspaceId, userId }) => {
    const workspace = await prisma.workspace.findUnique({
      where: { id: Number(workspaceId) },
    });

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    if (workspace.creatorId === Number(userId)) {
      // creator sees all projects

      return prisma.project.findMany({
        where: { workspaceId: Number(workspaceId) },
        include: { memberships: true, tasks: { select: { id: true } } },
      });
    }

    // non-creator: return only projects where user is a member
    return prisma.project.findMany({
      where: {
        workspaceId: Number(workspaceId),
        memberships: { some: { userId: Number(userId) } },
      },
      include: { memberships: true, tasks: { select: { id: true } } },
    });
  },

  getProjectById: async (projectId) => {
    return prisma.project.findUnique({
      where: { id: Number(projectId) },
      include: { workspace: true, memberships: true },
    });
  },

  updateProject: async ({ projectId, data }) => {
    return prisma.project.update({
      where: { id: Number(projectId) },
      data,
    });
  },

  deleteProject: async ({ projectId }) => {
    return prisma.project.delete({
      where: { id: Number(projectId) },
    });
  },

  /**
   * Helper: check if a user is ADMIN in a project
   */
  isProjectAdmin: async ({ projectId, userId }) => {
    const membership = await prisma.membership.findFirst({
      where: { projectId: Number(projectId), userId: Number(userId) },
    });
    return membership && membership.role === "ADMIN";
  },
};
