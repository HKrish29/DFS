'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { checkAndCreateBirthdayNotificationsAction, getNotifications } from '@/lib/actions/dashboard';
import { getCurrentUser } from '@/lib/actions/auth';
import { toast } from 'sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, user, setNotifications } = useAppStore();

  useEffect(() => {
    // Request push notification permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    async function loadUser() {
      try {
        let currentUserProfile = null;

        if (process.env.NEXT_PUBLIC_BYPASS_SUPABASE === 'true') {
          currentUserProfile = await getCurrentUser();
        } else {
          const supabase = createClient();
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const { data: profile } = await supabase
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .single();
            
            currentUserProfile = profile;
            
            if (!profile) {
              // Profile might not exist yet (trigger race condition) - create it
              const { data: newProfile } = await supabase
                .from('users')
                .upsert({
                  id: authUser.id,
                  email: authUser.email || '',
                  full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Admin',
                  role: 'admin',
                }, { onConflict: 'id' })
                .select()
                .single();
              if (newProfile) {
                currentUserProfile = newProfile;
              }
            }
          }
        }

        if (currentUserProfile) {
          setUser(currentUserProfile);
          
          // Check birthdays
          const birthdays = await checkAndCreateBirthdayNotificationsAction();
            birthdays.forEach((b: any) => {
              const msg = b.daysAway === 0 
                ? `${b.name}'s birthday is today! 🎉` 
                : `${b.name}'s birthday is in ${b.daysAway} days (${new Date(b.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}).`;
              
              toast(msg, {
                icon: '🎂',
                duration: 10000,
              });

              // Show browser notification if permitted
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(b.daysAway === 0 ? "Birthday Today! 🎂" : "Upcoming Birthday 🎂", {
                    body: msg,
                    icon: '/favicon.ico'
                  });
                } catch {}
              }
            });

          // Update store count with all active notifications
          const notifs = await getNotifications();
          setNotifications(notifs);
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
    }
    loadUser();
  }, [setUser, setNotifications]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
