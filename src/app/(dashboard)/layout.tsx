'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { useAppStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, user } = useAppStore();

  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();
          if (profile) {
            setUser(profile);
          } else {
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
              setUser(newProfile);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
    }
    loadUser();
  }, [setUser]);

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
