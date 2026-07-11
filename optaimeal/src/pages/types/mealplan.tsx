export type MealStatus = 'Draft' | 'Active' | 'Archived';

export interface MealPlan {
  id: number;
  meal_name: string;
  recipe_id: number | null;
  status: MealStatus;
  calories: number;
  nutritional_score: number;
  ingredients: string[];
  assignment_date: string;
  client_ids: number[];
  estimated_cost: number;
}

export const createEmptyMeal = (): MealPlan => ({
  id: -1,
  meal_name: "",
  recipe_id: null,
  status: "Draft",
  calories: 0,
  nutritional_score: 0,
  ingredients: [],
  assignment_date: new Date().toISOString().split('T')[0],
  client_ids: [],
  estimated_cost: 0,
});