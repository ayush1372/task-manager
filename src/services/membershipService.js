// src/services/membershipService.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
/**
 * membershipService:
 * - addMemberByEmail
 * - listMembers
 * - updateMemberRole
 * - removeMember
 */

export const membershipService = {
  /**
   * Add a user to a project by their email.
   * Throws if user doesn't exist, or membership already exists.
   */
  addMemberByEmail: async ({ projectId, email, role = "MEMBER" }) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("User with that email not found");

    // ensure membership not already exist
    const existing = await prisma.membership.findFirst({
      where: { projectId: Number(projectId), userId: user.id },
    }); 
    
    if (existing) throw new Error("User is already a member of this project");
    
    const membership = await prisma.membership.create({
      data: {
        projectId: Number(projectId),
        userId: user.id,
        role,
      },
    });
    
    return { membership, user };
  },

  /**
   * List members for a project: returns array of { userId, name, email, role, membershipId, createdAt }
   */
  listMembers: async ({ projectId }) => {
    const members = await prisma.membership.findMany({
      where: { projectId: Number(projectId) },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return members.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt,
    }));
  },

  /**
   * Update a membership's role (e.g., MEMBER -> ADMIN).
   */
  updateMemberRole: async ({ projectId, membershipId, role }) => {
    // ensure membership belongs to project
    const membership = await prisma.membership.findUnique({ where: { id: Number(membershipId) } });
    if (!membership || membership.projectId !== Number(projectId)) {
      throw new Error("Membership not found for this project");
    }

    const updated = await prisma.membership.update({
      where: { id: Number(membershipId) },
      data: { role },
    });

    return updated;
  },

  /**
   * Remove member from project by membership id
   */
  removeMember: async ({ projectId, membershipId }) => {
    const membership = await prisma.membership.findUnique({ where: { id: Number(membershipId) } });
    if (!membership || membership.projectId !== Number(projectId)) {
      throw new Error("Membership not found for this project");
    }

    await prisma.membership.delete({ where: { id: Number(membershipId) } });
    return;
  },
};
