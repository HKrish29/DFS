'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { GoalFormData } from '@/lib/validations';
import { all, get, run } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';

export async function getGoals(clientId?: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let sql = `
      SELECT goals.*, clients.name as client_name, clients.id as client_id
      FROM goals
      LEFT JOIN clients ON goals.client_id = clients.id
    `;
    const params: any[] = [];

    if (clientId) {
      sql += ' WHERE goals.client_id = ?';
      params.push(clientId);
    }

    sql += ' ORDER BY goals.created_at DESC';
    const rows = await all(sql, params);

    return rows.map(r => ({
      id: r.id,
      client_id: r.client_id,
      goal_type: r.goal_type,
      goal_name: r.goal_name,
      target_amount: r.target_amount,
      current_investment: r.current_investment,
      target_date: r.target_date,
      monthly_sip: r.monthly_sip,
      expected_return: r.expected_return,
      inflation_rate: r.inflation_rate,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at,
      client: r.client_id ? { id: r.client_id, name: r.client_name } : null
    }));
  }

  const supabase = await createClient();

  let query = supabase
    .from('goals')
    .select('*, client:clients(id, name)')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getGoal(id: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const r = await get(`
      SELECT goals.*, clients.name as client_name, clients.id as client_id
      FROM goals
      LEFT JOIN clients ON goals.client_id = clients.id
      WHERE goals.id = ?
    `, [id]);

    if (!r) return null;

    return {
      id: r.id,
      client_id: r.client_id,
      goal_type: r.goal_type,
      goal_name: r.goal_name,
      target_amount: r.target_amount,
      current_investment: r.current_investment,
      target_date: r.target_date,
      monthly_sip: r.monthly_sip,
      expected_return: r.expected_return,
      inflation_rate: r.inflation_rate,
      notes: r.notes,
      created_at: r.created_at,
      updated_at: r.updated_at,
      client: r.client_id ? { id: r.client_id, name: r.client_name } : null
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('goals')
    .select('*, client:clients(id, name)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createGoalAction(formData: GoalFormData) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO goals (id, client_id, goal_type, goal_name, target_amount, current_investment, target_date, monthly_sip, expected_return, inflation_rate, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, formData.client_id, formData.goal_type, formData.goal_name, formData.target_amount, formData.current_investment || 0, formData.target_date || null, formData.monthly_sip || 0, formData.expected_return || 12, formData.inflation_rate || 6, formData.notes || null]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'created', 'goal', newId, `Created goal: ${formData.goal_name}`]
    );

    revalidatePath('/goals');
    return { data: { id: newId } };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('goals')
    .insert(formData)
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'created',
    entity_type: 'goal',
    entity_id: data.id,
    details: `Created goal: ${formData.goal_name}`,
  });

  revalidatePath('/goals');
  return { data };
}

export async function updateGoalAction(id: string, formData: GoalFormData) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run(
      `UPDATE goals SET goal_type = ?, goal_name = ?, target_amount = ?, current_investment = ?, target_date = ?, monthly_sip = ?, expected_return = ?, inflation_rate = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [formData.goal_type, formData.goal_name, formData.target_amount, formData.current_investment || 0, formData.target_date || null, formData.monthly_sip || 0, formData.expected_return || 12, formData.inflation_rate || 6, formData.notes || null, id]
    );

    revalidatePath('/goals');
    return { data: { id } };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('goals')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/goals');
  return { data };
}

export async function deleteGoalAction(id: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM goals WHERE id = ?', [id]);
    revalidatePath('/goals');
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/goals');
  return { success: true };
}
