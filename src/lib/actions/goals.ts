'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { GoalFormData } from '@/lib/validations';

export async function getGoals(clientId?: string) {
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
  const supabase = await createClient();

  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/goals');
  return { success: true };
}
