import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';

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
          <div key={tag} className="flex items-center gap-1 bg-slate-100 px-3 py-1 rounded-full text-sm border border-slate-200">
            <span>{tag}</span>
            <button type="button" onClick={() => handleRemove(tag)} className="text-slate-400 hover:text-red-500">
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
    productCategories: [], flowCategories: [], productUnits: [], pointMultiplier: 1000
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/settings').then(res => res.json()).then(data => {
      setSettings(data);
    });
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toast.success('Pengaturan berhasil disimpan');
        window.dispatchEvent(new Event('settings-updated'));
      } else {
        toast.error('Gagal menyimpan pengaturan');
      }
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
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

  return (
    <div className="p-8 space-y-6 overflow-y-auto h-full">
      <h2 className="text-3xl font-bold text-slate-800">Pengaturan</h2>

      <Tabs defaultValue="general" className="w-full max-w-3xl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">Umum & Kategori</TabsTrigger>
          <TabsTrigger value="receipt">Pengaturan Struk</TabsTrigger>
          <TabsTrigger value="system">Sistem</TabsTrigger>
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
                      className="object-contain rounded border bg-slate-50" 
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>Sistem & Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nilai 1 Poin Pelanggan (Berdasarkan kelipatan transaksi Rp)</Label>
                <Input type="number" value={settings.pointMultiplier} onChange={(e) => setSettings({ ...settings, pointMultiplier: Number(e.target.value) })} />
                <p className="text-xs text-slate-500">Contoh: Jika diisi 1000, maka setiap transaksi Rp 10.000 akan mendapatkan 10 poin.</p>
              </div>
              <div className="space-y-2">
                <Label>Nama Printer Default</Label>
                <Input value={settings.printerName} onChange={(e) => setSettings({ ...settings, printerName: e.target.value })} />
              </div>
              <p className="text-sm text-slate-500">
                Catatan: Untuk versi web ini, pencetakan struk menggunakan dialog print browser bawaan. 
                Jika menggunakan aplikasi desktop (Tauri), pengaturan ini akan terhubung ke printer lokal.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="max-w-3xl pt-4">
        <Button onClick={handleSave} className="w-full bg-orange-500 hover:bg-orange-600">
          Simpan Semua Pengaturan
        </Button>
      </div>
    </div>
  );
}
