// Thin wrapper around tauri-plugin-thermal-printer with a graceful
// fallback when running in plain browser dev (where the Tauri runtime
// is absent and the plugin commands would throw).

import { isTauri } from './utils';

export type PrinterInterface = 'USB' | 'NETWORK' | 'BLUETOOTH';

export interface PrinterInfo {
  name: string;
  interface_type: PrinterInterface;
  identifier: string;
  status: string;
}

export interface PrintJobRequest {
  printer: string;
  paper_size: 'Mm80' | 'Mm58';
  options: {
    cut_paper?: boolean;
    beep?: boolean;
    open_cash_drawer?: boolean;
    code_page?: { codepage: number; encode: string; use_gbk: boolean };
  };
  sections: any[];
}

async function plugin() {
  if (!isTauri()) throw new Error('Thermal printer hanya tersedia di aplikasi desktop (Tauri)');
  return await import('tauri-plugin-thermal-printer');
}

export async function listThermalPrinters(): Promise<PrinterInfo[]> {
  const m: any = await plugin();
  const fn = m.list_thermal_printers || m.listThermalPrinters;
  return await fn();
}

export async function printThermal(job: PrintJobRequest): Promise<void> {
  const m: any = await plugin();
  const fn = m.print_thermal_printer || m.printThermalPrinter;
  const jobWithCP: PrintJobRequest = {
    ...job,
    options: { code_page: { codepage: 0, encode: 'WINDOWS_1252', use_gbk: false }, ...job.options },
  };
  await fn(jobWithCP);
}

const DEFAULT_CODE_PAGE = { codepage: 0, encode: 'WINDOWS_1252', use_gbk: false };

export async function testThermal(job: PrintJobRequest): Promise<void> {
  const m: any = await plugin();
  const fn = m.test_thermal_printer || m.testThermalPrinter;
  const jobWithCP: PrintJobRequest = {
    ...job,
    options: { code_page: DEFAULT_CODE_PAGE, ...job.options },
  };
  await fn({
    printer_info: jobWithCP,
    include_text: true,
    include_text_styles: true,
    include_alignment: true,
    include_columns: true,
    include_separators: true,
    include_barcode: false,
    include_qr: false,
    include_image: false,
    include_beep: false,
    test_cash_drawer: false,
    cut_paper: true,
    test_feed: true,
  });
}

// Virtual / GDI printers can't decode raw ESC/POS bytes — route them through
// the browser's HTML print dialog instead so they produce readable output.
const VIRTUAL_PRINTER_HINTS = [
  'microsoft print to pdf',
  'microsoft xps document writer',
  'onenote',
  'fax',
  'send to onenote',
  'pdf', // catches "Foxit PDF Printer", "Adobe PDF", "Bullzip PDF Printer", etc.
  'xps',
  'cutepdf',
  'dopdf',
  'nitro pdf',
];

export function isVirtualPrinter(name?: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return VIRTUAL_PRINTER_HINTS.some((h) => n.includes(h));
}

// Build receipt sections for a POS transaction
export interface ReceiptInput {
  txId: string;
  txDate: string;
  header?: string;
  footer?: string;
  customer?: string;
  tableName?: string;
  note?: string;
  cashier?: string;
  items: { name: string; qty: number; price: number; variantName?: string; note?: string }[];
  subtotal: number;
  tax: number;
  taxRate?: number;
  serviceCharge: number;
  serviceRate?: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  change?: number;
}

const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

// Helpers to build properly-typed sections matching the plugin schema
const txt = (text: string, styles?: any) => ({ text, ...(styles ? { styles } : {}) });

export function buildReceiptSections(r: ReceiptInput): any[] {
  const sections: any[] = [];
  const center = { align: 'center' as const };
  const right = { align: 'right' as const };
  const bold = { bold: true };

  for (const ln of (r.header || 'CAFE POS').split(/\r?\n/)) {
    sections.push({ Title: { text: ln, styles: center } });
  }
  sections.push({ Text: { text: `Struk #${r.txId}`, styles: center } });
  sections.push({ Text: { text: new Date(r.txDate).toLocaleString('id-ID'), styles: center } });
  if (r.cashier) sections.push({ Text: { text: `Kasir: ${r.cashier}` } });
  if (r.customer) sections.push({ Text: { text: `Pelanggan: ${r.customer}` } });
  if (r.tableName) sections.push({ Text: { text: `Meja: ${r.tableName}`, styles: bold } });
  sections.push({ Line: { character: '-' } });

  for (const it of r.items) {
    const name = `${it.qty}x ${it.name}${it.variantName ? ' (' + it.variantName + ')' : ''}`;
    sections.push({ Table: { columns: 2, body: [[txt(name), txt(fmt(it.price * it.qty), right)]], truncate: true } });
    if (it.note) {
      sections.push({ Text: { text: `  * ${it.note}` } });
    }
  }
  sections.push({ Line: { character: '-' } });

  sections.push({ Table: { columns: 2, body: [[txt('Subtotal'), txt(fmt(r.subtotal), right)]], truncate: true } });
  if (r.tax) sections.push({ Table: { columns: 2, body: [[txt(`Pajak (${r.taxRate || 0}%)`), txt(fmt(r.tax), right)]], truncate: true } });
  if (r.serviceCharge) sections.push({ Table: { columns: 2, body: [[txt(`Layanan (${r.serviceRate || 0}%)`), txt(fmt(r.serviceCharge), right)]], truncate: true } });
  sections.push({ Line: { character: '-' } });

  sections.push({ Table: { columns: 2, body: [[txt('TOTAL', bold), txt(fmt(r.total), { ...right, ...bold })]], truncate: true } });
  sections.push({ Text: { text: `Pembayaran: ${r.paymentMethod}` } });
  if (r.paymentMethod === 'Tunai') {
    sections.push({ Table: { columns: 2, body: [[txt('Tunai'), txt(fmt(r.amountPaid || 0), right)]], truncate: true } });
    sections.push({ Table: { columns: 2, body: [[txt('Kembalian'), txt(fmt(r.change || 0), right)]], truncate: true } });
  }
  if (r.note) sections.push({ Text: { text: `Catatan: ${r.note}` } });
  sections.push({ Line: { character: '-' } });

  for (const ln of (r.footer || 'Terima Kasih').split(/\r?\n/)) {
    sections.push({ Text: { text: ln, styles: center } });
  }

  sections.push({ Feed: { feed_type: 'lines', value: 3 } });
  sections.push({ Cut: { mode: 'partial', feed: 0 } });

  return sections;
}

// HTML print fallback — produces readable output on virtual printers
// (Microsoft Print to PDF, XPS Writer, etc.) and standard A4 printers.
// Uses a hidden iframe so it works without popup permissions and inside
// the Tauri webview where window.open() may be blocked.
export function htmlPrintReceipt(
  r: ReceiptInput,
  opts?: { paperWidth?: string; logo?: string; logoWidth?: number; logoHeight?: number }
): void {
  const paperWidth = opts?.paperWidth || '80mm';
  const itemRows = r.items.map((it) => `
    <div class="item">
      <span>${it.qty}x ${it.name}${it.variantName ? ' (' + it.variantName + ')' : ''}</span>
      <span>${fmt(it.price * it.qty)}</span>
    </div>${it.note ? `<div class="item-note">* ${it.note}</div>` : ''}`).join('');

  const html = `<!DOCTYPE html><html><head><title>Struk #${r.txId}</title>
    <style>
      @page { size: ${paperWidth} auto; margin: 4mm; }
      body { font-family: monospace; font-size: 12px; padding: 4px; width: ${paperWidth}; margin: 0 auto; }
      .header, .footer { text-align: center; white-space: pre-wrap; margin: 6px 0; }
      .header { font-weight: bold; font-size: 14px; }
      .item { display: flex; justify-content: space-between; margin-bottom: 3px; gap: 8px; }
      .item-note { font-size: 10px; font-style: italic; color: #555; padding-left: 12px; margin-bottom: 4px; }
      .item span:last-child { white-space: nowrap; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      .total { font-weight: bold; font-size: 13px; }
    </style></head><body>
      ${opts?.logo ? `<img src="${opts.logo}" style="display:block;margin:0 auto 6px;width:${
        paperWidth.includes('58') ? Math.min(opts.logoWidth || 160, 160) : Math.min(opts.logoWidth || 200, 200)
      }px;height:${
        paperWidth.includes('58') ? Math.min(opts.logoHeight || 45, 50) : Math.min(opts.logoHeight || 50, 60)
      }px;object-fit:contain;filter:grayscale(100%) contrast(1.2)" />` : ''}
      <div class="header">${(r.header || 'CAFE POS')}</div>
      <div>Struk #${r.txId}</div>
      <div>${new Date(r.txDate).toLocaleString('id-ID')}</div>
      ${r.cashier ? `<div>Kasir: ${r.cashier}</div>` : ''}
      ${r.customer ? `<div>Pelanggan: ${r.customer}</div>` : ''}
      ${r.tableName ? `<div><b>Meja: ${r.tableName}</b></div>` : ''}
      <div class="divider"></div>
      ${itemRows}
      <div class="divider"></div>
      <div class="item"><span>Subtotal</span><span>${fmt(r.subtotal)}</span></div>
      ${r.tax ? `<div class="item"><span>Pajak (${r.taxRate || 0}%)</span><span>${fmt(r.tax)}</span></div>` : ''}
      ${r.serviceCharge ? `<div class="item"><span>Layanan (${r.serviceRate || 0}%)</span><span>${fmt(r.serviceCharge)}</span></div>` : ''}
      <div class="divider"></div>
      <div class="item total"><span>Total</span><span>${fmt(r.total)}</span></div>
      <div class="item"><span>Pembayaran</span><span>${r.paymentMethod}</span></div>
      ${r.paymentMethod === 'Tunai' ? `
        <div class="item"><span>Tunai</span><span>${fmt(r.amountPaid || 0)}</span></div>
        <div class="item"><span>Kembalian</span><span>${fmt(r.change || 0)}</span></div>
      ` : ''}
      ${r.note ? `<div style="font-size:11px;color:#555;margin-top:4px">Catatan: ${r.note}</div>` : ''}
      <div class="divider"></div>
      <div class="footer">${(r.footer || 'Terima Kasih')}</div>
    </body></html>`;

  // Remove any previous print iframe
  const existing = document.getElementById('__pos_print_frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__pos_print_frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cw = iframe.contentWindow;
  if (!cw) throw new Error('Tidak dapat membuat iframe print');
  cw.document.open();
  cw.document.write(html);
  cw.document.close();

  // Wait for content (and any logo image) to render before invoking print
  const triggerPrint = () => {
    try {
      cw.focus();
      cw.print();
    } catch (e) {
      console.error('print() failed', e);
    }
    // Clean up after the dialog closes (give browser time)
    setTimeout(() => iframe.remove(), 60_000);
  };

  if (cw.document.readyState === 'complete') {
    setTimeout(triggerPrint, 100);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 100);
  }
}
