from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Meal(Base):
    __tablename__ = "meals"

    meal_id = Column(Integer, primary_key=True, index=True)
    meal_name = Column(String, index=True)
    status = Column(String, default="Draft")
    calories_per_serving = Column(Float)
    nutritional_score = Column(Float)

    meal_ingredients = relationship(
        "MealIngredients",
        back_populates="meal",
        cascade="all, delete-orphan"
    )


class MealIngredients(Base):
    __tablename__ = "meal_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.meal_id", ondelete="CASCADE"), index=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.ingredient_id"), index=True)
    ingredient_quantity = Column(Float, default=1.0)
    unit = Column(String, default="unit")

    # Relationships
    meal = relationship("Meal", back_populates="meal_ingredients")
    ingredient = relationship("Ingredient")


class Ingredient(Base):
    __tablename__ = "ingredients"

    ingredient_id = Column(Integer, primary_key=True, index=True)
    ingredient_name = Column(String, index=True)
    price_per_unit = Column(Float, nullable=True)
    location = Column(String, nullable=True)
    season = Column(String, nullable=True)
    availability = Column(String, nullable=True)
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
   
class ExchangeLog(Base):
    __tablename__ = "exchange_logs"
    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(Integer, ForeignKey("meals.meal_id"))
    timestamp = Column(DateTime)
    client_changes = Column(String)