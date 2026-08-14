from fastapi import FastAPI, Depends, HTTPException, status, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, ConfigDict, ValidationError
from datetime import date, datetime, timedelta
import json
import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
from groq import Groq
from typing import Dict, Any, List, Optional
import models, database 

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="OPTAIMEAL API")

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError(
        f"GROQ_API_KEY is missing! Looking at: {env_path}\n"
        "Make sure the file contains: GROQ_API_KEY=gsk_your_key_here"
    )

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)
# how to generate meal id
class IngredientCreate(BaseModel):
    ingredient_name: str
    category: Optional[str] = "n/a"
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
    ingredient_quantity: Optional[float] = 1.0
    unit: Optional[str] = "unit"

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Meal Schemas
# ==========================================

class MealCreate(BaseModel):
    meal_name: str
    parent_meal_id: Optional[int] = None
    calories_per_serving: float = 0.0
    nutritional_score: float = 0.0
    price_per_serving: float = 0.0
    status: str = "Draft"
    ingredients: List[MealIngredientItem] = []
    


class MealOut(BaseModel):
    meal_id: int
    meal_name: str
    parent_meal_id: Optional[int] = None
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
    parent_meal_id: Optional[int] = None
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
    id: int
    client_id: int
    meal_id: int
    assignment_date: date
    status: Optional[str] = "Scheduled"
    price_per_serving: Optional[float] = 0.0
    created_at: Optional[datetime] = None
    meal: Optional[MealDetailResponse] = None

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# Optimization Schemas
# ==========================================

class ChatMessageSchema(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    client_id: int
    assignment_date: str
    message: str

class RegenerateRequest(BaseModel):
    client_id: int
    assignment_date: str
    meal_id: int
    current_meal_name: str
    servings: int = 1
    unavailable_ingredients: List[str] = []
    insufficient_ingredients: List[str] = []
    user_prompt: Optional[str] = None
    chat_history: List[ChatMessageSchema] = []

class RegenerateResponse(BaseModel):
    reply: str
    edited_meal: dict       
    alternatives: List[dict]

class ApplySelectionRequest(BaseModel):
    client_id: int
    assignment_date: str
    selected_meal: dict

# ==========================================
# Helper Formatter Function
# ==========================================

def format_meal(meal: Any) -> dict:
    ingredients_list = []

    if hasattr(meal, "meal_ingredients") and meal.meal_ingredients:
        for mi in meal.meal_ingredients:
            ing_name = mi.ingredient.ingredient_name if getattr(mi, "ingredient", None) else "Unnamed Ingredient"

            ingredients_list.append({
                "ingredient_id": mi.ingredient_id,
                "ingredient_name": ing_name,
                "ingredient_quantity": mi.ingredient_quantity,
                "unit": mi.unit,
            })

    return {
        "meal_id": meal.meal_id,
        "meal_name": meal.meal_name,
        "parent_meal_id": getattr(meal, "parent_meal_id", None),
        "status": meal.status,
        "calories_per_serving": meal.calories_per_serving,
        "price_per_serving": float(getattr(meal, "price_per_serving", 0.0) or 0.0),
        "nutritional_score": meal.nutritional_score,
        "ingredients": ingredients_list,
        "created_at": getattr(meal, "created_at", None),
        "updated_at": getattr(meal, "updated_at", None),
    }

# ==========================================
# Logging Schemas
# ==========================================

class ChangeLogCreate(BaseModel):
    meal_id: Optional[int] = None
    action: str 
    changes: Optional[Dict[str, Any]] = None

class ChangeLogOut(BaseModel):
    id: int
    meal_id: Optional[int] = None
    action: str
    changes: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class MealAssignmentLogOut(BaseModel):
    id: int
    assignment_id: int
    client_id: int
    assignment_date: date
    current_meal_id: Optional[int] = None
    old_meal_ids: List[int] = []
    change_history: Optional[List[Dict[str, Any]]] = []
    action: str
    source: Optional[str] = None
    user_prompt: Optional[str] = None
    timestamp: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

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
            detail=f"Meal with ID {meal_id} not found",
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

    existing_meal.meal_name = meal_data.meal_name
    existing_meal.parent_meal_id = meal_data.parent_meal_id
    existing_meal.status = meal_data.status
    existing_meal.calories_per_serving = meal_data.calories_per_serving
    existing_meal.nutritional_score = meal_data.nutritional_score
    existing_meal.price_per_serving = meal_data.price_per_serving

    
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
                db.flush()
            ing_id = db_ing.ingredient_id

        if ing_id:
            db.add(
                models.MealIngredients(
                    meal_id=meal_id,
                    ingredient_id=ing_id,
                    ingredient_quantity=item.ingredient_quantity if item.ingredient_quantity is not None else 1.0,
                    unit=item.unit or "unit",
                )
            )

    

    changelog_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": "MEAL_UPDATE",
        "meal_id": meal_id,
        "meal_name": existing_meal.meal_name,
        "source": "API_MANUAL_UPDATE",
        "details": f"Meal '{existing_meal.meal_name}' (ID: {meal_id}) updated.",
    }

    meal_history = list(getattr(existing_meal, "change_history", []) or [])
    meal_history.append(changelog_entry)
    existing_meal.change_history = meal_history

    db.commit()

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
def assign_menu_to_client(
    request: MenuAssignmentRequest, db: Session = Depends(database.get_db)
):
    
    meal = db.query(models.Meal).filter(models.Meal.meal_id == request.meal_id).first()
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal with ID {request.meal_id} not found",
        )

    if meal.status == "Archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archived menus cannot be assigned",
        )

    
    client = (
        db.query(models.Client)
        .filter(models.Client.client_id == request.client_id)
        .first()
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID {request.client_id} not found in database",
        )

    # Check for existing assignment for this client on this date
    existing_assignment = (
        db.query(models.MealAssignment)
        .filter(
            models.MealAssignment.client_id == request.client_id,
            models.MealAssignment.assignment_date == request.assignment_date,
        )
        .first()
    )

    was_overwritten = False
    assigned_price = (
        request.price_per_serving
        if request.price_per_serving is not None
        else (meal.price_per_serving or 0.0)
    )
    assigned_status = request.status or "Scheduled"

    if existing_assignment:
        previous_meal_id = existing_assignment.meal_id

        # Update existing record
        existing_assignment.meal_id = request.meal_id
        existing_assignment.status = assigned_status
        existing_assignment.price_per_serving = assigned_price
        was_overwritten = True

        db.flush()

        # Update or create the corresponding assignment audit log
        log = (
            db.query(models.MealAssignmentLog)
            .filter(
                models.MealAssignmentLog.assignment_id == existing_assignment.id
            )
            .first()
        )

        if log:
            if previous_meal_id != request.meal_id:
                # Add previous meal ID to historical array
                old_ids = list(log.old_meal_ids or [])
                if previous_meal_id not in old_ids:
                    old_ids.append(previous_meal_id)
                log.old_meal_ids = old_ids

                # Append timeline entry to change_history
                history = list(log.change_history or [])
                history.append(
                    {
                        "timestamp": datetime.utcnow().isoformat(),
                        "action": "SWAP",
                        "previous_meal_id": previous_meal_id,
                        "new_meal_id": request.meal_id,
                        "source": "OPERATOR_UPDATE",
                    }
                )
                log.change_history = history
                log.current_meal_id = request.meal_id
                log.action = "SWAP"
        else:
            log = models.MealAssignmentLog(
                assignment_id=existing_assignment.id,
                client_id=request.client_id,
                assignment_date=request.assignment_date,
                current_meal_id=request.meal_id,
                old_meal_ids=[previous_meal_id]
                if previous_meal_id != request.meal_id
                else [],
                change_history=[
                    {
                        "timestamp": datetime.utcnow().isoformat(),
                        "action": "OVERWRITE",
                        "previous_meal_id": previous_meal_id,
                        "new_meal_id": request.meal_id,
                        "source": "OPERATOR_UPDATE",
                    }
                ],
                action="SWAP" if previous_meal_id != request.meal_id else "ASSIGN",
                source="OPERATOR_UPDATE",
            )
            db.add(log)

        # Revert previous meal to "Draft" ONLY if no other assignments reference it
        if previous_meal_id and previous_meal_id != request.meal_id:
            remaining_assignments = (
                db.query(models.MealAssignment)
                .filter(models.MealAssignment.meal_id == previous_meal_id)
                .first()
            )

            if not remaining_assignments:
                previous_meal = (
                    db.query(models.Meal)
                    .filter(models.Meal.meal_id == previous_meal_id)
                    .first()
                )
                if previous_meal:
                    previous_meal.status = "Draft"

    else:
        # Create new assignment
        new_assignment = models.MealAssignment(
            client_id=request.client_id,
            meal_id=request.meal_id,
            assignment_date=request.assignment_date,
            status=assigned_status,
            price_per_serving=assigned_price,
        )
        db.add(new_assignment)
        db.flush()

        # Create corresponding initial log entry
        new_log = models.MealAssignmentLog(
            assignment_id=new_assignment.id,
            client_id=request.client_id,
            assignment_date=request.assignment_date,
            current_meal_id=request.meal_id,
            old_meal_ids=[],
            change_history=[
                {
                    "timestamp": datetime.utcnow().isoformat(),
                    "action": "INITIAL_ASSIGNMENT",
                    "meal_id": request.meal_id,
                    "source": "OPERATOR_UPDATE",
                }
            ],
            action="ASSIGN",
            source="OPERATOR_UPDATE",
        )
        db.add(new_log)

    meal.status = "SCHEDULED"
    db.commit()

    date_str = request.assignment_date.isoformat()

    if was_overwritten:
        msg = f"Notice: Overwrote existing assignment for {client.client_name} on {date_str}. '{meal.meal_name}' is now active."
    else:
        msg = f"Meal '{meal.meal_name}' successfully assigned to '{client.client_name}' for {date_str}."

    return {
        "message": msg,
        "overwritten": was_overwritten,
        "assigned_meal_id": meal.meal_id,
        "assignment_date": date_str,
        "price_per_serving": assigned_price,
    }


# Access accumulated reports of client changes: UNIMPLEMENTED
@app.get("/api/operator/menu/analytics")
def get_menu_analytics(db: Session = Depends(database.get_db)):
    return


# ==========================================
# Ingredient Routes
# ==========================================

# Retrieve list of all ingredients
@app.get("/api/ingredients", response_model=list[IngredientOut])
def get_all_ingredients(db: Session = Depends(database.get_db)):
    return db.query(models.Ingredient).order_by(models.Ingredient.ingredient_name.asc()).all()


@app.post("/api/ingredients", response_model=IngredientOut, status_code=status.HTTP_201_CREATED)
def create_ingredient(payload: IngredientCreate, response: Response, db: Session = Depends(database.get_db)):
    clean_name = payload.ingredient_name.strip()

    # Check for existing duplicate
    existing = db.query(models.Ingredient).filter(
        models.Ingredient.ingredient_name.ilike(clean_name)
    ).first()

    if existing:
        response.status_code = status.HTTP_200_OK 
        return existing
        
        
    new_ingredient = models.Ingredient(
        ingredient_name=clean_name,
        category=payload.category or "n/a",
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
        parent_meal_id=meal_data.parent_meal_id,
        status=meal_data.status,
        calories_per_serving=meal_data.calories_per_serving,
        nutritional_score=meal_data.nutritional_score,
        price_per_serving=meal_data.price_per_serving,
    )

    db.add(new_meal)
    db.flush()

    for item in meal_data.ingredients:
        ing_id = item.ingredient_id

        # Fallback: handle ingredients added purely by text name
        if not ing_id and item.ingredient_name:
            clean_name = item.ingredient_name.strip()
            db_ing = (
                db.query(models.Ingredient)
                .filter(models.Ingredient.ingredient_name.ilike(clean_name))
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
                    ingredient_quantity=item.ingredient_quantity if item.ingredient_quantity is not None else 1.0,
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
def get_client_assignments(
    client_id: int, db: Session = Depends(database.get_db)
):
    client = (
        db.query(models.Client)
        .filter(models.Client.client_id == client_id)
        .first()
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID {client_id} not found",
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

    today = date.today()
    today_str = today.isoformat()  # String format for safe DB string comparison
    needs_commit = False
    checked_meal_ids = set()

    for assignment in assignments:
        # Safely parse assignment_date
        asgn_date = (
            date.fromisoformat(assignment.assignment_date)
            if isinstance(assignment.assignment_date, str)
            else assignment.assignment_date
        )

        # Update assignment status if scheduled on or before today
        if asgn_date <= today and assignment.status == "Scheduled":
            assignment.status = "Active"
            needs_commit = True

        # Check if the assigned meal needs to transition to "Active"
        meal = assignment.meal
        if meal and meal.meal_id not in checked_meal_ids:
            checked_meal_ids.add(meal.meal_id)

            if meal.status != "Active" and meal.status != "Archived":
                # Use today_str for safe string comparison in SQLite
                has_active_trigger = (
                    db.query(models.MealAssignment)
                    .filter(
                        models.MealAssignment.meal_id == meal.meal_id,
                        models.MealAssignment.assignment_date <= today_str,
                    )
                    .first()
                ) is not None

                if has_active_trigger:
                    meal.status = "Active"
                    needs_commit = True

    if needs_commit:
        db.commit()

    result = []
    for assignment in assignments:
        result.append(
            {
                "assignment_id": assignment.id,
                "client_id": assignment.client_id,
                "assignment_date": assignment.assignment_date,
                "status": assignment.status,
                "price_per_serving": getattr(
                    assignment, "price_per_serving", 0.0
                ),
                # If meal is None, return null safely instead of skipping
                "meal": format_meal(assignment.meal)
                if assignment.meal
                else None,
            }
        )

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

# get meals only for current week
@app.get("/api/client/{client_id}/assignments/week")
def get_client_weekly_assignments(client_id: int, db: Session = Depends(database.get_db)):

    client = db.query(models.Client).filter(models.Client.client_id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Client with ID {client_id} not found"
        )

    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())  # Monday
    end_of_week = start_of_week + timedelta(days=6)          # Sunday

    assignments = (
        db.query(models.MealAssignment)
        .options(
            joinedload(models.MealAssignment.meal)
            .joinedload(models.Meal.meal_ingredients)
            .joinedload(models.MealIngredients.ingredient)
        )
        .filter(
            models.MealAssignment.client_id == client_id,
            models.MealAssignment.assignment_date >= start_of_week,
            models.MealAssignment.assignment_date <= end_of_week,
        )
        .order_by(models.MealAssignment.assignment_date.asc())
        .all()
    )

    needs_commit = False
    checked_meal_ids = set()

    for assignment in assignments:
        

        asgn_date = (
                    date.fromisoformat(assignment.assignment_date)
                    if isinstance(assignment.assignment_date, str)
                    else assignment.assignment_date
                )
        
        if asgn_date <= today and assignment.status == "Scheduled":
            assignment.status = "Active"
            needs_commit = True

        meal = assignment.meal
        if meal and meal.meal_id not in checked_meal_ids:
            checked_meal_ids.add(meal.meal_id)

            if meal.status != "Active" and meal.status != "Archived":
                has_active_trigger = (
                    db.query(models.MealAssignment)
                    .filter(
                        models.MealAssignment.meal_id == meal.meal_id,
                        models.MealAssignment.assignment_date <= today
                    )
                    .first()
                ) is not None

                if has_active_trigger:
                    meal.status = "Active"
                    needs_commit = True

    if needs_commit:
        db.commit()

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

# not using anywhere tbh --> prob delete soon
@app.get("/api/client/menu/current/{client_id}")
def get_current_menu(client_id: int, db: Session = Depends(database.get_db)):
    # Fetch latest assignment with pre-loaded meal and ingredients 
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

    
    formatted_meal = format_meal(meal)
    
    return {
        "assignment_id": assignment.id,
        "client_id": assignment.client_id,
        "assignment_date": str(assignment.assignment_date),
        "assignment_status": assignment.status,
        "assignment_price_per_serving": assignment.price_per_serving,
        **formatted_meal
    }


# EXHANGE LOG REFAC
@app.post("/api/chat/regenerate-meal", response_model=RegenerateResponse)
def regenerate_meal_options(
    request: RegenerateRequest, db: Session = Depends(database.get_db)
):
    # Fetch meal with eager-loaded ingredients
    meal = (
        db.query(models.Meal)
        .options(
            joinedload(models.Meal.meal_ingredients).joinedload(
                models.MealIngredients.ingredient
            )
        )
        .filter(models.Meal.meal_id == request.meal_id)
        .first()
    )

    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Meal not found"
        )

    # Extract ingredient list correctly from relational model
    ingredient_names = [
        mi.ingredient.ingredient_name
        for mi in meal.meal_ingredients
        if mi.ingredient
    ]
    original_ingredients_str = (
        ", ".join(ingredient_names) if ingredient_names else "Not specified"
    )

    system_prompt = f"""
        You are an expert AI meal planning and recipe adjustment assistant. 

        ### PRIMARY OBJECTIVES
        1. **Adjust Current Meal (`edited_meal`)**:
           - **Substitutions**: Replace any missing/unavailable ingredients with nutritionally and culinary equivalent substitutes suited for institutional kitchen scale.
           - **Ratio & Quantity Adjustment**: If an ingredient is listed as low-stock/insufficient, adjust recipe proportions accordingly to preserve volume, flavor, and nutrition.
        2. **Generate Alternatives (`alternatives`)**:
           - Propose exactly **2 distinct alternative meal options** that completely avoid all unavailable ingredients.
        3. **Conversational Summary (`reply`)**:
           - Provide a concise culinary explanation summarizing adaptations made and highlighting the 2 alternative options.
        4. **Per-Serving Quantities:** All ingredient quantities (`ingredient_quantity`) MUST be calculated and returned for exactly **ONE serving** (base recipe unit), NOT the total batch size.
        
        Follow these strict versioning rules when generating or modifying meals:
        1. **Original Version:** Brand new meal generations are considered the base version and should NOT have a version suffix in their name (e.g., "Garlic Herb Chicken").
        2. **Subsequent Versions:** When a user requests an adjustment, modification, or iteration to an existing meal, increment the version sequentially (e.g., "Garlic Herb Chicken v2", "Garlic Herb Chicken v3").
        3. **Metadata Tracking:** Always include a `version_number` integer (1 for original, 2 for v2, etc.) and a `version_label` string (e.g., "", "v2", "v3") in your JSON response structure.
        
        
        ### REQUIRED JSON OUTPUT FORMAT
        You MUST reply strictly with a valid JSON object matching this structure:
        {{
            "reply": "A brief message to the user explaining the adjustments made.",
            "edited_meal": {{
                "meal_id": {meal.meal_id},
                "meal_name": "Adjusted Meal Name",
                "calories_per_serving": {meal.calories_per_serving or 500},
                "nutritional_score": "{meal.nutritional_score or '8.0'}",
                "ingredients": [
                    {{
                        "ingredient_name": "Ingredient 1",
                        "ingredient_quantity": 1.5,
                        "unit": "cups"
                    }}
                ],
                "is_edited_original": true
            }},
            "alternatives": [
                {{
                    "meal_id": 9901,
                    "meal_name": "New Dish Name",
                    "calories_per_serving": 520,
                    "nutritional_score": "8.5",
                    "ingredients": [
                        {{
                            "ingredient_name": "Ingredient A",
                            "ingredient_quantity": 2.0,
                            "unit": "tbsp"
                        }}
                    ],
                    "is_alternative": true
                }}
            ]
        }} 
    """

    messages = [{"role": "system", "content": system_prompt}]

    # Format previous chat history
    for msg in request.chat_history:
        role = "assistant" if msg.role == "assistant" else "user"
        messages.append({"role": role, "content": msg.content})

    # Append current context and constraints
    user_context = f"""
        Current Meal Name: {meal.meal_name} (ID: {meal.meal_id})
        Current Ingredients: {original_ingredients_str}
        Target Servings: {request.servings}
        Unavailable Ingredients to Replace: {', '.join(request.unavailable_ingredients) or 'None'}
        Insufficient Ingredients to Reduce/Replace: {', '.join(request.insufficient_ingredients) or 'None'}
        User Request: {request.user_prompt or 'Generate alternative meal options based on constraints.'}
    """
    messages.append({"role": "user", "content": user_context})

    # Call Groq API with JSON mode
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
        )

        response_text = completion.choices[0].message.content
        parsed_data = json.loads(response_text)

        return RegenerateResponse(**parsed_data)

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Groq LLM returned malformed JSON string.",
        )
    except ValidationError as ve:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"LLM JSON schema mismatch: {ve.errors()}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Groq API Error: {str(e)}",
        )

# UNTESTED
@app.post("/api/client/menu/apply-selection")
def apply_meal_selection(
    request: ApplySelectionRequest, db: Session = Depends(database.get_db)
):
    # Fetch assignment record
    assignment = (
        db.query(models.MealAssignment)
        .filter(
            models.MealAssignment.client_id == request.client_id,
            models.MealAssignment.assignment_date == request.assignment_date,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No meal assignment found for client {request.client_id} on {request.assignment_date}",
        )

    previous_meal_id = assignment.meal_id
    selected = request.selected_meal or {}

    raw_meal_id = selected.get("meal_id")
    is_edited = selected.get("is_edited_original", False)
    is_alternative = selected.get("is_alternative", False)

    # Check if this meal exists in DB
    existing_meal = None
    if raw_meal_id and not is_edited and not is_alternative:
        existing_meal = (
            db.query(models.Meal)
            .filter(models.Meal.meal_id == raw_meal_id)
            .first()
        )

    # Determine if we need to persist a NEW meal or use an existing one
    if existing_meal:
        chosen_meal = existing_meal
    else:
        # Create a new Meal record in DB
        chosen_meal = models.Meal(
            meal_name=selected.get("meal_name", "Adapted Meal").strip(),
            parent_meal_id=previous_meal_id if is_edited else None,
            status="Active",
            calories_per_serving=selected.get("calories_per_serving"),
            nutritional_score=str(selected.get("nutritional_score", "8.0")),
        )
        db.add(chosen_meal)
        db.flush()  # Generates chosen_meal.meal_id

        # Attach ingredients to join table (models.MealIngredients)
        ingredient_list = selected.get("ingredients", [])
        for ing_item in ingredient_list:
            # Handle both dictionary objects (with quantity/unit) and raw strings
            if isinstance(ing_item, dict):
                ing_name = str(ing_item.get("ingredient_name", "")).strip()
                
                raw_qty = ing_item.get("ingredient_quantity")
                if raw_qty is None:
                    raw_qty = ing_item.get("quantity", 1.0)
                try:
                    ingredient_quantity = float(raw_qty)
                except (ValueError, TypeError):
                    ingredient_quantity = 1.0
                
                ing_unit = str(ing_item.get("unit", "unit")).strip() or "unit"
            else:
                ing_name = str(ing_item).strip()
                ingredient_quantity = 1.0
                ing_unit = "unit"

            if not ing_name:
                continue

            # Lookup existing ingredient or create new one
            db_ing = (
                db.query(models.Ingredient)
                .filter(models.Ingredient.ingredient_name.ilike(ing_name))
                .first()
            )
            if not db_ing:
                db_ing = models.Ingredient(ingredient_name=ing_name)
                db.add(db_ing)
                db.flush()

            db.add(
                models.MealIngredients(
                    meal_id=chosen_meal.meal_id,
                    ingredient_id=db_ing.ingredient_id,
                    ingredient_quantity=ingredient_quantity,
                    unit=ing_unit,
                )
            )

    # Update the assignment to point to chosen_meal
    assignment.meal_id = chosen_meal.meal_id
    chosen_meal.status = "Active"
    db.flush()

    log = (
        db.query(models.MealAssignmentLog)
        .filter(models.MealAssignmentLog.assignment_id == assignment.id)
        .first()
    )

    history_entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": "SWAP_SELECTION",
        "previous_meal_id": previous_meal_id,
        "new_meal_id": chosen_meal.meal_id,
        "source": "AI_SELECTION_APPLIED",
    }

    if log:
        if previous_meal_id and previous_meal_id != chosen_meal.meal_id:
            old_ids = list(log.old_meal_ids or [])
            if previous_meal_id not in old_ids:
                old_ids.append(previous_meal_id)
            log.old_meal_ids = old_ids

        history = list(log.change_history or [])
        history.append(history_entry)
        log.change_history = history
        log.current_meal_id = chosen_meal.meal_id
        log.action = "SWAP"
    else:
        log = models.MealAssignmentLog(
            assignment_id=assignment.id,
            client_id=request.client_id,
            assignment_date=request.assignment_date,
            current_meal_id=chosen_meal.meal_id,
            old_meal_ids=[previous_meal_id]
            if previous_meal_id and previous_meal_id != chosen_meal.meal_id
            else [],
            change_history=[history_entry],
            action="SWAP" if previous_meal_id else "ASSIGN",
            source="AI_SELECTION_APPLIED",
        )
        db.add(log)

    # Clean up previous meal status if no other active assignments use it
    if previous_meal_id and previous_meal_id != chosen_meal.meal_id:
        remaining_assignments = (
            db.query(models.MealAssignment)
            .filter(models.MealAssignment.meal_id == previous_meal_id)
            .first()
        )
        if not remaining_assignments:
            prev_meal = (
                db.query(models.Meal)
                .filter(models.Meal.meal_id == previous_meal_id)
                .first()
            )
            if prev_meal and prev_meal.status != "Archived":
                prev_meal.status = "Draft"

    db.commit()

    # Eager load full meal details for UI return payload
    final_meal = (
        db.query(models.Meal)
        .options(
            joinedload(models.Meal.meal_ingredients).joinedload(
                models.MealIngredients.ingredient
            )
        )
        .filter(models.Meal.meal_id == chosen_meal.meal_id)
        .first()
    )

    return {
        "message": "Meal selection successfully applied to assignment.",
        "assignment_id": assignment.id,
        "assignment_date": str(request.assignment_date),
        "assigned_meal": format_meal(final_meal),
    }

# Fetch all clients (used for dropdowns/modals in frontend)
@app.get("/api/clients", response_model=List[ClientResponse])
def get_all_clients(db: Session = Depends(database.get_db)):
    return db.query(models.Client).order_by(models.Client.client_name.asc()).all()


#basic chat edpoint
@app.post("/api/client/menu/chat")
def chat_with_groq(
    request: ChatRequest, db: Session = Depends(database.get_db)
):
    # 1. Fetch current context (assigned meal for this day)
    assignment = (
        db.query(models.MealAssignment)
        .filter(
            models.MealAssignment.client_id == request.client_id,
            models.MealAssignment.assignment_date == request.assignment_date,
        )
        .first()
    )

    current_meal_info = "No meal currently assigned."
    if assignment and assignment.meal:
        current_meal_info = (
            f"Current meal: '{assignment.meal.meal_name}' "
            f"({assignment.meal.calories_per_serving or 'N/A'} kcal)."
        )

    # Build system prompt with meal context
    system_prompt = (
        "You are an AI nutrition and meal planning assistant. "
        f"You are talking with client ID {request.client_id} regarding their menu for {request.assignment_date}. "
        f"{current_meal_info} "
        "Provide concise, practical, and friendly answers to questions about ingredients, substitutions, or menu tweaks."
    )

    # Call Groq API
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message},
            ],
            temperature=0.7,
            max_tokens=400,
        )

        response_text = completion.choices[0].message.content

        return {
            "response": response_text,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Groq API Error: {str(e)}",
        )