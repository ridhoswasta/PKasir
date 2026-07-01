import { invoke } from '@tauri-apps/api/core';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface Ingredient {
  id: number;
  name: string;
  unit: string;
  costPerUnit: number;
  stockQty: number;
  lowStockThreshold: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface IngredientInput {
  name: string;
  unit: string;
  costPerUnit: number;
  stockQty?: number;
  lowStockThreshold?: number;
}

export interface RecipeItem {
  id: number;
  productId: string;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
  subtotal: number;
}

export interface RecipeItemInput {
  ingredientId: number;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  quantity: number;
}

// ── Service calls — thin wrappers over invoke ─────────────────────────────────

/** Fetch all ingredients, ordered by name. */
export const getIngredients = (): Promise<Ingredient[]> =>
  invoke<Ingredient[]>('get_ingredients');

/** Create a new ingredient. Returns the persisted record (with auto id). */
export const createIngredient = (input: IngredientInput): Promise<Ingredient> =>
  invoke<Ingredient>('create_ingredient', { input });

/** Update an existing ingredient by id. */
export const updateIngredient = (id: number, input: IngredientInput): Promise<Ingredient> =>
  invoke<Ingredient>('update_ingredient', { id, input });

/** Delete an ingredient by id. Also removes it from any recipes. */
export const deleteIngredient = (id: number): Promise<boolean> =>
  invoke<boolean>('delete_ingredient', { id });

/** Fetch the recipe (ingredient list) for a product. */
export const getRecipe = (productId: string): Promise<RecipeItem[]> =>
  invoke<RecipeItem[]>('get_recipe', { id: productId });

/**
 * Atomically replace the recipe for a product.
 * Sends `id` as the Tauri command's `id` parameter
 * and `items` as the list of {ingredientId, quantity} entries.
 */
export const saveRecipe = (
  productId: string,
  items: RecipeItemInput[],
): Promise<boolean> =>
  invoke<boolean>('save_recipe', { id: productId, items });

/** Compute total ingredient cost for selling one unit of a product. */
export const getProductCost = (productId: string): Promise<number> =>
  invoke<number>('get_product_cost', { id: productId });

/**
 * Fetch ingredient costs for ALL products with a recipe in one call.
 * Returns a map of productId → total ingredient cost. Products without a
 * recipe are absent (treat as 0). The effective HPP of a product is
 * costPrice (additional cost) + this ingredient cost.
 */
export const getAllProductCosts = (): Promise<Record<string, number>> =>
  invoke<Record<string, number>>('get_all_product_costs');

/**
 * Deduct ingredient stock for a completed sale.
 * Negative stock is allowed — the backend never blocks checkout.
 * Callers should warn the user but not throw on failure.
 */
export const deductIngredientsForSale = (items: SaleItem[]): Promise<void> =>
  invoke<void>('deduct_ingredients_for_sale', { items });
