export type MealStatus = 'Draft' | 'Active' | 'Archived';

export interface MealPlan {
  meal_id: number | null;
  meal_name: string;
  // recipe_id: number | null;
  status: MealStatus;
  calories_per_serving: number;
  nutritional_score: number;
  ingredients: string[];
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