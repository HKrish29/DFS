'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { all, get, run } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';
import fs from 'fs';
import path from 'path';

export async function getDocuments(clientId: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    return await all('SELECT * FROM documents WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function uploadDocument(
  clientId: string,
  file: File,
  docType: string
) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    // Check if file already exists (same name and size)
    const existingDoc = await get(
      'SELECT id FROM documents WHERE client_id = ? AND file_name = ? AND file_size = ?',
      [clientId, file.name, file.size]
    );

    if (existingDoc) {
      return { error: 'This file has already been uploaded for this client.' };
    }

    // Save locally
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', clientId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const localFilePath = path.join(uploadDir, safeFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(localFilePath, buffer);

    const dbFilePath = `uploads/${clientId}/${safeFileName}`;
    const newId = crypto.randomUUID();

    await run(
      `INSERT INTO documents (id, client_id, doc_type, file_name, file_path, file_size, mime_type, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, clientId, docType, file.name, dbFilePath, file.size, file.type, user.id]
    );

    // Log activity
    await run(
      'INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), user.id, 'uploaded', 'document', newId, `Uploaded document: ${file.name}`]
    );

    revalidatePath('/documents');
    revalidatePath(`/clients/${clientId}`);
    return { data: { id: newId, url: `/${dbFilePath}` } };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Check if file already exists for this client (same name and size)
  const { data: existingDoc, error: checkError } = await supabase
    .from('documents')
    .select('id')
    .eq('client_id', clientId)
    .eq('file_name', file.name)
    .eq('file_size', file.size)
    .maybeSingle();

  if (existingDoc) {
    return { error: 'This file has already been uploaded for this client.' };
  }

  const fileExt = file.name.split('.').pop();
  const filePath = `${clientId}/${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file);

  if (uploadError) return { error: uploadError.message };

  // Get signed URL for the file
  const { data: urlData } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600);

  // Save document record
  const { data, error } = await supabase
    .from('documents')
    .insert({
      client_id: clientId,
      doc_type: docType,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await supabase.from('activities').insert({
    user_id: user.id,
    action: 'uploaded',
    entity_type: 'document',
    entity_id: data.id,
    details: `Uploaded document: ${file.name}`,
  });

  revalidatePath(`/documents`);
  revalidatePath(`/clients/${clientId}`);
  return { data: { ...data, url: urlData?.signedUrl || '#' } };
}

export async function deleteDocument(id: string, filePath: string, clientId: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    // Delete physical file
    const fullPath = path.join(process.cwd(), 'public', filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Error deleting local file:', err);
      }
    }

    // Delete record
    await run('DELETE FROM documents WHERE id = ?', [id]);

    revalidatePath(`/documents`);
    revalidatePath(`/clients/${clientId}`);
    return { success: true };
  }

  const supabase = await createClient();

  // Delete from storage
  await supabase.storage.from('documents').remove([filePath]);

  // Delete record
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath(`/documents`);
  revalidatePath(`/clients/${clientId}`);
  return { success: true };
}

export async function getDocumentUrl(filePath: string) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    return `/${filePath}`;
  }

  const supabase = await createClient();

  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  return data?.signedUrl || null;
}
