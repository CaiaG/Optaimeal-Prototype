"""
state_machine.py

Centralizes all Meal / MealAssignment lifecycle logic (TODO item 4).
Two decoupled state machines:

  MealAssignment.status  (time-driven)   Scheduled -> Locked -> Archived
  Meal.status             (usage-driven) Draft <-> Active -> Archived

Nothing in main.py should set `.status` directly anymore, or compare
assignment_date/status manually - route through the helpers below so
the rules only live in one place.
"""

from datetime import date, datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

import models


# ==========================================
# Status constants
# ==========================================

class AssignmentStatus:
    SCHEDULED = "Scheduled"
    LOCKED = "Locked"
    ARCHIVED = "Archived"


class MealStatus:
    DRAFT = "Draft"
    ACTIVE = "Active"
    ARCHIVED = "Archived"


# ==========================================
# Assignment status: time-driven
# ==========================================

def _monday_of(d: date) -> date:
    """Return the Monday that starts d's week."""
    return d - timedelta(days=d.weekday())


def week_lock_boundary(assignment_date: date) -> datetime:
    """
    The whole week containing assignment_date locks together, 24h before
    that week's Monday (per spec, not per individual day).
    """
    monday = _monday_of(assignment_date)
    return datetime.combine(monday, datetime.min.time()) - timedelta(hours=24)


def resolve_assignment_status(assignment_date: date, now: Optional[datetime] = None) -> str:
    """
    Pure function: given a date, what SHOULD the assignment's status be right now?
    Does not touch the DB - callers persist the result via sync_assignment_status.
    """
    now = now or datetime.utcnow()
    today = now.date()

    if assignment_date < today:
        return AssignmentStatus.ARCHIVED

    if now >= week_lock_boundary(assignment_date):
        return AssignmentStatus.LOCKED

    return AssignmentStatus.SCHEDULED


def sync_assignment_status(assignment: "models.MealAssignment", now: Optional[datetime] = None) -> bool:
    """
    Lazily correct a single assignment's status in-place.
    Returns True if the status changed (caller is responsible for db.commit()).
    """
    asgn_date = (
        date.fromisoformat(assignment.assignment_date)
        if isinstance(assignment.assignment_date, str)
        else assignment.assignment_date
    )

    correct_status = resolve_assignment_status(asgn_date, now=now)
    if assignment.status != correct_status:
        assignment.status = correct_status
        return True
    return False


def sync_assignments(assignments: list, db: Session, now: Optional[datetime] = None) -> None:
    """Batch helper for list endpoints - syncs assignment status, then meal status, commits once."""
    changed = False
    touched_meals = set()

    for assignment in assignments:
        if sync_assignment_status(assignment, now=now):
            changed = True
        if assignment.meal_id:
            touched_meals.add(assignment.meal_id)

    for meal_id in touched_meals:
        meal = db.query(models.Meal).filter(models.Meal.meal_id == meal_id).first()
        if meal and sync_meal_status(meal, db):
            changed = True

    if changed:
        db.commit()


# ==========================================
# Meal status: usage-driven
# ==========================================

def meal_has_live_assignment(meal_id: int, db: Session) -> bool:
    """A meal is 'in use' if it's referenced by any non-Archived assignment."""
    return (
        db.query(models.MealAssignment)
        .filter(
            models.MealAssignment.meal_id == meal_id,
            models.MealAssignment.status != AssignmentStatus.ARCHIVED,
        )
        .first()
        is not None
    )


def sync_meal_status(meal: "models.Meal", db: Session) -> bool:
    """
    Auto-manage Draft <-> Active based on usage.
    Archived is a manual, one-way operator action and is never touched here -
    an Archived meal stays Archived even if all its assignments later change.
    Returns True if status changed.
    """
    if meal.status == MealStatus.ARCHIVED:
        return False

    should_be_active = meal_has_live_assignment(meal.meal_id, db)
    correct_status = MealStatus.ACTIVE if should_be_active else MealStatus.DRAFT

    if meal.status != correct_status:
        meal.status = correct_status
        return True
    return False


# ==========================================
# Permission checks
# ==========================================

def can_operator_edit_assignment(assignment: "models.MealAssignment") -> bool:
    return assignment.status == AssignmentStatus.SCHEDULED


def can_client_edit_assignment(assignment: "models.MealAssignment") -> bool:
    return assignment.status == AssignmentStatus.LOCKED


def can_edit_meal_in_place(meal: "models.Meal") -> bool:
    """True only for Draft meals - Active meals must be forked, Archived never edited."""
    return meal.status == MealStatus.DRAFT


def can_assign_meal(meal: "models.Meal") -> bool:
    """Archived meals can't be attached to new assignments."""
    return meal.status != MealStatus.ARCHIVED


# ==========================================
# Fork-on-edit for Active meals
# ==========================================

def fork_meal(
    db: Session,
    original: "models.Meal",
    meal_name: str,
    calories_per_serving: float,
    nutritional_score: float,
    price_per_serving: float,
    ingredients: list,
) -> "models.Meal":
    """
    Creates a new Meal row (Draft) with parent_meal_id = original.meal_id,
    copying over the given (already-edited) fields and ingredient list.
    Does NOT touch the original meal or any assignment - the caller
    (operator edit route, or apply-selection) is responsible for repointing
    only the specific assignment(s) it intends to update.
    """
    new_meal = models.Meal(
        meal_name=meal_name.strip(),
        parent_meal_id=original.meal_id,
        status=MealStatus.DRAFT,  # becomes Active automatically once assigned
        calories_per_serving=calories_per_serving,
        nutritional_score=nutritional_score,
        price_per_serving=price_per_serving,
    )
    db.add(new_meal)
    db.flush()

    for item in ingredients:
        ing_id = item.get("ingredient_id")
        ing_name = (item.get("ingredient_name") or "").strip()

        if not ing_id and ing_name:
            db_ing = (
                db.query(models.Ingredient)
                .filter(models.Ingredient.ingredient_name.ilike(ing_name))
                .first()
            )
            if not db_ing:
                db_ing = models.Ingredient(ingredient_name=ing_name)
                db.add(db_ing)
                db.flush()
            ing_id = db_ing.ingredient_id

        if ing_id:
            db.add(
                models.MealIngredients(
                    meal_id=new_meal.meal_id,
                    ingredient_id=ing_id,
                    ingredient_quantity=round(float(item.get("ingredient_quantity", 1.0)), 2),
                    unit=item.get("unit") or "unit",
                )
            )

    return new_meal