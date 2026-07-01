/**
 * Purchase Order PDF — generates a supplier-facing PO document (jsPDF + autotable).
 * Lazy-loaded by PurchaseOrdersModule so the heavy PDF stack stays out of the
 * initial bundle. Saves via the native Tauri save dialog (falls back to download).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable/es';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './utils';
import type { ExportResult } from './export';
import type { PurchaseOrder, Supplier } from '../types';

const rp = (n: number) => 'Rp ' + (Number.isFinite(n) ? n : 0).toLocaleString('id-ID');

function fmtDate(iso?: string) {
  if (!iso) return '-';
  try { return format(new Date(iso), 'dd MMM yyyy', { locale: idLocale }); } catch { return iso; }
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draf', ordered: 'Dipesan', received: 'Diterima', cancelled: 'Dibatalkan',
};

export interface PurchaseOrderPDFData {
  storeName: string;
  storeAddress?: string;
  logo?: string;
  po: PurchaseOrder;
  supplier?: Supplier;
}

export async function exportPurchaseOrderPDF(data: PurchaseOrderPDFData): Promise<ExportResult> {
  const { storeName, storeAddress, logo, po, supplier } = data;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // ── Header: store (left) + PURCHASE ORDER title (right) ───────────────────
  if (logo) {
    try {
      const fmt = logo.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logo, fmt, margin, y - 4, 28, 14);
    } catch { /* ignore bad logo */ }
  }
  const storeX = logo ? margin + 32 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(20, 20, 20);
  doc.text(storeName || 'PKasir', storeX, y + 4);
  if (storeAddress && storeAddress.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 120);
    const addrLines = doc.splitTextToSize(storeAddress.trim(), pageW / 2 - storeX);
    doc.text(addrLines, storeX, y + 9);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('PURCHASE ORDER', pageW - margin, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`No. PO: ${po.id}`, pageW - margin, y + 8, { align: 'right' });

  y += 18;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── Meta (left) + Supplier (right) ────────────────────────────────────────
  const leftX = margin;
  const rightX = pageW / 2 + 4;
  doc.setFontSize(9);

  const metaRows: [string, string][] = [
    ['Tanggal Order', fmtDate(po.orderDate)],
    ['Tanggal Diharapkan', fmtDate(po.expectedDate)],
    ['Status', STATUS_LABEL[po.status] || po.status],
  ];
  let metaY = y;
  metaRows.forEach(([k, v]) => {
    doc.setTextColor(130, 130, 130);
    doc.text(k, leftX, metaY);
    doc.setTextColor(30, 30, 30);
    doc.text(String(v), leftX + 38, metaY);
    metaY += 6;
  });

  // Supplier block
  let supY = y;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(130, 130, 130);
  doc.setFontSize(8);
  doc.text('KEPADA (PEMASOK)', rightX, supY);
  supY += 5;
  doc.setFontSize(10);
  doc.setTextColor(20, 20, 20);
  doc.text(supplier?.name || po.supplierName || 'Pemasok', rightX, supY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  supY += 5;
  const supLines = [
    supplier?.contactPerson ? `a.n. ${supplier.contactPerson}` : '',
    supplier?.phone || '',
    supplier?.email || '',
    supplier?.address || '',
  ].filter(Boolean);
  supLines.forEach((line) => {
    const wrapped = doc.splitTextToSize(line, pageW / 2 - margin - 4);
    doc.text(wrapped, rightX, supY);
    supY += 5 * wrapped.length;
  });

  y = Math.max(metaY, supY) + 4;

  // ── Items table ───────────────────────────────────────────────────────────
  const items = po.items || [];
  const body = items.map((it, i) => [
    String(i + 1),
    it.productName || it.productId,
    String(it.qty ?? 0),
    rp(it.costPrice ?? 0),
    rp((it.qty ?? 0) * (it.costPrice ?? 0)),
  ]);
  const total = items.reduce((s, it) => s + (it.qty ?? 0) * (it.costPrice ?? 0), 0);

  autoTable(doc, {
    startY: y,
    head: [['No', 'Produk', 'Qty', 'Harga Satuan', 'Subtotal']],
    body: body.length ? body : [['', 'Tidak ada item', '', '', '']],
    theme: 'striped',
    headStyles: { fillColor: [38, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 34, halign: 'right' },
      4: { cellWidth: 34, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // Total
  doc.setDrawColor(220, 220, 220);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text('TOTAL', pageW - margin - 50, y, { align: 'left' });
  doc.text(rp(total), pageW - margin, y, { align: 'right' });
  y += 10;

  // Note
  if (po.note) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text('Catatan:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    const noteLines = doc.splitTextToSize(po.note, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += 5 * noteLines.length + 4;
  }

  // Signature line
  y = Math.max(y, doc.internal.pageSize.getHeight() - 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text('Hormat kami,', pageW - margin - 50, y);
  doc.line(pageW - margin - 50, y + 18, pageW - margin, y + 18);
  doc.text(storeName || 'PKasir', pageW - margin - 50, y + 23);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 8;
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(`Dibuat ${format(new Date(), 'dd MMM yyyy HH:mm', { locale: idLocale })}`, margin, footerY);
  doc.text(storeName || 'PKasir', pageW - margin, footerY, { align: 'right' });

  // ── Save ──────────────────────────────────────────────────────────────────
  const safeSupplier = (supplier?.name || po.supplierName || 'Pemasok').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const filename = `PO-${po.id}-${safeSupplier}.pdf`;

  if (isTauri()) {
    const bytes = Array.from(new Uint8Array(doc.output('arraybuffer')));
    const path = await invoke<string | null>('export_pdf', { defaultName: filename, data: bytes });
    return { saved: !!path, path: path || undefined };
  }
  doc.save(filename);
  return { saved: true };
}
