import React, { useState, useEffect, useRef } from 'react';
import { decodeQRFromImage, extractMerchantInfo, isValidQRIS } from '../services/qrisService';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
// Issue #14: added Select import to replace native <select> elements
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Upload, X, Printer, RefreshCw, Bluetooth, Volume2, VolumeX, Play, ScrollText, Trash2, Search, Keyboard, Database, Download, FolderOpen, HardDriveUpload, QrCode, Images, Settings, Tags, Receipt, Sparkles, CheckCircle2, AlertCircle, type LucideIcon } from 'lucide-react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { listThermalPrinters, testThermal, isVirtualPrinter, htmlPrintReceipt, type PrinterInfo } from '../services/printer';
import { SOUND_STYLES, playAddToCart, setActiveSound, type SoundStyle } from '../services/sound';
import { isTauri, composeReceiptHeader, getShopName } from '../services/utils';
import { logActivity } from '../services/activity';

const TagInput = ({ tags = [], onChange, placeholder }: { tags: string[], onChange: (tags: string[]) => void, placeholder: string }) => {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim() && !tags.includes(inputValue.trim())) {
      onChange([...tags, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemove = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <div key={tag} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm border border-border text-foreground">
              <span>{tag}</span>
              <button type="button" onClick={() => handleRemove(tag)} aria-label={`Hapus ${tag}`} className="text-muted-foreground hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <Button type="button" onClick={handleAdd} variant="secondary">Tambah</Button>
      </div>
    </div>
  );
};

// Native <select> styled to match the Input component for visual consistency.
const SELECT_CLASS =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const DEFAULT_LOGO_WIDTH = 160;
const DEFAULT_LOGO_HEIGHT = 48;

// Uniform grouping card used for every settings sub-section so each tab reads
// as a tidy stack of labelled cards instead of ad-hoc dividers.
function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-2xl ring-1 ring-foreground/10 bg-card p-4 sm:p-5 space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
            {title}
          </h3>
          {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function SettingsModule() {
  const [settings, setSettings] = useState<any>({
    taxRate: 0, serviceCharge: 0, printerName: '', paperWidth: '', receiptHeader: '', receiptFooter: '', logo: '',
    productCategories: [], flowCategories: [], productUnits: [], pointMultiplier: 1000,
    printerType: 'browser', printerIp: '', printerPort: 9100, printerCharset: 'CP437', printerOpenDrawer: 0,
    tauriPrinterName: '', tauriPrinterInterface: 'USB', tables: [], cartSound: 'scanner', virtualKeyboard: 0,
    backupPath: '', autoBackupEnabled: 0, autoBackupPath: '', lastBackupAt: '', autoBackupIntervalSeconds: 0,
    displayPhotos: [], displaySlideshowInterval: 5,
    // QRIS v2 defaults (overwritten when DB loads)
    qrisMerchantCity: '', qrisMode: 'static',
  });
  const [testingPrint, setTestingPrint] = useState(false);
  const [discoveredPrinters, setDiscoveredPrinters] = useState<PrinterInfo[]>([]);
  const [scanningPrinters, setScanningPrinters] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [logSearch, setLogSearch] = useState('');
  const [backupInfo, setBackupInfo] = useState<{ dbPath: string; dbSize: number } | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [restoreRunning, setRestoreRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qrisInputRef = useRef<HTMLInputElement>(null);
  const displayPhotosInputRef = useRef<HTMLInputElement>(null);
  // QRIS image-decode state (v2 flow)
  const [qrisDecoding, setQrisDecoding] = useState(false);
  const [qrisDecodeStatus, setQrisDecodeStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [qrisDecodeError, setQrisDecodeError] = useState('');

  const fetchBackupInfo = () => {
    invoke<{ dbPath: string; dbSize: number }>('get_backup_info').then(setBackupInfo).catch(() => {});
  };

  const fetchLogs = () => {
    invoke('get_activity_logs').then((data: any) => setActivityLogs(data)).catch(() => {});
  };

  useEffect(() => {
    invoke('get_settings').then((data: any) => {
      setSettings(data);
      if (data.cartSound) setActiveSound(data.cartSound as SoundStyle);
      // Restore QRIS decode status from previously saved data
      if (data.qrisStatic && isValidQRIS(data.qrisStatic)) {
        setQrisDecodeStatus('valid');
        setQrisDecodeError('');
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      await invoke('update_settings', { settings });
      logActivity('Ubah Pengaturan');
      toast.success('Pengaturan berhasil disimpan');
      if (settings.cartSound) setActiveSound(settings.cartSound as SoundStyle);
      window.dispatchEvent(new Event('settings-updated'));
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    }
  };

  const handleScanPrinters = async () => {
    if (!isTauri()) {
      toast.error('Scan printer hanya tersedia di aplikasi desktop (Tauri)');
      return;
    }
    setScanningPrinters(true);
    try {
      const list = await listThermalPrinters();
      setDiscoveredPrinters(list);
      if (list.length === 0) toast.info('Tidak ada printer terdeteksi. Pastikan printer sudah ter-pair / terhubung di OS.');
      else toast.success(`Ditemukan ${list.length} printer`);
    } catch (e: any) {
      toast.error('Gagal scan: ' + (e.message || e));
    } finally {
      setScanningPrinters(false);
    }
  };

  const handleTestTauriPrint = async () => {
    if (!settings.tauriPrinterName) {
      toast.error('Pilih printer terlebih dahulu');
      return;
    }
    setTestingPrint(true);
    try {
      // Virtual printers (Microsoft Print to PDF, XPS, etc.) cannot decode raw ESC/POS bytes,
      // so the file becomes unreadable. Render a real HTML preview instead.
      if (isVirtualPrinter(settings.tauriPrinterName)) {
        htmlPrintReceipt(
          {
            txId: 'TEST-' + Date.now(),
            txDate: new Date().toISOString(),
            header: composeReceiptHeader(settings),
            footer: (settings.receiptFooter || 'Terima Kasih').replace(/\\n/g, '\n'),
            customer: 'Walk-In Customer',
            items: [
              { name: 'Test Item A', qty: 1, price: 10000 },
              { name: 'Test Item B', qty: 2, price: 5000 },
            ],
            subtotal: 20000,
            tax: 2000,
            taxRate: settings.taxRate,
            serviceCharge: 1000,
            serviceRate: settings.serviceCharge,
            total: 23000,
            paymentMethod: 'Tunai',
            amountPaid: 25000,
            change: 2000,
          },
          {
            paperWidth: settings.paperWidth,
            logo: settings.logo,
            logoWidth: settings.logoWidth,
            logoHeight: settings.logoHeight,
          }
        );
        toast.success('Test print dibuka di tab baru (mode HTML untuk printer virtual)');
        return;
      }

      await testThermal({
        printer: settings.tauriPrinterName,
        paper_size: (settings.paperWidth || '').includes('58') ? 'Mm58' : 'Mm80',
        options: {
          cut_paper: true,
          beep: false,
          open_cash_drawer: !!settings.printerOpenDrawer,
        },
        sections: [],
      });
      toast.success('Test print terkirim');
    } catch (e: any) {
      toast.error('Test print gagal: ' + (e.message || e));
    } finally {
      setTestingPrint(false);
    }
  };

  const handleTestPrint = async () => {
    if (!settings.printerIp) {
      toast.error('Isi alamat IP printer terlebih dahulu');
      return;
    }
    setTestingPrint(true);
    try {
      await invoke('print_test', { ip: settings.printerIp, port: Number(settings.printerPort) || 9100 });
      toast.success('Test print terkirim ke printer');
    } catch (e: any) {
      toast.error('Gagal: ' + (e.message || e));
    } finally {
      setTestingPrint(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev: any) => ({
          ...prev,
          logo: reader.result as string,
          logoWidth: prev.logoWidth || DEFAULT_LOGO_WIDTH,
          logoHeight: prev.logoHeight || DEFAULT_LOGO_HEIGHT,
        }));
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  /**
   * QRIS image upload handler (v2 flow):
   *   1. Read as base64 data URL (for thumbnail storage)
   *   2. Decode QR code from the same file using jsQR
   *   3. Validate the decoded string (CRC check)
   *   4. Extract merchant name (tag 59) and city (tag 60)
   *   5. Auto-populate qrisStatic, qrisMerchantName, qrisMerchantCity in settings
   */
  const handleQrisImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Allow re-selecting the same file later
    e.target.value = '';

    setQrisDecoding(true);
    setQrisDecodeStatus('idle');
    setQrisDecodeError('');

    try {
      // Read as data URL and decode QR simultaneously
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const [dataUrl, qrisString] = await Promise.all([
        dataUrlPromise,
        decodeQRFromImage(file),
      ]);

      // Always store the image thumbnail regardless of validity
      setSettings((prev: any) => ({ ...prev, qrisImage: dataUrl }));

      if (!isValidQRIS(qrisString)) {
        setQrisDecodeStatus('invalid');
        setQrisDecodeError(
          'QR code terdeteksi namun bukan QRIS yang valid (format tidak sesuai atau CRC tidak cocok).'
        );
        return;
      }

      const { merchantName, merchantCity } = extractMerchantInfo(qrisString);

      setSettings((prev: any) => ({
        ...prev,
        qrisImage: dataUrl,
        qrisStatic: qrisString,
        qrisMerchantName: merchantName,
        qrisMerchantCity: merchantCity,
      }));
      setQrisDecodeStatus('valid');
      setQrisDecodeError('');
    } catch (err: any) {
      setQrisDecodeStatus('invalid');
      setQrisDecodeError(err?.message || 'Gagal membaca QR code dari gambar');
    } finally {
      setQrisDecoding(false);
    }
  };

  const handleDisplayPhotosUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    Promise.all(
      files.map(
        (file) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    )
      .then((dataUrls) => {
        setSettings((prev: any) => ({
          ...prev,
          displayPhotos: [...(prev.displayPhotos || []), ...dataUrls],
        }));
      })
      .catch(() => toast.error('Gagal memuat gambar'));
    // Allow selecting the same file again later
    e.target.value = '';
  };

  const removeDisplayPhoto = (idx: number) => {
    setSettings((prev: any) => ({
      ...prev,
      displayPhotos: (prev.displayPhotos || []).filter((_: string, i: number) => i !== idx),
    }));
  };

  // handleValidateQris removed in v2 — validation now happens automatically
  // during image upload via handleQrisImageUpload + isValidQRIS().

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className="max-w-4xl space-y-6">
          <PageHeader
            icon={Settings}
            title="Pengaturan"
            description="Kelola toko, struk, printer, cadangan data, dan preferensi sistem."
          />

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 lg:grid-cols-7">
              <TabsTrigger value="general">
                <Settings className="w-3.5 h-3.5 mr-1.5" />Umum
              </TabsTrigger>
              <TabsTrigger value="receipt">
                <Receipt className="w-3.5 h-3.5 mr-1.5" />Struk
              </TabsTrigger>
              <TabsTrigger value="system">
                <Printer className="w-3.5 h-3.5 mr-1.5" />Sistem
              </TabsTrigger>
              <TabsTrigger value="loyalty">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />Loyalitas
              </TabsTrigger>
              <TabsTrigger value="email">
                <Tags className="w-3.5 h-3.5 mr-1.5" />Email
              </TabsTrigger>
              <TabsTrigger value="backup" onClick={fetchBackupInfo}>
                <Database className="w-3.5 h-3.5 mr-1.5" />Backup
              </TabsTrigger>
              <TabsTrigger value="activity" onClick={fetchLogs}>
                <ScrollText className="w-3.5 h-3.5 mr-1.5" />Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-5 space-y-5">
              <SettingsSection
                icon={Settings}
                title="Identitas & Pajak"
                description="Nama, alamat, dan logo toko — dipakai sebagai sumber utama (mis. PDF Purchase Order, laporan, struk)."
              >
                <div className="space-y-2">
                  <Label>Nama Toko</Label>
                  <Input
                    value={settings.shopName || ''}
                    onChange={e => setSettings({ ...settings, shopName: e.target.value })}
                    placeholder="Mis. Kopi Kenangan"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Alamat Toko</Label>
                  <Textarea
                    rows={2}
                    value={settings.shopAddress || ''}
                    onChange={e => setSettings({ ...settings, shopAddress: e.target.value })}
                    placeholder="Mis. Jl. Sudirman No. 1, Pekanbaru"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo Toko</Label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <Input
                      value={settings.logo || ''}
                      onChange={e => setSettings({
                        ...settings,
                        logo: e.target.value,
                        logoWidth: settings.logoWidth || DEFAULT_LOGO_WIDTH,
                        logoHeight: settings.logoHeight || DEFAULT_LOGO_HEIGHT,
                      })}
                      placeholder="URL Logo atau pilih gambar..."
                      className="min-w-0"
                    />
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
                      <Upload className="w-4 h-4 mr-2" />
                      Pilih Gambar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Logo ditampilkan otomatis secara proporsional. Tidak perlu mengatur tinggi dan lebar manual.
                  </p>
                  {settings.logo && (
                    <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                      <img
                        src={settings.logo}
                        alt="Logo Preview"
                        className="h-14 max-w-48 object-contain rounded border border-border bg-background p-2"
                      />
                      <div className="min-w-0 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Preview logo</p>
                        <p className="truncate">{String(settings.logo).startsWith('data:') ? fileInputRef.current?.files?.[0]?.name || 'Gambar tersimpan' : settings.logo}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pajak (%)</Label>
                    <Input type="number" value={settings.taxRate} onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Biaya Layanan (%)</Label>
                    <Input type="number" value={settings.serviceCharge} onChange={(e) => setSettings({ ...settings, serviceCharge: Number(e.target.value) })} />
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection
                icon={Tags}
                title="Kategori, Satuan & Meja"
                description="Dipakai di seluruh aplikasi sebagai pilihan kategori produk, kategori arus kas, satuan produk, dan daftar meja di POS."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Kategori Produk</Label>
                    <TagInput
                      tags={settings.productCategories || []}
                      onChange={(tags) => setSettings({ ...settings, productCategories: tags })}
                      placeholder="Ketik lalu Enter / koma..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kategori Arus Kas</Label>
                    <TagInput
                      tags={settings.flowCategories || []}
                      onChange={(tags) => setSettings({ ...settings, flowCategories: tags })}
                      placeholder="Ketik lalu Enter / koma..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Satuan Produk</Label>
                    <TagInput
                      tags={settings.productUnits || []}
                      onChange={(tags) => setSettings({ ...settings, productUnits: tags })}
                      placeholder="Ketik lalu Enter / koma..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Daftar Meja</Label>
                    <TagInput
                      tags={settings.tables || []}
                      onChange={(tags) => setSettings({ ...settings, tables: tags })}
                      placeholder="Mis. Meja 1, VIP A, Take Away..."
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Daftar meja akan muncul sebagai pilihan di POS saat membuat pesanan.
                </p>
              </SettingsSection>

              <SettingsSection
                icon={Images}
                title="Slideshow Customer Display"
                description="Unggah beberapa foto (promo, menu unggulan, dsb). Foto akan diputar bergantian di panel kiri layar Customer Display selama keranjang masih kosong."
                action={
                  <Button variant="outline" size="sm" onClick={() => displayPhotosInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Tambah Foto
                  </Button>
                }
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  ref={displayPhotosInputRef}
                  onChange={handleDisplayPhotosUpload}
                />

                {(settings.displayPhotos || []).length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {(settings.displayPhotos || []).map((src: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/40 group"
                      >
                        <img src={src} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeDisplayPhoto(idx)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-destructive transition-opacity flex items-center justify-center"
                          aria-label={`Hapus foto slide ${idx + 1}`}
                          title="Hapus foto"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState compact icon={Images} title="Belum ada foto slideshow" description="Klik “Tambah Foto” untuk mengunggah." />
                )}

                <div className="space-y-2 max-w-xs">
                  <Label>Interval Pergantian (detik)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={settings.displaySlideshowInterval ?? 5}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        displaySlideshowInterval: Math.max(1, Number(e.target.value) || 5),
                      })
                    }
                  />
                </div>
              </SettingsSection>
            </TabsContent>

            <TabsContent value="receipt" className="mt-5 space-y-5">
              <SettingsSection
                icon={Receipt}
                title="Format Struk"
                description="Lebar kertas serta teks header dan footer yang dicetak pada struk."
              >
                <div className="space-y-2">
                  <Label>Lebar Kertas (Contoh: 58mm atau 80mm)</Label>
                  <Input value={settings.paperWidth} onChange={(e) => setSettings({ ...settings, paperWidth: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Baris Tambahan Header Struk</Label>
                  <Textarea rows={3} value={settings.receiptHeader} onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })} placeholder="Mis. No. Telp, NPWP, slogan..." />
                  <p className="text-xs text-muted-foreground">Nama &amp; alamat toko otomatis diambil dari <b>Umum → Identitas Toko</b> dan dicetak di atas. Baris di sini ditampilkan setelahnya (opsional).</p>
                </div>
                <div className="space-y-2">
                  <Label>Footer Struk (Pesan Terima Kasih)</Label>
                  <Textarea rows={3} value={settings.receiptFooter} onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })} />
                </div>
              </SettingsSection>

              {/* ── QRIS Pembayaran (v2: image-upload flow) ───────────────── */}
              <SettingsSection
                icon={QrCode}
                title="QRIS Pembayaran"
                description="Upload gambar QRIS dari bank Anda. Sistem membaca QR code secara otomatis, mengisi nama merchant, dan memberi pilihan mode tampilan."
              >
                {/* Enable / disable QRIS */}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>Aktifkan QRIS</Label>
                    <p className="text-xs text-muted-foreground">
                      Tampilkan pilihan bayar QRIS di POS dan Customer Display.
                    </p>
                  </div>
                  <Switch
                    aria-label="Aktifkan QRIS"
                    checked={!!settings.qrisEnabled}
                    onCheckedChange={(checked: boolean) =>
                      setSettings({ ...settings, qrisEnabled: checked ? 1 : 0 })
                    }
                  />
                </div>

                {/* Image upload */}
                <div className="space-y-2">
                  <Label>Gambar QRIS</Label>
                  <div className="flex gap-2 items-center flex-wrap">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={qrisInputRef}
                      onChange={handleQrisImageUpload}
                    />
                    <Button
                      variant="outline"
                      onClick={() => qrisInputRef.current?.click()}
                      disabled={qrisDecoding}
                    >
                      {qrisDecoding ? (
                        <Spinner className="w-4 h-4 mr-2" />
                      ) : (
                            <Upload className="w-4 h-4 mr-2" />
                      )}
                      {qrisDecoding ? 'Membaca QR...' : 'Pilih Gambar QRIS'}
                    </Button>
                    {settings.qrisImage && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setSettings((prev: any) => ({
                            ...prev,
                            qrisImage: '',
                            qrisStatic: '',
                            qrisMerchantName: '',
                            qrisMerchantCity: '',
                          }));
                          setQrisDecodeStatus('idle');
                          setQrisDecodeError('');
                        }}
                        title="Hapus gambar QRIS"
                        aria-label="Hapus gambar QRIS"
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gunakan file PNG/JPG gambar QRIS yang diterima dari bank. QR code akan dibaca otomatis.
                  </p>
                </div>

                {/* Thumbnail + decode status */}
                {settings.qrisImage && (
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <img
                        src={settings.qrisImage}
                        alt="QRIS Preview"
                        className="w-36 h-36 object-contain rounded-xl border border-border bg-white p-2 shadow-sm"
                      />
                    </div>
                    <div className="flex-1 space-y-2 pt-1">
                      {qrisDecoding && (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Spinner className="w-4 h-4" />
                          Membaca QR code dari gambar...
                        </p>
                      )}
                      {!qrisDecoding && qrisDecodeStatus === 'valid' && (
                        <span className="flex items-center gap-1.5 text-sm text-success font-medium">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          QRIS valid — siap digunakan
                        </span>
                      )}
                      {!qrisDecoding && qrisDecodeStatus === 'invalid' && (
                        <div className="flex items-start gap-1.5 text-sm text-destructive">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{qrisDecodeError || 'QRIS tidak valid'}</span>
                        </div>
                      )}
                      {!qrisDecoding && qrisDecodeStatus === 'idle' && (
                        <p className="text-xs text-muted-foreground">
                          Upload gambar QRIS untuk membaca informasi merchant secara otomatis.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Auto-filled merchant info — shown only when decoded successfully */}
                {qrisDecodeStatus === 'valid' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nama Merchant</Label>
                      <Input
                        value={settings.qrisMerchantName || ''}
                        readOnly
                        tabIndex={-1}
                        className="bg-muted/50 cursor-default select-all"
                        title="Diisi otomatis dari tag 59 QRIS"
                      />
                      <p className="text-[11px] text-muted-foreground">Diisi otomatis dari data QRIS (tag 59)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Kota</Label>
                      <Input
                        value={settings.qrisMerchantCity || ''}
                        readOnly
                        tabIndex={-1}
                        className="bg-muted/50 cursor-default select-all"
                        title="Diisi otomatis dari tag 60 QRIS"
                      />
                      <p className="text-[11px] text-muted-foreground">Diisi otomatis dari data QRIS (tag 60)</p>
                    </div>
                  </div>
                )}

                {/* Mode selection — Statis vs Dinamis */}
                {qrisDecodeStatus === 'valid' && (
                  <div className="space-y-2">
                    <Label>Mode QRIS</Label>
                    <div className="space-y-2 mt-1">
                      {(
                        [
                          {
                            value: 'static',
                            label: 'Statis — tampilkan gambar QRIS asli',
                            desc: 'Gambar QRIS yang diupload ditampilkan apa adanya. Pelanggan scan dan input nominal secara manual.',
                          },
                          {
                            value: 'dynamic',
                            label: 'Dinamis — generate QR dengan nominal otomatis',
                            desc: 'QR code baru dibuat setiap transaksi dengan nominal sudah terisi. Pelanggan tidak perlu input jumlah.',
                          },
                        ] as const
                      ).map((opt) => {
                        const active = (settings.qrisMode || 'static') === opt.value;
                        return (
                          <label
                            key={opt.value}
                            className={cn(
                              'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                              active ? 'border-brand bg-brand/8' : 'border-border hover:bg-accent/40'
                            )}
                          >
                            <input
                              type="radio"
                              name="qrisMode"
                              value={opt.value}
                              checked={active}
                              onChange={() => setSettings({ ...settings, qrisMode: opt.value })}
                              className="accent-brand w-4 h-4 mt-0.5 shrink-0"
                            />
                            <div>
                              <div className="text-sm font-medium text-foreground">{opt.label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Decoded QRIS string preview (collapsed, for reference) */}
                {qrisDecodeStatus === 'valid' && settings.qrisStatic && (
                  <details className="group">
                    <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground/70">
                      Lihat string QRIS (untuk debugging)
                    </summary>
                    <p className="mt-2 text-[11px] font-mono bg-muted rounded-md px-3 py-2 break-all text-muted-foreground leading-relaxed">
                      {settings.qrisStatic}
                    </p>
                  </details>
                )}
              </SettingsSection>
            </TabsContent>

            <TabsContent value="system" className="mt-5 space-y-5">
              <SettingsSection icon={Keyboard} title="Tampilan POS">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>Keyboard Virtual</Label>
                    <p className="text-xs text-muted-foreground">
                      Tampilkan keyboard virtual di layar POS untuk input (berguna untuk layar sentuh).
                    </p>
                  </div>
                  <Switch
                    aria-label="Keyboard Virtual (POS)"
                    checked={!!settings.virtualKeyboard}
                    onCheckedChange={(checked: boolean) => setSettings({ ...settings, virtualKeyboard: checked ? 1 : 0 })}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                icon={Sparkles}
                title="Loyalitas Pelanggan"
                description="Contoh: jika diisi 1000, maka setiap transaksi Rp 10.000 akan mendapatkan 10 poin."
              >
                <div className="space-y-2 max-w-xs">
                  <Label>Nilai 1 Poin (kelipatan transaksi Rp)</Label>
                  <Input type="number" value={settings.pointMultiplier} onChange={(e) => setSettings({ ...settings, pointMultiplier: Number(e.target.value) })} />
                </div>
              </SettingsSection>

              <SettingsSection
                icon={settings.cartSound === 'none' ? VolumeX : Volume2}
                title="Efek Suara Tambah ke Keranjang"
                description="Pilih suara yang dimainkan setiap kali kasir menambahkan produk ke keranjang. Klik Test untuk mendengarkan."
              >
                <div className="grid grid-cols-1 gap-2">
                  {SOUND_STYLES.map((s) => {
                    const active = (settings.cartSound || 'scanner') === s.id;
                    return (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer transition-colors text-foreground",
                          active ? 'border-brand bg-brand/10' : 'border-border hover:bg-accent/50'
                        )}
                        onClick={() => { setSettings({ ...settings, cartSound: s.id }); setActiveSound(s.id); }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="radio"
                            name="cartSound"
                            checked={active}
                            onChange={() => { setSettings({ ...settings, cartSound: s.id }); setActiveSound(s.id); }}
                            className="accent-brand w-4 h-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{s.label}</div>
                            <div className="text-xs text-muted-foreground">{s.description}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={s.id === 'none'}
                          onClick={(e) => { e.stopPropagation(); playAddToCart(s.id as SoundStyle); }}
                          className="shrink-0"
                        >
                          <Play className="w-3.5 h-3.5 mr-1" /> Test
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </SettingsSection>

              <SettingsSection
                icon={Printer}
                title="Printer Thermal"
                description="Pilih bagaimana struk dicetak. Network cocok untuk printer LAN/WiFi (ESC/POS); Tauri untuk printer USB/Bluetooth tersistem."
              >
                {/* Issue #14: replaced native <select> with shadcn <Select> for consistency */}
                <div className="space-y-2">
                  <Label>Mode Cetak</Label>
                  <Select value={settings.printerType || 'browser'} onValueChange={(v) => setSettings({ ...settings, printerType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="browser">Dialog Print Browser (manual pilih printer)</SelectItem>
                      <SelectItem value="network">Network / LAN Thermal Printer (ESC/POS)</SelectItem>
                      <SelectItem value="tauri">Tauri Plugin (USB / Bluetooth tersistem)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {settings.printerType === 'network' && (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2 space-y-2">
                        <Label>IP Printer</Label>
                        <Input
                          placeholder="192.168.1.100"
                          value={settings.printerIp || ''}
                          onChange={(e) => setSettings({ ...settings, printerIp: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Port</Label>
                        <Input
                          type="number"
                          placeholder="9100"
                          value={settings.printerPort || 9100}
                          onChange={(e) => setSettings({ ...settings, printerPort: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Character Set</Label>
                        <Select value={settings.printerCharset || 'CP437'} onValueChange={(v) => setSettings({ ...settings, printerCharset: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CP437">CP437 (default)</SelectItem>
                            <SelectItem value="CP850">CP850 (Latin)</SelectItem>
                            <SelectItem value="CP858">CP858 (Euro)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={!!settings.printerOpenDrawer}
                            onChange={(e) => setSettings({ ...settings, printerOpenDrawer: e.target.checked ? 1 : 0 })}
                            className="accent-brand w-4 h-4"
                          />
                          Buka Cash Drawer setelah cetak
                        </label>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestPrint}
                      disabled={testingPrint}
                      className="w-full"
                    >
                      {testingPrint ? <Spinner className="w-4 h-4 mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                      {testingPrint ? 'Mengirim...' : 'Test Print'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Tip: Pastikan komputer & printer berada di jaringan yang sama, dan port 9100 (RAW) tidak diblokir firewall.
                    </p>
                  </>
                )}

                {settings.printerType === 'tauri' && (
                  <>
                    <div className="rounded-md bg-info/12 border border-info/30 p-3 text-xs text-info space-y-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <Bluetooth className="w-3.5 h-3.5" /> Cara pakai Bluetooth Printer di Windows:
                      </div>
                      <ol className="list-decimal ml-5 space-y-0.5">
                        <li>Buka <b>Settings → Bluetooth & devices</b> di Windows</li>
                        <li>Nyalakan printer thermal Bluetooth Anda, lalu klik <b>Add device → Bluetooth</b></li>
                        <li>Pair printer (PIN umum: <code>0000</code> atau <code>1234</code>)</li>
                        <li>Setelah ter-pair, klik <b>Scan Printer</b> di bawah ini — printer akan muncul</li>
                      </ol>
                      <div className="pt-1">Di Android, MAC printer akan dikenali otomatis selama sudah ter-pair.</div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleScanPrinters}
                        disabled={scanningPrinters}
                        className="flex-1"
                      >
                        {scanningPrinters ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        {scanningPrinters ? 'Scanning...' : 'Scan Printer'}
                      </Button>
                    </div>

                    {discoveredPrinters.length > 0 && (
                      <div className="space-y-2">
                        <Label>Printer Terdeteksi</Label>
                        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                          {discoveredPrinters.map((p) => {
                            const selected = settings.tauriPrinterName === p.name;
                            return (
                              <button
                                type="button"
                                key={p.identifier + p.name}
                                onClick={() => setSettings({
                                  ...settings,
                                  tauriPrinterName: p.name,
                                  tauriPrinterInterface: p.interface_type,
                                })}
                                className={cn("w-full text-left p-2 text-sm hover:bg-accent/50", selected && 'bg-brand/10')}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="font-medium text-foreground">{p.name}</div>
                                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{p.interface_type}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">{p.identifier} · {p.status}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Printer Aktif (nama / MAC address)</Label>
                      <Input
                        value={settings.tauriPrinterName || ''}
                        onChange={(e) => setSettings({ ...settings, tauriPrinterName: e.target.value })}
                        placeholder="Mis. POS-80, atau AA:BB:CC:DD:EE:FF (Android)"
                      />
                      <p className="text-xs text-muted-foreground">
                        Anda juga bisa mengetik manual jika printer tidak muncul saat scan
                        (mis. MAC address Bluetooth di Android).
                      </p>
                      {isVirtualPrinter(settings.tauriPrinterName) && (
                        <div className="rounded-md bg-warning/15 border border-warning/30 p-2 text-xs text-warning">
                          ⚠️ <b>Printer virtual terdeteksi</b> (mis. Microsoft Print to PDF, XPS).
                          Printer ini tidak bisa membaca byte mentah ESC/POS — output PDF akan rusak.
                          Aplikasi otomatis akan menggunakan mode <b>HTML print</b> agar hasilnya tetap terbaca.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Lebar Kertas</Label>
                        <Select
                          value={(settings.paperWidth || '').includes('58') ? '58mm' : '80mm'}
                          onValueChange={(v) => setSettings({ ...settings, paperWidth: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="80mm">80mm</SelectItem>
                            <SelectItem value="58mm">58mm</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={!!settings.printerOpenDrawer}
                            onChange={(e) => setSettings({ ...settings, printerOpenDrawer: e.target.checked ? 1 : 0 })}
                            className="accent-brand w-4 h-4"
                          />
                          Buka Cash Drawer
                        </label>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestTauriPrint}
                      disabled={testingPrint || !settings.tauriPrinterName}
                      className="w-full"
                    >
                      {testingPrint ? <Spinner className="w-4 h-4 mr-2" /> : <Printer className="w-4 h-4 mr-2" />}
                      {testingPrint ? 'Mengirim...' : 'Test Print'}
                    </Button>
                  </>
                )}

                {settings.printerType === 'browser' && (
                  <div className="space-y-2">
                    <Label>Nama Printer Default (opsional)</Label>
                    <Input
                      value={settings.printerName || ''}
                      onChange={(e) => setSettings({ ...settings, printerName: e.target.value })}
                      placeholder="POS-80"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mode browser akan menampilkan dialog print bawaan setiap transaksi.
                    </p>
                  </div>
                )}
              </SettingsSection>
            </TabsContent>

            {/* ═══════ LOYALITAS TAB ═══════ */}
            <TabsContent value="loyalty" className="mt-5 space-y-5">
              <SettingsSection
                icon={Sparkles}
                title="Program Loyalitas Pelanggan"
                description="Pelanggan terdaftar mendapatkan poin dari setiap transaksi dan dapat menukarkan poin untuk diskon."
                action={
                  <Switch
                    aria-label="Aktifkan Program Loyalitas"
                    checked={!!settings.loyaltyEnabled}
                    onCheckedChange={(checked: boolean) => setSettings({ ...settings, loyaltyEnabled: checked ? 1 : 0 })}
                  />
                }
              >
                <div className={`space-y-4 ${!settings.loyaltyEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="space-y-2">
                    <Label>Perolehan Poin: 1 poin per berapa Rupiah belanja?</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">1 poin per Rp</span>
                      <Input
                        type="number"
                        min={100}
                        step={100}
                        value={settings.pointMultiplier ?? 1000}
                        onChange={(e) => setSettings({ ...settings, pointMultiplier: Number(e.target.value) })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">belanja</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Contoh: nilai 1000 → pelanggan yang belanja Rp 25.000 mendapat 25 poin.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Nilai Tukar Poin (Rp per poin)</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">1 poin =</span>
                      <Input
                        type="number"
                        min={1}
                        step={50}
                        value={settings.redeemRate ?? 100}
                        onChange={(e) => setSettings({ ...settings, redeemRate: Number(e.target.value) })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">Rupiah diskon</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Contoh: nilai 100 → 50 poin dapat ditukar menjadi diskon Rp 5.000.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum Poin untuk Redeem</Label>
                    <Input
                      type="number"
                      min={1}
                      step={10}
                      value={settings.minRedeemPoints ?? 100}
                      onChange={(e) => setSettings({ ...settings, minRedeemPoints: Number(e.target.value) })}
                      className="w-40"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pelanggan harus memiliki minimal poin ini untuk menggunakan redeem.
                    </p>
                  </div>
                </div>
              </SettingsSection>
            </TabsContent>

            {/* ═══════ EMAIL / NOTIFIKASI TAB ═══════ */}
            <TabsContent value="email" className="mt-5 space-y-5">
              <SettingsSection
                icon={Tags}
                title="Notifikasi Email Stok Menipis"
                description="Kirim email otomatis ke alamat yang ditentukan ketika stok produk turun di bawah ambang batas."
                action={
                  <Switch
                    aria-label="Aktifkan Notifikasi Stok"
                    checked={!!settings.emailAlertEnabled}
                    onCheckedChange={(checked: boolean) => setSettings({ ...settings, emailAlertEnabled: checked ? 1 : 0 })}
                  />
                }
              >
                <div className={`space-y-4 ${!settings.emailAlertEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input
                        placeholder="smtp.gmail.com"
                        value={settings.smtpHost || ''}
                        onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input
                        type="number"
                        placeholder="587"
                        value={settings.smtpPort ?? 587}
                        onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label>Gunakan STARTTLS / TLS</Label>
                      <p className="text-xs text-muted-foreground">Aktifkan untuk koneksi terenkripsi (direkomendasikan).</p>
                    </div>
                    <Switch
                      aria-label="Gunakan TLS"
                      checked={!!(settings.smtpUseTls ?? 1)}
                      onCheckedChange={(checked: boolean) => setSettings({ ...settings, smtpUseTls: checked ? 1 : 0 })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Pengirim (From)</Label>
                    <Input
                      type="email"
                      placeholder="toko@gmail.com"
                      value={settings.smtpFrom || ''}
                      onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Username SMTP</Label>
                      <Input
                        placeholder="toko@gmail.com"
                        value={settings.smtpUsername || ''}
                        onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password SMTP / App Password</Label>
                      <Input
                        type="password"
                        placeholder="••••••••••••"
                        value={settings.smtpPassword || ''}
                        onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Untuk Gmail, gunakan <b>App Password</b> (bukan password akun biasa).
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email Penerima Notifikasi</Label>
                    <Input
                      type="email"
                      placeholder="admin@toko.com"
                      value={settings.emailRecipient || ''}
                      onChange={(e) => setSettings({ ...settings, emailRecipient: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Ambang Batas Stok Minimum</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={settings.lowStockThreshold ?? 5}
                        onChange={(e) => setSettings({ ...settings, lowStockThreshold: Number(e.target.value) })}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">unit</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Email dikirim setelah transaksi jika stok produk ≤ nilai ini.
                    </p>
                  </div>

                  <div className="rounded-md bg-muted/50 border border-border p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground/80">⚠️ Catatan Keamanan</p>
                    <p>Password SMTP disimpan sebagai teks biasa di database lokal. Gunakan <b>App Password</b> Gmail (bukan password utama) untuk keamanan lebih baik.</p>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!settings.smtpHost || !settings.emailRecipient) {
                          toast.error('Isi SMTP Host dan Email Penerima terlebih dahulu');
                          return;
                        }
                        try {
                          const storeName = getShopName(settings);
                          await invoke('send_email', {
                            smtpHost: settings.smtpHost,
                            smtpPort: settings.smtpPort ?? 587,
                            useTls: !!(settings.smtpUseTls ?? 1),
                            username: settings.smtpUsername || '',
                            password: settings.smtpPassword || '',
                            from: settings.smtpFrom || settings.emailRecipient,
                            to: settings.emailRecipient,
                            subject: `[${storeName}] Test Email dari PKasir`,
                            body: `Halo!\n\nIni adalah email percobaan dari aplikasi PKasir.\n\nJika Anda menerima email ini, konfigurasi SMTP Anda sudah benar.\n\nToko: ${storeName}\nWaktu: ${new Date().toLocaleString('id-ID')}`,
                          });
                          toast.success('Email uji berhasil dikirim! Periksa kotak masuk Anda.');
                        } catch (e: any) {
                          toast.error('Gagal kirim email: ' + (e?.message || e));
                        }
                      }}
                    >
                      <Tags className="w-4 h-4 mr-2" />
                      Test Kirim Email
                    </Button>
                  </div>
                </div>
              </SettingsSection>
            </TabsContent>

            <TabsContent value="backup" className="mt-5 space-y-5">
              {backupInfo && (
                <SettingsSection icon={Database} title="Status Database">
                  <div className="text-xs space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Lokasi Database</span>
                      <span className="font-mono text-foreground/80 truncate ml-2" title={backupInfo.dbPath}>{backupInfo.dbPath}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ukuran</span>
                      <span className="font-medium text-foreground/80">{(backupInfo.dbSize / 1024).toFixed(1)} KB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Backup Terakhir</span>
                      <span className="font-medium text-foreground/80">
                        {settings.lastBackupAt ? new Date(settings.lastBackupAt).toLocaleString('id-ID') : 'Belum pernah'}
                      </span>
                    </div>
                  </div>
                </SettingsSection>
              )}

              <SettingsSection
                icon={Download}
                title="Backup Manual"
                description="Simpan snapshot lengkap database ke file pilihan Anda."
              >
                <div className="space-y-2">
                  <Label className="text-xs">Path File Default (opsional)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Mis. C:\Users\Nama\Documents\pkasir-backup.db"
                      value={settings.backupPath || ''}
                      onChange={(e) => setSettings({ ...settings, backupPath: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      title="Pilih lokasi file..."
                      aria-label="Pilih lokasi file backup"
                      onClick={async () => {
                        const p = await invoke<string | null>('pick_backup_save_path', { defaultName: undefined });
                        if (p) setSettings({ ...settings, backupPath: p });
                      }}
                    >
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full bg-success text-success-foreground hover:bg-success/90"
                  disabled={backupRunning}
                  onClick={async () => {
                    setBackupRunning(true);
                    try {
                      let path = settings.backupPath;
                      if (!path) {
                        path = await invoke<string | null>('pick_backup_save_path', { defaultName: undefined });
                        if (!path) { setBackupRunning(false); return; }
                      }
                      await invoke('backup_database', { targetPath: path });
                      logActivity('Backup Database', path);
                      toast.success('Backup berhasil disimpan');
                      fetchBackupInfo();
                      // Refresh lastBackupAt
                      invoke('get_settings').then((d: any) => setSettings((prev: any) => ({ ...prev, lastBackupAt: d.lastBackupAt })));
                    } catch (e: any) {
                      toast.error('Backup gagal: ' + (e.message || e));
                    } finally {
                      setBackupRunning(false);
                    }
                  }}
                >
                  {backupRunning ? <Spinner className="w-4 h-4 mr-2 text-current" /> : <Download className="w-4 h-4 mr-2" />}
                  {backupRunning ? 'Menyimpan...' : 'Backup Sekarang'}
                </Button>
              </SettingsSection>

              <SettingsSection
                icon={RefreshCw}
                title="Auto Backup"
                description="File backup disimpan sebagai pkasir-auto-backup.db di folder yang dipilih. Setiap auto-backup menimpa file sebelumnya."
                action={
                  <Switch
                    aria-label="Auto Backup"
                    checked={!!settings.autoBackupEnabled}
                    onCheckedChange={(checked: boolean) => setSettings({ ...settings, autoBackupEnabled: checked ? 1 : 0 })}
                  />
                }
              >
                <div className="space-y-2">
                  <Label className="text-xs">Folder Auto Backup</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Mis. C:\Users\Nama\Documents\PKasir-Backups"
                      value={settings.autoBackupPath || ''}
                      onChange={(e) => setSettings({ ...settings, autoBackupPath: e.target.value })}
                      disabled={!settings.autoBackupEnabled}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={!settings.autoBackupEnabled}
                      title="Pilih folder..."
                      aria-label="Pilih folder auto backup"
                      onClick={async () => {
                        const p = await invoke<string | null>('pick_directory');
                        if (p) setSettings({ ...settings, autoBackupPath: p });
                      }}
                    >
                      <FolderOpen className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Interval Backup (detik)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0 = hanya saat aplikasi dibuka (harian)"
                    value={settings.autoBackupIntervalSeconds ?? 0}
                    onChange={(e) => setSettings({ ...settings, autoBackupIntervalSeconds: Math.max(0, Number(e.target.value) || 0) })}
                    disabled={!settings.autoBackupEnabled}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    <b>0</b> = backup hanya saat aplikasi dibuka, jika sudah &gt; 20 jam sejak backup terakhir.<br />
                    <b>&gt; 0</b> = backup berkala selama aplikasi terbuka (mis. <code>300</code> = setiap 5 menit, <code>3600</code> = setiap 1 jam).
                  </p>
                </div>
              </SettingsSection>

              <SettingsSection
                icon={HardDriveUpload}
                title="Restore dari Backup"
                description="Mengganti seluruh data saat ini dengan data dari file backup."
                className="ring-destructive/30 bg-destructive/5 [&_h3]:text-destructive [&_svg]:text-destructive"
              >
                <div className="rounded-md bg-destructive/12 border border-destructive/30 p-2 text-xs text-destructive">
                  ⚠️ <b>Peringatan:</b> Restore akan <b>mengganti seluruh data</b> saat ini (produk, transaksi, pelanggan, pengaturan, dll.) dengan data dari file backup. Data yang ada akan <b>hilang</b>. Pastikan Anda sudah backup terlebih dahulu.
                </div>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={restoreRunning}
                  onClick={async () => {
                    try {
                      const source = await invoke<string | null>('pick_backup_open_path');
                      if (!source) return;
                      if (!confirm(`Yakin ingin MENGGANTI seluruh data dengan backup dari:\n${source}\n\nTindakan ini tidak dapat dibatalkan!`)) return;
                      setRestoreRunning(true);
                      await invoke('restore_database', { sourcePath: source });
                      logActivity('Restore Database', source);
                      toast.success('Restore berhasil. Aplikasi akan dimuat ulang...');
                      setTimeout(() => window.location.reload(), 1500);
                    } catch (e: any) {
                      toast.error('Restore gagal: ' + (e.message || e));
                    } finally {
                      setRestoreRunning(false);
                    }
                  }}
                >
                  {restoreRunning ? <Spinner className="w-4 h-4 mr-2 text-current" /> : <HardDriveUpload className="w-4 h-4 mr-2" />}
                  {restoreRunning ? 'Memulihkan...' : 'Pilih File & Restore'}
                </Button>
              </SettingsSection>
            </TabsContent>

            <TabsContent value="activity" className="mt-5 space-y-5">
              <SettingsSection
                icon={ScrollText}
                title="Log Aktivitas"
                description="Menampilkan maksimal 500 log terbaru."
                action={
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchLogs}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (!confirm('Hapus semua log aktivitas? Tindakan ini tidak bisa dibatalkan.')) return;
                        try {
                          await invoke('clear_activity_logs');
                          logActivity('Hapus Semua Log');
                          setActivityLogs([]);
                          toast.success('Log aktivitas dibersihkan');
                        } catch { toast.error('Gagal menghapus log'); }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />Hapus Semua
                    </Button>
                  </div>
                }
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                  <Input
                    placeholder="Cari berdasarkan aksi, user, atau target..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="border border-border rounded-lg max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="border-b border-border">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Waktu</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">User</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Aksi</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Target</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activityLogs
                        .filter((log) => {
                          if (!logSearch) return true;
                          const q = logSearch.toLowerCase();
                          return (
                            (log.action || '').toLowerCase().includes(q) ||
                            (log.user || '').toLowerCase().includes(q) ||
                            (log.target || '').toLowerCase().includes(q) ||
                            (log.detail || '').toLowerCase().includes(q)
                          );
                        })
                        .map((log) => (
                          <tr key={log.id} className="hover:bg-accent/50">
                            <td className="px-3 py-2 text-muted-foreground whitespace-nowrap text-xs">
                              {(() => {
                                try {
                                  const d = new Date(log.date);
                                  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                } catch { return log.date; }
                              })()}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-foreground/80">{log.user || '-'}</span>
                                {log.role && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                    log.role === 'admin' ? 'bg-destructive/12 text-destructive' :
                                    log.role === 'manager' ? 'bg-info/12 text-info' :
                                    'bg-success/12 text-success'
                                  }`}>
                                    {log.role}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 font-medium text-foreground/90">{log.action}</td>
                            <td className="px-3 py-2 text-muted-foreground">{log.target || '-'}</td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">{log.detail || '-'}</td>
                          </tr>
                        ))}
                      {activityLogs.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-0">
                            <EmptyState compact icon={ScrollText} title="Belum ada aktivitas tercatat" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SettingsSection>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Sticky save bar — Save is always reachable without scrolling to the bottom */}
      <div className="shrink-0 border-t border-border bg-background/85 backdrop-blur supports-backdrop-filter:bg-background/70">
        <div className="max-w-4xl flex items-center gap-3 px-6 md:px-8 py-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            Perubahan baru aktif setelah disimpan.
          </p>
          <Button onClick={handleSave} className="ml-auto bg-brand px-8 text-brand-foreground hover:bg-brand/90">
            Simpan Pengaturan
          </Button>
        </div>
      </div>
    </div>
  );
}
