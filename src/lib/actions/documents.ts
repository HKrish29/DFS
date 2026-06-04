'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getDocuments(clientId: string) {
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

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
  const supabase = await createClient();

  const { data } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  return data?.signedUrl || null;
}
