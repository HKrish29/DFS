'use client';

import { Card } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils/helpers';
import type { DashboardStats } from '@/lib/types';
import {
  Users,
  UserCircle,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  CalendarClock,
  ClipboardList,
  Cake,
  Heart,
} from 'lucide-react';

interface DashboardCardsProps {
  stats: DashboardStats | null;
}

export function DashboardCards({ stats }: DashboardCardsProps) {
  const s = stats || {
    totalClients: 0,
    totalFamilies: 0,
    totalAUM: 0,
    totalInvestment: 0,
    currentValue: 0,
    profitLoss: 0,
    activeSIPs: 0,
    upcomingSIPs: 0,
    pendingFollowUps: 0,
    upcomingBirthdays: 0,
    upcomingAnniversaries: 0,
  };

  const cards = [
    {
      title: 'Total Clients',
      value: formatNumber(s.totalClients),
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Total Families',
      value: formatNumber(s.totalFamilies),
      icon: UserCircle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Total AUM',
      value: formatCurrency(s.totalAUM),
      icon: IndianRupee,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Total Investment',
      value: formatCurrency(s.totalInvestment),
      icon: TrendingUp,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      title: 'Current Value',
      value: formatCurrency(s.currentValue),
      icon: IndianRupee,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Profit/Loss',
      value: formatCurrency(s.profitLoss),
      icon: s.profitLoss >= 0 ? TrendingUp : TrendingDown,
      color: s.profitLoss >= 0 ? 'text-green-600' : 'text-red-600',
      bg: s.profitLoss >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      title: 'Active SIPs',
      value: formatNumber(s.activeSIPs),
      icon: RotateCcw,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'Upcoming SIPs',
      value: formatNumber(s.upcomingSIPs),
      icon: CalendarClock,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      title: 'Pending Follow Ups',
      value: formatNumber(s.pendingFollowUps),
      icon: ClipboardList,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      title: 'Upcoming Birthdays',
      value: formatNumber(s.upcomingBirthdays),
      icon: Cake,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
    },
    {
      title: 'Upcoming Anniversaries',
      value: formatNumber(s.upcomingAnniversaries),
      icon: Heart,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="p-4 bg-white border-gray-200 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">{card.title}</p>
              <p className="text-lg font-bold text-[#0F172A]">{card.value}</p>
            </div>
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
