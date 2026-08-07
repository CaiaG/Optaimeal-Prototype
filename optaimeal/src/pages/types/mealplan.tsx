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