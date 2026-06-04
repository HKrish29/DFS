'use client';

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
  },
  headerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 12,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    backgroundColor: '#0f172a',
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    padding: '6 10',
    borderRadius: 4,
    textAlign: 'center',
  },
  companyName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  companySubtitle: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
  },
  headerRight: {
    textAlign: 'right',
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 15,
    textDecoration: 'underline',
  },
  identityBlock: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 4,
    padding: '8 12',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  identityText: {
    fontWeight: 'bold',
    color: '#0369a1',
    fontSize: 9,
  },
  table: {
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
  },
  tableHeader: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#94a3b8',
  },
  tableColHeader: {
    padding: '6 8',
    fontWeight: 'bold',
    color: '#1e293b',
    fontSize: 9,
  },
  tableCol: {
    padding: '6 8',
    color: '#334155',
    fontSize: 8.5,
  },
  colFolio: { width: '18%', borderRightWidth: 1, borderRightColor: '#94a3b8' },
  colScheme: { width: '38%', borderRightWidth: 1, borderRightColor: '#94a3b8' },
  colInv: { width: '14%', borderRightWidth: 1, borderRightColor: '#94a3b8', textAlign: 'right' },
  colCurr: { width: '14%', borderRightWidth: 1, borderRightColor: '#94a3b8', textAlign: 'right' },
  colGain: { width: '16%', borderRightWidth: 1, borderRightColor: '#94a3b8', textAlign: 'right' },
  colCagr: { width: '12%', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 2,
    borderTopColor: '#0f172a',
    fontWeight: 'bold',
  },
  disclaimer: {
    marginTop: 30,
    fontSize: 8,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 1.4,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
});

interface PDFProps {
  clientName: string;
  pan: string;
  startDate?: string;
  endDate?: string;
  investments: Array<{
    folio_number: string;
    scheme_name: string;
    invested_amount: number;
    current_value: number;
    purchase_date: string | null;
  }>;
  totalInvested: number;
  totalCurrent: number;
  totalGain: number;
  portfolioCagr: number;
}

export function SimpleReportPDF({
  clientName,
  pan,
  startDate,
  endDate,
  investments,
  totalInvested,
  totalCurrent,
  totalGain,
  portfolioCagr,
}: PDFProps) {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ').join('-');
  
  const formatDateString = (ds: string) => {
    try {
      return new Date(ds).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).split(' ').join('-');
    } catch {
      return ds;
    }
  };

  const periodStr = startDate && endDate 
    ? `Period: ${formatDateString(startDate)} to ${formatDateString(endDate)}` 
    : `As of: ${dateStr}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>DFS</Text>
            <View>
              <Text style={styles.companyName}>Dhara Financial Services</Text>
              <Text style={styles.companySubtitle}>Wealth Management & Advisory</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 8.5, color: '#0f172a', fontWeight: 'bold' }}>MUTUAL FUND REPORT</Text>
            <Text style={{ fontSize: 7.5, color: '#64748b', marginTop: 3 }}>{periodStr}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Summary of Mutual Fund Investments</Text>

        {/* Identity Block */}
        <View style={styles.identityBlock}>
          <Text style={styles.identityText}>{clientName.toUpperCase()} - {pan ? pan.toUpperCase() : 'NO PAN'}</Text>
          <Text style={styles.identityText}>{dateStr}</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableColHeader, styles.colFolio]}>Folio no.</Text>
            <Text style={[styles.tableColHeader, styles.colScheme]}>Scheme Name</Text>
            <Text style={[styles.tableColHeader, styles.colInv]}>Invt Amt Rs</Text>
            <Text style={[styles.tableColHeader, styles.colCurr]}>Curr Amt Rs</Text>
            <Text style={[styles.tableColHeader, styles.colGain]}>Profit/Loss Rs</Text>
            <Text style={[styles.tableColHeader, styles.colCagr]}>CAGR %</Text>
          </View>

          {/* Table Body */}
          {investments.map((inv, idx) => {
            const gain = inv.current_value - inv.invested_amount;
            const years = inv.purchase_date 
              ? (new Date().getTime() - new Date(inv.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25) 
              : 0;
            const cagr = (inv.invested_amount > 0 && inv.current_value > 0 && years > 0.04)
              ? (Math.pow(inv.current_value / inv.invested_amount, 1 / years) - 1) * 100
              : 0;

            return (
              <View key={idx} style={styles.tableRow}>
                <Text style={[styles.tableCol, styles.colFolio, { fontFamily: 'Courier' }]}>{inv.folio_number || '-'}</Text>
                <Text style={[styles.tableCol, styles.colScheme, { fontWeight: 'bold' }]}>{inv.scheme_name}</Text>
                <Text style={[styles.tableCol, styles.colInv]}>{inv.invested_amount.toFixed(2)}</Text>
                <Text style={[styles.tableCol, styles.colCurr]}>{inv.current_value.toFixed(2)}</Text>
                <Text style={[styles.tableCol, styles.colGain]}>{gain.toFixed(2)}</Text>
                <Text style={[styles.tableCol, styles.colCagr]}>{cagr !== 0 ? `${cagr.toFixed(2)}%` : '-'}</Text>
              </View>
            );
          })}

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={[styles.tableCol, styles.colFolio]}></Text>
            <Text style={[styles.tableCol, styles.colScheme, { textAlign: 'right', fontWeight: 'bold' }]}>Total</Text>
            <Text style={[styles.tableCol, styles.colInv, { fontWeight: 'bold' }]}>{totalInvested.toFixed(2)}</Text>
            <Text style={[styles.tableCol, styles.colCurr, { fontWeight: 'bold' }]}>{totalCurrent.toFixed(2)}</Text>
            <Text style={[styles.tableCol, styles.colGain, { fontWeight: 'bold' }]}>{totalGain.toFixed(2)}</Text>
            <Text style={[styles.tableCol, styles.colCagr, { fontWeight: 'bold' }]}>{portfolioCagr !== 0 ? `${portfolioCagr.toFixed(2)}%` : '-'}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Note : Mutual Fund Investments are subject to Market risk, Read all Schemes related Documents carefully.
        </Text>
      </Page>
    </Document>
  );
}
