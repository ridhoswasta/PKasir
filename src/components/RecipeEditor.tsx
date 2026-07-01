import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, FlaskConical, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  getIngredients,
  getRecipe,
  saveRecipe,
  type Ingredient,
  type RecipeItem,
  type RecipeItemInput,
} from '../services/ingredientService';

interface RecipeEditorProps {
  /** The product being edited. Pass undefined when creating a new product. */
  productId: string | undefined;
  /** Selling price of the product (for margin calculation). */
  price: number;
  /** Additional cost (product.costPrice) outside ingredients — packaging, labor, etc. */
  additionalCost?: number;
  /** If true, save is disabled (no productId yet — user must save the product first). */
  isNewProduct?: boolean;
  /** Called after the recipe is saved, so the parent can refresh cost displays. */
  onSaved?: () => void;
}

interface DraftRow {
  ingredientId: number | '';
  quantity: number | '';
}

export function RecipeEditor({ productId, price, additionalCost = 0, isNewProduct, onSaved }: RecipeEditorProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load ingredient master list
  useEffect(() => {
    getIngredients().then(setIngredients).catch(() => {});
  }, []);

  // Load existing recipe whenever productId changes
  const loadRecipe = useCallback(() => {
    if (!productId) return;
    setLoading(true);
    getRecipe(productId)
      .then((items) => {
        setRecipe(items);
        setRows(
          items.map((it) => ({
            ingredientId: it.ingredientId,
            quantity: it.quantity,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  // ── Draft helpers ────────────────────────────────────────

  const addRow = () => {
    setRows((prev) => [...prev, { ingredientId: '', quantity: '' }]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  // ── Calculations ─────────────────────────────────────────

  const totalCost = rows.reduce((sum, row) => {
    if (!row.ingredientId || row.quantity === '') return sum;
    const ing = ingredients.find((i) => i.id === row.ingredientId);
    return sum + (ing ? ing.costPerUnit * (row.quantity as number) : 0);
  }, 0);

  // Effective HPP = ingredient cost + additional cost (packaging, labor, …)
  const totalHPP = totalCost + additionalCost;
  const margin = price > 0 ? ((price - totalHPP) / price) * 100 : 0;
  const profitPerUnit = price - totalHPP;

  // ── Save ─────────────────────────────────────────────────

  const handleSave = async () => {
    if (!productId) return;
    // Validate
    const valid = rows.every(
      (r) => r.ingredientId !== '' && typeof r.quantity === 'number' && r.quantity > 0,
    );
    if (!valid) {
      toast.error('Setiap baris harus memiliki bahan baku dan jumlah yang valid (> 0)');
      return;
    }
    // Check for duplicate ingredients
    const ids = rows.map((r) => r.ingredientId);
    if (new Set(ids).size !== ids.length) {
      toast.error('Bahan baku tidak boleh duplikat dalam satu resep');
      return;
    }
    setSaving(true);
    try {
      const items: RecipeItemInput[] = rows.map((r) => ({
        ingredientId: r.ingredientId as number,
        quantity: r.quantity as number,
      }));
      await saveRecipe(productId, items);
      await loadRecipe();
      onSaved?.();
      toast.success('Resep berhasil disimpan');
    } catch (e: any) {
      toast.error('Gagal menyimpan resep: ' + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  // ── New-product guard ─────────────────────────────────────

  if (isNewProduct || !productId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
        <FlaskConical className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium">Simpan produk terlebih dahulu untuk mengatur resep</p>
        <p className="text-xs">Resep dapat dikonfigurasi setelah produk tersimpan.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        Memuat resep…
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Cost & Margin summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <p className="text-[11px] text-muted-foreground mb-1">
            {additionalCost > 0 ? 'HPP Total' : 'Biaya Bahan'}
          </p>
          <p className="text-base font-bold text-foreground">
            Rp {totalHPP.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
          </p>
          {additionalCost > 0 && (
            <p className="text-[10px] text-muted-foreground">
              bahan {totalCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })} + tambahan{' '}
              {additionalCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
          <p className="text-[11px] text-muted-foreground mb-1">Harga Jual</p>
          <p className="text-base font-bold text-foreground">
            Rp {price.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 text-center ${
            margin >= 30
              ? 'border-green-500/30 bg-green-500/10'
              : margin >= 0
              ? 'border-yellow-500/30 bg-yellow-500/10'
              : 'border-destructive/30 bg-destructive/10'
          }`}
        >
          <p className="text-[11px] text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <TrendingUp className="w-3 h-3" /> Margin / Laba
          </p>
          <p
            className={`text-base font-bold ${
              margin >= 30 ? 'text-green-600' : margin >= 0 ? 'text-yellow-600' : 'text-destructive'
            }`}
          >
            {margin.toFixed(1)}% &nbsp;·&nbsp; Rp{' '}
            {profitPerUnit.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
            /unit
          </p>
        </div>
      </div>

      <Separator />

      {/* Ingredient rows */}
      <div className="space-y-1">
        <div className="grid grid-cols-[1fr_100px_90px_32px] gap-2 px-1 mb-1">
          <Label className="text-xs text-muted-foreground">Bahan Baku</Label>
          <Label className="text-xs text-muted-foreground">Jumlah</Label>
          <Label className="text-xs text-muted-foreground">Subtotal</Label>
          <span />
        </div>

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Belum ada bahan baku. Klik "+ Tambah Bahan" untuk mulai.
          </p>
        )}

        {rows.map((row, idx) => {
          const ing = ingredients.find((i) => i.id === row.ingredientId);
          const rowCost =
            ing && typeof row.quantity === 'number'
              ? ing.costPerUnit * row.quantity
              : 0;

          return (
            <div key={idx} className="grid grid-cols-[1fr_100px_90px_32px] gap-2 items-center">
              {/* Ingredient picker */}
              <Select
                value={row.ingredientId === '' ? '' : String(row.ingredientId)}
                onValueChange={(val) =>
                  updateRow(idx, { ingredientId: val ? Number(val) : '' })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Pilih bahan…" />
                </SelectTrigger>
                <SelectContent>
                  {ingredients.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name}
                      <span className="ml-1 text-muted-foreground">
                        ({i.unit} · Rp{' '}
                        {i.costPerUnit.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                        )
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Quantity */}
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(idx, {
                      quantity: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                  className="h-8 text-xs pr-7"
                  placeholder="0"
                />
                {ing && (
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    {ing.unit}
                  </span>
                )}
              </div>

              {/* Row subtotal */}
              <p className="text-xs text-right font-mono text-foreground/80">
                Rp {rowCost.toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </p>

              {/* Delete row */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Hapus baris"
                onClick={() => removeRow(idx)}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>

      {ingredients.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Belum ada bahan baku. Tambah di menu "Bahan Baku" terlebih dahulu.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          disabled={ingredients.length === 0}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Tambah Bahan
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          size="sm"
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={handleSave}
          disabled={saving || rows.length === 0}
        >
          {saving ? 'Menyimpan…' : 'Simpan Resep'}
        </Button>
      </div>
    </div>
  );
}
