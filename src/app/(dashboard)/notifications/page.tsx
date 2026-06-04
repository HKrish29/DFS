'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/actions/dashboard';
import { formatDateTime } from '@/lib/utils/helpers';
import { Bell, CheckCheck, Cake, Heart, RotateCcw, ClipboardList, Info } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try { const n = await getNotifications(); setNotifications(n); } catch {}
    }
    load();
  }, []);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  }

  const iconMap: Record<string, any> = {
    birthday: Cake,
    anniversary: Heart,
    sip: RotateCcw,
    follow_up: ClipboardList,
    task: ClipboardList,
    system: Info,
  };

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Notifications</h1>
          <p className="text-sm text-gray-500">{unread} unread notifications</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" /> Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200">
          <Bell className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No notifications</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const Icon = iconMap[notif.type] || Info;
            return (
              <Card
                key={notif.id}
                className={`p-4 border-gray-200 flex items-start gap-4 cursor-pointer hover:shadow-sm transition-shadow ${
                  notif.is_read ? 'bg-white' : 'bg-blue-50/50'
                }`}
                onClick={() => handleMarkRead(notif.id)}
              >
                <div className={`rounded-lg p-2 ${notif.is_read ? 'bg-gray-100' : 'bg-blue-100'}`}>
                  <Icon className={`h-4 w-4 ${notif.is_read ? 'text-gray-500' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className={`text-sm ${notif.is_read ? 'text-gray-700' : 'font-medium text-[#0F172A]'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                    </div>
                    {!notif.is_read && <div className="h-2 w-2 rounded-full bg-[#2563EB] flex-shrink-0 mt-2" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(notif.created_at)}</p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
