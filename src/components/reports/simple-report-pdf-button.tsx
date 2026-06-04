'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { SimpleReportPDF } from './simple-report-pdf';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface PDFButtonProps {
  clientName: string;
  pan: string;
  startDate?: string;
  endDate?: string;
  investments: any[];
  totalInvested: number;
  totalCurrent: number;
  totalGain: number;
  portfolioCagr: number;
}

export function SimpleReportPDFButton({
  clientName,
  pan,
  startDate,
  endDate,
  investments,
  totalInvested,
  totalCurrent,
  totalGain,
  portfolioCagr,
}: PDFButtonProps) {
  return (
    <PDFDownloadLink
      document={
        <SimpleReportPDF
          clientName={clientName}
          pan={pan}
          startDate={startDate}
          endDate={endDate}
          investments={investments}
          totalInvested={totalInvested}
          totalCurrent={totalCurrent}
          totalGain={totalGain}
          portfolioCagr={portfolioCagr}
        />
      }
      fileName={`DFS_Report_${clientName.replace(/\s+/g, '_')}.pdf`}
      className="w-full"
    >
      {({ loading }) => (
        <Button variant="outline" className="w-full text-blue-600 border-blue-200 hover:bg-blue-50/50 font-bold" disabled={loading}>
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Generating PDF...' : 'Download Simple PDF Report'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
