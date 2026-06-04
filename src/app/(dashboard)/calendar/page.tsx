'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getClients } from '@/lib/actions/clients';
import { getTasks } from '@/lib/actions/crm';
import { formatDate } from '@/lib/utils/helpers';
import { CalendarDays, Cake, Heart, RotateCcw, ClipboardList } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'birthday' | 'anniversary' | 'sip' | 'task';
  subtitle?: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      try {
        const [clients, tasks] = await Promise.all([getClients(), getTasks()]);
        const today = new Date();
        const allEvents: CalendarEvent[] = [];

        // Birthdays
        clients.forEach((c: any) => {
          if (c.dob) {
            const dob = new Date(c.dob);
            const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
            if (birthday < today) birthday.setFullYear(today.getFullYear() + 1);
            const diff = Math.ceil((birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diff <= 90) {
              allEvents.push({
                id: `bday-${c.id}`,
                title: `${c.name}'s Birthday`,
                date: birthday.toISOString(),
                type: 'birthday',
                subtitle: `Turns ${today.getFullYear() - dob.getFullYear()}`,
              });
            }
          }
        });

        // Anniversaries
        clients.forEach((c: any) => {
          if (c.anniversary) {
            const anniv = new Date(c.anniversary);
            const anniversary = new Date(today.getFullYear(), anniv.getMonth(), anniv.getDate());
            if (anniversary < today) anniversary.setFullYear(today.getFullYear() + 1);
            const diff = Math.ceil((anniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diff <= 90) {
              allEvents.push({
                id: `anniv-${c.id}`,
                title: `${c.name}'s Anniversary`,
                date: anniversary.toISOString(),
                type: 'anniversary',
                subtitle: `${today.getFullYear() - anniv.getFullYear()} years`,
              });
            }
          }
        });

        // Tasks
        tasks.forEach((t: any) => {
          if (t.status !== 'completed' && t.status !== 'cancelled') {
            allEvents.push({
              id: `task-${t.id}`,
              title: t.title,
              date: new Date(t.due_date).toISOString(),
              type: 'task',
              subtitle: t.client?.name,
            });
          }
        });

        allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setEvents(allEvents);
      } catch {}
    }
    load();
  }, []);

  const typeConfig = {
    birthday: { icon: Cake, color: 'bg-pink-50 text-pink-600', badge: 'bg-pink-100 text-pink-700' },
    anniversary: { icon: Heart, color: 'bg-rose-50 text-rose-600', badge: 'bg-rose-100 text-rose-700' },
    sip: { icon: RotateCcw, color: 'bg-orange-50 text-orange-600', badge: 'bg-orange-100 text-orange-700' },
    task: { icon: ClipboardList, color: 'bg-blue-50 text-blue-600', badge: 'bg-blue-100 text-blue-700' },
  };

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Calendar</h1>
        <p className="text-sm text-gray-500">Upcoming birthdays, anniversaries, and tasks</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'birthday', 'anniversary', 'task'].map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === type ? 'bg-[#0F172A] text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
            }`}
          >
            {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
          </button>
        ))}
      </div>

      {/* Events List */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200">
          <CalendarDays className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No upcoming events</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(event => {
            const config = typeConfig[event.type];
            const Icon = config.icon;
            const eventDate = new Date(event.date);
            const today = new Date();
            const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            return (
              <Card key={event.id} className="p-4 bg-white border-gray-200 flex items-center gap-4">
                <div className={`rounded-lg p-2.5 ${config.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#0F172A]">{event.title}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-gray-500">{formatDate(event.date)}</span>
                    {event.subtitle && <span className="text-xs text-gray-400">• {event.subtitle}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={config.badge}>{event.type}</Badge>
                  <Badge variant={daysUntil <= 7 ? 'destructive' : 'secondary'} className="text-xs">
                    {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
