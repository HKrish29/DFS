'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ClientFormData } from '@/lib/validations';

export async function getClients(search?: string, riskProfile?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (search) {
    query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,pan.ilike.%${search}%,email.ilike.%${search}%`);
  }

  if (riskProfile) {
    query = query.eq('risk_profile', riskProfile);
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getClient(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createClientAction(formData: ClientFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...formData, user_id: user.id })
    .select()
    .single();

  if (error) return { error: error.message };

  // Create empty portfolio for client
  await supabase.from('portfolios').insert({
    client_id: data.id,
    total_invested: 0,
    current_value: 0,
    realized_gains: 0,
  });

  // Log activity
  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'created',
    entity_type: 'client',
    entity_id: data.id,
    details: `Created client: ${formData.name}`,
  });

  revalidatePath('/clients');
  return { data };
}

export async function updateClientAction(id: string, formData: ClientFormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('clients')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'updated',
    entity_type: 'client',
    entity_id: id,
    details: `Updated client: ${formData.name}`,
  });

  revalidatePath('/clients');
  revalidatePath(`/clients/${id}`);
  return { data };
}

export async function deleteClientAction(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('clients')
    .update({ is_active: false })
    .eq('id', id);

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'deleted',
    entity_type: 'client',
    entity_id: id,
    details: 'Soft-deleted client',
  });

  revalidatePath('/clients');
  return { success: true };
}

export async function getClientCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  return count || 0;
}
