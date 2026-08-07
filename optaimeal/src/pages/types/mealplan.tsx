export type MealStatus = 'Draft' | 'Active' | 'Archived';

export interface MealPlan {
  meal_id: number | null;
  meal_name: string;
  // recipe_id: number | null;
  status: MealStatus;
  calories_per_serving: number;
  nutritional_score: number;
  ingredients: MealIngredient[];
  assignment_date: string;
}



export const createEmptyMeal = (): MealPlan => ({
  meal_id: null,
  meal_name: "",
  // recipe_id: null,
  status: "Draft",
  calories_per_serving: 0,
  nutritional_score: 0,
  ingredients: [],
  assignment_date: ""
});



export interface Client {
  client_id: number;
  client_name: string;
  // location?: string;
  // population?: number;
}

export interface Assignment {
  client_id: number;
  assignment_date: string; // YYYY-MM-DD format
  meal: MealPlan;
}

export interface MasterIngredient {
  ingredient_id: number;
  ingredient_name: string;
  default_unit?: string;
  calories_per_unit?: number;
}

// Line item attached to a specific meal draft
export interface MealIngredient {
  ingredient_id: number;
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

      // Already structured MealIngredient object
      if (typeof item === 'object') {
        return {
          ingredient_id: item.ingredient_id ?? index + 1,
          ingredient_name: item.ingredient_name || item.name || 'Unknown Ingredient',
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'unit',
        };
      }

      // Legacy string element (e.g., "Lentils")
      if (typeof item === 'string') {
        const str = item.trim();
        if (!str) return null;

        return {
          ingredient_id: index + 1,
          ingredient_name: str,
          quantity: 1,
          unit: 'unit',
        };
      }

      return null;
    })
    .filter((item): item is MealIngredient => item !== null);
};