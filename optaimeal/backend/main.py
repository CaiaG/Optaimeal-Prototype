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
        { "day": "Monday", "date": "2026-06-22", "meal_name": "Gobbeldy Gook", "calories": 450, "ingredients": ["aadffa", "onpasj", "oihohoi"] },
        { "day": "Tuesday", "date": "2026-06-23", "meal_name": "Codswallop", "calories": 312, "ingredients": ["ajkbc"] },
        { "day": "Wednesday", "date": "2026-06-23", "meal_name": "Balderdash", "calories": 5, "ingredients": ["ljdvh"] },
        { "day": "Thursday", "date": "2026-06-23", "meal_name": "Stinky Winky", "calories": 17, "ingredients": ["bndakv"] },
        { "day": "Friday", "date": "2026-06-23", "meal_name": "Bubble and Squeak", "calories": 723, "ingredients": ["bwg e"] },
        { "day": "Saturday", "date": "2026-06-23", "meal_name": "Upsy Daisy", "calories": 222, "ingredients": ["ph ei "] },
        { "day": "Sunday", "date": "2026-06-23", "meal_name": "Mud", "calories": 821, "ingredients": ["oqhtn"] },
    ]

@app.get("POST /api/client/menu/adjust")
def adjust_current_menu():
    return

