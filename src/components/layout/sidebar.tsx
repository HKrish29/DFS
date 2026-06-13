'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Briefcase,
  FileUp,
  FileText,
  MessageSquare,
  FolderLock,
  Target,
  CalendarDays,
  Bell,
  Settings,
  ChevronLeft,
  Handshake,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import { ContactDialog } from './contact-dialog';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Families', href: '/families', icon: UserCircle },
  { name: 'Portfolio', href: '/portfolio', icon: Briefcase },
  { name: 'Import', href: '/import', icon: FileUp },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'WhatsApp', href: '/whatsapp', icon: MessageSquare },
  { name: 'Documents', href: '/documents', icon: FolderLock },
  { name: 'CRM', href: '/crm', icon: Handshake },
  { name: 'Goals', href: '/goals', icon: Target },
  { name: 'Calendar', href: '/calendar', icon: CalendarDays },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, toggleSidebar, user } = useAppStore();
  const [contactOpen, setContactOpen] = useState(false);

  const menuItems = [...navigation];
  if (user?.role === 'admin') {
    // Insert Admin Panel right before Settings
    menuItems.splice(menuItems.length - 1, 0, { name: 'Admin Panel', href: '/admin', icon: ShieldCheck });
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full flex-col border-r border-gray-200 bg-white transition-all duration-200',
          'lg:static lg:z-auto',
          sidebarOpen ? 'w-64' : 'w-0 lg:w-20',
          !sidebarOpen && 'overflow-hidden lg:overflow-visible'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-sm">
              DFS
            </div>
            {sidebarOpen && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#0F172A] leading-tight">Dhara Financial</span>
                <span className="text-[10px] text-gray-500 leading-tight">Services</span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={toggleSidebar}
            className="hidden p-1 rounded-md hover:bg-gray-100 lg:block"
          >
            <ChevronLeft className={cn('h-5 w-5 transition-transform', !sidebarOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setSidebarOpen(false);
                }}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#0F172A] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className={cn('h-5 w-5 flex-shrink-0', !sidebarOpen && 'lg:mx-auto')} />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {sidebarOpen ? (
          <div className="border-t border-gray-250 bg-slate-50/50 p-4 space-y-3">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">System Developers</span>
              <button
                onClick={() => setContactOpen(true)}
                className="w-full relative px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs rounded-lg shadow-[0_4px_0_0_#1e40af] hover:shadow-[0_2px_0_0_#1e40af] active:shadow-none hover:translate-y-[2px] active:translate-y-[4px] transition-all border border-blue-500 cursor-pointer text-center"
              >
                NirQuants Team 🚀
              </button>
            </div>
            <p className="text-[10px] text-gray-400 text-center">© 2026 Dhara Financial Services</p>
          </div>
        ) : (
          <div className="border-t border-gray-200 p-2 flex justify-center">
            <button
              onClick={() => setContactOpen(true)}
              className="h-9 w-9 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-[0_3px_0_0_#1e40af] hover:shadow-[0_1px_0_0_#1e40af] active:shadow-none hover:translate-y-[2px] active:translate-y-[3px] border border-blue-500 transition-all cursor-pointer"
              title="Contact Developers"
            >
              NQ
            </button>
          </div>
        )}
      </aside>
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
}
