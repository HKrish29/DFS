'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ClientFormData } from '@/lib/validations';
import { all, get, run } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';

export async function getClients(search?: string, riskProfile?: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    let sql = 'SELECT * FROM clients WHERE is_active = 1';
    const params: any[] = [];

    if (riskProfile) {
      sql += ' AND risk_profile = ?';
      params.push(riskProfile);
    }

    sql += ' ORDER BY name ASC';
    const rows = await all(sql, params);

    // Map numeric booleans
    const mapped = rows.map(r => ({
      ...r,
      is_active: Number(r.is_active) === 1
    }));

    if (search) {
      const s = search.toLowerCase();
      return mapped.filter(r => 
        r.name.toLowerCase().includes(s) ||
        r.mobile.includes(s) ||
        (r.pan && r.pan.toLowerCase().includes(s)) ||
        (r.email && r.email.toLowerCase().includes(s))
      );
    }
    return mapped;
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const row = await get('SELECT * FROM clients WHERE id = ?', [id]);
    if (row) {
      row.is_active = Number(row.is_active) === 1;
    }
    return row;
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    const newId = crypto.randomUUID();
    await run(
      `INSERT INTO clients (id, user_id, name, pan, aadhaar, mobile, email, dob, anniversary, address, city, state, pincode, occupation, risk_profile, notes, assigned_rm_id, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        newId, user.id, formData.name, formData.pan || null, formData.aadhaar || null,
        formData.mobile, formData.email || null, formData.dob || null, formData.anniversary || null,
        formData.address || null, formData.city || null, formData.state || null, formData.pincode || null,
        formData.occupation || null, formData.risk_profile || null, formData.notes || null, user.id
      ]
    );

    // Create empty portfolio
    await run(
      'INSERT INTO portfolios (id, client_id, total_invested, current_value, realized_gains) VALUES (?, ?, 0, 0, 0)',
      [crypto.randomUUID(), newId]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'created', 'client', newId, `Created client: ${formData.name}`]
    );

    revalidatePath('/clients');
    return { data: { id: newId } };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    // Check if client has any uploaded documents
    const docCheck = await get('SELECT count(*) as count FROM documents WHERE client_id = ?', [id]);
    const docCount = docCheck ? Number(docCheck.count) : 0;

    if (docCount > 0) {
      // Fetch existing client data to check for core field changes
      const existingClient = await get('SELECT name, email, pan, aadhaar, mobile FROM clients WHERE id = ?', [id]);
      if (existingClient) {
        const isChanged =
          formData.name !== existingClient.name ||
          (formData.email || null) !== (existingClient.email || null) ||
          (formData.pan || null) !== (existingClient.pan || null) ||
          (formData.aadhaar || null) !== (existingClient.aadhaar || null) ||
          formData.mobile !== existingClient.mobile;

        if (isChanged) {
          return { error: 'Core fields (Name, Mobile, Email, PAN, Aadhaar) cannot be changed because documents are uploaded for this client.' };
        }
      }
    }

    await run(
      `UPDATE clients SET name = ?, pan = ?, aadhaar = ?, mobile = ?, email = ?, dob = ?, anniversary = ?, address = ?, city = ?, state = ?, pincode = ?, occupation = ?, risk_profile = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        formData.name, formData.pan || null, formData.aadhaar || null, formData.mobile,
        formData.email || null, formData.dob || null, formData.anniversary || null, formData.address || null,
        formData.city || null, formData.state || null, formData.pincode || null, formData.occupation || null,
        formData.risk_profile || null, formData.notes || null, id
      ]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'updated', 'client', id, `Updated client: ${formData.name}`]
    );

    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    return { data: { id } };
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Check if client has any uploaded documents
  const { count, error: countErr } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', id);

  if (count && count > 0) {
    // Fetch existing client data to check for core field changes
    const { data: existingClient } = await supabase
      .from('clients')
      .select('name, email, pan, aadhaar, mobile')
      .eq('id', id)
      .single();

    if (existingClient) {
      const isChanged =
        formData.name !== existingClient.name ||
        (formData.email || null) !== (existingClient.email || null) ||
        (formData.pan || null) !== (existingClient.pan || null) ||
        (formData.aadhaar || null) !== (existingClient.aadhaar || null) ||
        formData.mobile !== existingClient.mobile;

      if (isChanged) {
        return { error: 'Core fields (Name, Mobile, Email, PAN, Aadhaar) cannot be changed because documents are uploaded for this client.' };
      }
    }
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    await run('UPDATE clients SET is_active = 0 WHERE id = ?', [id]);

    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'deleted', 'client', id, 'Soft-deleted client']
    );

    revalidatePath('/clients');
    return { success: true };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const row = await get('SELECT count(*) as count FROM clients WHERE is_active = 1');
    return row ? Number(row.count) : 0;
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  return count || 0;
}
