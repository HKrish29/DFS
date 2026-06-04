'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function getNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/notifications');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return { error: error.message };

  revalidatePath('/notifications');
  return { success: true };
}

export async function getActivities(limit: number = 20) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('activities')
    .select('*, user:users(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getDashboardStats() {
  const supabase = await createClient();

  // Run all counts in parallel
  const [
    clientsResult,
    familiesResult,
    portfolioResult,
    activeSipsResult,
    pendingTasksResult,
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('families').select('*', { count: 'exact', head: true }),
    supabase.from('portfolios').select('total_invested, current_value'),
    supabase.from('sip_records').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('crm_tasks').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ]);

  const totalInvested = (portfolioResult.data || []).reduce((sum, p) => sum + (p.total_invested || 0), 0);
  const currentValue = (portfolioResult.data || []).reduce((sum, p) => sum + (p.current_value || 0), 0);

  // Get upcoming birthdays and anniversaries
  const { data: clientDates } = await supabase
    .from('clients')
    .select('name, dob, anniversary')
    .eq('is_active', true);

  const today = new Date();
  let upcomingBirthdays = 0;
  let upcomingAnniversaries = 0;

  (clientDates || []).forEach((client) => {
    if (client.dob) {
      const dob = new Date(client.dob);
      const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      if (birthday < today) birthday.setFullYear(today.getFullYear() + 1);
      const diff = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 30) upcomingBirthdays++;
    }
    if (client.anniversary) {
      const anniv = new Date(client.anniversary);
      const anniversary = new Date(today.getFullYear(), anniv.getMonth(), anniv.getDate());
      if (anniversary < today) anniversary.setFullYear(today.getFullYear() + 1);
      const diff = Math.ceil((anniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff <= 30) upcomingAnniversaries++;
    }
  });

  // Get upcoming SIPs (next 7 days)
  const { data: sips } = await supabase
    .from('sip_records')
    .select('sip_date')
    .eq('status', 'active');

  const currentDay = today.getDate();
  const upcomingSIPs = (sips || []).filter((sip) => {
    const sipDay = sip.sip_date;
    const diff = sipDay >= currentDay ? sipDay - currentDay : 30 - currentDay + sipDay;
    return diff <= 7;
  }).length;

  return {
    totalClients: clientsResult.count || 0,
    totalFamilies: familiesResult.count || 0,
    totalAUM: currentValue,
    totalInvestment: totalInvested,
    currentValue,
    profitLoss: currentValue - totalInvested,
    activeSIPs: activeSipsResult.count || 0,
    upcomingSIPs,
    pendingFollowUps: pendingTasksResult.count || 0,
    upcomingBirthdays,
    upcomingAnniversaries,
  };
}

export async function globalSearch(query: string) {
  const supabase = await createClient();

  if (!query || query.length < 2) return [];

  const [clientsResult, familiesResult, leadsResult] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, mobile, pan')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,mobile.ilike.%${query}%,pan.ilike.%${query}%`)
      .limit(10),
    supabase
      .from('families')
      .select('id, name')
      .ilike('name', `%${query}%`)
      .limit(5),
    supabase
      .from('crm_leads')
      .select('id, name, mobile')
      .or(`name.ilike.%${query}%,mobile.ilike.%${query}%`)
      .limit(5),
  ]);

  const results = [
    ...(clientsResult.data || []).map((c) => ({
      id: c.id,
      type: 'client' as const,
      name: c.name,
      subtitle: c.mobile || c.pan || '',
      link: `/clients/${c.id}`,
    })),
    ...(familiesResult.data || []).map((f) => ({
      id: f.id,
      type: 'family' as const,
      name: f.name,
      subtitle: 'Family',
      link: `/families/${f.id}`,
    })),
    ...(leadsResult.data || []).map((l) => ({
      id: l.id,
      type: 'lead' as const,
      name: l.name,
      subtitle: l.mobile || 'Lead',
      link: `/crm?tab=leads`,
    })),
  ];

  return results;
}
