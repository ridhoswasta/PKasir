/**
 * PDF Report Export — generates a professional PDF report using jsPDF + jspdf-autotable.
 * Supports the full ReportsModule data set: KPIs, top products, and transaction list.
 */
import jsPDF from 'jspdf';
// Use the ESM entry: the package's main "." export is a webpack-UMD CJS bundle
// whose default resolves to an object (not the function) under Vite/Rolldown,
// causing "autoTable is not a function". The /es build exports the function as default.
import autoTable from 'jspdf-autotable/es';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './utils';
import type { ExportResult } from './export';

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

function fmtDate(iso: string) {
  try {
    return format(new Date(iso), 'dd MMM yyyy HH:mm', { locale: idLocale });
  } catch {
    return iso;
  }
}

function rangLabel(range: string, customFrom?: string, customTo?: string): string {
  if (range === '7d') return '7 Hari Terakhir';
  if (range === '30d') return '30 Hari Terakhir';
  if (range === '90d') return '90 Hari Terakhir';
  if (range === 'all') return 'Semua Waktu';
  if (range === 'custom' && customFrom && customTo) {
    return `${customFrom} — ${customTo}`;
  }
  return 'Semua Waktu';
}

export interface PDFReportData {
  storeName: string;
  logo?: string; // base64 data URL
  range: string;
  customFrom?: string;
  customTo?: string;
  // KPIs
  totalSales: number;
  totalTx: number;
  avgTx: number;
  totalDiscount: number;
  grossProfit: number;
  margin: string;
  // Top products
  topProducts: Array<{ name: string; qty: number; revenue: number }>;
  // Transactions
  transactions: Array<{
    id: string;
    date: string;
    customer: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    paymentMethod: string;
    discount?: number;
  }>;
}

export async function exportReportPDF(data: PDFReportData): Promise<ExportResult> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // ── Header ──────────────────────────────────────────────────────────────
  // Logo (if available and base64)
  if (data.logo && data.logo.startsWith('data:image')) {
    try {
      const logoH = 16;
      const logoW = 40;
      doc.addImage(data.logo, 'AUTO', margin, y, logoW, logoH);
      y += logoH + 4;
    } catch {
      // ignore logo errors
    }
  }

  // Store name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text(data.storeName || 'PKasir', margin, y);
  y += 7;

  // Report title + period
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.text('Laporan Penjualan & Analitik', margin, y);
  y += 5;

  doc.setFontSize(10);
  doc.text(`Periode: ${rangLabel(data.range, data.customFrom, data.customTo)}`, margin, y);
  y += 4;

  // Generation timestamp — right aligned
  const genTs = `Dibuat: ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: idLocale })}`;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(genTs, pageW - margin, y - 4, { align: 'right' });

  // Divider
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── KPI Summary ─────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text('Ringkasan Kinerja', margin, y);
  y += 6;

  const kpiData = [
    ['Total Omset', fmt(data.totalSales), 'Jumlah Transaksi', String(data.totalTx)],
    ['Rata-rata Transaksi', fmt(data.avgTx), 'Laba Kotor', fmt(data.grossProfit)],
    ['Total Diskon', fmt(data.totalDiscount), 'Margin Laba', `${data.margin}%`],
  ];

  autoTable(doc, {
    startY: y,
    head: [],
    body: kpiData,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 50 },
      1: { fontStyle: 'normal', textColor: [30, 30, 30], cellWidth: 50 },
      2: { fontStyle: 'bold', textColor: [80, 80, 80], cellWidth: 50 },
      3: { fontStyle: 'normal', textColor: [30, 30, 30], cellWidth: 36 },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Top Products ─────────────────────────────────────────────────────────
  if (data.topProducts.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text('Produk Terlaris', margin, y);
    y += 4;

    const top10 = data.topProducts.slice(0, 20);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Nama Produk', 'Terjual (Qty)', 'Pendapatan']],
      body: top10.map((p, i) => [
        String(i + 1),
        p.name,
        p.qty.toLocaleString('id-ID'),
        fmt(p.revenue),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [50, 100, 200], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // ── Transactions ─────────────────────────────────────────────────────────
  if (data.transactions.length > 0) {
    // New page if less than 50mm remaining
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(`Daftar Transaksi (${data.transactions.length} transaksi)`, margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Tanggal', 'ID', 'Pelanggan', 'Item', 'Diskon', 'Total', 'Pembayaran']],
      body: data.transactions.map((tx) => {
        const itemSummary = (tx.items || [])
          .slice(0, 3)
          .map((i) => `${i.quantity}x ${i.name}`)
          .join(', ') + ((tx.items || []).length > 3 ? ` +${tx.items.length - 3}` : '');
        return [
          fmtDate(tx.date),
          tx.id,
          tx.customer || 'Walk-In',
          itemSummary,
          tx.discount ? fmt(tx.discount) : '-',
          fmt(tx.total),
          tx.paymentMethod || '-',
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [50, 100, 200], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 28 },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 24, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 22 },
      },
      margin: { left: margin, right: margin },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${data.storeName || 'PKasir'} — Laporan diekspor ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: idLocale })}`, margin, footerY);
    doc.text(`Hal. ${i} / ${pageCount}`, pageW - margin, footerY, { align: 'right' });
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY - 3, pageW - margin, footerY - 3);
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const filename = `Laporan-PKasir-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  if (isTauri()) {
    // Prompt the user with a native "Save As" dialog and write the bytes there.
    const bytes = Array.from(new Uint8Array(doc.output('arraybuffer')));
    const path = await invoke<string | null>('export_pdf', { defaultName: filename, data: bytes });
    return { saved: !!path, path: path || undefined };
  }

  // Browser fallback (dev / non-Tauri) — triggers the default download location.
  doc.save(filename);
  return { saved: true };
}
