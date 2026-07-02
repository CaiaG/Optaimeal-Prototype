from fastapi import FastAPI
import models
from database import engine
from fastapi.middleware.cors import CORSMiddleware

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="OPTAIMEAL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to the OPTAIMEAL Backend"}


@app.get("/api/client/menu/current")
def get_current_menu():
    return [
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

@app.get("POST /api/client/menu/adjust")
def adjust_current_menu():
    return

  
