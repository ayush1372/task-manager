import { supabase } from "../config/supabase.js";

export const workspaceService = {
  createWorkspace: async ({ name, creatorId }) => {
    const { data, error } = await supabase
      .from('workspaces')
      .insert([{ name, creatorId }])
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  getUserWorkspaces: async (userId) => {
    // Get workspaces where user is creator or member of a project
    const { data: created, error: err1 } = await supabase
      .from('workspaces')
      .select('*, projects(id, name)')
      .eq('creatorId', userId);

    const { data: memberships, error: err2 } = await supabase
      .from('memberships')
      .select('projectId')
      .eq('userId', userId);

    const projectIds = memberships?.map(m => m.projectId) || [];
    const { data: memberWorkspaces, error: err3 } = await supabase
      .from('projects')
      .select('workspaceId, id, name')
      .in('id', projectIds);

    // Merge workspaces
    const workspaceIds = memberWorkspaces?.map(p => p.workspaceId) || [];
    const { data: memberWs, error: err4 } = await supabase
      .from('workspaces')
      .select('*, projects(id, name)')
      .in('id', workspaceIds);

    if (err1 || err2 || err3 || err4) throw new Error((err1 || err2 || err3 || err4).message);

    // Combine and deduplicate
    const all = [...created, ...memberWs].reduce((acc, ws) => {
      if (!acc.find(w => w.id === ws.id)) acc.push(ws);
      return acc;
    }, []);
    return all;
  },

  getWorkspaceById: async (workspaceId) => {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateWorkspace: async ({ workspaceId, name }) => {
    const { data, error } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', workspaceId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  deleteWorkspace: async (workspaceId) => {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId);
    if (error) throw new Error(error.message);
    return;
  },
};