'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getClients } from '@/lib/actions/clients';
import { getPortfolio } from '@/lib/actions/portfolio';
import { formatCurrency, calculateAbsoluteReturn, formatDate } from '@/lib/utils/helpers';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';
import { FileText, Download, Printer } from 'lucide-react';

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [portfolio, setPortfolio] = useState<any>(null);
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    async function load() {
      try { const c = await getClients(); setClients(c); } catch {}
    }
    load();
  }, []);

  async function handleClientSelect(clientId: string) {
    setSelectedClient(clientId);
    const c = clients.find(cl => cl.id === clientId) || null;
    setClient(c);
    try {
      const p = await getPortfolio(clientId);
      setPortfolio(p);
    } catch {}
  }

  function handlePrint() {
    window.print();
  }

  const invested = portfolio?.portfolio?.total_invested || 0;
  const current = portfolio?.portfolio?.current_value || 0;
  const gain = current - invested;
  const returnPct = calculateAbsoluteReturn(invested, current);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">Reports</h1>
          <p className="text-sm text-gray-500">Generate portfolio and client reports</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end print:hidden">
        <div className="flex-1 max-w-sm">
          <label className="text-sm font-medium mb-1 block">Select Client</label>
          <Select value={selectedClient} onValueChange={(val) => handleClientSelect(val || '')}>
            <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobile}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedClient && (
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" /> Print / Save as PDF
          </Button>
        )}
      </div>

      {!selectedClient ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200 print:hidden">
          <FileText className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Select a client to generate report</p>
        </Card>
      ) : (
        <div id="report-content" className="bg-white border border-gray-200 rounded-xl p-8 print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-[#0F172A] flex items-center justify-center text-white font-bold">DFS</div>
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Dhara Financial Services</h2>
                <p className="text-xs text-gray-500">Wealth Management & Advisory</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#0F172A]">Portfolio Summary</p>
              <p className="text-xs text-gray-500">{formatDate(new Date().toISOString())}</p>
            </div>
          </div>

          {/* Client Info */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Client Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{client?.name}</span></div>
              <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{client?.mobile}</span></div>
              {client?.pan && <div><span className="text-gray-500">PAN:</span> <span className="font-medium">{client.pan}</span></div>}
              {client?.email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{client.email}</span></div>}
            </div>
          </div>

          {/* Portfolio Summary */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Portfolio Summary</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Investment</p>
                <p className="text-lg font-bold">{formatCurrency(invested)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Current Value</p>
                <p className="text-lg font-bold">{formatCurrency(current)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Gain/Loss</p>
                <p className={`text-lg font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(gain)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Returns</p>
                <p className={`text-lg font-bold ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>{returnPct.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          {/* Holdings */}
          {portfolio?.investments?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Holdings</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Scheme</th>
                    <th className="pb-2 font-medium">AMC</th>
                    <th className="pb-2 font-medium text-right">Invested</th>
                    <th className="pb-2 font-medium text-right">Current</th>
                    <th className="pb-2 font-medium text-right">Gain/Loss</th>
                    <th className="pb-2 font-medium text-right">Return %</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.investments.map((inv: any) => {
                    const g = inv.current_value - inv.invested_amount;
                    const r = calculateAbsoluteReturn(inv.invested_amount, inv.current_value);
                    return (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{inv.scheme_name}</td>
                        <td className="py-2 text-gray-500">{inv.amc || '-'}</td>
                        <td className="py-2 text-right">{formatCurrency(inv.invested_amount)}</td>
                        <td className="py-2 text-right">{formatCurrency(inv.current_value)}</td>
                        <td className={`py-2 text-right ${g >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(g)}</td>
                        <td className={`py-2 text-right ${r >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.toFixed(2)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* SIPs */}
          {portfolio?.sips?.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Active SIPs</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">Scheme</th>
                    <th className="pb-2 font-medium text-right">Amount</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.sips.map((sip: any) => (
                    <tr key={sip.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{sip.scheme_name}</td>
                      <td className="py-2 text-right">{formatCurrency(sip.amount)}</td>
                      <td className="py-2">{sip.sip_date}th</td>
                      <td className="py-2 capitalize">{sip.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="border-t pt-4 mt-8 text-center">
            <p className="text-xs text-gray-400">This report is generated by Dhara Financial Services for informational purposes only.</p>
            <p className="text-xs text-gray-400 mt-1">Past performance does not guarantee future results. Please consult your financial advisor before making investment decisions.</p>
          </div>
        </div>
      )}
    </div>
  );
}
