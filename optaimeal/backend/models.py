from sqlalchemy import Column, Integer, String, Float, JSON
from database import Base

class Meal(Base):
    __tablename__ = "meals"

    meal_id = Column(Integer, primary_key=True, index=True)
    meal_name = Column(String, index=True)
    status = Column(String, default="Draft")
    ingredients = Column(String);
    calories_per_serving = Column(Float)
    nutritional_score = Column(Float)
    assignment_date= Column(String)


class MealIngredients(Base):
    __tablename__ = "meal_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, index=True)
    ingredient_id = Column(Integer, index=True)
    ingredient_quantity = Column(Float)


class Ingredient(Base):
    __tablename__ = "ingredients"

    ingredient_id = Column(Integer, primary_key=True, index=True)
    ingredient_name = Column(String, index=True)
    price_per_unit = Column(Float)
    location = Column(String)
    season = Column(String)
    availability = Column(String)
    # maybe a list of possible substitutes?

# client id & assignment date pairs should be unique
class MealAssignment(Base):
    __tablename__ = "meal_assignments"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, index=True)
    meal_id = Column(Integer)
    assignment_date = Column(String)
    status = Column(String, default="Draft")

class Client(Base):
    __tablename__ = "clients"

    client_id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String)
    location = Column(String)
    population = Column(Integer)
   
