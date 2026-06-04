'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { getGoals, createGoalAction, deleteGoalAction } from '@/lib/actions/goals';
import { getClients } from '@/lib/actions/clients';
import { formatCurrency, goalTypeLabels, calculateRequiredSIP } from '@/lib/utils/helpers';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';
import { Plus, Target, Trash2, GraduationCap, Home, Car, Heart, Landmark, MoreHorizontal, Search } from 'lucide-react';

const goalIcons: Record<string, any> = {
  retirement: Landmark,
  education: GraduationCap,
  marriage: Heart,
  house: Home,
  vehicle: Car,
  other: MoreHorizontal,
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [form, setForm] = useState({
    client_id: '', goal_type: 'retirement' as const, goal_name: '',
    target_amount: '', current_investment: '0', target_date: '',
    expected_return: '12', inflation_rate: '6',
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [g, c] = await Promise.all([getGoals(), getClients()]);
      setGoals(g);
      setClients(c);
    } catch {}
  }

  async function handleCreate() {
    const years = form.target_date ? (new Date(form.target_date).getFullYear() - new Date().getFullYear()) : 10;
    const requiredSip = calculateRequiredSIP(
      Number(form.target_amount),
      Number(form.current_investment),
      years,
      Number(form.expected_return)
    );

    const result = await createGoalAction({
      client_id: form.client_id,
      goal_type: form.goal_type,
      goal_name: form.goal_name,
      target_amount: Number(form.target_amount),
      current_investment: Number(form.current_investment),
      target_date: form.target_date || null,
      monthly_sip: requiredSip,
      expected_return: Number(form.expected_return),
      inflation_rate: Number(form.inflation_rate),
      notes: null,
    });

    if (result.error) { toast.error(result.error); return; }
    toast.success('Goal created');
    setShowDialog(false);
    loadData();
  }

  async function handleDelete(id: string) {
    await deleteGoalAction(id);
    toast.success('Goal deleted');
    loadData();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Goal Planning</h1>
          <p className="text-sm text-gray-500">Financial goals for clients</p>
        </div>
        <Button onClick={() => { setClientSearch(''); setShowDialog(true); }} className="bg-[#0F172A] hover:bg-[#1E293B]">
          <Plus className="h-4 w-4 mr-2" /> Add Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200">
          <Target className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No goals created yet</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const Icon = goalIcons[goal.goal_type] || Target;
            const progress = goal.target_amount > 0 ? (goal.current_investment / goal.target_amount) * 100 : 0;
            return (
              <Card key={goal.id} className="p-5 bg-white border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-50 p-2">
                      <Icon className="h-5 w-5 text-[#2563EB]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#0F172A]">{goal.goal_name}</h4>
                      <p className="text-xs text-gray-400">{goal.client?.name || 'Client'}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)} className="text-red-400 h-8 w-8">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Target</span>
                    <span className="font-medium">{formatCurrency(goal.target_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Current</span>
                    <span className="font-medium">{formatCurrency(goal.current_investment)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Required SIP</span>
                    <span className="font-medium text-[#2563EB]">{formatCurrency(goal.monthly_sip)}/mo</span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{progress.toFixed(1)}%</span>
                      <span>{formatCurrency(goal.target_amount)}</span>
                    </div>
                    <Progress value={Math.min(progress, 100)} className="h-2" />
                  </div>
                </div>

                <Badge variant="secondary" className="mt-3 capitalize text-xs">{goalTypeLabels[goal.goal_type]}</Badge>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Goal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Client *</Label>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search client by name, mobile, PAN..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
              {(() => {
                const filteredClients = clients.filter(c =>
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.mobile.includes(clientSearch) ||
                  (c.pan && c.pan.toLowerCase().includes(clientSearch.toLowerCase()))
                );
                return (
                  <Select value={form.client_id} onValueChange={v => { if (v) setForm({ ...form, client_id: v }); }}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {filteredClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobile}</SelectItem>)}
                      {filteredClients.length === 0 && (
                        <p className="text-xs text-gray-400 p-2 text-center">No clients match search</p>
                      )}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Goal Type</Label>
                <Select value={form.goal_type} onValueChange={(v) => { if (v) setForm({ ...form, goal_type: v as any }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retirement">Retirement</SelectItem><SelectItem value="education">Education</SelectItem>
                    <SelectItem value="marriage">Marriage</SelectItem><SelectItem value="house">House</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem><SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Goal Name *</Label><Input value={form.goal_name} onChange={e => setForm({ ...form, goal_name: e.target.value })} placeholder="Child's Education" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Target Amount *</Label><Input type="number" value={form.target_amount} onChange={e => setForm({ ...form, target_amount: e.target.value })} /></div>
              <div className="space-y-2"><Label>Current Investment</Label><Input type="number" value={form.current_investment} onChange={e => setForm({ ...form, current_investment: e.target.value })} /></div>
              <div className="space-y-2"><Label>Target Date</Label><Input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Expected Return %</Label><Input type="number" value={form.expected_return} onChange={e => setForm({ ...form, expected_return: e.target.value })} /></div>
            </div>
            <Button onClick={handleCreate} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">Create Goal</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
