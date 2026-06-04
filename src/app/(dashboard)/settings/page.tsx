'use client';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { signOut } from '@/lib/actions/auth';
import { Settings as SettingsIcon, LogOut, User, Building } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAppStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card className="p-6 bg-white border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-5 w-5 text-gray-400" />
          <h3 className="font-semibold text-[#0F172A]">Profile</h3>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input defaultValue={user?.full_name || ''} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input defaultValue={user?.email || ''} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input defaultValue={user?.phone || ''} readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input defaultValue={user?.role || ''} readOnly className="bg-gray-50 capitalize" />
            </div>
          </div>
        </div>
      </Card>

      {/* Company */}
      <Card className="p-6 bg-white border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Building className="h-5 w-5 text-gray-400" />
          <h3 className="font-semibold text-[#0F172A]">Company Details</h3>
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input defaultValue="Dhara Financial Services" readOnly className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input defaultValue="DFS" readOnly className="bg-gray-50" />
            </div>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 bg-white border-red-200">
        <h3 className="font-semibold text-red-600 mb-4">Account Actions</h3>
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
          onClick={async () => { await signOut(); }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </Card>
    </div>
  );
}
