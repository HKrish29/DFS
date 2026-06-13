import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LandingFooter } from '@/components/layout/landing-footer';
import {
  ArrowRight,
  TrendingUp,
  Shield,
  Users,
  Briefcase,
  FileText,
  Target,
  MessageSquare,
  Lock,
  Calendar,
  CheckCircle,
} from 'lucide-react';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F172A] text-white font-bold text-sm">
              DFS
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#0F172A] leading-tight">Dhara Financial</span>
              <span className="text-[10px] text-gray-500 font-semibold leading-tight">Services</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-950 transition-colors">Features</a>
            <a href="#about" className="hover:text-gray-950 transition-colors">About Us</a>
            <a href="#stats" className="hover:text-gray-950 transition-colors">Performance</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <Link href="/dashboard">
                <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-xs h-9">
                  Go to Dashboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button className="bg-[#0F172A] hover:bg-[#1E293B] text-xs h-9">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Call to Action Text */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                <span className="flex h-2 w-2 rounded-full bg-green-500" />
                Empowering Independent Wealth Advisories
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#0F172A] leading-tight">
                Smarter Wealth Management, <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Unified CRM</span>.
              </h1>
              <p className="text-base sm:text-lg text-gray-500 max-w-xl leading-relaxed">
                The all-in-one platform built specifically for financial advisors, wealth managers, and family offices. Track portfolios, structure family groups, map goals, and communicate securely.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-2">
                {user ? (
                  <Link href="/dashboard">
                    <Button size="lg" className="bg-[#0F172A] hover:bg-[#1E293B] shadow-md shadow-slate-900/10">
                      Enter Portal <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login">
                      <Button size="lg" className="bg-[#0F172A] hover:bg-[#1E293B] shadow-md shadow-slate-900/10">
                        Sign In <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Premium Interactive Dashboard Preview */}
            <div className="lg:col-span-6 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/25 to-indigo-500/25 rounded-3xl blur-3xl" />
              <div className="relative w-full max-w-md lg:max-w-none bg-slate-900 rounded-2xl shadow-2xl shadow-slate-900/40 p-6 border border-slate-800/80 text-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400">DFS SECURE PORTAL</span>
                </div>

                <div className="space-y-4">
                  {/* Dashboard Metric Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total AUM</p>
                      <p className="text-xl font-extrabold text-white mt-1">₹15.82 Cr</p>
                      <span className="text-[10px] text-green-400 flex items-center mt-1">
                        <TrendingUp className="h-3 w-3 mr-0.5" /> +14.2% YoY
                      </span>
                    </div>
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Active Clients</p>
                      <p className="text-xl font-extrabold text-white mt-1">124 Profiles</p>
                      <span className="text-[10px] text-slate-400 mt-1">26 Family Groups</span>
                    </div>
                  </div>

                  {/* Document Lock Mock Row */}
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-500/15 p-2 rounded-lg text-blue-400">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Protected Vault Mode</p>
                        <p className="text-[10px] text-slate-400">Core client details locked upon upload</p>
                      </div>
                    </div>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      ACTIVE
                    </span>
                  </div>

                  {/* Activity log mockup */}
                  <div className="bg-slate-850 rounded-xl p-3 border border-slate-800/60">
                    <p className="text-[10px] font-bold text-slate-400 mb-2">Live Activity Log</p>
                    <div className="space-y-2 text-[10px]">
                      <div className="flex justify-between text-slate-300">
                        <span>👤 Rajesh Sharma</span>
                        <span className="text-slate-500">2m ago</span>
                      </div>
                      <p className="text-slate-400">Uploaded file PAN_Card.pdf • Locked core fields</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-slate-50/50 border-t border-gray-150">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              Engineered for Premier Wealth Management
            </h2>
            <p className="text-gray-500 text-sm sm:text-base">
              A comprehensive toolset designed to simplify your administrative workflow while ensuring absolute security and audit readiness.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="p-6 bg-white border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="rounded-lg bg-blue-50 p-3 w-fit text-[#2563EB] mb-4">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-[#0F172A] mb-2">Portfolio Analytics</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Consolidate mid-caps, equities, and term deposits. View real-time purchase NAV, current values, and calculated absolute gains.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="p-6 bg-white border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="rounded-lg bg-emerald-50 p-3 w-fit text-emerald-600 mb-4">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-[#0F172A] mb-2">Secure Document Vault</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Store Aadhaar cards, PAN, and statements in client vaults. Checks for duplicate files on upload to maintain a clean database.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="p-6 bg-white border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="rounded-lg bg-amber-50 p-3 w-fit text-amber-600 mb-4">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-[#0F172A] mb-2">Client Compliance Lock</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Prevents accidental updates. Once a file is added, core identification details (Name, Mobile, Email, PAN, Aadhaar) are automatically locked.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="p-6 bg-white border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="rounded-lg bg-purple-50 p-3 w-fit text-purple-600 mb-4">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-[#0F172A] mb-2">Family Household Groups</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Group multiple clients together under one family household. View grouped portfolios, goals, and consolidated performance reports.
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="p-6 bg-white border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="rounded-lg bg-indigo-50 p-3 w-fit text-indigo-600 mb-4">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-[#0F172A] mb-2">Goal Achievements</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Map SIPs to retirement plans, higher education, or villa purchases. Track achievement percentages dynamically.
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="p-6 bg-white border-gray-200 hover:shadow-md transition-shadow duration-200">
              <div className="rounded-lg bg-pink-50 p-3 w-fit text-pink-600 mb-4">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg text-[#0F172A] mb-2">WhatsApp & CRM Workflows</h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Draft follow-up tasks, schedule birthday greetings, and connect directly to WhatsApp with pre-written templates.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Metrics / Stats Section */}
      <section id="stats" className="py-20 bg-white border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 grid-cols-2 md:grid-cols-4 text-center">
            <div className="space-y-2">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">₹15+ Cr</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Assets Advisory</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">120+</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Active Clients</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">99.9%</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">System Uptime</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl sm:text-4xl font-extrabold text-[#0F172A]">256-bit</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Data Encryption</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action banner */}
      <section className="py-16 bg-[#0F172A] text-white">
        <div className="mx-auto max-w-5xl px-4 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Ready to upgrade your financial practice?
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Get started today with Dhara Financial Services. Manage your clients with next-level precision, compliant tools, and structured analytics.
          </p>
          <div className="pt-2">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" className="bg-white hover:bg-slate-100 text-[#0F172A] font-semibold">
                  Access Portal <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button size="lg" className="bg-white hover:bg-slate-100 text-[#0F172A] font-semibold">
                  Get Started Now <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
