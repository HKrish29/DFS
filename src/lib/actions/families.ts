'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { FamilyFormData, FamilyMemberFormData } from '@/lib/validations';
import { all, get, run } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';

export async function getFamilies(search?: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let sql = 'SELECT * FROM families';
    const params: any[] = [];

    if (search) {
      sql += ' WHERE name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY name ASC';
    const familiesList = await all(sql, params);

    // Fetch members for each family
    const families = [];
    for (const f of familiesList) {
      const members = await all(`
        SELECT fm.id, fm.relationship, c.id as client_id, c.name, c.mobile, c.email
        FROM family_members fm
        LEFT JOIN clients c ON fm.client_id = c.id
        WHERE fm.family_id = ?
      `, [f.id]);

      families.push({
        ...f,
        family_members: members.map(m => ({
          id: m.id,
          relationship: m.relationship,
          client: { id: m.client_id, name: m.name, mobile: m.mobile, email: m.email }
        }))
      });
    }

    return families;
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const fam = await get('SELECT * FROM families WHERE id = ?', [id]);
    if (!fam) return null;

    const members = await all(`
      SELECT fm.id, fm.relationship, c.*
      FROM family_members fm
      LEFT JOIN clients c ON fm.client_id = c.id
      WHERE fm.family_id = ?
    `, [id]);

    const headClient = fam.head_client_id 
      ? await get('SELECT id, name FROM clients WHERE id = ?', [fam.head_client_id])
      : null;

    return {
      ...fam,
      family_members: members.map(m => ({
        id: m.id,
        relationship: m.relationship,
        client: m
      })),
      head_client: headClient
    };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      'INSERT INTO families (id, name, head_client_id, notes) VALUES (?, ?, ?, ?)',
      [newId, formData.name, formData.head_client_id || null, formData.notes || null]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'created', 'family', newId, `Created family: ${formData.name}`]
    );

    revalidatePath('/families');
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    await run(
      `UPDATE families SET name = ?, head_client_id = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [formData.name, formData.head_client_id || null, formData.notes || null, id]
    );

    revalidatePath('/families');
    revalidatePath(`/families/${id}`);
    return { data: { id } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    // Delete family members first
    await run('DELETE FROM family_members WHERE family_id = ?', [id]);
    await run('DELETE FROM families WHERE id = ?', [id]);

    revalidatePath('/families');
    return { success: true };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const newId = crypto.randomUUID();
    await run(
      'INSERT INTO family_members (id, family_id, client_id, relationship) VALUES (?, ?, ?, ?)',
      [newId, formData.family_id, formData.client_id, formData.relationship]
    );

    revalidatePath(`/families/${formData.family_id}`);
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('DELETE FROM family_members WHERE id = ?', [id]);
    revalidatePath(`/families/${familyId}`);
    return { success: true };
  }

  const supabase = await createClient();

  const { error } = await supabase.from('family_members').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/families/${familyId}`);
  return { success: true };
}

export async function getFamilyCount() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const row = await get('SELECT count(*) as count FROM families');
    return row ? Number(row.count) : 0;
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from('families')
    .select('*', { count: 'exact', head: true });
  return count || 0;
}
