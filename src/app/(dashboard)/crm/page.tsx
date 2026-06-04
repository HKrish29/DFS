'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLeads, createLeadAction, updateLeadAction, deleteLeadAction, getTasks, createTaskAction, updateTaskAction, getMeetings, createMeetingAction } from '@/lib/actions/crm';
import { formatDate, leadStatusConfig, priorityConfig, taskStatusConfig } from '@/lib/utils/helpers';
import { toast } from 'sonner';
import { Plus, Search, Phone, Trash2, Edit, CheckCircle } from 'lucide-react';

export default function CRMPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<any>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Lead form
  const [leadForm, setLeadForm] = useState({ name: '', mobile: '', email: '', status: 'new' as const, notes: '', source: '' });
  // Task form
  const [taskForm, setTaskForm] = useState({ title: '', description: '', due_date: '', priority: 'medium' as const, status: 'pending' as const });
  // Meeting form
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '', location: '', notes: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [l, t, m] = await Promise.all([getLeads(), getTasks(), getMeetings()]);
      setLeads(l);
      setTasks(t);
      setMeetings(m);
    } catch {}
  }

  async function handleCreateLead() {
    const result = editingLead
      ? await updateLeadAction(editingLead.id, { ...leadForm, assigned_to: null })
      : await createLeadAction({ ...leadForm, assigned_to: null });
    if (result.error) { toast.error(result.error); return; }
    toast.success(editingLead ? 'Lead updated' : 'Lead created');
    setShowLeadDialog(false);
    setEditingLead(null);
    setLeadForm({ name: '', mobile: '', email: '', status: 'new', notes: '', source: '' });
    loadData();
  }

  async function handleDeleteLead() {
    if (!deletingLeadId) return;
    await deleteLeadAction(deletingLeadId);
    toast.success('Lead deleted');
    setDeletingLeadId(null);
    loadData();
  }

  async function handleCreateTask() {
    const result = await createTaskAction({
      ...taskForm,
      assigned_to: (await (await import('@/lib/supabase/client')).createClient().auth.getUser()).data.user?.id || '',
      client_id: null,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success('Task created');
    setShowTaskDialog(false);
    setTaskForm({ title: '', description: '', due_date: '', priority: 'medium', status: 'pending' });
    loadData();
  }

  async function handleCreateMeeting() {
    const result = await createMeetingAction({
      ...meetingForm,
      client_id: null,
      lead_id: null,
      action_items: null,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success('Meeting created');
    setShowMeetingDialog(false);
    setMeetingForm({ title: '', date: '', time: '', location: '', notes: '' });
    loadData();
  }

  async function handleToggleTask(task: any) {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTaskAction(task.id, { ...task, status: newStatus, client_id: task.client_id || null });
    loadData();
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-[#0F172A]">CRM</h1>
        <p className="text-sm text-gray-500">Leads, Tasks & Meetings</p>
      </div>

      <Tabs defaultValue="leads">
        <TabsList>
          <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="meetings">Meetings ({meetings.length})</TabsTrigger>
        </TabsList>

        {/* Leads */}
        <TabsContent value="leads" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Button onClick={() => { setEditingLead(null); setLeadForm({ name: '', mobile: '', email: '', status: 'new', notes: '', source: '' }); setShowLeadDialog(true); }} className="bg-[#0F172A] hover:bg-[#1E293B]">
              <Plus className="h-4 w-4 mr-2" /> Add Lead
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leads.filter(l => !search || l.name.toLowerCase().includes(search.toLowerCase())).map(lead => (
              <Card key={lead.id} className="p-4 bg-white border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-[#0F172A]">{lead.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <Phone className="h-3 w-3" /> {lead.mobile}
                    </div>
                  </div>
                  <Badge className={leadStatusConfig[lead.status]?.color}>{leadStatusConfig[lead.status]?.label}</Badge>
                </div>
                {lead.notes && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{lead.notes}</p>}
                <div className="flex gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => { setEditingLead(lead); setLeadForm({ name: lead.name, mobile: lead.mobile, email: lead.email || '', status: lead.status, notes: lead.notes || '', source: lead.source || '' }); setShowLeadDialog(true); }}>
                    <Edit className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => setDeletingLeadId(lead.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowTaskDialog(true)} className="bg-[#0F172A] hover:bg-[#1E293B]">
              <Plus className="h-4 w-4 mr-2" /> Add Task
            </Button>
          </div>
          <div className="space-y-3">
            {tasks.map(task => (
              <Card key={task.id} className="p-4 bg-white border-gray-200 flex items-center gap-4">
                <button onClick={() => handleToggleTask(task)} className="flex-shrink-0">
                  <CheckCircle className={`h-5 w-5 ${task.status === 'completed' ? 'text-green-500' : 'text-gray-300'}`} />
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-[#0F172A]'}`}>{task.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500">Due: {formatDate(task.due_date)}</span>
                    {task.client?.name && <span className="text-xs text-gray-400">• {task.client.name}</span>}
                  </div>
                </div>
                <Badge className={priorityConfig[task.priority]?.color}>{priorityConfig[task.priority]?.label}</Badge>
                <Badge className={taskStatusConfig[task.status]?.color}>{taskStatusConfig[task.status]?.label}</Badge>
              </Card>
            ))}
            {tasks.length === 0 && <Card className="p-8 bg-white text-center text-gray-400 text-sm">No tasks</Card>}
          </div>
        </TabsContent>

        {/* Meetings */}
        <TabsContent value="meetings" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowMeetingDialog(true)} className="bg-[#0F172A] hover:bg-[#1E293B]">
              <Plus className="h-4 w-4 mr-2" /> Add Meeting
            </Button>
          </div>
          <div className="space-y-3">
            {meetings.map(meeting => (
              <Card key={meeting.id} className="p-4 bg-white border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-[#0F172A]">{meeting.title}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(meeting.date)} {meeting.time && `at ${meeting.time}`}
                      {meeting.location && ` • ${meeting.location}`}
                    </p>
                  </div>
                  {meeting.client?.name && <Badge variant="secondary">{meeting.client.name}</Badge>}
                </div>
                {meeting.notes && <p className="text-sm text-gray-600 mt-2">{meeting.notes}</p>}
              </Card>
            ))}
            {meetings.length === 0 && <Card className="p-8 bg-white text-center text-gray-400 text-sm">No meetings</Card>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Dialog */}
      <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingLead ? 'Edit Lead' : 'Add Lead'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={leadForm.name} onChange={e => setLeadForm({ ...leadForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Mobile *</Label><Input value={leadForm.mobile} onChange={e => setLeadForm({ ...leadForm, mobile: e.target.value })} maxLength={10} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={leadForm.email} onChange={e => setLeadForm({ ...leadForm, email: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Status</Label>
                <Select value={leadForm.status} onValueChange={(v) => { if (v) setLeadForm({ ...leadForm, status: v as any }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem><SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="interested">Interested</SelectItem><SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Source</Label><Input value={leadForm.source} onChange={e => setLeadForm({ ...leadForm, source: e.target.value })} placeholder="Referral, Website..." /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={leadForm.notes} onChange={e => setLeadForm({ ...leadForm, notes: e.target.value })} rows={3} /></div>
            <Button onClick={handleCreateLead} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">{editingLead ? 'Update Lead' : 'Create Lead'}</Button>
          </div>
        </DialogContent>
      </Dialog>
  
      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Task</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Due Date *</Label><Input type="date" value={taskForm.due_date} onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(v) => { if (v) setTaskForm({ ...taskForm, priority: v as any }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleCreateTask} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">Create Task</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Meeting</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={meetingForm.title} onChange={e => setMeetingForm({ ...meetingForm, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Date *</Label><Input type="date" value={meetingForm.date} onChange={e => setMeetingForm({ ...meetingForm, date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Time</Label><Input type="time" value={meetingForm.time} onChange={e => setMeetingForm({ ...meetingForm, time: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Location</Label><Input value={meetingForm.location} onChange={e => setMeetingForm({ ...meetingForm, location: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={meetingForm.notes} onChange={e => setMeetingForm({ ...meetingForm, notes: e.target.value })} rows={3} /></div>
            <Button onClick={handleCreateMeeting} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">Create Meeting</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLeadId} onOpenChange={() => setDeletingLeadId(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Lead</AlertDialogTitle><AlertDialogDescription>Are you sure?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteLead} className="bg-red-600">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
