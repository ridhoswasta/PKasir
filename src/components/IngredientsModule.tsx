import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Plus, Edit, Trash2, FlaskConical, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getIngredients,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  type Ingredient,
  type IngredientInput,
} from '../services/ingredientService';

const blank: IngredientInput & { id?: number } = {
  name: '',
  unit: '',
  costPerUnit: 0,
  stockQty: 0,
  lowStockThreshold: 0,
};

// ── Purchase-unit conversion ─────────────────────────────────────────────────
// Recipes use small units (ml, gr, mg) but purchases happen in pack units
// (liter, kg, ons). The dialog's calculator converts a pack price into
// cost-per-recipe-unit so the user never divides by 1000 manually.

type PurchaseOption = { key: string; label: string; factor: number };

function normalizeUnit(u: string): string {
  const t = u.trim().toLowerCase();
  if (['g', 'gr', 'gram'].includes(t)) return 'gr';
  if (['ml', 'cc', 'mili', 'mililiter'].includes(t)) return 'ml';
  if (['l', 'lt', 'ltr', 'liter', 'litre'].includes(t)) return 'l';
  if (['mg', 'miligram'].includes(t)) return 'mg';
  if (['kg', 'kilogram', 'kilo'].includes(t)) return 'kg';
  return t;
}

const PURCHASE_FAMILIES: Record<string, PurchaseOption[]> = {
  ml: [
    { key: 'liter', label: 'liter (1.000 ml)', factor: 1000 },
    { key: 'ml', label: 'ml', factor: 1 },
  ],
  l: [{ key: 'liter', label: 'liter', factor: 1 }],
  gr: [
    { key: 'kg', label: 'kg (1.000 gr)', factor: 1000 },
    { key: 'ons', label: 'ons (100 gr)', factor: 100 },
    { key: 'gr', label: 'gr', factor: 1 },
  ],
  mg: [
    { key: 'kg', label: 'kg (1.000.000 mg)', factor: 1_000_000 },
    { key: 'ons', label: 'ons (100.000 mg)', factor: 100_000 },
    { key: 'gr', label: 'gr (1.000 mg)', factor: 1000 },
    { key: 'mg', label: 'mg', factor: 1 },
  ],
  kg: [{ key: 'kg', label: 'kg', factor: 1 }],
};

function purchaseOptionsFor(unit: string): PurchaseOption[] {
  const norm = normalizeUnit(unit);
  const base =
    PURCHASE_FAMILIES[norm] ?? (norm ? [{ key: norm, label: `per ${norm}`, factor: 1 }] : []);
  // "Kemasan lain" lets the user define any pack size (e.g. 1 sak = 25.000 gr)
  return [...base, { key: 'custom', label: 'Kemasan lain…', factor: 0 }];
}

const COMMON_UNITS = ['ml', 'gr', 'mg', 'kg', 'liter', 'pcs', 'lbr', 'butir'];

// Unit options for STOCK entry (no "Kemasan lain" — plain conversions only)
function stockUnitOptionsFor(unit: string): PurchaseOption[] {
  const norm = normalizeUnit(unit);
  return PURCHASE_FAMILIES[norm] ?? (norm ? [{ key: norm, label: norm, factor: 1 }] : []);
}

/** "10000 ml" → "≈ 10 liter" — largest pack unit the quantity reaches, or null. */
function packEquivalent(qty: number, unit: string): string | null {
  const opts = PURCHASE_FAMILIES[normalizeUnit(unit)];
  if (!opts || qty <= 0) return null;
  const big = [...opts]
    .filter((o) => o.factor > 1)
    .sort((a, b) => b.factor - a.factor)
    .find((o) => qty >= o.factor);
  if (!big) return null;
  return `≈ ${(qty / big.factor).toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${big.key}`;
}

const blankCalc = { price: '', qty: '1', unitKey: '', customFactor: '' };
const blankEntry = { qty: '0', unit: '' };

export function IngredientsModule() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [current, setCurrent] = useState<IngredientInput & { id?: number }>(blank);
  const [toDelete, setToDelete] = useState<Ingredient | null>(null);
  const [saving, setSaving] = useState(false);
  const [calc, setCalc] = useState(blankCalc);
  // Stock fields are entered in any unit of the family (e.g. liter) and
  // converted to the recipe unit (ml) on save, so "10 liter" never gets
  // stored as "10 ml".
  const [stockEntry, setStockEntry] = useState(blankEntry);
  const [threshEntry, setThreshEntry] = useState(blankEntry);

  const load = () => getIngredients().then(setIngredients).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  // Purchase-price calculator (derived values)
  const purchaseOptions = purchaseOptionsFor(current.unit);
  const selectedOption =
    purchaseOptions.find((o) => o.key === calc.unitKey) ?? purchaseOptions[0];
  const calcFactor =
    selectedOption?.key === 'custom'
      ? Number(calc.customFactor) || 0
      : selectedOption?.factor ?? 0;
  const calcTotalUnits = (Number(calc.qty) || 0) * calcFactor;
  const calcCost =
    (Number(calc.price) || 0) > 0 && calcTotalUnits > 0
      ? Number(calc.price) / calcTotalUnits
      : 0;

  // Stock entry: resolve the chosen unit (fall back to the recipe unit itself)
  const stockOptions = stockUnitOptionsFor(current.unit);
  const resolveEntry = (entry: typeof blankEntry) => {
    const opt =
      stockOptions.find((o) => o.key === entry.unit) ??
      stockOptions.find((o) => o.factor === 1) ??
      stockOptions[0];
    const qty = Number(entry.qty) || 0;
    return { opt, value: qty * (opt?.factor ?? 1) };
  };
  const stockResolved = resolveEntry(stockEntry);
  const threshResolved = resolveEntry(threshEntry);

  // Auto-fill cost-per-unit whenever the calculator yields a valid result
  useEffect(() => {
    if (calcCost > 0) {
      setCurrent((p) => ({ ...p, costPerUnit: Math.round(calcCost * 10000) / 10000 }));
    }
  }, [calcCost]);

  const openAdd = () => {
    setCurrent({ ...blank });
    setCalc({ ...blankCalc });
    setStockEntry({ ...blankEntry });
    setThreshEntry({ ...blankEntry });
    setIsEditMode(false);
    setIsDialogOpen(true);
  };

  const openEdit = (ing: Ingredient) => {
    setCurrent({
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      costPerUnit: ing.costPerUnit,
      stockQty: ing.stockQty,
      lowStockThreshold: ing.lowStockThreshold,
    });
    setCalc({ ...blankCalc });
    // Existing values are stored in recipe units — show them as-is
    setStockEntry({ qty: String(ing.stockQty), unit: '' });
    setThreshEntry({ qty: String(ing.lowStockThreshold), unit: '' });
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!current.name.trim()) {
      toast.error('Nama bahan baku wajib diisi');
      return;
    }
    if (!current.unit.trim()) {
      toast.error('Satuan wajib diisi');
      return;
    }
    if (current.costPerUnit < 0) {
      toast.error('Biaya per satuan tidak boleh negatif');
      return;
    }
    setSaving(true);
    try {
      const input: IngredientInput = {
        name: current.name.trim(),
        unit: current.unit.trim(),
        costPerUnit: current.costPerUnit,
        // Convert from the entry unit (e.g. liter) to the recipe unit (ml)
        stockQty: stockResolved.value,
        lowStockThreshold: threshResolved.value,
      };
      if (isEditMode && current.id !== undefined) {
        await updateIngredient(current.id, input);
        toast.success('Bahan baku berhasil diperbarui');
      } else {
        await createIngredient(input);
        toast.success('Bahan baku berhasil ditambahkan');
      }
      setIsDialogOpen(false);
      setCurrent({ ...blank });
      load();
    } catch (e: any) {
      toast.error('Gagal menyimpan: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteIngredient(toDelete.id);
      toast.success('Bahan baku berhasil dihapus');
      setToDelete(null);
      load();
    } catch (e: any) {
      toast.error('Gagal menghapus: ' + (e?.message || e));
    }
  };

  const isLowStock = (ing: Ingredient) =>
    ing.lowStockThreshold > 0 && ing.stockQty <= ing.lowStockThreshold;

  return (
    <div className="p-6 md:p-8 space-y-6 overflow-y-auto h-full">
      <PageHeader
        title="Bahan Baku"
        description="Kelola daftar bahan baku dan biaya per satuan untuk kalkulasi HPP"
        icon={FlaskConical}
        actions={
          <Button className="bg-brand text-brand-foreground hover:bg-brand/90" onClick={openAdd}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Bahan Baku
          </Button>
        }
      />

      {/* Add / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Bahan Baku</Label>
              <Input
                value={current.name}
                onChange={(e) => setCurrent((p) => ({ ...p, name: e.target.value }))}
                placeholder="contoh: Susu Segar, Tepung Terigu…"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Satuan Resep</Label>
                <Input
                  list="ingredient-unit-options"
                  value={current.unit}
                  onChange={(e) => setCurrent((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="contoh: ml, gr, lbr…"
                />
                <datalist id="ingredient-unit-options">
                  {COMMON_UNITS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label>
                  Biaya per Satuan (Rp{current.unit.trim() ? `/${current.unit.trim()}` : ''})
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={current.costPerUnit}
                  onChange={(e) =>
                    setCurrent((p) => ({ ...p, costPerUnit: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            {/* Purchase-price calculator: enter the pack you actually buy
                (1 liter susu, 1 kg kopi) and the cost per recipe unit fills
                itself — no manual division. */}
            <div className="rounded-xl border border-dashed border-foreground/25 bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-medium">Hitung dari Harga Beli</p>
              {!current.unit.trim() ? (
                <p className="text-xs text-muted-foreground">
                  Isi satuan resep terlebih dahulu untuk memakai kalkulator ini.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Harga Beli (Rp)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={calc.price}
                        placeholder="contoh: 20000"
                        onChange={(e) => setCalc((p) => ({ ...p, price: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Jumlah Beli</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={calc.qty}
                        onChange={(e) => setCalc((p) => ({ ...p, qty: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`space-y-2 ${selectedOption?.key === 'custom' ? '' : 'col-span-2'}`}>
                      <Label className="text-xs">Satuan Beli</Label>
                      <Select
                        value={selectedOption?.key ?? ''}
                        onValueChange={(v: string | null) =>
                          setCalc((p) => ({ ...p, unitKey: v ?? '' }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string) =>
                              purchaseOptions.find((o) => o.key === v)?.label ?? v
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {purchaseOptions.map((o) => (
                            <SelectItem key={o.key} value={o.key}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedOption?.key === 'custom' && (
                      <div className="space-y-2">
                        <Label className="text-xs">
                          Isi per Kemasan ({current.unit.trim()})
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={calc.customFactor}
                          placeholder="contoh: 25000"
                          onChange={(e) =>
                            setCalc((p) => ({ ...p, customFactor: e.target.value }))
                          }
                        />
                      </div>
                    )}
                  </div>
                  {calcCost > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {Number(calc.qty).toLocaleString('id-ID')}{' '}
                      {selectedOption?.key === 'custom' ? 'kemasan' : selectedOption?.key} ={' '}
                      {calcTotalUnits.toLocaleString('id-ID')} {current.unit.trim()} →{' '}
                      <span className="font-semibold text-foreground">
                        Rp{' '}
                        {calcCost.toLocaleString('id-ID', { maximumFractionDigits: 4 })}/
                        {current.unit.trim()}
                      </span>{' '}
                      (terisi otomatis di Biaya per Satuan)
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stok Saat Ini</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="flex-1 min-w-0"
                    value={stockEntry.qty}
                    onChange={(e) => setStockEntry((p) => ({ ...p, qty: e.target.value }))}
                  />
                  {stockOptions.length > 0 && (
                    <Select
                      value={stockResolved.opt?.key ?? ''}
                      onValueChange={(v: string | null) =>
                        setStockEntry((p) => ({ ...p, unit: v ?? '' }))
                      }
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue>
                          {(v: string) => stockOptions.find((o) => o.key === v)?.key ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stockOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {(stockResolved.opt?.factor ?? 1) > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Disimpan sebagai{' '}
                    <span className="font-medium text-foreground">
                      {stockResolved.value.toLocaleString('id-ID', { maximumFractionDigits: 3 })}{' '}
                      {current.unit.trim()}
                    </span>{' '}
                    — resep memotong stok per {current.unit.trim()}.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Batas Stok Rendah</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="flex-1 min-w-0"
                    value={threshEntry.qty}
                    onChange={(e) => setThreshEntry((p) => ({ ...p, qty: e.target.value }))}
                  />
                  {stockOptions.length > 0 && (
                    <Select
                      value={threshResolved.opt?.key ?? ''}
                      onValueChange={(v: string | null) =>
                        setThreshEntry((p) => ({ ...p, unit: v ?? '' }))
                      }
                    >
                      <SelectTrigger className="w-24 shrink-0">
                        <SelectValue>
                          {(v: string) => stockOptions.find((o) => o.key === v)?.key ?? v}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {stockOptions.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(threshResolved.opt?.factor ?? 1) > 1 ? (
                    <>
                      ={' '}
                      {threshResolved.value.toLocaleString('id-ID', { maximumFractionDigits: 3 })}{' '}
                      {current.unit.trim()} ·{' '}
                    </>
                  ) : null}
                  Peringatan saat stok ≤ angka ini. Isi 0 untuk nonaktif.
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-brand text-brand-foreground hover:bg-brand/90 mt-2"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Menyimpan…' : isEditMode ? 'Simpan Perubahan' : 'Simpan Bahan Baku'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Master list table */}
      <Card className="rounded-2xl ring-1 ring-foreground/10">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead className="text-right">Biaya/Satuan</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead className="text-right">Batas Rendah</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ingredients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={FlaskConical}
                      title="Belum ada bahan baku"
                      description="Tambahkan bahan baku pertama untuk mulai menghitung HPP resep."
                      action={
                        <Button
                          className="bg-brand text-brand-foreground hover:bg-brand/90"
                          onClick={openAdd}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Bahan Baku
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                ingredients.map((ing) => {
                  const low = isLowStock(ing);
                  return (
                    <TableRow key={ing.id} className={low ? 'bg-amber-500/5' : ''}>
                      <TableCell className="font-medium">
                        {ing.name}
                        {low && (
                          <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-amber-600 font-normal">
                            <AlertTriangle className="w-3 h-3" /> Stok rendah
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ing.unit}</TableCell>
                      <TableCell className="text-right font-mono">
                        Rp {ing.costPerUnit.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${low ? 'text-amber-600 font-semibold' : ''}`}
                      >
                        {ing.stockQty.toLocaleString('id-ID', { maximumFractionDigits: 3 })}{' '}
                        {ing.unit}
                        {packEquivalent(ing.stockQty, ing.unit) && (
                          <p className="text-xs text-muted-foreground font-normal font-sans">
                            {packEquivalent(ing.stockQty, ing.unit)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {ing.lowStockThreshold > 0
                          ? `${ing.lowStockThreshold.toLocaleString('id-ID', {
                              maximumFractionDigits: 3,
                            })} ${ing.unit}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {low ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Rendah
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full">
                            OK
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit bahan"
                            onClick={() => openEdit(ing)}
                          >
                            <Edit className="w-4 h-4 text-info" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Hapus bahan"
                            onClick={() => setToDelete(ing)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        variant="destructive"
        title="Hapus Bahan Baku"
        description={
          <>
            Apakah Anda yakin ingin menghapus bahan baku{' '}
            <strong>{toDelete?.name}</strong>? Bahan ini juga akan dihapus dari semua resep
            yang menggunakannya. Tindakan ini tidak dapat dibatalkan.
          </>
        }
        confirmLabel="Hapus"
        onConfirm={handleDelete}
      />
    </div>
  );
}
