'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getClients, createClientAction } from '@/lib/actions/clients';
import { addInvestmentAction, createFileImportRecord, bulkImportAction, importNavFeedAction, importNavFeedFileAction } from '@/lib/actions/portfolio';
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
  FileText,
  Database,
  FolderSync,
  Zap,
  Activity,
  HardDrive,
  TrendingUp,
  Clock,
  Layers,
  Gauge
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

interface FeedProgress {
  stage: 'idle' | 'scanning' | 'processing_file' | 'inserting_db' | 'updating_investments' | 'done' | 'error';
  currentFile?: string;
  currentFileIndex?: number;
  totalFiles?: number;
  fileProgress?: number;
  recordsProcessed?: number;
  totalRecords?: number;
  uniqueSchemes?: number;
  filesProcessed?: number;
  investmentsUpdated?: number;
  errorMessage?: string;
  fileSize?: number;
  logs: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<'standard' | 'portfolio' | 'feed' | null>(null);
  const [processingFeed, setProcessingFeed] = useState(false);
  const [feedFile, setFeedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Feed folder scan progress
  const [feedProgress, setFeedProgress] = useState<FeedProgress>({ stage: 'idle', logs: [] });
  
  // Standard format states
  const [standardData, setStandardData] = useState<ImportRow[]>([]);
  const [standardColumns, setStandardColumns] = useState<string[]>([]);
  
  // Custom portfolio statement states
  const [extractedClients, setExtractedClients] = useState<ExtractedClient[]>([]);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  
  const [importing, setImporting] = useState(false);
  const [importLog, setImportLog] = useState<Array<{ item: string; status: 'success' | 'error'; message: string }>>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsingFiles, setParsingFiles] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

  // ===== Bulk Import States =====
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkImportType, setBulkImportType] = useState<'bulk_clients' | 'bulk_transactions'>('bulk_clients');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    stage: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
    percent: number;
    rowsProcessed: number;
    totalRows: number;
    rowsFailed: number;
    rowsPerSecond: number;
    clientsCreated: number;
    clientsUpdated: number;
    investmentsCreated: number;
    elapsedMs: number;
    message: string;
    logs: string[];
  }>({ stage: 'idle', percent: 0, rowsProcessed: 0, totalRows: 0, rowsFailed: 0, rowsPerSecond: 0, clientsCreated: 0, clientsUpdated: 0, investmentsCreated: 0, elapsedMs: 0, message: '', logs: [] });
  const [bulkResult, setBulkResult] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const detectSheetFormat = (rows: any[][]): 'standard' | 'portfolio' | 'feed' => {
    if (rows.length > 0 && rows[0]) {
      const headers = rows[0].map(h => String(h).replace(/^'|'$/g, '').trim().toUpperCase());
      const isFeed = headers.includes('AMC_CODE') || 
                     headers.includes('FOLIO_NO') || 
                     headers.includes('TRXNTYPE') || 
                     headers.includes('FMCODE') || 
                     headers.includes('TD_ACNO') || 
                     headers.includes('TD_TRTYPE');
      if (isFeed) {
        return 'feed';
      }
    }

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

  const parseFeedDate = (dateStr: string, isDdMm: boolean = false): string | null => {
    if (!dateStr) return null;
    const cleanStr = String(dateStr).trim();
    
    // Check if it's a number (Excel serial date)
    if (/^\d+(\.\d+)?$/.test(cleanStr)) {
      const num = Number(cleanStr);
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }

    // Try parsing ISO format first
    if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
      return cleanStr.substring(0, 10);
    }

    // Match DD/MM/YYYY or MM/DD/YYYY with optional time
    const match = cleanStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const part1 = parseInt(match[1], 10);
      const part2 = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);

      let day = part1;
      let month = part2;

      if (part1 > 12) {
        day = part1;
        month = part2;
      } else if (part2 > 12) {
        day = part2;
        month = part1;
      } else {
        if (isDdMm) {
          day = part1;
          month = part2;
        } else {
          day = part2;
          month = part1;
        }
      }

      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    }

    const date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    return null;
  };

  const parseFeedRows = (rows: any[][]): ExtractedClient[] => {
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => String(h).replace(/^'|'$/g, '').trim().toUpperCase());
    
    const getIndex = (aliases: string[]): number => {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias.toUpperCase());
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const panIdx = getIndex(['PAN', 'PAN1', 'GUARDPANNO']);
    const nameIdx = getIndex(['INV_NAME', 'INVNAME', 'CLIENTNAME', 'NAME']);
    const folioIdx = getIndex(['FOLIO_NO', 'TD_ACNO', 'FOLIO_NUM', 'FOLIO']);
    const schemeIdx = getIndex(['SCHEME', 'FUNDDESC', 'SCHEME_NAME', 'SCHEME_DESC']);
    const trxnTypeIdx = getIndex(['TRXNTYPE', 'TD_TRTYPE', 'TD_PURRED', 'TR_TYPE']);
    const trxnNatureIdx = getIndex(['TRXN_NATURE', 'TRDESC', 'TRXN_DESC']);
    const dateIdx = getIndex(['TRADDATE', 'TD_TRDT', 'TR_DATE', 'DATE']);
    const priceIdx = getIndex(['PURPRICE', 'TD_NAV', 'TD_POP', 'NAV', 'PRICE']);
    const unitsIdx = getIndex(['UNITS', 'TD_UNITS', 'QTY']);
    const amountIdx = getIndex(['AMOUNT', 'TD_AMT', 'AMT']);

    const isDdMm = headers.includes('TD_TRDT') || headers.includes('FMCODE');

    if (nameIdx === -1 || folioIdx === -1 || schemeIdx === -1) {
      console.error('Required columns missing from feed:', { nameIdx, folioIdx, schemeIdx });
      return [];
    }

    const cleanVal = (val: any): string => {
      if (val === null || val === undefined) return '';
      const s = String(val).trim();
      return s.replace(/^'|'$/g, '').trim();
    };

    const clientsMap: Record<string, {
      name: string;
      pan: string;
      holdings: Record<string, {
        folioNumber: string;
        schemeName: string;
        transactions: Array<{
          date: string | null;
          units: number;
          amount: number;
          price: number;
          isRedemption: boolean;
        }>;
      }>;
    }> = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || !row[nameIdx]) continue;

      const name = cleanVal(row[nameIdx]);
      if (!name) continue;

      const pan = panIdx !== -1 ? cleanVal(row[panIdx]).toUpperCase() : '';
      const folioNumber = cleanVal(row[folioIdx]);
      const schemeName = cleanVal(row[schemeIdx]);
      const trxnType = trxnTypeIdx !== -1 ? cleanVal(row[trxnTypeIdx]) : '';
      const trxnNature = trxnNatureIdx !== -1 ? cleanVal(row[trxnNatureIdx]) : '';
      const dateStr = dateIdx !== -1 ? cleanVal(row[dateIdx]) : '';
      const price = priceIdx !== -1 ? Number(cleanVal(row[priceIdx])) || 0 : 0;
      const units = unitsIdx !== -1 ? Number(cleanVal(row[unitsIdx])) || 0 : 0;
      const amount = amountIdx !== -1 ? Number(cleanVal(row[amountIdx])) || 0 : 0;

      const isRedemption = 
        trxnType.toUpperCase() === 'R' ||
        trxnType.toUpperCase().startsWith('RED') ||
        trxnType.toUpperCase().startsWith('SWO') ||
        trxnNature.toLowerCase().includes('redemption') || 
        trxnNature.toLowerCase().includes('switch out') ||
        trxnNature.toLowerCase().includes('switch-out') ||
        trxnNature.toLowerCase().includes('swout');

      const clientKey = pan && pan.length >= 5 ? pan : name.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (!clientsMap[clientKey]) {
        clientsMap[clientKey] = {
          name,
          pan,
          holdings: {}
        };
      }

      const holdingKey = `${folioNumber}_${schemeName}`;
      if (!clientsMap[clientKey].holdings[holdingKey]) {
        clientsMap[clientKey].holdings[holdingKey] = {
          folioNumber,
          schemeName,
          transactions: []
        };
      }

      clientsMap[clientKey].holdings[holdingKey].transactions.push({
        date: parseFeedDate(dateStr, isDdMm),
        units,
        amount,
        price,
        isRedemption
      });
    }

    const result: ExtractedClient[] = [];

    for (const [clientKey, rawClient] of Object.entries(clientsMap)) {
      const { name, pan, holdings } = rawClient;
      const investments: ExtractedInvestment[] = [];

      for (const rawHolding of Object.values(holdings)) {
        const { folioNumber, schemeName, transactions } = rawHolding;

        transactions.sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateA - dateB;
        });

        let netUnits = 0;
        let netAmount = 0;
        let earliestDateStr: string | null = null;
        let latestPrice = 0;
        let latestPriceDate = 0;

        for (const tx of transactions) {
          if (tx.isRedemption) {
            netUnits -= tx.units;
            netAmount -= tx.amount;
          } else {
            netUnits += tx.units;
            netAmount += tx.amount;
            
            const txDate = tx.date ? new Date(tx.date).getTime() : 0;
            if (tx.date && (!earliestDateStr || txDate < new Date(earliestDateStr).getTime())) {
              earliestDateStr = tx.date;
            }
          }

          const txDate = tx.date ? new Date(tx.date).getTime() : 0;
          if (txDate >= latestPriceDate && tx.price > 0) {
            latestPrice = tx.price;
            latestPriceDate = txDate;
          }
        }

        if (netUnits <= 0.0001) {
          continue;
        }

        if (!earliestDateStr && transactions.length > 0) {
          const earliestTx = transactions.reduce((earliest, current) => {
            const earliestTime = earliest.date ? new Date(earliest.date).getTime() : Infinity;
            const currentTime = current.date ? new Date(current.date).getTime() : Infinity;
            return currentTime < earliestTime ? current : earliest;
          }, transactions[0]);
          if (earliestTx.date) {
            earliestDateStr = earliestTx.date;
          }
        }

        const purchaseNav = netUnits > 0 ? (netAmount / netUnits) : latestPrice;
        const currentNav = latestPrice;
        const currentValue = netUnits * currentNav;

        investments.push({
          folioNumber,
          schemeName,
          purchaseDate: earliestDateStr,
          investedAmount: Math.round(netAmount),
          purchaseNav,
          units: netUnits,
          currentNav,
          currentValue
        });
      }

      if (investments.length === 0) continue;

      const existing = existingClients.find(
        ec => (ec.pan && ec.pan.toUpperCase() === pan) || ec.name.toLowerCase() === name.toLowerCase()
      );

      result.push({
        id: `client-${clientKey.toLowerCase()}`,
        name,
        pan,
        kycStatus: 'FEED IMPORTED',
        mobile: existing ? existing.mobile : `998877${Math.floor(1000 + Math.random() * 9000)}`,
        email: existing ? existing.email : `${name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '')}@example.com`,
        city: existing ? existing.city : 'Rajkot',
        state: existing ? existing.state : 'Gujarat',
        investments,
        isExisting: !!existing,
        existingId: existing ? existing.id : undefined
      });
    }

    return result;
  };

  const parseCSVText = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(entry);
        entry = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(entry);
        lines.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }
    if (entry || row.length > 0) {
      row.push(entry);
      lines.push(row);
    }
    return lines;
  };

  const mergeExtractedClients = (existing: ExtractedClient[], incoming: ExtractedClient[]): ExtractedClient[] => {
    const clientMap = new Map<string, ExtractedClient>();
    
    // Add all existing clients
    for (const client of existing) {
      clientMap.set(client.id, { ...client, investments: [...client.investments] });
    }

    // Merge incoming clients
    for (const client of incoming) {
      if (clientMap.has(client.id)) {
        const baseClient = clientMap.get(client.id)!;
        
        // Merge investments
        const invMap = new Map<string, ExtractedInvestment>();
        for (const inv of baseClient.investments) {
          invMap.set(`${inv.folioNumber}_${inv.schemeName}`, inv);
        }

        for (const inv of client.investments) {
          const key = `${inv.folioNumber}_${inv.schemeName}`;
          if (invMap.has(key)) {
            const baseInv = invMap.get(key)!;
            const totalUnits = baseInv.units + inv.units;
            const totalInvested = baseInv.investedAmount + inv.investedAmount;
            const avgPurchaseNav = totalUnits > 0 ? (totalInvested / totalUnits) : baseInv.purchaseNav;
            
            invMap.set(key, {
              ...baseInv,
              units: totalUnits,
              investedAmount: totalInvested,
              purchaseNav: avgPurchaseNav,
              currentNav: Math.max(baseInv.currentNav, inv.currentNav),
              currentValue: baseInv.currentValue + inv.currentValue,
              purchaseDate: baseInv.purchaseDate && inv.purchaseDate
                ? (new Date(baseInv.purchaseDate) < new Date(inv.purchaseDate) ? baseInv.purchaseDate : inv.purchaseDate)
                : (baseInv.purchaseDate || inv.purchaseDate)
            });
          } else {
            invMap.set(key, inv);
          }
        }

        baseClient.investments = Array.from(invMap.values());
      } else {
        clientMap.set(client.id, client);
      }
    }

    return Array.from(clientMap.values());
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setParsingFiles(true);
    const toastId = toast.loading(`Reading and parsing ${files.length} file(s)...`);

    let mergedClients: ExtractedClient[] = [];
    let mergedStandardData: ImportRow[] = [];
    let columns: string[] = [];
    let detectedFormat: 'standard' | 'portfolio' | 'feed' | null = null;
    let hasError = false;

    // Helper to read a single file
    const processFile = (file: File): Promise<void> => {
      return new Promise((resolve) => {
        const reader = new FileReader();

        reader.onerror = () => {
          toast.error(`Error reading file: ${file.name}`);
          hasError = true;
          resolve();
        };

        reader.onload = (evt) => {
          try {
            const dataStr = evt.target?.result;
            if (!dataStr) {
              resolve();
              return;
            }

            let rawRows: any[][] = [];
            const isCSV = file.name.endsWith('.csv');

            if (isCSV) {
              // Fast CSV parsing
              rawRows = parseCSVText(dataStr as string);
            } else {
              // Excel parsing
              const wb = XLSX.read(dataStr, { type: 'binary' });
              const wsname = wb.SheetNames[0];
              const ws = wb.Sheets[wsname];
              rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
            }

            if (rawRows.length === 0) {
              toast.error(`No data found in file: ${file.name}`);
              resolve();
              return;
            }

            const currentFormat = detectSheetFormat(rawRows);
            if (!detectedFormat) {
              detectedFormat = currentFormat;
            }

            if (currentFormat === 'portfolio') {
              const parsedClients = parseMultiSection(rawRows);
              mergedClients = mergeExtractedClients(mergedClients, parsedClients);
            } else if (currentFormat === 'feed') {
              const parsedClients = parseFeedRows(rawRows);
              mergedClients = mergeExtractedClients(mergedClients, parsedClients);
            } else {
              // Standard format
              let jsonData: ImportRow[] = [];
              if (isCSV) {
                if (rawRows.length > 0) {
                  const headers = rawRows[0].map(h => String(h).trim());
                  jsonData = rawRows.slice(1).map(row => {
                    const obj: ImportRow = {};
                    headers.forEach((header, idx) => {
                      obj[header] = row[idx] !== undefined ? row[idx] : '';
                    });
                    return obj;
                  });
                }
              } else {
                const wb = XLSX.read(dataStr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                jsonData = XLSX.utils.sheet_to_json(ws, { defval: '' }) as ImportRow[];
              }

              if (jsonData.length > 0) {
                columns = Object.keys(jsonData[0]);
                mergedStandardData = [...mergedStandardData, ...jsonData];
              }
            }
          } catch (error) {
            console.error('File parsing error:', error);
            toast.error(`Failed to parse file: ${file.name}`);
            hasError = true;
          }
          resolve();
        };

        if (file.name.endsWith('.csv')) {
          reader.readAsText(file);
        } else {
          reader.readAsBinaryString(file);
        }
      });
    };

    // Process all files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Skip folders (folders typically have size 0 and no extension)
      if (file.size === 0 && !file.name.includes('.')) {
        continue;
      }
      await processFile(file);
    }

    setParsingFiles(false);

    if (hasError) {
      toast.error('Some files could not be processed.', { id: toastId });
      e.target.value = '';
      return;
    }

    setImportType(detectedFormat);

    if (detectedFormat === 'portfolio' || detectedFormat === 'feed') {
      if (mergedClients.length > 0) {
        setExtractedClients(mergedClients);
        setStep('preview');
        setFile(files[0]);
        toast.success(`Loaded ${files.length} file(s): ${mergedClients.length} clients extracted.`, { id: toastId });
      } else {
        toast.error('Could not extract portfolios or feed holdings.', { id: toastId });
      }
    } else {
      if (mergedStandardData.length > 0) {
        setStandardColumns(columns);
        setStandardData(mergedStandardData);
        setStep('preview');
        setFile(files[0]);
        toast.success(`Loaded ${files.length} flat lists: ${mergedStandardData.length} records found.`, { id: toastId });
      } else {
        toast.error('No valid rows found in flat sheets.', { id: toastId });
      }
    }

    e.target.value = '';
  }, [existingClients]);

  const handleClientMobileChange = (clientId: string, newMobile: string) => {
    setExtractedClients(prev => 
      prev.map(c => c.id === clientId ? { ...c, mobile: newMobile } : c)
    );
  };

  const hasInvalidMobiles = () => {
    if (importType !== 'portfolio' && importType !== 'feed') return false;
    return extractedClients.some(c => !/^\d{10}$/.test(c.mobile));
  };

  async function handleImport() {
    setImporting(true);
    setStep('importing');

    try {
      const result = await bulkImportAction({
        importType: importType as any,
        extractedClients,
        standardData,
        fileName: file?.name,
        fileSize: file?.size,
      });

      if (result.error) {
        toast.error(`Import failed: ${result.error}`);
        setStep('preview');
        setImporting(false);
        return;
      }

      const logs = result.data || [];
      setImportLog(logs);
      setStep('done');
      setImporting(false);

      const successCount = logs.filter(l => l.status === 'success').length;
      toast.success(`Import complete: ${successCount}/${logs.length} operations successful`);

      // Record the file import for audit trail
      try {
        const clientsCreated = logs.filter(l => l.item.startsWith('Client:') && l.status === 'success' && l.message.includes('Created')).length;
        const investmentsCreated = importType === 'portfolio' || importType === 'feed'
          ? logs.filter(l => l.item === 'Holdings Upload' && l.status === 'success').reduce((sum, l) => {
              const match = l.message.match(/batch-imported (\d+)/);
              return sum + (match ? parseInt(match[1]) : 0);
            }, 0)
          : 0;

        await createFileImportRecord({
          file_name: file?.name || 'unknown',
          file_size: file?.size || 0,
          import_type: importType === 'portfolio' || importType === 'feed' ? 'portfolio' : 'standard',
          clients_created: clientsCreated,
          investments_created: investmentsCreated,
          status: 'completed',
          notes: `${successCount}/${logs.length} operations successful`,
        });
      } catch {}
    } catch (err: any) {
      toast.error(`Import error: ${err.message || err}`);
      setStep('preview');
      setImporting(false);
    }
  }

  // ===== BULK IMPORT HANDLERS =====
  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setBulkFile(files[0]);
      setBulkResult(null);
      setBulkProgress({ stage: 'idle', percent: 0, rowsProcessed: 0, totalRows: 0, rowsFailed: 0, rowsPerSecond: 0, clientsCreated: 0, clientsUpdated: 0, investmentsCreated: 0, elapsedMs: 0, message: '', logs: [] });
    }
  };

  const handleBulkImport = async () => {
    if (!bulkFile) return;
    setBulkProcessing(true);
    setBulkProgress(prev => ({ ...prev, stage: 'uploading', message: 'Uploading file...' }));

    const formData = new FormData();
    formData.append('file', bulkFile);
    formData.append('importType', bulkImportType);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/import-data', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.type === 'start') {
              setBulkProgress(prev => ({
                ...prev, stage: 'processing', message: event.message || 'Starting import...',
                logs: [...prev.logs, `Start: ${event.fileName}`]
              }));
            } else if (event.type === 'status') {
              setBulkProgress(prev => ({
                ...prev, message: event.message,
                logs: [...prev.logs, event.message]
              }));
            } else if (event.type === 'progress') {
              setBulkProgress(prev => ({
                ...prev,
                stage: 'processing',
                percent: event.percent,
                rowsProcessed: event.rowsProcessed,
                totalRows: event.totalRows,
                rowsFailed: event.rowsFailed,
                rowsPerSecond: event.rowsPerSecond,
                clientsCreated: event.clientsCreated,
                clientsUpdated: event.clientsUpdated,
                investmentsCreated: event.investmentsCreated,
                elapsedMs: event.elapsedMs,
                message: event.message,
                logs: event.percent % 20 === 0 || event.percent >= 99
                  ? [...prev.logs, `${event.percent}% — ${event.message}`]
                  : prev.logs,
              }));
            } else if (event.type === 'complete') {
              setBulkProgress(prev => ({
                ...prev,
                stage: 'done',
                percent: 100,
                rowsProcessed: event.rowsProcessed,
                totalRows: event.totalRows,
                rowsFailed: event.rowsFailed,
                clientsCreated: event.clientsCreated,
                clientsUpdated: event.clientsUpdated,
                investmentsCreated: event.investmentsCreated,
                message: `Complete! ${event.rowsProcessed?.toLocaleString()} rows processed`,
                logs: [...prev.logs, `Complete: ${event.clientsCreated} clients, ${event.investmentsCreated} holdings`]
              }));
              setBulkResult(event);
              toast.success(`Import complete: ${event.clientsCreated} clients, ${event.investmentsCreated} holdings`);
            } else if (event.type === 'error') {
              setBulkProgress(prev => ({
                ...prev,
                stage: 'error',
                message: event.message,
                logs: [...prev.logs, `ERROR: ${event.message}`]
              }));
              toast.error(event.message);
            }
          } catch {
            // ignore parse errors for partial lines
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Import cancelled');
      } else {
        toast.error(err.message || 'Import failed');
        setBulkProgress(prev => ({
          ...prev, stage: 'error', message: err.message || 'Import failed'
        }));
      }
    } finally {
      setBulkProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const cancelBulkImport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  function reset() {
    setFile(null);
    setImportType(null);
    setStandardData([]);
    setStandardColumns([]);
    setExtractedClients([]);
    setImportLog([]);
    setStep('upload');
    setFeedFile(null);
    setUploadProgress(0);
    setFeedProgress({ stage: 'idle', logs: [] });
    setBulkFile(null);
    setBulkResult(null);
    setBulkProgress({ stage: 'idle', percent: 0, rowsProcessed: 0, totalRows: 0, rowsFailed: 0, rowsPerSecond: 0, clientsCreated: 0, clientsUpdated: 0, investmentsCreated: 0, elapsedMs: 0, message: '', logs: [] });
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  // ===== Feed Folder SSE Progress Scan =====
  const handleFeedFolderScan = () => {
    setProcessingFeed(true);
    setFeedProgress({ stage: 'scanning', logs: ['Starting feed folder scan...'] });

    const eventSource = new EventSource('/api/import-feed-progress');
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'start':
            setFeedProgress(prev => ({
              ...prev,
              stage: 'scanning',
              totalFiles: data.totalFiles,
              logs: [...prev.logs, `Found ${data.totalFiles} files to process: ${data.files.join(', ')}`]
            }));
            break;

          case 'file_start':
            setFeedProgress(prev => ({
              ...prev,
              stage: 'processing_file',
              currentFile: data.fileName,
              currentFileIndex: data.fileIndex,
              totalFiles: data.totalFiles,
              fileProgress: 0,
              fileSize: data.fileSize,
              logs: [...prev.logs, `Processing ${data.fileName} (${formatFileSize(data.fileSize)})...`]
            }));
            break;

          case 'file_progress':
            setFeedProgress(prev => ({
              ...prev,
              fileProgress: data.progress,
              recordsProcessed: data.recordsProcessed,
              totalRecords: data.totalRecords,
              uniqueSchemes: data.uniqueSchemes,
            }));
            break;

          case 'file_done':
            setFeedProgress(prev => ({
              ...prev,
              fileProgress: 100,
              recordsProcessed: data.recordsProcessed,
              uniqueSchemes: data.uniqueSchemes,
              logs: [...prev.logs, `✓ ${data.fileName}: ${data.recordsProcessed?.toLocaleString()} rows processed (${data.uniqueSchemes?.toLocaleString()} unique schemes)`]
            }));
            break;

          case 'file_error':
            setFeedProgress(prev => ({
              ...prev,
              logs: [...prev.logs, `✗ ${data.fileName}: ${data.message}`]
            }));
            break;

          case 'db_insert_start':
            setFeedProgress(prev => ({
              ...prev,
              stage: 'inserting_db',
              uniqueSchemes: data.totalSchemes,
              logs: [...prev.logs, `Inserting ${data.totalSchemes.toLocaleString()} unique schemes into database...`]
            }));
            break;

          case 'db_insert_done':
            setFeedProgress(prev => ({
              ...prev,
              logs: [...prev.logs, `✓ Database insert complete (${data.totalSchemes.toLocaleString()} schemes)`]
            }));
            break;

          case 'update_investments_start':
            setFeedProgress(prev => ({
              ...prev,
              stage: 'updating_investments',
              logs: [...prev.logs, `Updating active client holdings with latest NAVs...`]
            }));
            break;

          case 'complete':
            setFeedProgress(prev => ({
              ...prev,
              stage: 'done',
              filesProcessed: data.filesProcessed,
              uniqueSchemes: data.uniqueSchemes,
              investmentsUpdated: data.investmentsUpdated,
              logs: [...prev.logs, `✓ Complete! ${data.filesProcessed} files, ${data.uniqueSchemes.toLocaleString()} schemes, ${data.investmentsUpdated} holdings updated`]
            }));
            setProcessingFeed(false);
            eventSource.close();
            toast.success(`Successfully processed ${data.filesProcessed} files — ${data.uniqueSchemes.toLocaleString()} unique schemes, ${data.investmentsUpdated} holdings updated!`);
            break;

          case 'error':
            setFeedProgress(prev => ({
              ...prev,
              stage: 'error',
              errorMessage: data.message,
              logs: [...prev.logs, `ERROR: ${data.message}`]
            }));
            setProcessingFeed(false);
            eventSource.close();
            toast.error(data.message);
            break;
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      if (feedProgress.stage !== 'done' && feedProgress.stage !== 'error') {
        setFeedProgress(prev => ({
          ...prev,
          stage: 'error',
          errorMessage: 'Connection lost during processing',
          logs: [...prev.logs, 'Connection lost. Processing may have completed on the server.']
        }));
      }
      setProcessingFeed(false);
      eventSource.close();
    };
  };

  // ===== Manual Feed File Upload with Progress =====
  const handleFeedFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setFeedFile(files[0]);
      setUploadProgress(0);
    }
  };

  const handleFeedFileUpload = async () => {
    if (!feedFile) return;
    setProcessingFeed(true);
    setUploadProgress(0);
    const toastId = toast.loading(`Uploading ${feedFile.name} (${formatFileSize(feedFile.size)})...`);

    try {
      // Use XMLHttpRequest for upload progress
      const result = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/import-feed?filename=${encodeURIComponent(feedFile.name)}&filesize=${feedFile.size}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
            if (percent < 100) {
              toast.loading(`Uploading ${feedFile.name}... ${percent}%`, { id: toastId });
            } else {
              toast.loading(`Processing ${feedFile.name} on server...`, { id: toastId });
            }
          }
        };

        xhr.onload = () => {
          try {
            const res = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && !res.error) {
              resolve(res);
            } else {
              reject(new Error(res.error || `Server error ${xhr.status}`));
            }
          } catch {
            reject(new Error('Failed to parse server response'));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 600000; // 10 minute timeout

        xhr.send(feedFile);
      });

      toast.success(result.message, { id: toastId });
      if (result.investmentsUpdated !== undefined && result.investmentsUpdated > 0) {
        toast.success(`Updated ${result.investmentsUpdated} active holdings with latest NAV rates!`);
      }
      setFeedFile(null);
      setUploadProgress(0);
    } catch (err: any) {
      toast.error(err.message || 'Error processing file', { id: toastId });
    } finally {
      setProcessingFeed(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} bytes`;
  };

  const getOverallProgress = (): number => {
    if (feedProgress.stage === 'idle') return 0;
    if (feedProgress.stage === 'done') return 100;
    if (feedProgress.stage === 'error') return 0;
    if (feedProgress.stage === 'inserting_db') return 90;
    if (feedProgress.stage === 'updating_investments') return 95;
    if (feedProgress.stage === 'scanning') return 2;

    // During file processing
    const totalFiles = feedProgress.totalFiles || 1;
    const currentFileIndex = feedProgress.currentFileIndex || 0;
    const fileProgress = feedProgress.fileProgress || 0;
    
    // Each file gets an equal slice of 0-85%
    const perFileSlice = 85 / totalFiles;
    return Math.round(currentFileIndex * perFileSlice + (fileProgress / 100) * perFileSlice);
  };

  const getStageLabel = (): string => {
    switch (feedProgress.stage) {
      case 'scanning': return 'Scanning feed folder...';
      case 'processing_file': return `Processing ${feedProgress.currentFile || 'file'}...`;
      case 'inserting_db': return 'Inserting schemes into database...';
      case 'updating_investments': return 'Updating client holdings...';
      case 'done': return 'Complete!';
      case 'error': return 'Error occurred';
      default: return 'Ready';
    }
  };

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
        <div className="space-y-6">
          {/* Main Upload Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-10 bg-white border border-gray-150 shadow-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-50/10 via-transparent to-indigo-50/5 pointer-events-none" />
              <div className="flex flex-col items-center justify-center py-6 relative z-10">
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
                      multiple
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileUpload}
                      disabled={parsingFiles}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2 rounded-xl bg-[#0F172A] px-8 py-4 text-sm font-semibold text-white shadow hover:bg-[#1E293B] active:scale-95 transition-all">
                      {parsingFiles ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {parsingFiles ? 'Parsing files...' : 'Select Files'}
                    </div>
                  </label>
                </div>
                <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-500 bg-gray-50 p-6 rounded-xl border border-gray-100 w-full">
                  <div>
                    <p className="font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      Standard Flat Sheet Columns:
                    </p>
                    <p className="leading-relaxed font-medium">Client Name, Mobile, PAN, Email, City, State, Occupation</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      Structured Portfolio Statements:
                    </p>
                    <p className="leading-relaxed font-medium">Supports nested client sections with names, PANs, KYC status blocks, and folio tables like Book1.xls</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Manual NAV Feed Upload Card */}
            <Card className="p-8 bg-white border border-gray-150 shadow-sm relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/10 via-transparent to-orange-50/5 pointer-events-none" />
              <div className="relative z-10 space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="rounded-full bg-amber-50 p-4 w-fit text-[#D97706] group-hover:scale-110 transition-transform duration-300">
                    <Database className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-[#0F172A]">Manual NAV Feed Upload</h3>
                    <p className="text-sm text-gray-500 leading-relaxed font-medium">
                      Upload a single daily feed CSV file (e.g. <strong>Feed1.csv</strong>) to update all client active holdings to the latest NAVs.
                    </p>
                    <p className="text-xs text-gray-500 bg-amber-50/50 p-3 rounded-lg border border-amber-100/50 font-medium">
                      Max file size: <strong>2 GB</strong>. Processed on server — no browser crashes.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  <input
                    type="file"
                    accept=".csv"
                    id="feed-file-upload"
                    className="hidden"
                    onChange={handleFeedFileSelect}
                    disabled={processingFeed}
                  />
                  <label
                    htmlFor="feed-file-upload"
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-4 text-xs font-semibold text-gray-600 hover:border-amber-400 hover:text-amber-700 cursor-pointer active:scale-95 transition-all bg-gray-50/30"
                  >
                    <Upload className="h-4 w-4 text-gray-400" />
                    {feedFile ? (
                      <span className="truncate max-w-[200px]">
                        {feedFile.name} <span className="text-gray-400">({formatFileSize(feedFile.size)})</span>
                      </span>
                    ) : (
                      'Select Feed CSV File'
                    )}
                  </label>

                  {feedFile && (
                    <>
                      {uploadProgress > 0 && uploadProgress < 100 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-semibold text-amber-700">
                            <span>Uploading...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {uploadProgress >= 100 && processingFeed && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 py-2">
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-600" />
                          Processing on server...
                        </div>
                      )}
                      <Button
                        onClick={handleFeedFileUpload}
                        disabled={processingFeed}
                        className="w-full bg-[#D97706] hover:bg-[#B45309] text-white flex items-center justify-center gap-2 rounded-xl py-5 font-semibold active:scale-95 transition-all shadow-md"
                      >
                        {processingFeed ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        ) : (
                          <FolderSync className="h-4 w-4" />
                        )}
                        {processingFeed ? 'Uploading & Processing...' : 'Upload & Process Feed'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ===== BULK DATA IMPORT CARD — Full Width ===== */}
          <Card className="p-8 bg-white border border-gray-150 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/10 via-transparent to-indigo-50/5 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-blue-50 p-4 text-blue-600 flex-shrink-0">
                    <Layers className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">Bulk Data Import</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed font-medium max-w-xl">
                      Server-side streaming import for <strong>massive CSV and DBF files</strong> (1M+ rows).
                      Handles deduplication, auto-maps columns, and inserts in optimized batches with live progress.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
                  <select
                    value={bulkImportType}
                    onChange={(e) => setBulkImportType(e.target.value as any)}
                    disabled={bulkProcessing}
                    className="h-11 px-4 rounded-xl border border-gray-200 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="bulk_clients">Client List</option>
                    <option value="bulk_transactions">Transaction Feed</option>
                  </select>

                  <input
                    type="file"
                    accept=".csv,.dbf,.xlsx,.xls"
                    id="bulk-file-upload"
                    className="hidden"
                    onChange={handleBulkFileSelect}
                    disabled={bulkProcessing}
                  />
                  <label
                    htmlFor="bulk-file-upload"
                    className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-5 py-2.5 text-xs font-semibold text-gray-600 hover:border-blue-400 hover:text-blue-700 cursor-pointer active:scale-95 transition-all bg-gray-50/30"
                  >
                    <Upload className="h-4 w-4 text-gray-400" />
                    {bulkFile ? (
                      <span className="truncate max-w-[200px]">
                        {bulkFile.name} <span className="text-gray-400">({formatFileSize(bulkFile.size)})</span>
                      </span>
                    ) : (
                      'Select CSV / DBF / Excel'
                    )}
                  </label>

                  {bulkFile && (
                    <Button
                      onClick={handleBulkImport}
                      disabled={bulkProcessing}
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 rounded-xl px-6 py-5 font-bold text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all"
                    >
                      {bulkProcessing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <FileUp className="h-4 w-4" />
                      )}
                      {bulkProcessing ? 'Processing...' : 'Start Import'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Bulk Import Progress Dashboard */}
              {bulkProgress.stage !== 'idle' && (
                <div className="mt-6 space-y-4">
                  {/* Overall Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        {bulkProgress.stage === 'done' ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : bulkProgress.stage === 'error' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
                        )}
                        {bulkProgress.message || 'Processing...'}
                      </span>
                      <div className="flex items-center gap-3">
                        {bulkProcessing && (
                          <button
                            onClick={cancelBulkImport}
                            className="text-xs font-semibold text-red-500 hover:text-red-700 underline"
                          >
                            Cancel
                          </button>
                        )}
                        <span className="text-sm font-bold text-blue-600">{bulkProgress.percent}%</span>
                      </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          bulkProgress.stage === 'done'
                            ? 'bg-emerald-500'
                            : bulkProgress.stage === 'error'
                            ? 'bg-red-400'
                            : 'bg-gradient-to-r from-blue-400 to-indigo-500'
                        }`}
                        style={{ width: `${bulkProgress.percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Gauge className="h-3 w-3" /> Rows/sec</p>
                      <p className="text-lg font-bold text-blue-600">{(bulkProgress.rowsPerSecond || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Layers className="h-3 w-3" /> Processed</p>
                      <p className="text-lg font-bold text-gray-800">{(bulkProgress.rowsProcessed || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">/ {(bulkProgress.totalRows || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><XCircle className="h-3 w-3" /> Failed</p>
                      <p className="text-lg font-bold text-red-500">{(bulkProgress.rowsFailed || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><User className="h-3 w-3" /> New</p>
                      <p className="text-lg font-bold text-emerald-600">{(bulkProgress.clientsCreated || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><UserCheck className="h-3 w-3" /> Updated</p>
                      <p className="text-lg font-bold text-amber-600">{(bulkProgress.clientsUpdated || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Holdings</p>
                      <p className="text-lg font-bold text-indigo-600">{(bulkProgress.investmentsCreated || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" /> Elapsed</p>
                      <p className="text-lg font-bold text-gray-700">{Math.floor((bulkProgress.elapsedMs || 0) / 1000)}s</p>
                    </div>
                  </div>

                  {/* Log Output */}
                  <div className="bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                    <div className="space-y-1">
                      {bulkProgress.logs.map((log, i) => (
                        <p key={i} className={`text-xs font-mono ${
                          log.startsWith('Complete:') ? 'text-emerald-400' :
                          log.startsWith('ERROR:') || log.startsWith('Error:') ? 'text-red-400' :
                          log.startsWith('Start:') ? 'text-blue-400' :
                          'text-gray-400'
                        }`}>
                          {log}
                        </p>
                      ))}
                      {(bulkProcessing || bulkProgress.stage === 'uploading') && (
                        <p className="text-xs font-mono text-gray-500 animate-pulse">▌</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Feed Folder Scan Card — Full Width */}
          <Card className="p-8 bg-white border border-gray-150 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/10 via-transparent to-teal-50/5 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-emerald-50 p-4 text-emerald-600 flex-shrink-0">
                    <Zap className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#0F172A]">Scan & Process Feed Folder</h3>
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed font-medium max-w-xl">
                      Processes <strong>all CSV and DBF files</strong> in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">feed/</code> directory automatically.
                      Handles the 2.7 GB DBF file (12M records) + all 7 CSV files in one go with live progress.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleFeedFolderScan}
                  disabled={processingFeed}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 rounded-xl px-8 py-6 font-bold text-sm shadow-lg hover:shadow-xl active:scale-95 transition-all flex-shrink-0"
                >
                  {processingFeed ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  ) : (
                    <HardDrive className="h-5 w-5" />
                  )}
                  {processingFeed ? 'Processing...' : 'Start Full Scan'}
                </Button>
              </div>

              {/* Progress Dashboard */}
              {feedProgress.stage !== 'idle' && (
                <div className="mt-6 space-y-4">
                  {/* Overall Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        {feedProgress.stage === 'done' ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : feedProgress.stage === 'error' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                        )}
                        {getStageLabel()}
                      </span>
                      <span className="text-sm font-bold text-emerald-600">{getOverallProgress()}%</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          feedProgress.stage === 'done'
                            ? 'bg-emerald-500'
                            : feedProgress.stage === 'error'
                            ? 'bg-red-400'
                            : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                        }`}
                        style={{ width: `${getOverallProgress()}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Row */}
                  {(feedProgress.stage === 'processing_file' || feedProgress.stage === 'done') && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Files</p>
                        <p className="text-lg font-bold text-gray-800">
                          {feedProgress.stage === 'done' ? feedProgress.filesProcessed : `${(feedProgress.currentFileIndex || 0) + 1}`}
                          <span className="text-gray-400 text-sm">/{feedProgress.totalFiles || '?'}</span>
                        </p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current File</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{feedProgress.currentFile || '—'}</p>
                        {feedProgress.fileSize && (
                          <p className="text-[10px] text-gray-400">{formatFileSize(feedProgress.fileSize)}</p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Unique Schemes</p>
                        <p className="text-lg font-bold text-emerald-600">{(feedProgress.uniqueSchemes || 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Holdings Updated</p>
                        <p className="text-lg font-bold text-blue-600">{feedProgress.investmentsUpdated ?? '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* Current File Progress */}
                  {feedProgress.stage === 'processing_file' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-gray-500">
                        <span>
                          {feedProgress.currentFile}
                          {feedProgress.recordsProcessed ? ` — ${feedProgress.recordsProcessed.toLocaleString()} rows` : ''}
                          {feedProgress.totalRecords ? ` / ${feedProgress.totalRecords.toLocaleString()}` : ''}
                        </span>
                        <span>{feedProgress.fileProgress || 0}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 rounded-full transition-all duration-300"
                          style={{ width: `${feedProgress.fileProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Log Output */}
                  <div className="bg-gray-900 rounded-xl p-4 max-h-48 overflow-y-auto">
                    <div className="space-y-1">
                      {feedProgress.logs.map((log, i) => (
                        <p key={i} className={`text-xs font-mono ${
                          log.startsWith('✓') ? 'text-emerald-400' :
                          log.startsWith('✗') || log.startsWith('ERROR') ? 'text-red-400' :
                          'text-gray-400'
                        }`}>
                          {log}
                        </p>
                      ))}
                      {(feedProgress.stage !== 'done' && feedProgress.stage !== 'error') && (
                        <p className="text-xs font-mono text-gray-500 animate-pulse">▌</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {step === 'preview' && (importType === 'portfolio' || importType === 'feed') && extractedClients.length > 0 && (
        <div className="space-y-6">
          <Card className="p-6 bg-white border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <Badge className={
                  importType === 'feed'
                    ? "bg-amber-50 text-amber-700 border-amber-150 mb-2 hover:bg-amber-50"
                    : "bg-indigo-50 text-indigo-700 border-indigo-150 mb-2 hover:bg-indigo-50"
                }>
                  {importType === 'feed' ? 'CAMS Daily Feed Format Detected' : 'Structured Statement Format Detected'}
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
                  <FileUp className="h-4 w-4 mr-2" /> {importType === 'feed' ? 'Import CAMS Feed' : 'Import Portfolios'}
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
