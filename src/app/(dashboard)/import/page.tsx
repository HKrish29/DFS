'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getClients, createClientAction } from '@/lib/actions/clients';
import { addInvestmentAction, createFileImportRecord } from '@/lib/actions/portfolio';
import { toast } from 'sonner';
import { 
  FileUp, 
  CheckCircle, 
  XCircle, 
  Upload, 
  FileSpreadsheet, 
  User, 
  ArrowRight, 
  Briefcase, 
  Hash, 
  UserCheck, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportRow {
  [key: string]: any;
}

interface ExtractedInvestment {
  folioNumber: string;
  schemeName: string;
  purchaseDate: string | null;
  investedAmount: number;
  purchaseNav: number;
  units: number;
  currentNav: number;
  currentValue: number;
}

interface ExtractedClient {
  id: string; // temp unique identifier
  name: string;
  pan: string;
  kycStatus: string;
  mobile: string;
  email: string;
  city: string;
  state: string;
  investments: ExtractedInvestment[];
  isExisting: boolean;
  existingId?: string;
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'standard' | 'portfolio' | null>(null);
  
  // Standard format states
  const [standardData, setStandardData] = useState<ImportRow[]>([]);
  const [standardColumns, setStandardColumns] = useState<string[]>([]);
  
  // Custom portfolio statement states
  const [extractedClients, setExtractedClients] = useState<ExtractedClient[]>([]);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<Array<{ item: string; status: 'success' | 'error'; message: string }>>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');

  // Load existing clients on mount to identify duplicates
  useEffect(() => {
    async function loadClients() {
      try {
        const clients = await getClients();
        setExistingClients(clients);
      } catch (err) {
        console.error('Failed to load existing clients:', err);
      }
    }
    loadClients();
  }, []);

  const excelDateToISODate = (excelDate: any): string | null => {
    if (!excelDate) return null;
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    return String(excelDate);
  };

  const detectSheetFormat = (rows: any[][]): 'standard' | 'portfolio' => {
    let hasFolioHeader = false;
    let hasClientHeader = false;

    for (const row of rows) {
      if (!row || row.length === 0) continue;
      if (row[0] === 'Folio no.' && row[1] === 'Scheme Name') {
        hasFolioHeader = true;
      }
      if (
        row[1] &&
        typeof row[1] === 'string' &&
        row[1].includes(' - ') &&
        row[3] &&
        typeof row[3] === 'string' &&
        row[3].startsWith('KYC')
      ) {
        hasClientHeader = true;
      }
    }

    if (hasFolioHeader && hasClientHeader) {
      return 'portfolio';
    }
    return 'standard';
  };

  const parseMultiSection = (rows: any[][]): ExtractedClient[] => {
    const clientsMap: Record<string, ExtractedClient> = {};
    let currentClient: ExtractedClient | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      // Detect client header: e.g. [null, "NIKUNJBHAI K AMLANI - AFKPA4817N", null, "KYC - KYC VALIDATED"]
      if (
        row[1] &&
        typeof row[1] === 'string' &&
        row[1].includes(' - ') &&
        row[3] &&
        typeof row[3] === 'string' &&
        row[3].startsWith('KYC')
      ) {
        const parts = row[1].split(' - ');
        const name = parts[0].trim();
        const pan = parts[1].trim().toUpperCase();
        const kycStatus = row[3].trim();

        // Check if this client already exists in the system
        const existing = existingClients.find(
          ec => (ec.pan && ec.pan.toUpperCase() === pan) || ec.name.toLowerCase() === name.toLowerCase()
        );

        currentClient = {
          id: `client-${pan.toLowerCase()}`,
          name,
          pan,
          kycStatus,
          mobile: existing ? existing.mobile : `998877${Math.floor(1000 + Math.random() * 9000)}`,
          email: existing ? existing.email : `${name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')}@example.com`,
          city: existing ? existing.city : 'Rajkot',
          state: existing ? existing.state : 'Gujarat',
          investments: [],
          isExisting: !!existing,
          existingId: existing ? existing.id : undefined
        };

        clientsMap[pan] = currentClient;
      }

      // Detect investment headers: "Folio no." and "Scheme Name"
      if (row[0] === 'Folio no.' && row[1] === 'Scheme Name') {
        const detailsRow = rows[i + 2];
        const calculationsRow = rows[i + 4];

        if (detailsRow && detailsRow[0] && currentClient) {
          const folioNumber = String(detailsRow[0]).trim();
          const schemeName = String(detailsRow[1]).trim();
          const purchaseDate = excelDateToISODate(detailsRow[2]);
          const investedAmount = Number(detailsRow[3]) || Number(calculationsRow[3]) || 0;
          const purchaseNav = Number(detailsRow[4]) || Number(calculationsRow[4]) || 0;
          const units = Number(detailsRow[5]) || Number(calculationsRow[5]) || 0;

          const currentNav = calculationsRow ? Number(calculationsRow[6]) : purchaseNav;
          const currentValue = calculationsRow ? Number(calculationsRow[7]) : investedAmount;

          currentClient.investments.push({
            folioNumber,
            schemeName,
            purchaseDate,
            investedAmount,
            purchaseNav,
            units,
            currentNav,
            currentValue
          });
        }
      }
    }

    return Object.values(clientsMap);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFile(file);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Read raw rows first to check sheet format
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
        
        if (rawRows.length === 0) {
          toast.error('No data found in the file');
          return;
        }

        const detectedFormat = detectSheetFormat(rawRows);
        setImportType(detectedFormat);

        if (detectedFormat === 'portfolio') {
          const parsedClients = parseMultiSection(rawRows);
          if (parsedClients.length > 0) {
            setExtractedClients(parsedClients);
            setStep('preview');
            toast.success(`Detected portfolio statement: ${parsedClients.length} clients loaded.`);
          } else {
            toast.error('Could not extract portfolio data from the file structure');
          }
        } else {
          // Standard flat format
          const jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as ImportRow[];
          if (jsonData.length > 0) {
            setStandardColumns(Object.keys(jsonData[0]));
            setStandardData(jsonData);
            setStep('preview');
            toast.success(`${jsonData.length} rows loaded from ${file.name}`);
          } else {
            toast.error('No data found in standard sheet');
          }
        }
      } catch (error) {
        toast.error('Error reading Excel file');
      }
    };
    reader.readAsBinaryString(file);
  }, [existingClients]);

  const handleClientMobileChange = (clientId: string, newMobile: string) => {
    setExtractedClients(prev => 
      prev.map(c => c.id === clientId ? { ...c, mobile: newMobile } : c)
    );
  };

  const hasInvalidMobiles = () => {
    if (importType !== 'portfolio') return false;
    return extractedClients.some(c => !/^\d{10}$/.test(c.mobile));
  };

  async function handleImport() {
    setImporting(true);
    setStep('importing');
    const logs: typeof importLog = [];

    if (importType === 'portfolio') {
      for (const client of extractedClients) {
        try {
          let resolvedClientId = client.existingId;

          // 1. Create client if they do not exist
          if (!resolvedClientId) {
            const clientResult = await createClientAction({
              name: client.name,
              mobile: client.mobile,
              pan: client.pan || null,
              email: client.email || null,
              city: client.city || null,
              state: client.state || null,
              occupation: 'Business Owner',
              risk_profile: 'moderate',
              aadhaar: null,
              dob: null,
              anniversary: null,
              address: null,
              pincode: null,
              notes: `Imported via Portfolio Sheet: KYC: ${client.kycStatus}`,
              assigned_rm_id: null,
            });

            if (clientResult.error) {
              logs.push({
                item: `Client: ${client.name}`,
                status: 'error',
                message: `Failed to create client: ${clientResult.error}`
              });
              continue; // Skip investments if client creation failed
            } else {
              resolvedClientId = clientResult.data.id;
              logs.push({
                item: `Client: ${client.name}`,
                status: 'success',
                message: 'Created client successfully'
              });
            }
          } else {
            logs.push({
              item: `Client: ${client.name}`,
              status: 'success',
              message: 'Linked to existing client'
            });
          }

          // 2. Import investments
          for (const inv of client.investments) {
            try {
              const invResult = await addInvestmentAction({
                client_id: resolvedClientId!,
                scheme_name: inv.schemeName,
                folio_number: inv.folioNumber,
                nav: inv.purchaseNav,
                units: inv.units,
                invested_amount: inv.investedAmount,
                current_value: inv.currentValue,
                category: 'mutual_fund',
                investment_type: 'lumpsum',
                purchase_date: inv.purchaseDate,
                scheme_code: null,
                amc: inv.schemeName.split(' ')[0] || 'Other',
              });

              if (invResult.error) {
                logs.push({
                  item: `  - Investment: Folio ${inv.folioNumber}`,
                  status: 'error',
                  message: `Failed: ${invResult.error}`
                });
              } else {
                logs.push({
                  item: `  - Investment: Folio ${inv.folioNumber}`,
                  status: 'success',
                  message: `Imported holding: ₹${inv.currentValue.toLocaleString()}`
                });
              }
            } catch (invErr) {
              logs.push({
                item: `  - Investment: Folio ${inv.folioNumber}`,
                status: 'error',
                message: 'Unexpected holding import error'
              });
            }
          }

        } catch (clientErr) {
          logs.push({
            item: `Client: ${client.name}`,
            status: 'error',
            message: 'Unexpected client import error'
          });
        }
      }
    } else {
      // Standard Flat Import
      for (let i = 0; i < standardData.length; i++) {
        const row = standardData[i];
        try {
          const name = row['Client Name'] || row['Name'] || row['name'] || row['client_name'] || '';
          const mobile = String(row['Mobile'] || row['mobile'] || row['Phone'] || row['phone'] || '').replace(/\D/g, '');

          if (name && mobile && mobile.length === 10) {
            const result = await createClientAction({
              name: String(name),
              mobile,
              pan: String(row['PAN'] || row['pan'] || '') || null,
              email: String(row['Email'] || row['email'] || '') || null,
              city: String(row['City'] || row['city'] || '') || null,
              state: String(row['State'] || row['state'] || '') || null,
              occupation: String(row['Occupation'] || row['occupation'] || '') || null,
              risk_profile: null,
              aadhaar: null,
              dob: null,
              anniversary: null,
              address: null,
              pincode: null,
              notes: 'Imported via standard flat list',
              assigned_rm_id: null,
            });

            if (result.error) {
              logs.push({ item: `Row ${i + 1}: ${name}`, status: 'error', message: result.error });
            } else {
              logs.push({ item: `Row ${i + 1}: ${name}`, status: 'success', message: 'Client imported' });
            }
          } else {
            logs.push({ item: `Row ${i + 1}`, status: 'error', message: 'Missing Name or valid 10-digit Mobile' });
          }
        } catch (error) {
          logs.push({ item: `Row ${i + 1}`, status: 'error', message: 'Unexpected error' });
        }
      }
    }

    setImportLog(logs);
    setStep('done');
    setImporting(false);

    const successCount = logs.filter(l => l.status === 'success').length;
    toast.success(`Import complete: ${successCount}/${logs.length} operations successful`);

    // Record the file import for audit trail
    try {
      await createFileImportRecord({
        file_name: file?.name || 'unknown',
        file_size: file?.size || 0,
        import_type: importType === 'portfolio' ? 'portfolio' : 'standard',
        clients_created: logs.filter(l => l.item.startsWith('Client:') && l.status === 'success').length,
        investments_created: logs.filter(l => l.item.includes('Investment:') && l.status === 'success').length,
        status: 'completed',
        notes: `${successCount}/${logs.length} operations successful`,
      });
    } catch {}
  }

  function reset() {
    setFile(null);
    setImportType(null);
    setStandardData([]);
    setStandardColumns([]);
    setExtractedClients([]);
    setImportLog([]);
    setStep('upload');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-[#0F172A] tracking-tight">Excel Import Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Upload flat client lists or custom structured client portfolio statements</p>
        </div>
        {step !== 'upload' && (
          <Button onClick={reset} variant="outline" className="border-gray-300 hover:bg-gray-50">
            Reset Importer
          </Button>
        )}
      </div>

      {step === 'upload' && (
        <Card className="p-10 bg-white border border-gray-150 shadow-sm relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/10 via-transparent to-indigo-50/5 pointer-events-none" />
          <div className="flex flex-col items-center justify-center py-10 relative z-10">
            <div className="rounded-full bg-blue-50 p-6 mb-6 group-hover:scale-110 transition-transform duration-300">
              <FileSpreadsheet className="h-10 w-10 text-[#2563EB]" />
            </div>
            <h3 className="text-xl font-bold text-[#0F172A] mb-2">Upload Client Excel or Statement</h3>
            <p className="text-sm text-gray-500 mb-8 text-center max-w-lg">
              Upload an <strong>.xlsx</strong> or <strong>.xls</strong> file. The system will auto-detect the sheet format, present a preview of clients and their holdings, and let you commit them to the offline database.
            </p>
            <div className="space-y-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2 rounded-xl bg-[#0F172A] px-8 py-4 text-sm font-semibold text-white shadow hover:bg-[#1E293B] active:scale-95 transition-all">
                  <Upload className="h-4 w-4" />
                  Select Excel File
                </div>
              </label>
            </div>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl text-xs text-gray-500 bg-gray-50 p-6 rounded-xl border border-gray-100">
              <div>
                <p className="font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  Standard Flat Sheet Columns:
                </p>
                <p className="leading-relaxed">Client Name, Mobile, PAN, Email, City, State, Occupation</p>
              </div>
              <div>
                <p className="font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  Structured Portfolio Statements:
                </p>
                <p className="leading-relaxed">Supports nested client sections with names, PANs, KYC status blocks, and folio tables like Book1.xls</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {step === 'preview' && importType === 'portfolio' && extractedClients.length > 0 && (
        <div className="space-y-6">
          <Card className="p-6 bg-white border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-150 mb-2 hover:bg-indigo-50">
                  Structured Statement Format Detected
                </Badge>
                <h3 className="text-lg font-bold text-[#0F172A]">Previewing: {file?.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Found <strong className="text-gray-900">{extractedClients.length}</strong> client profiles and <strong className="text-gray-900">{extractedClients.reduce((acc, c) => acc + c.investments.length, 0)}</strong> holdings.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset} className="border-gray-300">Cancel</Button>
                <Button 
                  onClick={handleImport} 
                  disabled={hasInvalidMobiles()}
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] shadow"
                >
                  <FileUp className="h-4 w-4 mr-2" /> Import Portfolios
                </Button>
              </div>
            </div>

            {hasInvalidMobiles() && (
              <div className="mt-4 flex items-center gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-xs font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                Please correct any client mobile numbers below to be exactly 10 digits before importing.
              </div>
            )}
          </Card>

          <div className="space-y-6">
            {extractedClients.map((client) => (
              <Card key={client.id} className="bg-white border border-gray-200 shadow-sm overflow-hidden">
                {/* Client Header Block */}
                <div className="bg-gray-50/70 border-b border-gray-150 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-100 p-2.5 text-blue-700">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 text-base">{client.name}</h4>
                        {client.isExisting ? (
                          <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 flex items-center gap-1">
                            <UserCheck className="h-3 w-3" /> Existing Client
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-150 hover:bg-emerald-50">
                            New Client Record
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-0.5">
                        <span>PAN: <strong className="text-gray-700">{client.pan}</strong></span>
                        <span className="h-3 w-px bg-gray-350 hidden sm:inline" />
                        <span>KYC: <strong className="text-gray-700">{client.kycStatus}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Mobile & Email Form Fields */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mobile Number (Required)</label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={client.mobile}
                          onChange={(e) => handleClientMobileChange(client.id, e.target.value)}
                          placeholder="10 digit mobile"
                          maxLength={10}
                          className={`h-9 w-40 text-sm font-medium border-gray-200 bg-white ${
                            /^\d{10}$/.test(client.mobile) ? 'focus-visible:ring-emerald-500' : 'border-amber-400 focus-visible:ring-amber-500'
                          }`}
                        />
                        {!/^\d{10}$/.test(client.mobile) && (
                          <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> 10 digits
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Investments Subtable */}
                <div className="p-6">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Portfolio Holdings ({client.investments.length})</h5>
                  <div className="overflow-x-auto rounded-lg border border-gray-150">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-150 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Folio No</th>
                          <th className="py-3 px-4">Scheme Name</th>
                          <th className="py-3 px-4 text-right">Units</th>
                          <th className="py-3 px-4 text-right">Inv. NAV</th>
                          <th className="py-3 px-4 text-right">Curr. NAV</th>
                          <th className="py-3 px-4 text-right">Invested Amt</th>
                          <th className="py-3 px-4 text-right">Current Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {client.investments.map((inv, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/30 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-medium text-gray-650">{inv.folioNumber}</td>
                            <td className="py-3.5 px-4 font-semibold text-gray-800">{inv.schemeName}</td>
                            <td className="py-3.5 px-4 text-right font-medium">{inv.units.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</td>
                            <td className="py-3.5 px-4 text-right text-gray-600">₹{inv.purchaseNav.toFixed(4)}</td>
                            <td className="py-3.5 px-4 text-right text-gray-600">₹{inv.currentNav.toFixed(4)}</td>
                            <td className="py-3.5 px-4 text-right font-semibold text-gray-700">₹{inv.investedAmount.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right font-bold text-blue-600">₹{Math.round(inv.currentValue).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 'preview' && importType === 'standard' && standardData.length > 0 && (
        <Card className="p-6 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <Badge className="bg-blue-50 text-blue-700 border-blue-150 mb-2 hover:bg-blue-50">
                Standard Client Format Detected
              </Badge>
              <h3 className="text-lg font-bold text-[#0F172A]">Preview: {file?.name}</h3>
              <p className="text-sm text-gray-500">{standardData.length} records found</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={handleImport} className="bg-[#0F172A] hover:bg-[#1E293B] shadow">
                <FileUp className="h-4 w-4 mr-2" /> Import {standardData.length} Records
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-150 max-h-96">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-150 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0">
                  <th className="py-3 px-4 font-medium">#</th>
                  {standardColumns.slice(0, 8).map((col) => (
                    <th key={col} className="py-3 px-4 font-semibold whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {standardData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-4 text-gray-400 font-medium">{i + 1}</td>
                    {standardColumns.slice(0, 8).map((col) => (
                      <td key={col} className="py-2.5 px-4 max-w-[180px] truncate text-gray-700 font-medium">{String(row[col] || '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {standardData.length > 50 && (
              <div className="bg-gray-50 py-3 border-t text-center">
                <p className="text-xs text-gray-400">Showing first 50 of {standardData.length} rows</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {step === 'importing' && (
        <Card className="flex flex-col items-center justify-center py-24 bg-white border border-gray-200 shadow-sm">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
            <Briefcase className="h-5 w-5 text-blue-600 absolute top-3.5 left-3.5 animate-pulse" />
          </div>
          <h4 className="text-lg font-bold text-[#0F172A] mt-4">Writing records to offline database...</h4>
          <p className="text-sm text-gray-500 mt-1">Please keep this tab open. Revalidating paths and updating portfolios.</p>
        </Card>
      )}

      {step === 'done' && (
        <Card className="p-6 bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-150">
            <div>
              <h3 className="text-xl font-bold text-[#0F172A]">Import Operation Completed</h3>
              <div className="flex gap-4 mt-2">
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-150 hover:bg-emerald-50 flex items-center gap-1 font-semibold">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {importLog.filter(l => l.status === 'success').length} Successes
                </Badge>
                <Badge className="bg-red-50 text-red-800 border-red-150 hover:bg-red-50 flex items-center gap-1 font-semibold">
                  <XCircle className="h-3.5 w-3.5" />
                  {importLog.filter(l => l.status === 'error').length} Failures
                </Badge>
              </div>
            </div>
            <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700 shadow text-white">Import Another File</Button>
          </div>
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {importLog.map((log, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl p-4 border ${
                log.status === 'success' ? 'bg-emerald-50/30 border-emerald-100/60' : 'bg-red-50/30 border-red-100/60'
              }`}>
                {log.status === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <h5 className="text-sm font-semibold text-gray-800">{log.item}</h5>
                  <p className="text-xs text-gray-500 mt-0.5">{log.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
