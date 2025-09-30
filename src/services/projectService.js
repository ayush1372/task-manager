import { supabase } from "../config/supabase.js";

/**
 * Create a project inside a workspace.
 * Only allowed if requester is the workspace creator (owner).
 */
export const projectService = {
  createProject: async ({ workspaceId, name, description }) => {
    const { data, error } = await supabase
      .from("projects")
      .insert([{ name, description, workspaceId }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get projects in a workspace accessible to the user:
   * - If workspace creator => return all projects
   * - Else return only projects where user has a membership
   */
  getProjectsForUser: async ({ workspaceId, userId }) => {
    // Get workspace to check creator
    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();
    if (wsError || !workspace) throw new Error("Workspace not found");

    if (workspace.creatorId === Number(userId)) {
      // creator sees all projects
      const { data: projects, error } = await supabase
        .from("projects")
        .select("*, memberships(*), tasks(id)")
        .eq("workspaceId", workspaceId);
      if (error) throw new Error(error.message);
      return projects;
    }

    // non-creator: return only projects where user is a member
    const { data: memberships, error: memError } = await supabase
      .from("memberships")
      .select("projectId")
      .eq("userId", userId);
    if (memError) throw new Error(memError.message);

    const memberProjectIds = memberships?.map(m => m.projectId) || [];
    if (memberProjectIds.length === 0) return [];

    const { data: projects, error } = await supabase
      .from("projects")
      .select("*, memberships(*), tasks(id)")
      .eq("workspaceId", workspaceId)
      .in("id", memberProjectIds);
    if (error) throw new Error(error.message);
    return projects;
  },

  getProjectById: async (projectId) => {
    const { data: project, error } = await supabase
      .from("projects")
      .select("*, workspace(*), memberships(*)")
      .eq("id", projectId)
      .single();
    if (error) throw new Error(error.message);
    return project;
  },

  updateProject: async ({ projectId, data }) => {
    const { data: updated, error } = await supabase
      .from("projects")
      .update(data)
      .eq("id", projectId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  },

  deleteProject: async ({ projectId }) => {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);
    if (error) throw new Error(error.message);
    return;
  },

  /**
   * Helper: check if a user is ADMIN in a project
   */
  isProjectAdmin: async ({ projectId, userId }) => {
    const { data: membership, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("projectId", projectId)
      .eq("userId", userId)
      .single();
    if (error || !membership) return false;
    return membership.role === "ADMIN";
  },
};