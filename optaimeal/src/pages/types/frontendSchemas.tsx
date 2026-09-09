export type MealStatus = 'Draft' | 'Active' | 'Archived' | 'Scheduled';

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
  substitutes?: string[] | null;
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
  substitutes?: string[] | null;
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
  ingredient_quantity: number;
  unit: string;
}

export interface MealCandidateOption {
  meal_id?: number;
  meal_name: string;
  calories_per_serving?: number;
  nutritional_score?: string | number;
  ingredients?: string[];
  is_edited_original?: boolean;
  is_alternative?: boolean;
}

export interface ApplySelectionResponse {
  message: string;
  assignment_id: number;
  assignment_date: string;
  assigned_meal: any; 
}

export interface AnalyticsSummary {
  total_changes: number;
  by_action: Record<string, number>;
  by_source: Record<string, number>;
  by_client: { client_id: number; count: number }[];
}

export interface AnalyticsEntry {
  assignment_id: number | null;
  client_id: number | null;
  assignment_date: string | null;
  timestamp: string;
  action: string;
  changes?: Record<string, any>;
  source: string;
  source_category: string;
  previous_meal_id: number | null;
  new_meal_id: number | null;
  client_name: string | null;
  previous_meal_name: string | null;
  new_meal_name: string | null;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  entries: AnalyticsEntry[];

}
export const parseIngredients = (
  ingredients: MealIngredient[] | string[] | string | undefined | null
): MealIngredient[] => {
  if (!ingredients) return [];

  let raw: any[] = [];

  // Parse string inputs (JSON stringified array OR comma-separated string)
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

  // Normalize every item into a valid MealIngredient object
  return raw
  // index not in use
    .map((item, index) => {
      if (!item) return null;

      // Structured MealIngredient object (handles both quantity & ingredient_quantity keys)
      if (typeof item === 'object') {
        const quantityVal = item.ingredient_quantity;
        return {
          ingredient_id: item.ingredient_id ?? null,
          ingredient_name: item.ingredient_name || item.name || 'Unknown Ingredient',
          ingredient_quantity: quantityVal !== undefined && quantityVal !== null ? Number(quantityVal) : 1,
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
          ingredient_quantity: 1,
          unit: 'unit',
        };
      }

      return null;
    })
    .filter((item): item is MealIngredient => item !== null);
};

export interface MealIngredientBreakdown {
  ingredient_id: number;
  ingredient_name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  price_per_unit?: number;
  cost_contribution: number;
  macros: Record<string, number>;
  micros: Record<string, number>;
  has_nutrition_data: boolean;
}

export interface MealBreakdownTotals {
  total_cost: number;
  energy_kcal: number;
  protein_g: number;
  fat_g: number;
  carb_g: number;
  fibre_g: number;
  vitamin_a_mcg: number;
  vitamin_c_mg: number;
  vitamin_b6_mg: number;
  vitamin_b12_mcg: number;
  iron_mg: number;
  zinc_mg: number;
  thiamin_mg: number;
  riboflavin_mg: number;
}

export interface MealBreakdownResponse {
  meal_id: number;
  meal_name: string;
  status: string;
  price_per_serving: number;
  calories_per_serving: number;
  ingredients: MealIngredientBreakdown[];
  totals: MealBreakdownTotals;
}