from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, ConfigDict
from datetime import date, datetime, timezone
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
class IngredientCreate(BaseModel):
    ingredient_name: str
    price_per_unit: Optional[float] = 0.0
    unit: Optional[str] = "unit"
    location: Optional[str] = "Pantry"
    season: Optional[str] = "All Year"
    availability: Optional[str] = "Available"
    substitutes: Optional[List[str]] = []


class IngredientOut(BaseModel):
    ingredient_id: int
    ingredient_name: str
    price_per_unit: Optional[float] = 0.0
    unit: Optional[str] = "unit"
    location: Optional[str] = None
    season: Optional[str] = None
    availability: Optional[str] = None
    substitutes: Optional[List[str]] = []

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Meal Ingredient Join Schemas
# ==========================================

class MealIngredientItem(BaseModel):
    ingredient_id: Optional[int] = None
    ingredient_name: Optional[str] = "Unnamed Ingredient"
    quantity: Optional[float] = 1.0
    unit: Optional[str] = "unit"

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Meal Schemas
# ==========================================

class MealCreate(BaseModel):
    meal_name: str
    calories_per_serving: float = 0.0
    nutritional_score: float = 0.0
    price_per_serving: float = 0.0
    status: str = "Draft"
    ingredients: List[MealIngredientItem] = []


class MealOut(BaseModel):
    meal_id: int
    meal_name: str
    calories_per_serving: float = 0.0
    nutritional_score: float = 0.0
    price_per_serving: float = 0.0
    status: str = "Draft"
    ingredients: List[MealIngredientItem] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MealDetailResponse(BaseModel):
    meal_id: int
    meal_name: str
    calories_per_serving: float = 0.0
    nutritional_score: float = 0.0
    price_per_serving: float = 0.0
    status: str = "Draft"
    ingredients: List[MealIngredientItem] = []

    model_config = ConfigDict(from_attributes=True)


class MealAdjustmentRequest(BaseModel):
    meal_id: int
    adjustments: Dict[str, Any]


# ==========================================
# Client Schemas
# ==========================================

class ClientCreate(BaseModel):
    client_name: str
    contact_email: Optional[str] = None
    location: Optional[str] = None
    population: Optional[int] = 1


class ClientResponse(BaseModel):
    client_id: int
    client_name: str
    contact_email: Optional[str] = None
    location: Optional[str] = None
    population: Optional[int] = 1
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# Assignment & Menu Schemas
# ==========================================

class MenuAssignmentRequest(BaseModel):
    meal_id: int
    client_id: int
    assignment_date: date
    status: Optional[str] = "Draft"
    price_per_serving: Optional[float] = 0.0


class ClientAssignmentResponse(BaseModel):
    client_id: int
    assignment_date: str
    status: Optional[str] = "Draft"
    price_per_serving: Optional[float] = 0.0
    meal: MealDetailResponse


# ==========================================
# Helper Formatter Function
# ==========================================

def format_meal(meal: models.Meal) -> dict:
    ingredients_list = []

    for mi in meal.meal_ingredients:
        ing_name = mi.ingredient.ingredient_name if mi.ingredient else "Unnamed Ingredient"

        ingredients_list.append({
            "ingredient_id": mi.ingredient_id,
            "ingredient_name": ing_name,
            "quantity": mi.ingredient_quantity,
            "unit": mi.unit,
        })

    return {
        "meal_id": meal.meal_id,
        "meal_name": meal.meal_name,
        "status": meal.status,
        "calories_per_serving": meal.calories_per_serving,
        "price_per_serving": float(getattr(meal, 'price_per_serving', 0.0) or 0.0),
        "nutritional_score": meal.nutritional_score,
        "ingredients": ingredients_list,
        "created_at": getattr(meal, 'created_at', None),
        "updated_at": getattr(meal, 'updated_at', None),
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to the OPTAIMEAL Backend"}

# ==========================================
# Operator Routes
# ==========================================

# Get meal details given meal id
@app.get("/api/meal/{meal_id}", response_model=MealOut)
def get_meal_details(meal_id: int, db: Session = Depends(database.get_db)):
    meal = (
        db.query(models.Meal)
        .options(
            joinedload(models.Meal.meal_ingredients).joinedload(
                models.MealIngredients.ingredient
            )
        )
        .filter(models.Meal.meal_id == meal_id)
        .first()
    )
    
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Meal with ID {meal_id} not found"
        )
    
    return format_meal(meal)


# Update meal details given meal id
@app.put("/api/meal/{meal_id}", response_model=MealOut)
def update_meal(meal_id: int, meal_data: MealCreate, db: Session = Depends(database.get_db)):
    existing_meal = (
        db.query(models.Meal)
        .filter(models.Meal.meal_id == meal_id)
        .first()
    )

    if not existing_meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Meal with ID {meal_id} not found"
        )
    
    if existing_meal.status == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived meals are locked and cannot be edited."
        )
  
    # 1. Update basic scalar fields (including new model attributes)
    existing_meal.meal_name = meal_data.meal_name
    existing_meal.status = meal_data.status
    existing_meal.calories_per_serving = meal_data.calories_per_serving
    existing_meal.nutritional_score = meal_data.nutritional_score
    existing_meal.price_per_serving = meal_data.price_per_serving

    # 2. Wipe old join records for this meal
    db.query(models.MealIngredients).filter(
        models.MealIngredients.meal_id == meal_id
    ).delete(synchronize_session=False)

    # 3. Re-insert updated join records
    for item in meal_data.ingredients:
        ing_id = item.ingredient_id

        # Fallback: handle ingredients added purely by text name
        if not ing_id and item.ingredient_name:
            clean_name = item.ingredient_name.strip()
            db_ing = (
                db.query(models.Ingredient)
                .filter(models.Ingredient.ingredient_name == clean_name)
                .first()
            )
            if not db_ing:
                db_ing = models.Ingredient(ingredient_name=clean_name)
                db.add(db_ing)
                db.flush()  # Populate db_ing.ingredient_id before committing
            ing_id = db_ing.ingredient_id

        if ing_id:
            db.add(
                models.MealIngredients(
                    meal_id=meal_id,
                    ingredient_id=ing_id,
                    ingredient_quantity=item.quantity if item.quantity is not None else 1.0,
                    unit=item.unit or "unit",
                )
            )

    db.commit()

    # 4. Fetch updated meal with pre-loaded ingredient relationships
    updated_meal = (
        db.query(models.Meal)
        .options(
            joinedload(models.Meal.meal_ingredients).joinedload(
                models.MealIngredients.ingredient
            )
        )
        .filter(models.Meal.meal_id == meal_id)
        .first()
    )
    
    return format_meal(updated_meal)

@app.post("/api/operator/menu/assign")
def assign_menu_to_client(request: MenuAssignmentRequest, db: Session = Depends(database.get_db)):
    date_str = str(request.assignment_date)

    # 1. Fetch meal
    meal = db.query(models.Meal).filter(models.Meal.meal_id == request.meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Meal with ID {request.meal_id} not found"
        )

    if meal.status == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Archived menus cannot be assigned"
        )

    # 2. Fetch client
    client = db.query(models.Client).filter(models.Client.client_id == request.client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Client with ID {request.client_id} not found in database"
        )

    # 3. Check for existing assignment for this client on this date
    existing_assignment = db.query(models.MealAssignment).filter(
        models.MealAssignment.client_id == request.client_id,
        models.MealAssignment.assignment_date == date_str
    ).first()

    was_overwritten = False
    assigned_price = request.price_per_serving or meal.price_per_serving or 0.0
    assigned_status = request.status or "Active"

    if existing_assignment:
        previous_meal_id = existing_assignment.meal_id
        
        # Update existing record
        existing_assignment.meal_id = request.meal_id
        existing_assignment.status = assigned_status
        existing_assignment.price_per_serving = assigned_price
        was_overwritten = True

        db.flush()

        # Revert previous meal to "Draft" ONLY if no other active assignments reference it
        if previous_meal_id and previous_meal_id != request.meal_id:
            previous_meal = db.query(models.Meal).filter(models.Meal.meal_id == previous_meal_id).first()
            if previous_meal:
                remaining_assignments = db.query(models.MealAssignment).filter(
                    models.MealAssignment.meal_id == previous_meal_id
                ).first()

                if not remaining_assignments:
                    previous_meal.status = "Draft"
    else:
        new_assignment = models.MealAssignment(
            client_id=request.client_id,
            meal_id=request.meal_id,
            assignment_date=date_str,
            status=assigned_status,
            price_per_serving=assigned_price
        )
        db.add(new_assignment)

    meal.status = "Active"
    db.commit()

    if was_overwritten:
        msg = f"Notice: Overwrote existing assignment for {client.client_name} on {date_str}. '{meal.meal_name}' is now active."
    else:
        msg = f"Meal '{meal.meal_name}' successfully assigned to '{client.client_name}' for {date_str}."

    return {
        "message": msg,
        "overwritten": was_overwritten,
        "assigned_meal_id": meal.meal_id,
        "assignment_date": date_str,
        "price_per_serving": assigned_price
    }


# Access accumulated reports of client changes.
@app.get("/api/operator/menu/analytics")
def get_menu_analytics(db: Session = Depends(database.get_db)):
    logs = db.query(models.ExchangeLog).order_by(models.ExchangeLog.timestamp.desc()).all()
    
    if not logs:
        return {"message": "No implementation reports available yet.", "logs": []}
        
    return logs


# ==========================================
# Ingredient Routes
# ==========================================

# Retrieve list of all ingredients
@app.get("/api/ingredients", response_model=list[IngredientOut])
def get_all_ingredients(db: Session = Depends(database.get_db)):
    return db.query(models.Ingredient).order_by(models.Ingredient.ingredient_name.asc()).all()


@app.post("/api/ingredients", response_model=IngredientOut, status_code=status.HTTP_201_CREATED)
def create_ingredient(payload: IngredientCreate, db: Session = Depends(database.get_db)):
    clean_name = payload.ingredient_name.strip()

    # Check for existing duplicate (case-insensitive)
    existing = db.query(models.Ingredient).filter(
        models.Ingredient.ingredient_name.ilike(clean_name)
    ).first()

    if existing:
        return existing

    new_ingredient = models.Ingredient(
        ingredient_name=clean_name,
        price_per_unit=payload.price_per_unit,
        unit=payload.unit or "unit",
        location=payload.location,
        season=payload.season,
        availability=payload.availability,
        substitutes=payload.substitutes or []
    )
    
    db.add(new_ingredient)
    db.commit()
    db.refresh(new_ingredient)
    return new_ingredient
@app.get("/api/meals", response_model=List[MealOut])
def get_all_meals(db: Session = Depends(database.get_db)):
    meals = (
        db.query(models.Meal)
        .options(
            joinedload(models.Meal.meal_ingredients).joinedload(
                models.MealIngredients.ingredient
            )
        )
        .order_by(models.Meal.meal_id.desc())
        .all()
    )
    return [format_meal(m) for m in meals]


# Post new meal without a given id
@app.post("/api/meal", response_model=MealOut, status_code=status.HTTP_201_CREATED)
def create_meal(meal_data: MealCreate, db: Session = Depends(database.get_db)):
    new_meal = models.Meal(
        meal_name=meal_data.meal_name.strip(),
        status=meal_data.status,
        calories_per_serving=meal_data.calories_per_serving,
        nutritional_score=meal_data.nutritional_score,
        price_per_serving=meal_data.price_per_serving,
    )

    db.add(new_meal)
    db.flush()  # Assigns meal_id before committing join table rows

    for item in meal_data.ingredients:
        ing_id = item.ingredient_id

        # Fallback: handle ingredients added purely by text name
        if not ing_id and item.ingredient_name:
            clean_name = item.ingredient_name.strip()
            db_ing = (
                db.query(models.Ingredient)
                .filter(models.Ingredient.ingredient_name == clean_name)
                .first()
            )
            if not db_ing:
                db_ing = models.Ingredient(ingredient_name=clean_name)
                db.add(db_ing)
                db.flush()
            ing_id = db_ing.ingredient_id

        if ing_id:
            db.add(
                models.MealIngredients(
                    meal_id=new_meal.meal_id,
                    ingredient_id=ing_id,
                    ingredient_quantity=item.quantity if item.quantity is not None else 1.0,
                    unit=item.unit or "unit",
                )
            )

    db.commit()

    # Query freshly created meal with eager-loaded relationships for format_meal
    created_meal = (
        db.query(models.Meal)
        .options(
            joinedload(models.Meal.meal_ingredients).joinedload(
                models.MealIngredients.ingredient
            )
        )
        .filter(models.Meal.meal_id == new_meal.meal_id)
        .first()
    )

    return format_meal(created_meal)


# ==========================================
# Client & Assignment Routes
# ==========================================

# Get all meal assignments for a client
@app.get("/api/client/{client_id}/assignments")
def get_client_assignments(client_id: int, db: Session = Depends(database.get_db)):
    client = db.query(models.Client).filter(models.Client.client_id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Client with ID {client_id} not found"
        )

    assignments = (
        db.query(models.MealAssignment)
        .options(
            joinedload(models.MealAssignment.meal)
            .joinedload(models.Meal.meal_ingredients)
            .joinedload(models.MealIngredients.ingredient)
        )
        .filter(models.MealAssignment.client_id == client_id)
        .order_by(models.MealAssignment.assignment_date.asc())
        .all()
    )

    result = []
    for assignment in assignments:
        if assignment.meal:
            formatted_meal = format_meal(assignment.meal)
            result.append({
                "client_id": assignment.client_id,
                "assignment_date": assignment.assignment_date,
                "status": assignment.status,
                "price_per_serving": assignment.price_per_serving,
                "meal": formatted_meal,
            })

    return {
        "client": {
            "client_id": client.client_id,
            "client_name": client.client_name,
            "contact_email": client.contact_email,
            "location": client.location,
            "population": client.population or 1,
        },
        "assignments": result,
    }


# Post new client
@app.post("/api/client/new", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(payload: ClientCreate, db: Session = Depends(database.get_db)):
    clean_name = payload.client_name.strip()
    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Client name cannot be empty"
        )

    new_client = models.Client(
        client_name=clean_name,
        contact_email=payload.contact_email,
        location=payload.location,
        population=payload.population if payload.population is not None else 1,
    )
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    return new_client
@app.get("/api/client/menu/current/{client_id}")
def get_current_menu(client_id: int, db: Session = Depends(database.get_db)):
    # 1. Fetch latest assignment with pre-loaded meal and ingredients
    assignment = (
        db.query(models.MealAssignment)
        .options(
            joinedload(models.MealAssignment.meal)
            .joinedload(models.Meal.meal_ingredients)
            .joinedload(models.MealIngredients.ingredient)
        )
        .filter(models.MealAssignment.client_id == client_id)
        .order_by(models.MealAssignment.assignment_date.desc())
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"No menu assignment found for client ID {client_id}"
        )

    meal = assignment.meal
    if not meal or meal.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Active menu not found for this assignment"
        )

    # 2. Format meal data and merge assignment metadata
    formatted_meal = format_meal(meal)
    
    return {
        "assignment_id": assignment.id,
        "client_id": assignment.client_id,
        "assignment_date": str(assignment.assignment_date),
        "assignment_status": assignment.status,
        "assignment_price_per_serving": assignment.price_per_serving,
        **formatted_meal
    }


# Send real-time changes back to the backend logging table
@app.post("/api/client/menu/adjust")
def adjust_client_menu(request: MealAdjustmentRequest, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.meal_id == request.meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Meal with ID {request.meal_id} not found"
        )

    if meal.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Adjustments can only be made to Active menus"
        )

    # Convert dictionary adjustments to JSON string for logging storage
    changes_str = json.dumps(request.adjustments) if isinstance(request.adjustments, dict) else str(request.adjustments)
    client_id = request.adjustments.get("client_id") if isinstance(request.adjustments, dict) else None

    new_log = models.ExchangeLog(
        meal_id=request.meal_id,
        client_id=client_id,
        action="ADJUSTMENT",
        timestamp=datetime.now(timezone.utc),
        client_changes=changes_str
    )
    db.add(new_log)
    db.commit()

    return {"message": "Adjustments successfully reported for analytics."}


# Request alternative, optimized meals based on reported constraints
@app.get("/api/client/menu/optimize/{meal_id}")
def optimize_meal(meal_id: int, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Original meal with ID {meal_id} not found"
        )

    latest_log = (
        db.query(models.ExchangeLog)
        .filter(models.ExchangeLog.meal_id == meal_id)
        .order_by(models.ExchangeLog.timestamp.desc())
        .first()
    )

    if not latest_log:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="No reported constraints found to optimize against."
        )

    # Standardized on meal_name across the codebase
    optimized_suggestion = {
        "original_meal_id": meal.meal_id,
        "meal_name": f"Optimized {meal.meal_name}",
        "status": "Active",
        "adjustments_applied": latest_log.client_changes,
        "nutritional_targets_met": True,
        "suggested_ingredients": "Alternative ingredients substituted based on client log constraints"
    }

    return optimized_suggestion


# Fetch all clients (used for dropdowns/modals in frontend)
@app.get("/api/clients", response_model=List[ClientResponse])
def get_all_clients(db: Session = Depends(database.get_db)):
    return db.query(models.Client).order_by(models.Client.client_name.asc()).all()