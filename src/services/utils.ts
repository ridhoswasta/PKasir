export const isTauri = () => {
  return (window as any).__TAURI_INTERNALS__ !== undefined;
};

/** Canonical shop name — prefers Settings → Nama Toko, falls back to the first
 *  line of the (legacy) receipt header. */
export function getShopName(settings: any): string {
  const name = (settings?.shopName || '').trim();
  if (name) return name;
  return ((settings?.receiptHeader || 'PKasir').split('\n')[0] || 'PKasir').trim();
}

/** Compose the printed/displayed receipt header from the canonical shop identity
 *  (Nama Toko + Alamat Toko) plus any extra receipt-header lines. When no shop
 *  name/address is set, falls back to the legacy receiptHeader-only behaviour. */
export function composeReceiptHeader(settings: any): string {
  const name = (settings?.shopName || '').trim();
  const addr = (settings?.shopAddress || '').trim();
  const extra = (settings?.receiptHeader || '').replace(/\\n/g, '\n').trim();
  if (!name && !addr) return extra || 'PKasir';
  return [name, addr, extra].filter(Boolean).join('\n');
}
