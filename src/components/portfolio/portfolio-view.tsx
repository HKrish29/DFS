'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPortfolio, addInvestmentAction, addSipAction, getAssetAllocation, getAmcAllocation } from '@/lib/actions/portfolio';
import { formatCurrency, calculateAbsoluteReturn, calculateInvestmentCAGR } from '@/lib/utils/helpers';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';
import { Plus, TrendingUp, TrendingDown, IndianRupee, Briefcase, Search } from 'lucide-react';

const COLORS = ['#2563EB', '#0F172A', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

interface PortfolioViewProps {
  clients: Client[];
  selectedClientId?: string;
}

export function PortfolioView({ clients, selectedClientId }: PortfolioViewProps) {
  const [clientId, setClientId] = useState(selectedClientId || '');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [assetAllocation, setAssetAllocation] = useState<any[]>([]);
  const [amcAllocation, setAmcAllocation] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInvDialog, setShowInvDialog] = useState(false);
  const [showSipDialog, setShowSipDialog] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Investment form state
  const [invForm, setInvForm] = useState({
    scheme_name: '', amc: '', category: '', folio_number: '',
    invested_amount: '', current_value: '', units: '', nav: '',
    investment_type: 'lumpsum' as const, purchase_date: '',
  });

  // SIP form state
  const [sipForm, setSipForm] = useState({
    scheme_name: '', amc: '', amount: '', sip_date: '1',
    start_date: '', frequency: 'monthly' as const, status: 'active' as const,
  });

  useEffect(() => {
    if (clientId) loadPortfolio();
  }, [clientId]);

  async function loadPortfolio() {
    setLoading(true);
    try {
      const [data, assets, amcs] = await Promise.all([
        getPortfolio(clientId),
        getAssetAllocation(clientId),
        getAmcAllocation(clientId),
      ]);
      setPortfolio(data);
      setAssetAllocation(assets);
      setAmcAllocation(amcs);
    } catch {}
    setLoading(false);
  }

  async function handleAddInvestment() {
    const result = await addInvestmentAction({
      client_id: clientId,
      scheme_name: invForm.scheme_name,
      scheme_code: null,
      amc: invForm.amc || null,
      category: invForm.category || null,
      folio_number: invForm.folio_number || null,
      invested_amount: Number(invForm.invested_amount),
      current_value: Number(invForm.current_value),
      units: Number(invForm.units),
      nav: Number(invForm.nav),
      purchase_date: invForm.purchase_date || null,
      investment_type: invForm.investment_type,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Investment added');
      setShowInvDialog(false);
      loadPortfolio();
    }
  }

  async function handleAddSip() {
    const result = await addSipAction({
      client_id: clientId,
      scheme_name: sipForm.scheme_name,
      scheme_code: null,
      amc: sipForm.amc || null,
      folio_number: null,
      amount: Number(sipForm.amount),
      sip_date: Number(sipForm.sip_date),
      start_date: sipForm.start_date,
      end_date: null,
      frequency: sipForm.frequency,
      status: sipForm.status,
    });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('SIP added');
      setShowSipDialog(false);
      loadPortfolio();
    }
  }

  const invested = portfolio?.portfolio?.total_invested || 0;
  const current = portfolio?.portfolio?.current_value || 0;
  const gain = current - invested;
  const returnPct = calculateAbsoluteReturn(invested, current);

  let totalWeightAmount = 0;
  let weightedCagrSum = 0;
  if (portfolio?.investments) {
    for (const inv of portfolio.investments) {
      const cagr = calculateInvestmentCAGR(inv.invested_amount, inv.current_value, inv.purchase_date);
      if (cagr !== 0) {
        weightedCagrSum += cagr * inv.invested_amount;
        totalWeightAmount += inv.invested_amount;
      }
    }
  }
  const portfolioCagr = totalWeightAmount > 0 ? weightedCagrSum / totalWeightAmount : 0;

  // Filter clients based on search input
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.mobile.includes(clientSearch) ||
    (c.pan && c.pan.toLowerCase().includes(clientSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Client Selection */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 w-full sm:w-80">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search client by name, mobile, PAN..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          {clientSearch ? (
            <div className="border border-gray-150 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto bg-white shadow-sm w-full">
              {(() => {
                if (filteredClients.length === 0) {
                  return <div className="p-2.5 text-center text-xs text-gray-400">No clients match search</div>;
                }
                return filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setClientId(c.id);
                      setClientSearch('');
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50/50 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-[#0F172A] font-semibold">{c.name}</span>
                      <span className="text-[10px] text-gray-500 ml-1.5">({c.mobile})</span>
                    </div>
                    {c.pan && (
                      <span className="text-[9px] bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-550 border border-gray-200">
                        {c.pan}
                      </span>
                    )}
                  </button>
                ));
              })()}
            </div>
          ) : (
            <Select value={clientId} onValueChange={(val) => setClientId(val || '')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name} - {client.mobile}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {clientId && (
          <div className="flex gap-2">
            <Button onClick={() => setShowInvDialog(true)} className="bg-[#0F172A] hover:bg-[#1E293B]">
              <Plus className="h-4 w-4 mr-2" /> Add Investment
            </Button>
            <Button onClick={() => setShowSipDialog(true)} variant="outline">
              <Plus className="h-4 w-4 mr-2" /> Add SIP
            </Button>
          </div>
        )}
      </div>

      {!clientId ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200">
          <Briefcase className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500">Select a client to view portfolio</p>
        </Card>
      ) : loading ? (
        <Card className="flex items-center justify-center py-20 bg-white border-gray-200">
          <p className="text-gray-500">Loading portfolio...</p>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500">Investment</p>
              <p className="text-lg font-bold">{formatCurrency(invested)}</p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500">Current Value</p>
              <p className="text-lg font-bold">{formatCurrency(current)}</p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500">Gain/Loss</p>
              <p className={`text-lg font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(gain)}
              </p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500">Abs. Return</p>
              <p className={`text-lg font-bold ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {returnPct.toFixed(2)}%
              </p>
            </Card>
            <Card className="p-4 bg-white border-gray-200">
              <p className="text-xs text-gray-500">Ann. Return (CAGR)</p>
              <p className={`text-lg font-bold ${portfolioCagr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioCagr !== 0 ? `${portfolioCagr.toFixed(2)}%` : '-'}
              </p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-6 bg-white border-gray-200">
              <h3 className="text-sm font-semibold mb-4">Asset Allocation</h3>
              {assetAllocation.length > 0 ? (
                <div className="h-[200px] w-full min-w-[200px] min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height: 200 }}>
                    <PieChart>
                      <Pie data={assetAllocation} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                        {assetAllocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v || 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-gray-400 text-center py-12">No data</p>}
            </Card>
            <Card className="p-6 bg-white border-gray-200">
              <h3 className="text-sm font-semibold mb-4">AMC Allocation</h3>
              {amcAllocation.length > 0 ? (
                <div className="h-[200px] w-full min-w-[200px] min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 200, height: 200 }}>
                    <PieChart>
                      <Pie data={amcAllocation} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="value">
                        {amcAllocation.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(v || 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <p className="text-sm text-gray-400 text-center py-12">No data</p>}
            </Card>
          </div>

          {/* Investments Table */}
          <Card className="p-6 bg-white border-gray-200">
            <h3 className="text-sm font-semibold mb-4">Investments</h3>
            {portfolio?.investments?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Scheme</th>
                      <th className="pb-3 font-medium">AMC</th>
                      <th className="pb-3 font-medium">Category</th>
                      <th className="pb-3 font-medium text-right">Invested</th>
                      <th className="pb-3 font-medium text-right">Current</th>
                      <th className="pb-3 font-medium text-right">Gain</th>
                      <th className="pb-3 font-medium text-right text-nowrap">Abs. Return</th>
                      <th className="pb-3 font-medium text-right">CAGR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.investments.map((inv: any) => {
                      const g = inv.current_value - inv.invested_amount;
                      const r = calculateAbsoluteReturn(inv.invested_amount, inv.current_value);
                      const cagr = calculateInvestmentCAGR(inv.invested_amount, inv.current_value, inv.purchase_date);
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-3 font-medium max-w-[200px] truncate">{inv.scheme_name}</td>
                          <td className="py-3 text-gray-500">{inv.amc || '-'}</td>
                          <td className="py-3 text-gray-500">{inv.category || '-'}</td>
                          <td className="py-3 text-right">{formatCurrency(inv.invested_amount)}</td>
                          <td className="py-3 text-right">{formatCurrency(inv.current_value)}</td>
                          <td className={`py-3 text-right ${g >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(g)}
                          </td>
                          <td className={`py-3 text-right ${r >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {r.toFixed(2)}%
                          </td>
                          <td className={`py-3 text-right ${cagr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {cagr !== 0 ? `${cagr.toFixed(2)}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-8">No investments</p>}
          </Card>

          {/* SIPs Table */}
          <Card className="p-6 bg-white border-gray-200">
            <h3 className="text-sm font-semibold mb-4">SIPs</h3>
            {portfolio?.sips?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Scheme</th>
                      <th className="pb-3 font-medium">AMC</th>
                      <th className="pb-3 font-medium text-right">Amount</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Frequency</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.sips.map((sip: any) => (
                      <tr key={sip.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{sip.scheme_name}</td>
                        <td className="py-3 text-gray-500">{sip.amc || '-'}</td>
                        <td className="py-3 text-right">{formatCurrency(sip.amount)}</td>
                        <td className="py-3">{sip.sip_date}th</td>
                        <td className="py-3 capitalize">{sip.frequency}</td>
                        <td className="py-3">
                          <Badge variant={sip.status === 'active' ? 'default' : 'secondary'}>{sip.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-8">No SIPs</p>}
          </Card>
        </>
      )}

      {/* Add Investment Dialog */}
      <Dialog open={showInvDialog} onOpenChange={setShowInvDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Investment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scheme Name *</Label>
              <Input value={invForm.scheme_name} onChange={e => setInvForm({ ...invForm, scheme_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>AMC</Label>
                <Input value={invForm.amc} onChange={e => setInvForm({ ...invForm, amc: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input value={invForm.category} onChange={e => setInvForm({ ...invForm, category: e.target.value })} placeholder="Equity, Debt, etc." />
              </div>
              <div className="space-y-2">
                <Label>Invested Amount *</Label>
                <Input type="number" value={invForm.invested_amount} onChange={e => setInvForm({ ...invForm, invested_amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Current Value *</Label>
                <Input type="number" value={invForm.current_value} onChange={e => setInvForm({ ...invForm, current_value: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Units</Label>
                <Input type="number" value={invForm.units} onChange={e => setInvForm({ ...invForm, units: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>NAV</Label>
                <Input type="number" value={invForm.nav} onChange={e => setInvForm({ ...invForm, nav: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={invForm.investment_type} onValueChange={(v) => { if (v) setInvForm({ ...invForm, investment_type: v as any }); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lumpsum">Lumpsum</SelectItem>
                  <SelectItem value="sip">SIP</SelectItem>
                  <SelectItem value="switch">Switch</SelectItem>
                  <SelectItem value="redemption">Redemption</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddInvestment} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">Add Investment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add SIP Dialog */}
      <Dialog open={showSipDialog} onOpenChange={setShowSipDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add SIP</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Scheme Name *</Label>
              <Input value={sipForm.scheme_name} onChange={e => setSipForm({ ...sipForm, scheme_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>AMC</Label>
                <Input value={sipForm.amc} onChange={e => setSipForm({ ...sipForm, amc: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input type="number" value={sipForm.amount} onChange={e => setSipForm({ ...sipForm, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>SIP Date *</Label>
                <Input type="number" min={1} max={31} value={sipForm.sip_date} onChange={e => setSipForm({ ...sipForm, sip_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={sipForm.start_date} onChange={e => setSipForm({ ...sipForm, start_date: e.target.value })} />
              </div>
            </div>
            <Button onClick={handleAddSip} className="w-full bg-[#0F172A] hover:bg-[#1E293B]">Add SIP</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
