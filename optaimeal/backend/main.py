from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, datetime
import json

from typing import Dict, Any, List, Union, Optional

import models, database 

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="OPTAIMEAL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)
# how to generate meal id

class MealIngredientItem(BaseModel):
    ingredient_id: Optional[int] = None
    ingredient_name: str = "Unnamed Ingredient"
    quantity: Optional[float] = 1.0
    unit: Optional[str] = "unit"

# 2. Updated Meal creation/update schema
class MealCreate(BaseModel):
    meal_name: str
    calories_per_serving: float = 0.0
    nutritional_score: float = 0.0
    ingredients: List[MealIngredientItem] = [] 
    status: str = "Draft"

class MealOut(BaseModel):
    meal_id: int
    meal_name: str
    calories_per_serving: float
    nutritional_score: float = 0.0
    ingredients: List[MealIngredientItem] = []
    status: str = "Draft"

    class Config:
        from_attributes = True

class MenuAssignmentRequest(BaseModel):
    meal_id: int
    client_id: int
    assignment_date: str


def serialize_ingredients(ingredients: List[MealIngredientItem]) -> str:
    """Converts structured ingredients list into a JSON string for DB storage."""
    return json.dumps([ing.model_dump() for ing in ingredients])

def parse_ingredients_from_db(raw_ingredients) -> List[dict]:
    """Safely parses DB string/JSON column into structured ingredient dicts."""
    if not raw_ingredients:
        return []
    
    if isinstance(raw_ingredients, list):
        return raw_ingredients

    if isinstance(raw_ingredients, str):
        trimmed = raw_ingredients.strip()
        if not trimmed:
            return []
        
        # Parse JSON stringified array
        if trimmed.startswith("[") or trimmed.startswith("{"):
            try:
                parsed = json.loads(trimmed)
                return parsed if isinstance(parsed, list) else [parsed]
            except Exception:
                pass
        
        # Legacy fallback: CSV string (e.g. "Lentils, Carrots")
        return [
            {
                "ingredient_id": i + 1,
                "ingredient_name": name.strip(),
                "quantity": 1.0,
                "unit": "unit"
            }
            for i, name in enumerate(trimmed.split(",")) if name.strip()
        ]

    return []

def format_meal_dict(meal: models.Meal) -> dict:
    """Formats a Meal model into a dict matching MealOut response shape."""
    return {
        "meal_id": meal.meal_id,
        "meal_name": meal.meal_name,
        "calories_per_serving": meal.calories_per_serving,
        "nutritional_score": meal.nutritional_score,
        "status": meal.status,
        "ingredients": parse_ingredients_from_db(meal.ingredients),
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the OPTAIMEAL Backend"}

# operator routes

# get meal details given meal id
@app.get("/api/meal/{meal_id}", response_model=MealOut)
def get_meal_details(meal_id: int, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return format_meal_dict(meal)

# Update meal details given meal id
@app.put("/api/meal/{meal_id}", response_model=MealOut)
def update_meal(meal_id: int, meal_data: MealCreate, db: Session = Depends(database.get_db)):
    existing_meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    
    if not existing_meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    existing_meal.meal_name = meal_data.meal_name
    existing_meal.status = meal_data.status
    existing_meal.calories_per_serving = meal_data.calories_per_serving
    existing_meal.nutritional_score = meal_data.nutritional_score
    existing_meal.ingredients = serialize_ingredients(meal_data.ingredients)

    db.commit()
    db.refresh(existing_meal)
    
    return format_meal_dict(existing_meal)

class MenuAssignmentRequest(BaseModel):
    meal_id: int
    client_id: int
    assignment_date: date

# Send a specific menu to a client (using client ID)
@app.post("/api/operator/menu/assign")
def assign_menu_to_client(request: MenuAssignmentRequest, db: Session = Depends(database.get_db)):
    # 1. Fetch meal
    meal = db.query(models.Meal).filter(models.Meal.meal_id == request.meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    if meal.status == "Archived":
        raise HTTPException(status_code=400, detail="Archived menus cannot be assigned")

    # 2. Fetch client
    client = db.query(models.Client).filter(models.Client.client_id == request.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found in database")

    # 3. Check for existing assignment for this client on this date
    existing_assignment = db.query(models.MealAssignment).filter(
        models.MealAssignment.client_id == request.client_id,
        models.MealAssignment.assignment_date == request.assignment_date
    ).first()

    was_overwritten = False

    if existing_assignment:
        previous_meal = db.query(models.Meal).filter(
            models.Meal.meal_id == existing_assignment.meal_id
        ).first()
        
        existing_assignment.meal_id = request.meal_id
        was_overwritten = True

        db.flush()

        # Revert previous meal to "Draft" ONLY if no other active assignments reference it
        if previous_meal and previous_meal.meal_id != request.meal_id:
            remaining_assignments = db.query(models.MealAssignment).filter(
                models.MealAssignment.meal_id == previous_meal.meal_id
            ).first()

            if not remaining_assignments:
                previous_meal.status = "Draft"
    else:
        new_assignment = models.MealAssignment(
            client_id=request.client_id,
            meal_id=request.meal_id,
            assignment_date=request.assignment_date
        )
        db.add(new_assignment)

    meal.status = "Active"
    db.commit()

    if was_overwritten:
        msg = f"Notice: Overwrote existing assignment for {client.client_name} on {request.assignment_date}. '{meal.meal_name}' is now active."
    else:
        msg = f"Meal '{meal.meal_name}' successfully assigned to '{client.client_name}'."

    return {
        "message": msg,
        "overwritten": was_overwritten,
        "assigned_meal_id": meal.meal_id
    }


# Access accumulated reports of client changes.
@app.get("/api/operator/menu/analytics")
def get_menu_analytics(db: Session = Depends(database.get_db)):
    
    logs = db.query(models.ExchangeLog).all()
    
    if not logs:
        return {"message": "No implementation reports available yet."}
        
    return logs

class IngredientCreate(BaseModel):
    ingredient_name: str
    price_per_unit: Optional[float] = 0.0
    location: Optional[str] = "Pantry"
    season: Optional[str] = "All Year"
    availability: Optional[str] = "Available"

class IngredientOut(BaseModel):
    ingredient_id: int
    ingredient_name: str
    price_per_unit: Optional[float] = 0.0
    location: Optional[str] = None
    season: Optional[str] = None
    availability: Optional[str] = None

    class Config:
        from_attributes = True

# Retrieve list of all ingredients
@app.get("/api/ingredients", response_model=list[IngredientOut])
def get_all_ingredients(db: Session = Depends(database.get_db)):
    return db.query(models.Ingredient).all()

@app.post("/api/ingredients", response_model=IngredientOut, status_code=status.HTTP_201_CREATED)
def create_ingredient(payload: IngredientCreate, db: Session = Depends(database.get_db)):
    clean_name = payload.ingredient_name.strip()

    # Check for existing duplicate
    existing = db.query(models.Ingredient).filter(
        models.Ingredient.ingredient_name.ilike(clean_name)
    ).first()

    if existing:
        return existing

    # payload.model_dump() / payload.dict() contains all fields including default values
    new_ingredient = models.Ingredient(
        ingredient_name=clean_name,
        price_per_unit=payload.price_per_unit,
        location=payload.location,
        season=payload.season,
        availability=payload.availability
    )
    
    db.add(new_ingredient)
    db.commit()
    db.refresh(new_ingredient)
    return new_ingredient

# retrieve list of all meals on backend
@app.get("/api/meals", response_model=List[MealOut])
def get_all_meals(db: Session = Depends(database.get_db)):
    meals = db.query(models.Meal).all()
    return [format_meal_dict(m) for m in meals]

# post new meal without a given id
@app.post("/api/meal", response_model=MealOut, status_code=status.HTTP_201_CREATED)
def create_meal(meal_data: MealCreate, db: Session = Depends(database.get_db)):
    new_meal = models.Meal(
        meal_name=meal_data.meal_name,
        calories_per_serving=meal_data.calories_per_serving,
        nutritional_score=meal_data.nutritional_score,
        status=meal_data.status,
        ingredients=serialize_ingredients(meal_data.ingredients)
    )
    
    db.add(new_meal)
    db.commit()
    db.refresh(new_meal)
    
    return format_meal_dict(new_meal)

class MealDetailResponse(BaseModel):
    meal_id: int
    meal_name: str
    calories_per_serving: int
    nutritional_score: int
    ingredients: Union[List[str], str]
    status: str

    class Config:
        from_attributes = True

class ClientAssignmentResponse(BaseModel):
    client_id: int
    assignment_date: str
    meal: MealDetailResponse

@app.get("/api/client/{client_id}/assignments", response_model=List[ClientAssignmentResponse])
def get_client_assignments(client_id: int, db: Session = Depends(database.get_db)):
    # Verify client exists
    client = db.query(models.Client).filter(models.Client.client_id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    assignments = (
        db.query(models.MealAssignment, models.Meal)
        .join(models.Meal, models.MealAssignment.meal_id == models.Meal.meal_id)
        .filter(models.MealAssignment.client_id == client_id)
        .all()
    )

    result = []
    for assignment, meal in assignments:
        result.append({
            "client_id": assignment.client_id,
            "assignment_date": assignment.assignment_date,
            "meal": meal
        })

    return result

### client routes ###

#  Fetch the daily/weekly menu assigned to the authenticated client based on their id.
@app.get("/api/client/menu/current/{client_id}")
def get_current_menu(client_id: int, db: Session = Depends(database.get_db)):
    assignment = db.query(models.MealAssignment).filter(
        models.MealAssignment.client_id == client_id
    ).order_by(models.MealAssignment.assignment_date.desc()).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="No menu assigned to this client.")

    meal = db.query(models.Meal).filter(
        models.Meal.meal_id == assignment.meal_id,
        models.Meal.status == "Active"
    ).first()

    if not meal:
        raise HTTPException(status_code=404, detail="Active menu not found.")

    # Merge assignment and meal properties into a flat dictionary
    return {
        "assignment_id": assignment.id,
        "client_id": assignment.client_id,
        "assignment_date": str(assignment.assignment_date),
        "meal_id": meal.meal_id,
        "meal_name": meal.meal_name,
        "calories_per_serving": meal.calories_per_serving,
        "nutritional_score": meal.nutritional_score,
        "ingredients": meal.ingredients,
        "status": meal.status
    }

class MealAdjustmentRequest(BaseModel):
    meal_id: int
    adjustments: Dict[str, Any]

#  Send real-time changes (e.g., ingredient availability, quantity adjustments) back to the backend.
@app.post("/api/client/menu/adjust")
def adjust_client_menu(request: MealAdjustmentRequest, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.meal_id == request.meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    if meal.status != "Active":
        raise HTTPException(status_code=400, detail="Adjustments can only be made to Active menus")

    new_log = models.ExchangeLog(
        meal_id=request.meal_id,
        timestamp=datetime.now(),
        client_changes=str(request.adjustments)
    )
    db.add(new_log)
    
    db.commit()
    return {"message": "Adjustments successfully reported for analytics."}

# commit to either recipe_name or meal_name
# Request alternative, optimized recipes based on reported constraints.
@app.get("/api/client/menu/optimize/{meal_id}")
def optimize_meal(meal_id: int, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Original meal not found")

    latest_log = db.query(models.ExchangeLog).filter(
        models.ExchangeLog.meal_id == meal_id
    ).order_by(models.ExchangeLog.timestamp.desc()).first()

    if not latest_log:
        raise HTTPException(status_code=400, detail="No reported constraints found to optimize against.")

    optimized_suggestion = {
        "original_meal_id": meal.meal_id,
        "new_recipe_name": f"Optimized {meal.meal_name}",
        "status": "Active",
        "adjustments_applied": latest_log.client_changes,
        "nutritional_targets_met": True,
        "suggested_ingredients": "Alternative ingredients based on availability"
    }

    return optimized_suggestion

class ClientCreate(BaseModel):
    client_name: str
    location: str
    population: int

class ClientResponse(BaseModel):
    client_id: int
    client_name: str
    location: str
    population: int

    class Config:
        from_attributes = True

# Fetch all clients (used for dropdowns/modals in frontend)
@app.get("/api/clients", response_model=List[ClientResponse])
def get_all_clients(db: Session = Depends(database.get_db)):
    clients = db.query(models.Client).all()
    return clients


# Create a new client
@app.post("/api/clients", response_model=ClientResponse)
def create_client(client_data: ClientCreate, db: Session = Depends(database.get_db)):
    new_client = models.Client(
        client_name=client_data.client_name,
        location=client_data.location,
        population=client_data.population
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client