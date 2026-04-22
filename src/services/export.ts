// CSV export helper. Uses Tauri's native save-file dialog when running in the
// desktop app, falls back to a blob download (dev / browser) otherwise.
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './utils';

const csvEscape = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function buildCsv(rows: (string | number | null | undefined)[][]): string {
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
  // BOM ensures Excel auto-detects UTF-8 (so Indonesian characters render correctly)
  return '\uFEFF' + body;
}

export interface ExportResult {
  saved: boolean;
  path?: string;
}

/**
 * Prompts the user with a native save-file dialog (in Tauri) and writes the CSV.
 * Falls back to a browser blob download outside Tauri.
 */
export async function exportCSV(
  defaultName: string,
  rows: (string | number | null | undefined)[][],
): Promise<ExportResult> {
  const content = buildCsv(rows);

  if (isTauri()) {
    const path = await invoke<string | null>('export_csv', {
      defaultName,
      content,
    });
    return { saved: !!path, path: path || undefined };
  }

  // Browser fallback — triggers the default download location
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
  return { saved: true };
}

/** @deprecated Use `exportCSV` instead — kept for backward compatibility. */
export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]): void {
  void exportCSV(filename, rows);
}
