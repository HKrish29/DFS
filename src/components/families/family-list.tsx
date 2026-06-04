'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { createFamilyAction, deleteFamilyAction, addFamilyMemberAction, removeFamilyMemberAction } from '@/lib/actions/families';
import { getClients } from '@/lib/actions/clients';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Users, Trash2, UserPlus } from 'lucide-react';
import type { Client } from '@/lib/types';

interface FamilyListProps {
  initialFamilies: any[];
}

export function FamilyList({ initialFamilies }: FamilyListProps) {
  const router = useRouter();
  const [families, setFamilies] = useState(initialFamilies);
  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [relationship, setRelationship] = useState('');

  const filtered = families.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateFamily() {
    if (!newFamilyName.trim()) return;
    setLoading(true);
    const result = await createFamilyAction({ name: newFamilyName, notes: null, head_client_id: null });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Family created');
      setShowAddDialog(false);
      setNewFamilyName('');
      router.refresh();
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!deletingId) return;
    const result = await deleteFamilyAction(deletingId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Family deleted');
      setFamilies(families.filter(f => f.id !== deletingId));
    }
    setDeletingId(null);
  }

  async function openMemberDialog(familyId: string) {
    setShowMemberDialog(familyId);
    try {
      const data = await getClients();
      setClients(data);
    } catch {}
  }

  async function handleAddMember() {
    if (!showMemberDialog || !selectedClient || !relationship) return;
    setLoading(true);
    const result = await addFamilyMemberAction({
      family_id: showMemberDialog,
      client_id: selectedClient,
      relationship,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Member added');
      setShowMemberDialog(null);
      setSelectedClient('');
      setRelationship('');
      router.refresh();
    }
    setLoading(false);
  }

  async function handleRemoveMember(memberId: string, familyId: string) {
    const result = await removeFamilyMemberAction(memberId, familyId);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Member removed');
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search families..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="bg-[#0F172A] hover:bg-[#1E293B]">
          <Plus className="h-4 w-4 mr-2" />
          Create Family
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 bg-white border-gray-200">
          <Users className="h-8 w-8 text-gray-300 mb-2" />
          <p className="text-gray-500 text-sm">No families found</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((family) => (
            <Card key={family.id} className="p-5 bg-white border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[#0F172A]">{family.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {family.family_members?.length || 0} members
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openMemberDialog(family.id)}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingId(family.id)}
                    className="text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Family Members */}
              <div className="space-y-2">
                {family.family_members?.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{member.client?.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">{member.relationship}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id, family.id)}
                      className="text-red-400 hover:text-red-600 h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {(!family.family_members || family.family_members.length === 0) && (
                  <p className="text-xs text-gray-400 text-center py-2">No members added</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Family Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Family</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Family Name</Label>
              <Input
                placeholder="e.g., Patel Family"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateFamily} disabled={loading} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">
              {loading ? 'Creating...' : 'Create Family'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!showMemberDialog} onOpenChange={() => setShowMemberDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={selectedClient} onValueChange={(val) => setSelectedClient(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} - {client.mobile}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select value={relationship} onValueChange={(val) => setRelationship(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Self">Self (Head)</SelectItem>
                  <SelectItem value="Husband">Husband</SelectItem>
                  <SelectItem value="Wife">Wife</SelectItem>
                  <SelectItem value="Father">Father</SelectItem>
                  <SelectItem value="Mother">Mother</SelectItem>
                  <SelectItem value="Son">Son</SelectItem>
                  <SelectItem value="Daughter">Daughter</SelectItem>
                  <SelectItem value="Brother">Brother</SelectItem>
                  <SelectItem value="Sister">Sister</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddMember} disabled={loading} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Family</AlertDialogTitle>
            <AlertDialogDescription>This will remove the family and all member links. Client records will not be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
