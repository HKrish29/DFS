'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { get, run } from '@/lib/sqlite/db';

export async function signIn(formData: { email: string; password: string }) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await get('SELECT * FROM users WHERE email = ?', [formData.email]);
    if (!user) {
      return { error: 'Invalid email or password' };
    }
    if (Number(user.is_active) !== 1) {
      return { error: 'This user account is inactive. Please contact an admin.' };
    }
    if (user.password !== formData.password) {
      return { error: 'Invalid email or password' };
    }

    const cookieStore = await cookies();
    cookieStore.set('dfs-offline-session', user.id, { 
      httpOnly: true, 
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    
    // Log login activity
    await run('INSERT INTO activities (id, user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)', [
      crypto.randomUUID(),
      user.id,
      'login',
      'user',
      user.id,
      'Admin user logged in successfully'
    ]);

    redirect('/dashboard');
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.email,
    password: formData.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
}

export async function signUp(formData: { email: string; password: string; full_name: string }) {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const existing = await get('SELECT id FROM users WHERE email = ?', [formData.email]);
    if (existing) {
      return { error: 'A user with this email address already exists' };
    }

    const newId = crypto.randomUUID();
    await run(
      'INSERT INTO users (id, email, password, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [newId, formData.email, formData.password, formData.full_name, 'admin', 1]
    );

    const cookieStore = await cookies();
    cookieStore.set('dfs-offline-session', newId, { 
      httpOnly: true, 
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    redirect('/dashboard');
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.email,
    password: formData.password,
    options: {
      data: {
        full_name: formData.full_name,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // The handle_new_user trigger auto-creates the users row
  // But as a fallback, we also try here (in case trigger hasn't run yet)
  if (data.user) {
    const { error: profileError } = await supabase.from('users').upsert({
      id: data.user.id,
      email: formData.email,
      full_name: formData.full_name,
      role: 'admin',
    }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
    }
  }

  redirect('/dashboard');
}

export async function signOut() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const cookieStore = await cookies();
    cookieStore.delete('dfs-offline-session');
    redirect('/login');
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function getCurrentUser() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const cookieStore = await cookies();
    const userId = cookieStore.get('dfs-offline-session')?.value;

    if (!userId) return null;

    const profile = await get('SELECT * FROM users WHERE id = ?', [userId]);
    if (profile) {
      // Map numeric boolean to JS boolean
      profile.is_active = Number(profile.is_active) === 1;
    }
    return profile;
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return profile;
}
