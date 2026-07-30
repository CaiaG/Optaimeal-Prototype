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

@app.get("/api/client/menu/current")
def get_current_menu():
    return meals

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
    assignment_date: str


# Update meal details given meal id
@app.put("/api/meal/{meal_id}")
def update_meal(meal_id: int, meal_data: MealCreate, db: Session = Depends(database.get_db)):
    existing_meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
    
    if not existing_meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    existing_meal.meal_name = meal_data.meal_name
    existing_meal.status = meal_data.status
    existing_meal.ingredients = ", ".join(meal_data.ingredients) if isinstance(meal_data.ingredients, list) else meal_data.ingredients
    existing_meal.calories_per_serving = meal_data.calories_per_serving
    existing_meal.nutritional_score = meal_data.nutritional_score
    existing_meal.assignment_date = meal_data.assignment_date

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
    meal = db.query(models.Meal).filter(models.Meal.id == request.meal_id).first()

    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    if meal.status != "Draft":
        raise HTTPException(status_code=400, detail="Only draft menus can be assigned")

    new_assignment = models.MealAssignment(
        client_id=request.client_id,
        meal_id=request.meal_id,
        assignment_date=request.assignment_date
    )
    db.add(new_assignment)

    meal.status = "Active"
    
    db.commit()
    return {"message": f"Meal {request.meal_id} successfully assigned to client {request.client_id}"}

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

@app.post("/api/meals")
def create_meal(meal_data: MealCreate, db: Session = Depends(database.get_db)):
    new_meal = models.Meal(
        meal_name=meal_data.meal_name,
        calories_per_serving=meal_data.calories_per_serving,
        nutritional_score=meal_data.nutritional_score,
        ingredients=", ".join(meal_data.ingredients),
        status=meal_data.status,
        assignment_date=meal_data.assignment_date
    )
    
    db.add(new_meal)
    
    db.commit()
    
    db.refresh(new_meal)
    
    return new_meal

# client routes

#  Fetch the daily/weekly menu assigned to the authenticated client based on their id.
@app.get("/api/client/menu/current/{client_id}")
def get_current_menu(client_id: int, db: Session = Depends(database.get_db)):
    assignment = db.query(models.MealAssignment).filter(
        models.MealAssignment.client_id == client_id
    ).order_by(models.MealAssignment.assignment_date.desc()).first()

    if not assignment:
        raise HTTPException(status_code=404, detail="No menu assigned to this client.")
    meal = db.query(models.Meal).filter(
        models.Meal.id == assignment.meal_id,
        models.Meal.status == "Active"
    ).first()

    if not meal:
        raise HTTPException(status_code=404, detail="Active menu not found.")

    return meal

class MealAdjustmentRequest(BaseModel):
    meal_id: int
    adjustments: Dict[str, Any]

#  Send real-time changes (e.g., ingredient availability, quantity adjustments) back to the backend.
@app.post("/api/client/menu/adjust")
def adjust_client_menu(request: MealAdjustmentRequest, db: Session = Depends(database.get_db)):
    meal = db.query(models.Meal).filter(models.Meal.id == request.meal_id).first()
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