'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/lib/validations';
import { signIn } from '@/lib/actions/auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { ContactDialog } from '@/components/layout/contact-dialog';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setLoading(true);
    setError('');
    try {
      const result = await signIn(data);
      if (result?.error) {
        setError(result.error);
      }
    } catch {
      // redirect happens on success
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0F172A] text-white font-bold text-xl">
            DFS
          </div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Dhara Financial Services</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        {/* Form */}
        <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#0F172A] hover:bg-[#1E293B]"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs text-gray-400">
              DFS Internal Platform • Offline Version
            </p>
            <div className="flex flex-col items-center gap-1.5 pt-2 border-t border-gray-50">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">System Developers</span>
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="w-full relative px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-extrabold text-xs rounded-lg shadow-[0_3px_0_0_#1e40af] hover:shadow-[0_1px_0_0_#1e40af] active:shadow-none hover:translate-y-[1px] active:translate-y-[3px] border border-blue-500 transition-all cursor-pointer text-center"
              >
                NirQuants Team 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
    </div>
  );
}
