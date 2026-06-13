'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { all, get, run } from '@/lib/sqlite/db';
import { getCurrentUser } from '@/lib/actions/auth';

export async function getNotifications() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return [];

    const rows = await all(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [user.id]
    );
    return rows.map(r => ({ ...r, is_read: Number(r.is_read) === 1 }));
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    revalidatePath('/notifications');
    return { success: true };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return { error: 'Not authenticated' };

    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [user.id]);
    revalidatePath('/notifications');
    return { success: true };
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const rows = await all(`
      SELECT activities.*, users.full_name as user_full_name, users.id as user_u_id
      FROM activities
      LEFT JOIN users ON activities.user_id = users.id
      ORDER BY activities.created_at DESC
      LIMIT ?
    `, [limit]);

    return rows.map(r => ({
      id: r.id,
      user_id: r.user_id,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      details: r.details,
      created_at: r.created_at,
      user: r.user_id ? { id: r.user_u_id, full_name: r.user_full_name } : null
    }));
  }

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
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const clientCountRow = await get('SELECT count(*) as count FROM clients WHERE is_active = 1');
    const familyCountRow = await get('SELECT count(*) as count FROM families');
    const portfoliosList = await all('SELECT total_invested, current_value FROM portfolios');
    const activeSipsRow = await get("SELECT count(*) as count FROM sip_records WHERE status = 'active'");
    const pendingTasksRow = await get("SELECT count(*) as count FROM crm_tasks WHERE status = 'pending'");

    const totalInvested = portfoliosList.reduce((sum, p) => sum + Number(p.total_invested), 0);
    const currentValue = portfoliosList.reduce((sum, p) => sum + Number(p.current_value), 0);

    // Get birthdays
    const clientDates = await all('SELECT name, dob, anniversary FROM clients WHERE is_active = 1');
    const today = new Date();
    let upcomingBirthdays = 0;
    let upcomingAnniversaries = 0;

    clientDates.forEach((client) => {
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
    const sips = await all("SELECT sip_date FROM sip_records WHERE status = 'active'");
    const currentDay = today.getDate();
    const upcomingSIPs = sips.filter((sip) => {
      const sipDay = Number(sip.sip_date);
      const diff = sipDay >= currentDay ? sipDay - currentDay : 30 - currentDay + sipDay;
      return diff <= 7;
    }).length;

    return {
      totalClients: clientCountRow ? Number(clientCountRow.count) : 0,
      totalFamilies: familyCountRow ? Number(familyCountRow.count) : 0,
      totalAUM: currentValue,
      totalInvestment: totalInvested,
      currentValue,
      profitLoss: currentValue - totalInvested,
      activeSIPs: activeSipsRow ? Number(activeSipsRow.count) : 0,
      upcomingSIPs,
      pendingFollowUps: pendingTasksRow ? Number(pendingTasksRow.count) : 0,
      upcomingBirthdays,
      upcomingAnniversaries,
    };
  }

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
  if (!query || query.length < 2) return [];

  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const clientsList = await all(
      'SELECT id, name, mobile, pan FROM clients WHERE is_active = 1 AND (name LIKE ? OR mobile LIKE ? OR pan LIKE ?)',
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );

    const familiesList = await all(
      'SELECT id, name FROM families WHERE name LIKE ?',
      [`%${query}%`]
    );

    const leadsList = await all(
      'SELECT id, name, mobile FROM crm_leads WHERE name LIKE ? OR mobile LIKE ?',
      [`%${query}%`, `%${query}%`]
    );

    return [
      ...clientsList.map((c) => ({
        id: c.id,
        type: 'client' as const,
        name: c.name,
        subtitle: c.mobile || c.pan || '',
        link: `/clients/${c.id}`,
      })),
      ...familiesList.map((f) => ({
        id: f.id,
        type: 'family' as const,
        name: f.name,
        subtitle: 'Family',
        link: `/families/${f.id}`,
      })),
      ...leadsList.map((l) => ({
        id: l.id,
        type: 'lead' as const,
        name: l.name,
        subtitle: l.mobile || 'Lead',
        link: `/crm?tab=leads`,
      })),
    ];
  }

  const supabase = await createClient();

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

export async function checkAndCreateBirthdayNotificationsAction() {
  if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
    const user = await getCurrentUser();
    if (!user) return [];

    const clients = await all('SELECT id, name, dob FROM clients WHERE is_active = 1 AND dob IS NOT NULL');
    const today = new Date();
    const upcomingBirthdaysList: any[] = [];

    for (const client of clients) {
      if (!client.dob) continue;
      const dob = new Date(client.dob);
      const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
      
      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const birthdayDateOnly = new Date(birthday.getFullYear(), birthday.getMonth(), birthday.getDate());

      if (birthdayDateOnly < todayDateOnly) {
        birthdayDateOnly.setFullYear(today.getFullYear() + 1);
      }
      
      const diffTime = birthdayDateOnly.getTime() - todayDateOnly.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const isBirthdayNear = diffDays >= 0 && diffDays <= 7;
      
      if (isBirthdayNear) {
        const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
        const existingNotif = await get(
          `SELECT id FROM notifications 
           WHERE user_id = ? AND type = 'birthday' AND message LIKE ? AND created_at > ?`,
          [user.id, `%${client.name}%`, startOfYear]
        );

        if (!existingNotif) {
          const birthdayStr = dob.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          const title = diffDays === 0 ? `Birthday Today: ${client.name} 🎉` : `Upcoming Birthday: ${client.name}`;
          const message = diffDays === 0 
            ? `${client.name}'s birthday is today! Wish them a happy birthday.` 
            : `${client.name}'s birthday is on ${birthdayStr} (in ${diffDays} days).`;

          await run(
            'INSERT INTO notifications (id, user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, ?, 0)',
            [crypto.randomUUID(), user.id, title, message, 'birthday']
          );
        }

        upcomingBirthdaysList.push({
          id: client.id,
          name: client.name,
          dob: client.dob,
          daysAway: diffDays
        });
      }
    }

    return upcomingBirthdaysList;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch active clients with dob
  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, dob')
    .eq('is_active', true)
    .not('dob', 'is', null);

  if (error || !clients) return [];

  const today = new Date();
  const upcomingBirthdaysList: any[] = [];

  for (const client of clients) {
    if (!client.dob) continue;
    const dob = new Date(client.dob);
    // Use current year for comparison
    const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    
    // Normalize date parts
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const birthdayDateOnly = new Date(birthday.getFullYear(), birthday.getMonth(), birthday.getDate());

    // If birthday already passed this year, check next year
    if (birthdayDateOnly < todayDateOnly) {
      birthdayDateOnly.setFullYear(today.getFullYear() + 1);
    }
    
    const diffTime = birthdayDateOnly.getTime() - todayDateOnly.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // If birthday is within 7 days
    const isBirthdayNear = diffDays >= 0 && diffDays <= 7;
    
    if (isBirthdayNear) {
      // Check if a notification already exists for this client's birthday this year
      const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'birthday')
        .ilike('message', `%${client.name}%`)
        .gt('created_at', startOfYear)
        .maybeSingle();

      if (!existingNotif) {
        const birthdayStr = dob.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const title = diffDays === 0 ? `Birthday Today: ${client.name} 🎉` : `Upcoming Birthday: ${client.name}`;
        const message = diffDays === 0 
          ? `${client.name}'s birthday is today! Wish them a happy birthday.` 
          : `${client.name}'s birthday is on ${birthdayStr} (in ${diffDays} days).`;

        await supabase.from('notifications').insert({
          user_id: user.id,
          title,
          message,
          type: 'birthday',
          is_read: false
        });
      }

      upcomingBirthdaysList.push({
        id: client.id,
        name: client.name,
        dob: client.dob,
        daysAway: diffDays
      });
    }
  }

  return upcomingBirthdaysList;
}
