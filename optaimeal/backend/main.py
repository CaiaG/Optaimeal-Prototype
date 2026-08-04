from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date, datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from database import Base 

from typing import Dict, Any, List, Union

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

meals = [
        { "id": 0, "meal_name": "Gobbeldy Gook", "recipe_id": 101, "status": "Active", "calories": 450, "nutritional_score": 3.5, "ingredients": ["water", "beans", "maize"],
            "assignment_date": "2026-07-01", "client_ids": [10], "estimated_cost": 12},
        { "id": 1,"meal_name": "Codswallop","recipe_id": 102,"status": "Draft","calories": 520,"nutritional_score": 8.0,"ingredients": ["fish", "potatoes"],
            "assignment_date": "2026-07-02","client_ids": [13, 14],"estimated_cost": 3},
        { "id": 2,"meal_name": "Balderdash","recipe_id": 103,"status": "Archived","calories": 349,"nutritional_score": 2.0,"ingredients": ["rice", "lentils", "carrots"],
            "assignment_date": "2026-07-03","client_ids": [14-19],"estimated_cost": 3 },
        { "id": 3, "meal_name": "Stinky Winky","recipe_id": 104,"status": "Active","calories": 610,"nutritional_score": 9.5,"ingredients": ["beef", "onions", "tomatoes"],
            "assignment_date": "2026-07-04","client_ids": [20-23],"estimated_cost": 99},
        { "id": 4, "meal_name": "Bubble and Squeak","recipe_id": 105,"status": "Draft","calories": 983,"nutritional_score": 5.0,"ingredients": ["cabbage", "potatoes", "leftover greens"],
            "assignment_date": "2026-07-05","client_ids": [15, 24-26],"estimated_cost": 193 }
    ]

@app.get("/")
def read_root():
    return {"message": "Welcome to the OPTAIMEAL Backend"}

# operator routes

# get meal details given meal id
@app.get("/api/meal/{meal_id}")
def get_meal_details(meal_id: int, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return meal

class MealCreate(BaseModel):
    meal_name: str
    calories_per_serving: float
    nutritional_score: float
    ingredients: Union[List[str], str]
    status: str = "Draft"


# Update meal details given meal id
@app.put("/api/meal/{meal_id}")
def update_meal(meal_id: int, meal_data: MealCreate, db: Session = Depends(database.get_db)):
    existing_meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    
    if not existing_meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    existing_meal.meal_name = meal_data.meal_name
    existing_meal.status = meal_data.status
    existing_meal.ingredients = (
        ", ".join(meal_data.ingredients) 
        if isinstance(meal_data.ingredients, list) 
        else meal_data.ingredients
    )
    existing_meal.calories_per_serving = meal_data.calories_per_serving
    existing_meal.nutritional_score = meal_data.nutritional_score

    db.commit()
    db.refresh(existing_meal)
    
    return existing_meal

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

    # Prevent assigning archived meals if you have an Archived status, but allow Draft and Active
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
        previous_meal = db.query(models.Meal).filter(models.Meal.meal_id == existing_assignment.meal_id).first()
        
        existing_assignment.meal_id = request.meal_id
        was_overwritten = True

        db.flush()

        # Revert previous meal to "Draft" ONLY if no other active assignments still reference it
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
        "overwritten": was_overwritten
    }

class ExchangeLog(Base):
    __tablename__ = "exchange_logs"
    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.id"))
    timestamp = Column(DateTime)
    client_changes = Column(String)

# Access accumulated reports of client changes.
@app.get("/api/operator/menu/analytics")
def get_menu_analytics(db: Session = Depends(database.get_db)):
    
    logs = db.query(models.ExchangeLog).all()
    
    if not logs:
        return {"message": "No implementation reports available yet."}
        
    return logs

# Retrieve list of all ingredients
@app.get("/api/ingredients")
def get_all_ingredients(db: Session = Depends(database.get_db)):
    ingredients = db.query(models.Ingredient).all()
    if not ingredients:
        return {"message": "No ingredients found in the database."}
        
    return ingredients

# retrieve list of all meals on backend
@app.get("/api/meals")
def get_all_meals(db: Session = Depends(database.get_db)):
    meals = db.query(models.Meal).all()
    if not meals:
            return {"message": "No meals found in the database."}
            
    return meals

# post new meal without a given id
@app.post("/api/meal")
def create_meal(meal_data: MealCreate, db: Session = Depends(database.get_db)):
    formatted_ingredients = (
        ", ".join(meal_data.ingredients) 
        if isinstance(meal_data.ingredients, list) 
        else meal_data.ingredients
    )

    new_meal = models.Meal(
        meal_name=meal_data.meal_name,
        calories_per_serving=meal_data.calories_per_serving,
        nutritional_score=meal_data.nutritional_score,
        ingredients=formatted_ingredients,
        status=meal_data.status,
    )
    
    db.add(new_meal)
    
    db.commit()
    
    db.refresh(new_meal)
    
    return new_meal

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
        "assignment_date": str(assignment.assignment_date), # Attach the date here!
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
    meal = db.query(models.Meal).filter(models.Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Original meal not found")

    latest_log = db.query(models.ExchangeLog).filter(
        models.ExchangeLog.meal_id == meal_id
    ).order_by(models.ExchangeLog.timestamp.desc()).first()

    if not latest_log:
        raise HTTPException(status_code=400, detail="No reported constraints found to optimize against.")

    optimized_suggestion = {
        "original_meal_id": meal.id,
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