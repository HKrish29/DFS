'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getClients } from '@/lib/actions/clients';
import { getPortfolio } from '@/lib/actions/portfolio';
import { generateWhatsAppMessage, generateWhatsAppLink, formatCurrency } from '@/lib/utils/helpers';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';
import { MessageSquare, Copy, ExternalLink, Send } from 'lucide-react';

export default function WhatsAppPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [message, setMessage] = useState('');
  const [clientData, setClientData] = useState<{ name: string; mobile: string; portfolioValue?: string } | null>(null);

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
      if (portfolio?.portfolio?.current_value) {
        portfolioValue = formatCurrency(portfolio.portfolio.current_value);
      }
    } catch {}

    setClientData({ name: client.name, mobile: client.mobile, portfolioValue });
    setMessage(generateWhatsAppMessage(client.name, portfolioValue));
  }

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

          {clientData && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-medium">{clientData.name}</p>
              <p className="text-xs text-gray-500">{clientData.mobile}</p>
              {clientData.portfolioValue && (
                <p className="text-xs text-gray-500 mt-1">Portfolio: {clientData.portfolioValue}</p>
              )}
            </div>
          )}
        </Card>

        {/* Message Preview */}
        <Card className="p-6 bg-white border-gray-200">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Message</h3>
          {message ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-green-50 border border-green-100 p-4">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="bg-transparent border-none focus-visible:ring-0 resize-none p-0"
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCopy} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
                <Button onClick={handleShare} className="flex-1 bg-green-600 hover:bg-green-700">
                  <Send className="h-4 w-4 mr-2" /> Send via WhatsApp
                </Button>
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
