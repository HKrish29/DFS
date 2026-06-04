'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getClients } from '@/lib/actions/clients';
import { getPortfolio } from '@/lib/actions/portfolio';
import { generateWhatsAppMessage, generateWhatsAppLink, formatCurrency, calculateInvestmentCAGR } from '@/lib/utils/helpers';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';
import { MessageSquare, Copy, ExternalLink, Send, Download, Search } from 'lucide-react';

// Dynamic import of PDF button component to completely isolate native pdf dependencies from SSR
const SimpleReportPDFButton = dynamic(
  () => import('@/components/reports/simple-report-pdf-button').then((mod) => mod.SimpleReportPDFButton),
  { ssr: false }
);

export default function WhatsAppPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [message, setMessage] = useState('');
  const [clientData, setClientData] = useState<{ name: string; mobile: string; portfolioValue?: string; pan?: string } | null>(null);
  
  // Date range filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    async function load() {
      try { const c = await getClients(); setClients(c); } catch {}
    }
    load();
  }, []);

  async function handleClientSelect(clientId: string) {
    setSelectedClient(clientId);
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    let portfolioValue: string | undefined;
    try {
      const portfolio = await getPortfolio(clientId);
      setPortfolioData(portfolio);
      if (portfolio?.portfolio?.current_value) {
        portfolioValue = formatCurrency(portfolio.portfolio.current_value);
      }
    } catch {}

    setClientData({ name: client.name, mobile: client.mobile, portfolioValue, pan: client.pan || '' });
    setMessage(generateWhatsAppMessage(client.name, portfolioValue));
  }

  // Filter investments based on selected date range
  const filteredInvestments = portfolioData?.investments?.filter((inv: any) => {
    if (!inv.purchase_date) return true; // Include if no date is provided
    if (startDate && inv.purchase_date < startDate) return false;
    if (endDate && inv.purchase_date > endDate) return false;
    return true;
  }) || [];

  const totalInvested = filteredInvestments.reduce((sum: number, inv: any) => sum + inv.invested_amount, 0);
  const totalCurrent = filteredInvestments.reduce((sum: number, inv: any) => sum + inv.current_value, 0);
  const totalGain = totalCurrent - totalInvested;

  let totalWeightAmount = 0;
  let weightedCagrSum = 0;
  for (const inv of filteredInvestments) {
    const cagr = calculateInvestmentCAGR(inv.invested_amount, inv.current_value, inv.purchase_date);
    if (cagr !== 0) {
      weightedCagrSum += cagr * inv.invested_amount;
      totalWeightAmount += inv.invested_amount;
    }
  }
  const portfolioCagr = totalWeightAmount > 0 ? weightedCagrSum / totalWeightAmount : 0;

  // Sync WhatsApp message template with selected dates and current filtered values
  useEffect(() => {
    if (!clientData) return;
    const formatDateStr = (ds: string) => {
      try {
        return new Date(ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ').join('-');
      } catch { return ds; }
    };
    const dateRangeStr = startDate && endDate 
      ? ` for the period ${formatDateStr(startDate)} to ${formatDateStr(endDate)}` 
      : '';
    const portfolioValStr = totalCurrent > 0 ? formatCurrency(totalCurrent) : clientData.portfolioValue;

    setMessage(
      `Dear ${clientData.name},\n\nPlease find your Dhara Financial Services (DFS) Mutual Fund Investment Report${dateRangeStr} here. \n\nPortfolio Value: ${portfolioValStr}\n\nWarm Regards,\nDhara Financial Services`
    );
  }, [clientData, startDate, endDate, totalCurrent]);

  function handleCopy() {
    navigator.clipboard.writeText(message);
    toast.success('Message copied to clipboard');
  }

  function handleShare() {
    if (!clientData) return;
    const link = generateWhatsAppLink(clientData.mobile, message);
    window.open(link, '_blank');
  }

  function handleBulkGenerate() {
    const messages = clients.map(c => ({
      name: c.name,
      mobile: c.mobile,
      message: generateWhatsAppMessage(c.name),
    }));

    const text = messages.map(m => `--- ${m.name} (${m.mobile}) ---\n${m.message}`).join('\n\n');
    navigator.clipboard.writeText(text);
    toast.success(`${messages.length} messages copied to clipboard`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A]">WhatsApp Messages</h1>
          <p className="text-sm text-gray-500">Generate ready-to-send messages for clients</p>
        </div>
        <Button variant="outline" onClick={handleBulkGenerate}>
          <Copy className="h-4 w-4 mr-2" /> Bulk Copy All
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Client Selection */}
        <Card className="p-6 bg-white border-gray-200">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Select Client</h3>
          
          <div className="flex flex-col gap-2.5 sm:flex-row mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search client by name, mobile, PAN..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            {clientSearch && (
              <Button variant="ghost" onClick={() => setClientSearch('')} className="h-10 text-gray-500 hover:text-gray-700">
                Clear
              </Button>
            )}
          </div>

          {clientSearch ? (
            <div className="border border-gray-150 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto mb-3 bg-white shadow-sm">
              {(() => {
                const filteredClients = clients.filter(c =>
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.mobile.includes(clientSearch) ||
                  (c.pan && c.pan.toLowerCase().includes(clientSearch.toLowerCase()))
                );
                if (filteredClients.length === 0) {
                  return <div className="p-3 text-center text-xs text-gray-400">No clients match search</div>;
                }
                return filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      handleClientSelect(c.id);
                      setClientSearch('');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50/50 text-sm font-medium flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-[#0F172A] font-semibold">{c.name}</span>
                      <span className="text-xs text-gray-500 ml-2">({c.mobile})</span>
                    </div>
                    {c.pan && (
                      <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-550 border border-gray-200">
                        {c.pan}
                      </span>
                    )}
                  </button>
                ));
              })()}
            </div>
          ) : (
            <Select value={selectedClient} onValueChange={(val) => handleClientSelect(val || '')}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobile}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {clientData && (
            <div className="mt-4 space-y-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm font-medium">{clientData.name}</p>
                <p className="text-xs text-gray-500">{clientData.mobile}</p>
                {(totalCurrent > 0 || clientData.portfolioValue) && (
                  <p className="text-xs text-gray-500 mt-1">
                    Portfolio Value: {totalCurrent > 0 ? formatCurrency(totalCurrent) : clientData.portfolioValue}
                  </p>
                )}
              </div>

              {/* Date Filters */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              
              {startDate || endDate ? (
                <div className="text-xs text-gray-500 italic bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 flex justify-between">
                  <span>Showing mutual fund investments filtered by date range.</span>
                  <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-blue-600 hover:underline font-semibold">Clear</button>
                </div>
              ) : null}
            </div>
          )}
        </Card>

        {/* Message Preview */}
        <Card className="p-6 bg-white border-gray-200">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Message Preview</h3>
          {message && clientData ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-100 p-4">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="bg-transparent border-none focus-visible:ring-0 resize-none p-0 text-sm font-medium text-gray-805 text-gray-800"
                />
              </div>
              <div className="flex flex-col gap-3">
                <SimpleReportPDFButton
                  clientName={clientData.name}
                  pan={clientData.pan || ''}
                  startDate={startDate}
                  endDate={endDate}
                  investments={filteredInvestments}
                  totalInvested={totalInvested}
                  totalCurrent={totalCurrent}
                  totalGain={totalGain}
                  portfolioCagr={portfolioCagr}
                />

                <div className="flex gap-3">
                  <Button onClick={handleCopy} variant="outline" className="flex-1 font-semibold">
                    <Copy className="h-4 w-4 mr-2" /> Copy Text
                  </Button>
                  <Button onClick={handleShare} className="flex-1 bg-green-600 hover:bg-green-700 font-semibold text-white">
                    <Send className="h-4 w-4 mr-2" /> Send via WhatsApp
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageSquare className="h-8 w-8 mb-2" />
              <p className="text-sm">Select a client to generate message</p>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Templates */}
      <Card className="p-6 bg-white border-gray-200">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Quick Templates</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Market Update', msg: 'Dear {name},\n\nIndian markets remained strong this month. Long term wealth is created through discipline and patience.\n\nYour Portfolio Summary is attached.\n\nRegards,\nDhara Financial Services' },
            { title: 'SIP Reminder', msg: 'Dear {name},\n\nThis is a friendly reminder that your SIP is due this week. Please ensure sufficient balance in your bank account.\n\nRegards,\nDhara Financial Services' },
            { title: 'Birthday Wish', msg: 'Dear {name},\n\nWishing you a very Happy Birthday! 🎂\n\nMay this year bring you good health, happiness, and financial growth.\n\nWarm Regards,\nDhara Financial Services' },
            { title: 'Anniversary Wish', msg: 'Dear {name},\n\nHappy Wedding Anniversary! 💐\n\nWishing you many more years of togetherness and prosperity.\n\nWarm Regards,\nDhara Financial Services' },
            { title: 'Review Meeting', msg: 'Dear {name},\n\nIt\'s time for your quarterly portfolio review. Let\'s schedule a meeting at your convenience.\n\nPlease let me know your preferred date and time.\n\nRegards,\nDhara Financial Services' },
            { title: 'New Year', msg: 'Dear {name},\n\nWishing you a very Happy New Year! 🎉\n\nMay this year bring prosperity and help you achieve all your financial goals.\n\nRegards,\nDhara Financial Services' },
          ].map((template) => (
            <button
              key={template.title}
              onClick={() => {
                const name = clientData?.name || 'Client';
                setMessage(template.msg.replace(/{name}/g, name));
                toast.success(`"${template.title}" template loaded`);
              }}
              className="rounded-lg border p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <p className="text-sm font-medium text-[#0F172A]">{template.title}</p>
              <p className="text-xs text-gray-400 mt-1 line-clamp-2">{template.msg.split('\n')[2]}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
