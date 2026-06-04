'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { FamilyFormData, FamilyMemberFormData } from '@/lib/validations';

export async function getFamilies(search?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('families')
    .select(`
      *,
      family_members (
        id,
        relationship,
        client:clients (id, name, mobile, email)
      )
    `)
    .order('name', { ascending: true });

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getFamily(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('families')
    .select(`
      *,
      family_members (
        id,
        relationship,
        client:clients (*)
      ),
      head_client:clients!families_head_client_id_fkey (id, name)
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createFamilyAction(formData: FamilyFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('families')
    .insert(formData)
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'created',
    entity_type: 'family',
    entity_id: data.id,
    details: `Created family: ${formData.name}`,
  });

  revalidatePath('/families');
  return { data };
}

export async function updateFamilyAction(id: string, formData: FamilyFormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('families')
    .update(formData)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath('/families');
  revalidatePath(`/families/${id}`);
  return { data };
}

export async function deleteFamilyAction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Delete family members first
  await supabase.from('family_members').delete().eq('family_id', id);

  const { error } = await supabase.from('families').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/families');
  return { success: true };
}

export async function addFamilyMemberAction(formData: FamilyMemberFormData) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('family_members')
    .insert(formData)
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/families/${formData.family_id}`);
  return { data };
}

export async function removeFamilyMemberAction(id: string, familyId: string) {
  const supabase = await createClient();

  const { error } = await supabase.from('family_members').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/families/${familyId}`);
  return { success: true };
}

export async function getFamilyCount() {
  const supabase = await createClient();
  const { count } = await supabase
    .from('families')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}
