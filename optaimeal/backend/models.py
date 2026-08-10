from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, UniqueConstraint, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Meal(Base):
    __tablename__ = "meals"

    meal_id = Column(Integer, primary_key=True, index=True)
    meal_name = Column(String, index=True)
    status = Column(String, default="Draft")
    calories_per_serving = Column(Float)
    nutritional_score = Column(Float)
    price_per_serving = Column(Float, nullable=True, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    meal_ingredients = relationship(
        "MealIngredients",
        back_populates="meal",
        cascade="all, delete-orphan"
    )

    assignments = relationship("MealAssignment", back_populates="meal")


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
    category = Column(String, nullable=True)
    unit = Column(String, default="unit")
    price_per_unit = Column(Float, nullable=True)
    location = Column(String, nullable=True)
    season = Column(String, nullable=True)
    availability = Column(String, nullable=True)

    substitutes = Column(JSON, nullable=True, default=list)
    # maybe a list of possible substitutes?

# client id & assignment date pairs should be unique
class MealAssignment(Base):
    __tablename__ = "meal_assignments"
    __table_args__ = (
        UniqueConstraint(
            "client_id", "assignment_date", name="uq_client_assignment_date"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(
        Integer, ForeignKey("clients.client_id", ondelete="CASCADE"), index=True
    )
    meal_id = Column(
        Integer, ForeignKey("meals.meal_id", ondelete="CASCADE"), index=True
    )
    assignment_date = Column(String, index=True)  # Format: YYYY-MM-DD
    status = Column(String, default="Draft")
    price_per_serving = Column(Float, nullable=True, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    client = relationship("Client", back_populates="assignments")
    meal = relationship("Meal", back_populates="assignments")

class Client(Base):
    __tablename__ = "clients"

    client_id = Column(Integer, primary_key=True, index=True)
    client_name = Column(String, nullable=False)
    contact_email = Column(String, nullable=True)
    location = Column(String, nullable=True)
    population = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    assignments = relationship(
        "MealAssignment", back_populates="client", cascade="all, delete-orphan"
    )
   
class ExchangeLog(Base):
    __tablename__ = "exchange_logs"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(
        Integer, ForeignKey("meals.meal_id", ondelete="SET NULL"), nullable=True
    )
    client_id = Column(
        Integer, ForeignKey("clients.client_id", ondelete="SET NULL"), nullable=True
    )
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    action = Column(String, nullable=True)  # e.g., "SWAP", "DELETE", "UPDATE"
    client_changes = Column(Text, nullable=True)