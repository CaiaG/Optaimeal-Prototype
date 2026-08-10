export type MealStatus = 'Draft' | 'Active' | 'Archived';

export interface MealPlan {
  meal_id: number | null;
  meal_name: string;
  
  category?: string | null;
  status: MealStatus;
  calories_per_serving: number;
  nutritional_score: number;
  price_per_serving: number;
  ingredients: MealIngredient[];
  assignment_date: string;
}

export const createEmptyMeal = (): MealPlan => ({
  meal_id: null,
  meal_name: "",
 
  category: "",
  status: "Draft",
  calories_per_serving: 0,
  nutritional_score: 0,
  price_per_serving: 0,
  ingredients: [],
  assignment_date: ""
});

export interface CreateIngredientPayload {
  ingredient_name: string;
  category?: string | null;
  price_per_unit?: number | null;
  unit?: string | null;
  location?: string | null;
  season?: string | null;
  availability?: string | null;
  substitutes?: string[];
}

export interface MasterIngredient {
  ingredient_id: number;
  ingredient_name: string;
  category?: string | null;
  price_per_unit?: number | null;
  unit?: string | null;
  location?: string | null;
  season?: string | null;
  availability?: string | null;
  substitutes?: string[];
}

export interface Client {
  client_id: number;
  client_name: string;
  contact_email?: string | null;
  location?: string | null;
  population?: number | null;
}

export interface Assignment {
  client_id: number;
  assignment_date: string; // YYYY-MM-DD format
  status?: string;
  price_per_serving?: number;
  meal: MealPlan;
}

// Line item attached to a specific meal draft
export interface MealIngredient {
  ingredient_id: number | null;
  ingredient_name: string;
  quantity: number;
  unit: string;
}

export const parseIngredients = (
  ingredients: MealIngredient[] | string[] | string | undefined | null
): MealIngredient[] => {
  if (!ingredients) return [];

  let raw: any[] = [];

  // 1. Parse string inputs (JSON stringified array OR comma-separated string)
  if (typeof ingredients === 'string') {
    const trimmed = ingredients.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        raw = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // Fallback to CSV split if JSON parsing fails
        raw = trimmed.split(',').map((s) => s.trim());
      }
    } else {
      raw = trimmed.split(',').map((s) => s.trim());
    }
  } else if (Array.isArray(ingredients)) {
    raw = ingredients;
  }

  // 2. Normalize every item into a valid MealIngredient object
  return raw
    .map((item, index) => {
      if (!item) return null;

      // Structured MealIngredient object (handles both quantity & ingredient_quantity keys)
      if (typeof item === 'object') {
        const quantityVal = item.quantity ?? item.ingredient_quantity;
        return {
          ingredient_id: item.ingredient_id ?? null,
          ingredient_name: item.ingredient_name || item.name || 'Unknown Ingredient',
          quantity: quantityVal !== undefined && quantityVal !== null ? Number(quantityVal) : 1,
          unit: item.unit || 'unit',
        };
      }

      // Legacy string element (e.g., "Lentils")
      if (typeof item === 'string') {
        const str = item.trim();
        if (!str) return null;

        return {
          ingredient_id: null,
          ingredient_name: str,
          quantity: 1,
          unit: 'unit',
        };
      }

      return null;
    })
    .filter((item): item is MealIngredient => item !== null);
};