import { supabase } from "../config/supabase.js";

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
    // Find user by email
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();
    if (userError || !user) throw new Error("User with that email not found");

    // Check if membership already exists
    const { data: existing, error: existError } = await supabase
      .from("memberships")
      .select("*")
      .eq("projectId", Number(projectId))
      .eq("userId", user.id)
      .single();
    if (existing) throw new Error("User is already a member of this project");

    // Create membership
    const { data: membership, error: memError } = await supabase
      .from("memberships")
      .insert([{ projectId: Number(projectId), userId: user.id, role }])
      .select()
      .single();
    if (memError) throw new Error(memError.message);

    return { membership, user };
  },

  /**
   * List members for a project: returns array of { userId, name, email, role, membershipId, createdAt }
   */
  listMembers: async ({ projectId }) => {
    const { data: memberships, error } = await supabase
      .from("memberships")
      .select("*, user(id, name, email)")
      .eq("projectId", Number(projectId));
    if (error) throw new Error(error.message);

    return memberships.map((m) => ({
      membershipId: m.id,
      userId: m.user?.id,
      name: m.user?.name,
      email: m.user?.email,
      role: m.role,
      createdAt: m.createdAt,
    }));
  },

  /**
   * Update a membership's role (e.g., MEMBER -> ADMIN).
   */
  updateMemberRole: async ({ projectId, membershipId, role }) => {
    // Ensure membership belongs to project
    const { data: membership, error: memError } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", Number(membershipId))
      .single();
    if (memError || !membership || membership.projectId !== Number(projectId)) {
      throw new Error("Membership not found for this project");
    }

    const { data: updated, error: updError } = await supabase
      .from("memberships")
      .update({ role })
      .eq("id", Number(membershipId))
      .select()
      .single();
    if (updError) throw new Error(updError.message);

    return updated;
  },

  /**
   * Remove member from project by membership id
   */
  removeMember: async ({ projectId, membershipId }) => {
    // Ensure membership belongs to project
    const { data: membership, error: memError } = await supabase
      .from("memberships")
      .select("*")
      .eq("id", Number(membershipId))
      .single();
    if (memError || !membership || membership.projectId !== Number(projectId)) {
      throw new Error("Membership not found for this project");
    }

    const { error: delError } = await supabase
      .from("memberships")
      .delete()
      .eq("id", Number(membershipId));
    if (delError) throw new Error(delError.message);

    return;
  },
};