from sqlalchemy import Column, Integer, String, Float, JSON
from database import Base

class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default="Draft") 
    recipe_id = Column(String, index=True)
    recipe_name = Column(String)
    calories_per_serving = Column(Float)
    nutritional_score = Column(Float)

    ingredients = Column(JSON) 
    client_id_list = Column(JSON)
    assignment_date = Column(String) 

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    price_per_unit = Column(Float)
    location = Column(String)
    season = Column(String)
    availability = Column(String)