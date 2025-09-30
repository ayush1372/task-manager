import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const workspaceService = {
  // Creates a workspace and returns it
  //Also does NOT automatically create memberships (we use project-level memberships).
  createWorkspace: async ({ name, creatorId }) => {
    return prisma.workspace.create({
      data: {
        name,
        creatorId,
      },
    });
  },

  /**
   * Get workspaces where user is either the creator,
   * or a member of at least one project inside the workspace.
   */

  getUserWorkspaces: async (userId) => {
    return prisma.workspace.findMany({
      where: {
        OR: [
          { creatorId: userId },
          {
            // workspace has projects that have memberships for user
            projects: {
              some: {
                memberships: {
                  some: { userId },
                },
              },
            },
          },
        ],
      },
      include: {
        // include shallow project info (no heavy nested data)
        projects: { select: { id: true, name: true } },
      },
    });
  },

  getWorkspaceById: async(workspaceId) =>{
    return prisma.workspace.findUnique({
        where:{id:workspaceId},
    })
  },

  updateWorkspace: async({workspaceId,name})=>{
    return prisma.workspace.update({
        where:{id:Number(workspaceId)},
        data:{name}
    });
  },

  deleteWorkspace: async(workspaceId)=>{
      
    return prisma.workspace.delete({
        where:{id:Number(workspaceId)},
  });
  },

};
