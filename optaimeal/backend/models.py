from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, UniqueConstraint, Text, Date
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class Meal(Base):
    __tablename__ = "meals"

    meal_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meal_name = Column(String, index=True)
    
    status = Column(String, default="Draft")
    calories_per_serving = Column(Float)
    nutritional_score = Column(Float)
    price_per_serving = Column(Float, nullable=True, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    parent_meal_id = Column(
        Integer, ForeignKey("meals.meal_id", ondelete="SET NULL"), nullable=True, index=True
    )

    meal_ingredients = relationship(
        "MealIngredients",
        back_populates="meal",
        cascade="all, delete-orphan"
    )

    assignments = relationship("MealAssignment", back_populates="meal")
    change_logs = relationship("ChangeLog", back_populates="meal")


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

    # add nutrition values
    substitutes = Column(JSON, nullable=True, default=list)

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

    log = relationship(
        "MealAssignmentLog", back_populates="assignment", uselist=False, cascade="all, delete-orphan"
    )

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

# for meal edits
class ChangeLog(Base):
    """
    Tracks Recipe & Ingredient Modifications made to meals (Operator or System edits).
    """
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True, index=True)
    meal_id = Column(
        Integer, ForeignKey("meals.meal_id", ondelete="SET NULL"), nullable=True, index=True
    )
    
    action = Column(String, nullable=False)
    changes = Column(JSON, nullable=True)
    
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    meal = relationship("Meal", back_populates="change_logs")


class MealAssignmentLog(Base):
    """
    Cumulative history tracking for a single calendar assignment slot over time.
    """
    __tablename__ = "meal_assignment_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    assignment_id = Column(
        Integer,
        ForeignKey("meal_assignments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    client_id = Column(
        Integer, ForeignKey("clients.client_id", ondelete="CASCADE"), nullable=False, index=True
    )
    assignment_date = Column(Date, nullable=False, index=True)

    current_meal_id = Column(
        Integer, ForeignKey("meals.meal_id", ondelete="SET NULL"), nullable=True
    )

    old_meal_ids = Column(JSON, default=list, nullable=False)

    change_history = Column(JSON, default=list, nullable=True)

    action = Column(String, nullable=False)
    source = Column(String, nullable=True) 
    user_prompt = Column(Text, nullable=True)

    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    assignment = relationship("MealAssignment", back_populates="log")