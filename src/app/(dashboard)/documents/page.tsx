'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getClients } from '@/lib/actions/clients';
import { getDocuments, uploadDocument, deleteDocument, getDocumentUrl } from '@/lib/actions/documents';
import { formatDate } from '@/lib/utils/helpers';
import { toast } from 'sonner';
import type { Client } from '@/lib/types';
import { FileText, Upload, Download, Trash2, FolderLock, Eye, Search } from 'lucide-react';

export default function DocumentsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('other');
  const [clientSearch, setClientSearch] = useState('');

  useEffect(() => {
    async function load() {
      try { const c = await getClients(); setClients(c); } catch {}
    }
    load();
  }, []);

  async function handleClientChange(clientId: string) {
    setSelectedClient(clientId);
    try {
      const docs = await getDocuments(clientId);
      setDocuments(docs);
    } catch {}
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;

    setUploading(true);
    const result = await uploadDocument(selectedClient, file, docType);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Document uploaded');
      handleClientChange(selectedClient);
    }
    setUploading(false);
  }

  async function handleDelete(id: string, filePath: string) {
    const result = await deleteDocument(id, filePath, selectedClient);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success('Document deleted');
      handleClientChange(selectedClient);
    }
  }

  async function handleView(filePath: string) {
    const url = await getDocumentUrl(filePath);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Could not get document URL');
    }
  }

  const docTypeLabels: Record<string, string> = {
    pan: 'PAN Card',
    aadhaar: 'Aadhaar Card',
    kyc: 'KYC Documents',
    statement: 'Account Statement',
    report: 'Report',
    other: 'Other',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0F172A]">Document Vault</h1>
        <p className="text-sm text-gray-500">Securely store and manage client documents</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1 max-w-sm">
          <label className="text-sm font-medium mb-1 block">Select Client</label>
          <div className="flex flex-col gap-2.5 sm:flex-row items-stretch sm:items-center mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search name, mobile, PAN..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
          </div>
          {(() => {
            const filteredClients = clients.filter(c =>
              c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
              c.mobile.includes(clientSearch) ||
              (c.pan && c.pan.toLowerCase().includes(clientSearch.toLowerCase()))
            );
            return (
              <Select value={selectedClient} onValueChange={(val) => handleClientChange(val || '')}>
                <SelectTrigger><SelectValue placeholder="Choose a client" /></SelectTrigger>
                <SelectContent>
                  {filteredClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} - {c.mobile}</SelectItem>)}
                  {filteredClients.length === 0 && (
                    <p className="text-xs text-gray-400 p-2 text-center">No matches</p>
                  )}
                </SelectContent>
              </Select>
            );
          })()}
        </div>

        {selectedClient && (
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-sm font-medium mb-1 block">Document Type</label>
              <Select value={docType} onValueChange={(val) => setDocType(val || 'other')}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pan">PAN Card</SelectItem>
                  <SelectItem value="aadhaar">Aadhaar</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="statement">Statement</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="cursor-pointer">
              <input type="file" onChange={handleUpload} className="hidden" />
              <div className="flex items-center gap-2 rounded-lg bg-[#0F172A] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E293B]">
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload'}
              </div>
            </label>
          </div>
        )}
      </div>

      {!selectedClient ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200">
          <FolderLock className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">Select a client to manage documents</p>
        </Card>
      ) : documents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 bg-white border-gray-200">
          <FileText className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No documents uploaded for this client</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-4 bg-white border-gray-200">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-50 p-2">
                  <FileText className="h-5 w-5 text-[#2563EB]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">{docTypeLabels[doc.doc_type] || doc.doc_type}</Badge>
                    <span className="text-xs text-gray-400">{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3 border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => handleView(doc.file_path)} className="flex-1">
                  <Eye className="h-3 w-3 mr-1" /> View
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(doc.id, doc.file_path)} className="text-red-500">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
