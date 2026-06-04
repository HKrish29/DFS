import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getPortfolio } from '@/lib/actions/portfolio';
import { getGoals } from '@/lib/actions/goals';
import { getDocuments } from '@/lib/actions/documents';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, calculateAbsoluteReturn, goalTypeLabels } from '@/lib/utils/helpers';
import { signOut } from '@/lib/actions/auth';
import { Briefcase, Target, FileText, LogOut } from 'lucide-react';

export default async function ClientPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Find client record for this user
  const { data: clientRecord } = await supabase
    .from('clients')
    .select('*')
    .eq('email', user.email)
    .eq('is_active', true)
    .single();

  let portfolio = null;
  let goals: any[] = [];
  let documents: any[] = [];

  if (clientRecord) {
    try {
      [portfolio, goals, documents] = await Promise.all([
        getPortfolio(clientRecord.id),
        getGoals(clientRecord.id),
        getDocuments(clientRecord.id),
      ]);
    } catch {}
  }

  const invested = portfolio?.portfolio?.total_invested || 0;
  const current = portfolio?.portfolio?.current_value || 0;
  const gain = current - invested;
  const returnPct = calculateAbsoluteReturn(invested, current);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#0F172A] flex items-center justify-center text-white font-bold text-sm">DFS</div>
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">Dhara Financial Services</h1>
              <p className="text-xs text-gray-500">Client Portal</p>
            </div>
          </div>
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="h-4 w-4 mr-2" /> Logout
            </Button>
          </form>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Welcome */}
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">
            Welcome, {clientRecord?.name || user.email}
          </h2>
          <p className="text-sm text-gray-500">Your financial overview</p>
        </div>

        {!clientRecord ? (
          <Card className="p-8 bg-white text-center">
            <p className="text-gray-500">Your client profile is being set up. Please contact your advisor.</p>
          </Card>
        ) : (
          <>
            {/* Portfolio Summary */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Card className="p-4 bg-white">
                <p className="text-xs text-gray-500">Investment</p>
                <p className="text-lg font-bold">{formatCurrency(invested)}</p>
              </Card>
              <Card className="p-4 bg-white">
                <p className="text-xs text-gray-500">Current Value</p>
                <p className="text-lg font-bold">{formatCurrency(current)}</p>
              </Card>
              <Card className="p-4 bg-white">
                <p className="text-xs text-gray-500">Gain/Loss</p>
                <p className={`text-lg font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(gain)}</p>
              </Card>
              <Card className="p-4 bg-white">
                <p className="text-xs text-gray-500">Return</p>
                <p className={`text-lg font-bold ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{returnPct.toFixed(2)}%</p>
              </Card>
            </div>

            {/* Holdings */}
            {portfolio?.investments && portfolio.investments.length > 0 && (
              <Card className="p-6 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-5 w-5 text-[#2563EB]" />
                  <h3 className="font-semibold text-[#0F172A]">My Investments</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Scheme</th>
                        <th className="pb-2 font-medium text-right">Invested</th>
                        <th className="pb-2 font-medium text-right">Current</th>
                        <th className="pb-2 font-medium text-right">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.investments.map((inv: any) => {
                        const g = inv.current_value - inv.invested_amount;
                        return (
                          <tr key={inv.id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{inv.scheme_name}</td>
                            <td className="py-2 text-right">{formatCurrency(inv.invested_amount)}</td>
                            <td className="py-2 text-right">{formatCurrency(inv.current_value)}</td>
                            <td className={`py-2 text-right ${g >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(g)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Goals */}
            {goals.length > 0 && (
              <Card className="p-6 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-[#2563EB]" />
                  <h3 className="font-semibold text-[#0F172A]">My Goals</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {goals.map(goal => {
                    const progress = goal.target_amount > 0 ? (goal.current_investment / goal.target_amount) * 100 : 0;
                    return (
                      <div key={goal.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium">{goal.goal_name}</h5>
                          <Badge variant="secondary" className="capitalize text-xs">{goalTypeLabels[goal.goal_type]}</Badge>
                        </div>
                        <p className="text-xs text-gray-500">Target: {formatCurrency(goal.target_amount)}</p>
                        <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{progress.toFixed(1)}% achieved</p>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <Card className="p-6 bg-white">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-[#2563EB]" />
                  <h3 className="font-semibold text-[#0F172A]">My Documents</h3>
                </div>
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium">{doc.file_name}</p>
                          <p className="text-xs text-gray-400 capitalize">{doc.doc_type}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">© 2025 Dhara Financial Services. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
