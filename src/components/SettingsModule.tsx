import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Upload, X, Printer, RefreshCw, Bluetooth, Volume2, VolumeX, Play, ScrollText, Trash2, Search, Keyboard, Database, Download, FolderOpen, HardDriveUpload, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';
import { listThermalPrinters, testThermal, isVirtualPrinter, htmlPrintReceipt, type PrinterInfo } from '../services/printer';
import { SOUND_STYLES, playAddToCart, setActiveSound, type SoundStyle } from '../services/sound';
import { isTauri } from '../services/utils';
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
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(tag => (
          <div key={tag} className="flex items-center gap-1 bg-muted px-3 py-1 rounded-full text-sm border border-border text-foreground">
            <span>{tag}</span>
            <button type="button" onClick={() => handleRemove(tag)} className="text-muted-foreground hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
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

export function SettingsModule() {
  const [settings, setSettings] = useState<any>({
    taxRate: 0, serviceCharge: 0, printerName: '', paperWidth: '', receiptHeader: '', receiptFooter: '', logo: '',
    productCategories: [], flowCategories: [], productUnits: [], pointMultiplier: 1000,
    printerType: 'browser', printerIp: '', printerPort: 9100, printerCharset: 'CP437', printerOpenDrawer: 0,
    tauriPrinterName: '', tauriPrinterInterface: 'USB', tables: [], cartSound: 'scanner', virtualKeyboard: 0,
    backupPath: '', autoBackupEnabled: 0, autoBackupPath: '', lastBackupAt: '', autoBackupIntervalSeconds: 0
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
            header: (settings.receiptHeader || 'CAFE POS').replace(/\\n/g, '\n'),
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
        setSettings((prev: any) => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings((prev: any) => ({ ...prev, qrisImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <h2 className="text-3xl font-bold text-foreground">Pengaturan</h2>

      <Tabs defaultValue="general" className="w-full max-w-4xl">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">Umum & Kategori</TabsTrigger>
          <TabsTrigger value="receipt">Pengaturan Struk</TabsTrigger>
          <TabsTrigger value="system">Sistem</TabsTrigger>
          <TabsTrigger value="backup" onClick={fetchBackupInfo}>
            <Database className="w-3.5 h-3.5 mr-1.5" />Backup
          </TabsTrigger>
          <TabsTrigger value="activity" onClick={fetchLogs}>
            <ScrollText className="w-3.5 h-3.5 mr-1.5" />Log Aktivitas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Umum & Kategori</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Logo Toko</Label>
                <div className="flex gap-2 items-center">
                  <Input value={settings.logo || ''} onChange={e => setSettings({...settings, logo: e.target.value})} placeholder="URL Logo atau Upload..." className="flex-1" />
                  <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleLogoUpload} />
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>
                {settings.logo && (
                  <div className="mt-2">
                    <img 
                      src={settings.logo} 
                      alt="Logo Preview" 
                      style={{ width: settings.logoWidth || 120, height: settings.logoHeight || 32 }}
                      className="object-contain rounded border border-border bg-muted/40"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label>Lebar Logo (px)</Label>
                    <Input type="number" value={settings.logoWidth || 120} onChange={(e) => setSettings({ ...settings, logoWidth: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tinggi Logo (px)</Label>
                    <Input type="number" value={settings.logoHeight || 32} onChange={(e) => setSettings({ ...settings, logoHeight: Number(e.target.value) })} />
                  </div>
                </div>
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
              <div className="space-y-2">
                <Label>Kategori Produk</Label>
                <TagInput 
                  tags={settings.productCategories || []} 
                  onChange={(tags) => setSettings({ ...settings, productCategories: tags })} 
                  placeholder="Ketik kategori lalu tekan Enter atau Koma..."
                />
              </div>
              <div className="space-y-2">
                <Label>Kategori Arus Kas</Label>
                <TagInput 
                  tags={settings.flowCategories || []} 
                  onChange={(tags) => setSettings({ ...settings, flowCategories: tags })} 
                  placeholder="Ketik kategori lalu tekan Enter atau Koma..."
                />
              </div>
              <div className="space-y-2">
                <Label>Satuan Produk</Label>
                <TagInput
                  tags={settings.productUnits || []}
                  onChange={(tags) => setSettings({ ...settings, productUnits: tags })}
                  placeholder="Ketik satuan lalu tekan Enter atau Koma..."
                />
              </div>
              <div className="space-y-2">
                <Label>Daftar Meja</Label>
                <TagInput
                  tags={settings.tables || []}
                  onChange={(tags) => setSettings({ ...settings, tables: tags })}
                  placeholder="Mis. Meja 1, Meja 2, VIP A, Take Away..."
                />
                <p className="text-xs text-muted-foreground">
                  Daftar meja akan muncul sebagai pilihan di POS saat membuat pesanan.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Cetak Struk</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Lebar Kertas (Contoh: 58mm atau 80mm)</Label>
                <Input value={settings.paperWidth} onChange={(e) => setSettings({ ...settings, paperWidth: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Header Struk (Nama Toko, Alamat)</Label>
                <Textarea rows={4} value={settings.receiptHeader} onChange={(e) => setSettings({ ...settings, receiptHeader: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Footer Struk (Pesan Terima Kasih)</Label>
                <Textarea rows={3} value={settings.receiptFooter} onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })} />
              </div>

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <h4 className="font-semibold">Gambar QRIS Statis</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Upload gambar QRIS statis toko Anda. Gambar akan otomatis tampil di layar Customer Display
                  saat kasir membuka dialog pembayaran QRIS, sehingga pelanggan dapat langsung scan untuk membayar.
                </p>
                <div className="flex gap-2 items-center">
                  <Input
                    value={settings.qrisImage || ''}
                    onChange={e => setSettings({ ...settings, qrisImage: e.target.value })}
                    placeholder="URL Gambar QRIS atau Upload..."
                    className="flex-1"
                  />
                  <input type="file" accept="image/*" className="hidden" ref={qrisInputRef} onChange={handleQrisUpload} />
                  <Button variant="outline" onClick={() => qrisInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                  {settings.qrisImage && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSettings({ ...settings, qrisImage: '' })}
                      title="Hapus gambar QRIS"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
                {settings.qrisImage && (
                  <div className="mt-2 flex items-start gap-3">
                    <img
                      src={settings.qrisImage}
                      alt="QRIS Preview"
                      className="w-40 h-40 object-contain rounded-lg border bg-white p-2"
                    />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>✓ Gambar QRIS siap digunakan.</p>
                      <p>Pastikan gambar jelas dan tidak buram agar mudah dipindai pelanggan.</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Sistem & Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-4 h-4" />
                    <Label>Keyboard Virtual (POS)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tampilkan keyboard virtual di layar POS untuk input (berguna untuk layar sentuh).
                  </p>
                </div>
                <Switch
                  checked={!!settings.virtualKeyboard}
                  onCheckedChange={(checked: boolean) => setSettings({ ...settings, virtualKeyboard: checked ? 1 : 0 })}
                />
              </div>
              <div className="border-t" />

              <div className="space-y-2">
                <Label>Nilai 1 Poin Pelanggan (Berdasarkan kelipatan transaksi Rp)</Label>
                <Input type="number" value={settings.pointMultiplier} onChange={(e) => setSettings({ ...settings, pointMultiplier: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">Contoh: Jika diisi 1000, maka setiap transaksi Rp 10.000 akan mendapatkan 10 poin.</p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  {settings.cartSound === 'none'
                    ? <VolumeX className="w-4 h-4" />
                    : <Volume2 className="w-4 h-4" />}
                  Efek Suara Tambah ke Keranjang
                </h4>
                <p className="text-xs text-muted-foreground">
                  Pilih suara yang dimainkan setiap kali kasir menambahkan produk ke keranjang.
                  Klik tombol <b>Test</b> untuk mendengarkan.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {SOUND_STYLES.map((s) => {
                    const active = (settings.cartSound || 'scanner') === s.id;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                          active ? 'border-orange-500 bg-orange-500/10 text-foreground' : 'border-border hover:bg-accent/50 text-foreground'
                        }`}
                        onClick={() => { setSettings({ ...settings, cartSound: s.id }); setActiveSound(s.id); }}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="radio"
                            name="cartSound"
                            checked={active}
                            onChange={() => { setSettings({ ...settings, cartSound: s.id }); setActiveSound(s.id); }}
                            className="accent-orange-500 w-4 h-4"
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
              </div>
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2"><Printer className="w-4 h-4" /> Printer Thermal</h4>

                <div className="space-y-2">
                  <Label>Mode Cetak</Label>
                  <select
                    className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
                    value={settings.printerType || 'browser'}
                    onChange={(e) => setSettings({ ...settings, printerType: e.target.value })}
                  >
                    <option value="browser">Dialog Print Browser (manual pilih printer)</option>
                    <option value="network">Network / LAN Thermal Printer (ESC/POS)</option>
                    <option value="tauri">Tauri Plugin (USB / Bluetooth tersistem)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Pilih <b>Network</b> jika printer thermal Anda terhubung via kabel LAN / WiFi
                    (mis. Epson TM-T82, Xprinter XP-N160, dsb). Cek IP printer di menu self-test printer.
                  </p>
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
                        <select
                          className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
                          value={settings.printerCharset || 'CP437'}
                          onChange={(e) => setSettings({ ...settings, printerCharset: e.target.value })}
                        >
                          <option value="CP437">CP437 (default)</option>
                          <option value="CP850">CP850 (Latin)</option>
                          <option value="CP858">CP858 (Euro)</option>
                        </select>
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={!!settings.printerOpenDrawer}
                            onChange={(e) => setSettings({ ...settings, printerOpenDrawer: e.target.checked ? 1 : 0 })}
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
                      <Printer className="w-4 h-4 mr-2" />
                      {testingPrint ? 'Mengirim...' : 'Test Print'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Tip: Pastikan komputer & printer berada di jaringan yang sama, dan port 9100 (RAW) tidak diblokir firewall.
                    </p>
                  </>
                )}

                {settings.printerType === 'tauri' && (
                  <>
                    <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
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
                        <RefreshCw className={`w-4 h-4 mr-2 ${scanningPrinters ? 'animate-spin' : ''}`} />
                        {scanningPrinters ? 'Scanning...' : 'Scan Printer'}
                      </Button>
                    </div>

                    {discoveredPrinters.length > 0 && (
                      <div className="space-y-2">
                        <Label>Printer Terdeteksi</Label>
                        <div className="border rounded divide-y max-h-48 overflow-y-auto">
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
                                className={`w-full text-left p-2 text-sm hover:bg-accent/50 ${selected ? 'bg-orange-500/10' : ''}`}
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
                        <div className="rounded-md bg-amber-50 border border-amber-300 p-2 text-xs text-amber-900">
                          ⚠️ <b>Printer virtual terdeteksi</b> (mis. Microsoft Print to PDF, XPS).
                          Printer ini tidak bisa membaca byte mentah ESC/POS — output PDF akan rusak.
                          Aplikasi otomatis akan menggunakan mode <b>HTML print</b> agar hasilnya tetap terbaca.
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Lebar Kertas</Label>
                        <select
                          className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
                          value={(settings.paperWidth || '').includes('58') ? '58mm' : '80mm'}
                          onChange={(e) => setSettings({ ...settings, paperWidth: e.target.value })}
                        >
                          <option value="80mm">80mm</option>
                          <option value="58mm">58mm</option>
                        </select>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
                          <input
                            type="checkbox"
                            checked={!!settings.printerOpenDrawer}
                            onChange={(e) => setSettings({ ...settings, printerOpenDrawer: e.target.checked ? 1 : 0 })}
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
                      <Printer className="w-4 h-4 mr-2" />
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" /> Backup & Restore
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {backupInfo && (
                <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs space-y-1">
                  <div className="flex justify-between">
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
              )}

              {/* ─── Manual Backup ─── */}
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <h4 className="font-semibold">Backup Manual</h4>
                </div>
                <p className="text-xs text-muted-foreground">Simpan snapshot lengkap database ke file pilihan Anda.</p>

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
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
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
                  <Download className="w-4 h-4 mr-2" />
                  {backupRunning ? 'Menyimpan...' : 'Backup Sekarang'}
                </Button>
              </div>

              {/* ─── Auto Backup ─── */}
              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <h4 className="font-semibold">Auto Backup</h4>
                  </div>
                  <Switch
                    checked={!!settings.autoBackupEnabled}
                    onCheckedChange={(checked: boolean) => setSettings({ ...settings, autoBackupEnabled: checked ? 1 : 0 })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  File backup disimpan sebagai <code>pkasir-auto-backup.db</code> di folder yang dipilih.
                  Setiap auto-backup <b>menimpa</b> file sebelumnya, sehingga tidak menghasilkan banyak file.
                </p>
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
                    File auto-backup selalu ditimpa (hanya 1 file disimpan).
                  </p>
                </div>
              </div>

              {/* ─── Restore ─── */}
              <div className="space-y-3 border border-red-200 rounded-lg p-4 bg-red-50/30">
                <div className="flex items-center gap-2">
                  <HardDriveUpload className="w-4 h-4 text-red-600" />
                  <h4 className="font-semibold text-red-900">Restore dari Backup</h4>
                </div>
                <div className="rounded-md bg-red-100 border border-red-300 p-2 text-xs text-red-800">
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
                  <HardDriveUpload className="w-4 h-4 mr-2" />
                  {restoreRunning ? 'Memulihkan...' : 'Pilih File & Restore'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Log Aktivitas</CardTitle>
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
                <Input
                  placeholder="Cari berdasarkan aksi, user, atau target..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="border rounded-lg max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="border-b">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Waktu</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">User</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Aksi</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Target</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
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
                                  log.role === 'admin' ? 'bg-red-100 text-red-700' :
                                  log.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                                  'bg-emerald-100 text-emerald-700'
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
                        <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground/70">
                          Belum ada aktivitas tercatat
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground/70">Menampilkan maksimal 500 log terbaru.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="max-w-4xl pt-4">
        <Button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600">
          Simpan Semua Pengaturan
        </Button>
      </div>
    </div>
  );
}
