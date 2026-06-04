'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { LeadFormData, TaskFormData, MeetingFormData, NoteFormData } from '@/lib/validations';

// --- Leads ---
export async function getLeads(status?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('crm_leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createLeadAction(formData: LeadFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('crm_leads')
    .insert({ ...formData, assigned_to: formData.assigned_to || user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'created',
    entity_type: 'lead',
    entity_id: data.id,
    details: `Created lead: ${formData.name}`,
  });

  revalidatePath('/crm');
  return { data };
}

export async function updateLeadAction(id: string, formData: LeadFormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_leads')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { data };
}

export async function deleteLeadAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('crm_leads').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: true };
}

// --- Tasks ---
export async function getTasks(status?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('crm_tasks')
    .select('*, client:clients(id, name)')
    .order('due_date', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createTaskAction(formData: TaskFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({ ...formData, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { data };
}

export async function updateTaskAction(id: string, formData: TaskFormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('crm_tasks')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { data };
}

export async function deleteTaskAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('crm_tasks').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: true };
}

// --- Meetings ---
export async function getMeetings() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .select('*, client:clients(id, name)')
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createMeetingAction(formData: MeetingFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('meetings')
    .insert({ ...formData, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { data };
}

export async function deleteMeetingAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: true };
}

// --- Notes ---
export async function getNotes(clientId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createNoteAction(formData: NoteFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('notes')
    .insert({ ...formData, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/clients/${formData.client_id}`);
  return { data };
}

export async function deleteNoteAction(id: string, clientId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
