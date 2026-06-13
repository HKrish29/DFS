'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { LeadFormData, TaskFormData, MeetingFormData, NoteFormData } from '@/lib/validations';
import { all, get, run } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';

// --- Leads ---
export async function getLeads(status?: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let sql = 'SELECT * FROM crm_leads';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';
    return await all(sql, params);
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO crm_leads (id, name, mobile, email, status, source, assigned_to, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, formData.name, formData.mobile, formData.email || null, formData.status, formData.source || null, formData.assigned_to || user.id, formData.notes || null]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'created', 'lead', newId, `Created lead: ${formData.name}`]
    );

    revalidatePath('/crm');
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run(
      `UPDATE crm_leads SET name = ?, mobile = ?, email = ?, status = ?, source = ?, assigned_to = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [formData.name, formData.mobile, formData.email || null, formData.status, formData.source || null, formData.assigned_to || null, formData.notes || null, id]
    );

    revalidatePath('/crm');
    return { data: { id } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM crm_leads WHERE id = ?', [id]);
    revalidatePath('/crm');
    return { success: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('crm_leads').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: true };
}

// --- Tasks ---
export async function getTasks(status?: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let sql = `
      SELECT crm_tasks.*, clients.name as client_name, clients.id as client_id
      FROM crm_tasks
      LEFT JOIN clients ON crm_tasks.client_id = clients.id
    `;
    const params: any[] = [];

    if (status) {
      sql += ' WHERE crm_tasks.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY crm_tasks.due_date ASC';
    const rows = await all(sql, params);

    return rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      assigned_to: r.assigned_to,
      client_id: r.client_id,
      due_date: r.due_date,
      priority: r.priority,
      status: r.status,
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
      client: r.client_id ? { id: r.client_id, name: r.client_name } : null
    }));
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO crm_tasks (id, title, description, assigned_to, client_id, due_date, priority, status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, formData.title, formData.description || null, formData.assigned_to, formData.client_id || null, formData.due_date, formData.priority, formData.status, user.id]
    );

    revalidatePath('/crm');
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run(
      `UPDATE crm_tasks SET title = ?, description = ?, assigned_to = ?, client_id = ?, due_date = ?, priority = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
      [formData.title, formData.description || null, formData.assigned_to, formData.client_id || null, formData.due_date, formData.priority, formData.status, id]
    );

    revalidatePath('/crm');
    return { data: { id } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM crm_tasks WHERE id = ?', [id]);
    revalidatePath('/crm');
    return { success: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('crm_tasks').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: true };
}

// --- Meetings ---
export async function getMeetings() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const rows = await all(`
      SELECT meetings.*, clients.name as client_name, clients.id as client_id
      FROM meetings
      LEFT JOIN clients ON meetings.client_id = clients.id
      ORDER BY meetings.date DESC
    `);

    return rows.map(r => ({
      id: r.id,
      client_id: r.client_id,
      lead_id: r.lead_id,
      title: r.title,
      date: r.date,
      time: r.time,
      location: r.location,
      notes: r.notes,
      action_items: r.action_items,
      created_by: r.created_by,
      created_at: r.created_at,
      client: r.client_id ? { id: r.client_id, name: r.client_name } : null
    }));
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('meetings')
    .select('*, client:clients(id, name)')
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createMeetingAction(formData: MeetingFormData) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO meetings (id, client_id, lead_id, title, date, time, location, notes, action_items, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, formData.client_id || null, formData.lead_id || null, formData.title, formData.date, formData.time || null, formData.location || null, formData.notes || null, formData.action_items || null, user.id]
    );

    revalidatePath('/crm');
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM meetings WHERE id = ?', [id]);
    revalidatePath('/crm');
    return { success: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/crm');
  return { success: true };
}

// --- Notes ---
export async function getNotes(clientId: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    return await all('SELECT * FROM notes WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      'INSERT INTO notes (id, client_id, content, created_by) VALUES (?, ?, ?, ?)',
      [newId, formData.client_id, formData.content, user.id]
    );

    revalidatePath(`/clients/${formData.client_id}`);
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM notes WHERE id = ?', [id]);
    revalidatePath(`/clients/${clientId}`);
    return { success: true };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}
