'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientSchema, type ClientFormData } from '@/lib/validations';
import { createClientAction, updateClientAction } from '@/lib/actions/clients';
import { getDocuments } from '@/lib/actions/documents';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { indianStates } from '@/lib/utils/helpers';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';

interface ClientFormProps {
  client?: Client;
  onSuccess: () => void;
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);

  useEffect(() => {
    if (client) {
      getDocuments(client.id)
        .then((docs) => {
          if (docs && docs.length > 0) {
            setHasDocuments(true);
          }
        })
        .catch((err) => console.error('Error checking documents in form:', err));
    }
  }, [client]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: client
      ? {
          name: client.name,
          pan: client.pan || '',
          aadhaar: client.aadhaar || '',
          mobile: client.mobile,
          email: client.email || '',
          dob: client.dob || '',
          anniversary: client.anniversary || '',
          address: client.address || '',
          city: client.city || '',
          state: client.state || '',
          pincode: client.pincode || '',
          occupation: client.occupation || '',
          risk_profile: client.risk_profile || undefined,
          notes: client.notes || '',
        }
      : {
          name: '',
          mobile: '',
        },
  });

  async function onSubmit(data: ClientFormData) {
    setLoading(true);
    try {
      const cleanData = {
        ...data,
        pan: data.pan || null,
        aadhaar: data.aadhaar || null,
        email: data.email || null,
        dob: data.dob || null,
        anniversary: data.anniversary || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        occupation: data.occupation || null,
        notes: data.notes || null,
      };

      const result = client
        ? await updateClientAction(client.id, cleanData)
        : await createClientAction(cleanData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(client ? 'Client updated successfully' : 'Client added successfully');
        onSuccess();
      }
    } catch (error) {
      toast.error('Something went wrong');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {hasDocuments && (
        <div className="rounded-lg bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200">
          <strong>Identity Data Protected:</strong> Core identity fields (Name, Mobile, Email, PAN, Aadhaar) are locked because this client has documents uploaded in their vault.
        </div>
      )}

      {/* Basic Information */}
      <div>
        <h4 className="text-sm font-semibold text-[#0F172A] mb-3">Basic Information</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Client Name *</Label>
            <Input 
              {...register('name')} 
              placeholder="Full Name" 
              readOnly={hasDocuments}
              className={cn(hasDocuments && "bg-gray-100 cursor-not-allowed")}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Mobile *</Label>
            <Input 
              {...register('mobile')} 
              placeholder="10 digit mobile" 
              maxLength={10} 
              readOnly={hasDocuments}
              className={cn(hasDocuments && "bg-gray-100 cursor-not-allowed")}
            />
            {errors.mobile && <p className="text-xs text-red-500">{errors.mobile.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>PAN</Label>
            <Input 
              {...register('pan')} 
              placeholder="ABCDE1234F" 
              maxLength={10} 
              className={cn("uppercase", hasDocuments && "bg-gray-100 cursor-not-allowed")}
              readOnly={hasDocuments}
            />
            {errors.pan && <p className="text-xs text-red-500">{errors.pan.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Aadhaar</Label>
            <Input 
              {...register('aadhaar')} 
              placeholder="12 digit number" 
              maxLength={12} 
              readOnly={hasDocuments}
              className={cn(hasDocuments && "bg-gray-100 cursor-not-allowed")}
            />
            {errors.aadhaar && <p className="text-xs text-red-500">{errors.aadhaar.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              {...register('email')} 
              type="email" 
              placeholder="email@example.com" 
              readOnly={hasDocuments}
              className={cn(hasDocuments && "bg-gray-100 cursor-not-allowed")}
            />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Occupation</Label>
            <Input {...register('occupation')} placeholder="Occupation" />
          </div>
        </div>
      </div>

      {/* Dates */}
      <div>
        <h4 className="text-sm font-semibold text-[#0F172A] mb-3">Important Dates</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input {...register('dob')} type="date" />
          </div>
          <div className="space-y-2">
            <Label>Anniversary</Label>
            <Input {...register('anniversary')} type="date" />
          </div>
        </div>
      </div>

      {/* Address */}
      <div>
        <h4 className="text-sm font-semibold text-[#0F172A] mb-3">Address</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <Input {...register('address')} placeholder="Street address" />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input {...register('city')} placeholder="City" />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select
              value={watch('state') || ''}
              onValueChange={(val) => setValue('state', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {indianStates.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Pincode</Label>
            <Input {...register('pincode')} placeholder="6 digit pincode" maxLength={6} />
            {errors.pincode && <p className="text-xs text-red-500">{errors.pincode.message}</p>}
          </div>
        </div>
      </div>

      {/* Risk Profile */}
      <div>
        <h4 className="text-sm font-semibold text-[#0F172A] mb-3">Investment Profile</h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Risk Profile</Label>
            <Select
              value={watch('risk_profile') || ''}
              onValueChange={(val: any) => setValue('risk_profile', val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Risk Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="very_aggressive">Very Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          {...register('notes')}
          placeholder="Any additional notes about the client..."
          rows={3}
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button type="submit" className="bg-[#0F172A] hover:bg-[#1E293B]" disabled={loading}>
          {loading ? 'Saving...' : client ? 'Update Client' : 'Add Client'}
        </Button>
      </div>
    </form>
  );
}
