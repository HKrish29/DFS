'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate, formatCurrency, riskProfileLabels, calculateAbsoluteReturn } from '@/lib/utils/helpers';
import type { Client, Portfolio, Goal, Document as DocType, Note } from '@/lib/types';
import {
  Phone, Mail, MapPin, Calendar, Briefcase, Target, FileText,
  StickyNote, ArrowLeft, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

interface ClientDetailProps {
  client: Client;
  portfolio: any;
  goals: Goal[];
  documents: DocType[];
  notes: Note[];
}

export function ClientDetail({ client, portfolio, goals, documents, notes }: ClientDetailProps) {
  const invested = portfolio?.portfolio?.total_invested || 0;
  const current = portfolio?.portfolio?.current_value || 0;
  const gain = current - invested;
  const returnPct = calculateAbsoluteReturn(invested, current);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#0F172A]">{client.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {client.pan && <span className="text-xs text-gray-500">PAN: {client.pan}</span>}
            {client.risk_profile && (
              <Badge variant="secondary" className="text-xs">
                {riskProfileLabels[client.risk_profile]}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/portfolio?client=${client.id}`}>
            <Button variant="outline" size="sm">
              <Briefcase className="h-4 w-4 mr-1" />
              Portfolio
            </Button>
          </Link>
          <Link href={`/whatsapp?client=${client.id}`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>
          </Link>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 bg-white border-gray-200">
          <p className="text-xs text-gray-500">Investment</p>
          <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(invested)}</p>
        </Card>
        <Card className="p-4 bg-white border-gray-200">
          <p className="text-xs text-gray-500">Current Value</p>
          <p className="text-lg font-bold text-[#0F172A]">{formatCurrency(current)}</p>
        </Card>
        <Card className="p-4 bg-white border-gray-200">
          <p className="text-xs text-gray-500">Gain/Loss</p>
          <p className={`text-lg font-bold ${gain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(gain)}
          </p>
        </Card>
        <Card className="p-4 bg-white border-gray-200">
          <p className="text-xs text-gray-500">Return</p>
          <p className={`text-lg font-bold ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {returnPct.toFixed(2)}%
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Information</TabsTrigger>
          <TabsTrigger value="investments">Investments ({portfolio?.investments?.length || 0})</TabsTrigger>
          <TabsTrigger value="sips">SIPs ({portfolio?.sips?.length || 0})</TabsTrigger>
          <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card className="p-6 bg-white border-gray-200">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <h4 className="font-semibold text-[#0F172A] text-sm">Contact Details</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span>{client.mobile}</span>
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{client.email}</span>
                    </div>
                  )}
                  {(client.address || client.city) && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                      <span>
                        {[client.address, client.city, client.state, client.pincode]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-[#0F172A] text-sm">Personal Details</h4>
                <div className="space-y-3 text-sm">
                  {client.dob && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>DOB: {formatDate(client.dob)}</span>
                    </div>
                  )}
                  {client.anniversary && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Anniversary: {formatDate(client.anniversary)}</span>
                    </div>
                  )}
                  {client.occupation && <p className="text-gray-600">Occupation: {client.occupation}</p>}
                  {client.aadhaar && <p className="text-gray-600">Aadhaar: {client.aadhaar}</p>}
                </div>
              </div>

              {client.notes && (
                <div className="sm:col-span-2">
                  <h4 className="font-semibold text-[#0F172A] text-sm mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="investments" className="mt-4">
          <Card className="p-6 bg-white border-gray-200">
            {portfolio?.investments?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Scheme</th>
                      <th className="pb-3 font-medium">AMC</th>
                      <th className="pb-3 font-medium text-right">Invested</th>
                      <th className="pb-3 font-medium text-right">Current</th>
                      <th className="pb-3 font-medium text-right">Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.investments.map((inv: any) => {
                      const invGain = inv.current_value - inv.invested_amount;
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-3 font-medium">{inv.scheme_name}</td>
                          <td className="py-3 text-gray-500">{inv.amc || '-'}</td>
                          <td className="py-3 text-right">{formatCurrency(inv.invested_amount)}</td>
                          <td className="py-3 text-right">{formatCurrency(inv.current_value)}</td>
                          <td className={`py-3 text-right ${invGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(invGain)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No investments found</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="sips" className="mt-4">
          <Card className="p-6 bg-white border-gray-200">
            {portfolio?.sips?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Scheme</th>
                      <th className="pb-3 font-medium">Amount</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.sips.map((sip: any) => (
                      <tr key={sip.id} className="border-b last:border-0">
                        <td className="py-3 font-medium">{sip.scheme_name}</td>
                        <td className="py-3">{formatCurrency(sip.amount)}</td>
                        <td className="py-3">{sip.sip_date}th of every month</td>
                        <td className="py-3">
                          <Badge variant={sip.status === 'active' ? 'default' : 'secondary'}>
                            {sip.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No SIPs found</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <Card className="p-6 bg-white border-gray-200">
            {goals.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {goals.map((goal) => {
                  const progress = goal.target_amount > 0
                    ? (goal.current_investment / goal.target_amount) * 100
                    : 0;
                  return (
                    <div key={goal.id} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="font-medium text-sm">{goal.goal_name}</h5>
                        <Badge variant="secondary" className="text-xs capitalize">{goal.goal_type}</Badge>
                      </div>
                      <div className="space-y-1 text-xs text-gray-500">
                        <p>Target: {formatCurrency(goal.target_amount)}</p>
                        <p>Current: {formatCurrency(goal.current_investment)}</p>
                        <p>Monthly SIP: {formatCurrency(goal.monthly_sip)}</p>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#2563EB]"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{progress.toFixed(1)}% achieved</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No goals set</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card className="p-6 bg-white border-gray-200">
            {documents.length > 0 ? (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">{doc.file_name}</p>
                        <p className="text-xs text-gray-400 capitalize">{doc.doc_type} • {formatDate(doc.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No documents uploaded</p>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card className="p-6 bg-white border-gray-200">
            {notes.length > 0 ? (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border p-4">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No notes added</p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
