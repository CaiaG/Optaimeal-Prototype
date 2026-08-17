

"""
analytics.py

Centralizes operator-facing "menu analytics" logic (TODO item 1 / the
UNIMPLEMENTED GET /api/operator/menu/analytics route).

Source of truth is MealAssignmentLog.change_history - every operator
assignment/overwrite and every client swap (apply-selection) already
appends a timestamped entry there (see main.py). This module doesn't
write any new data; it reads, filters, and aggregates what's already
being logged.

Two rules from the spec live here so they aren't reimplemented ad hoc
in main.py:

  1. Delayed surfacing - "the accumulated report is not available to
     the operator until 00:00 of the following day" (spec, State
     Management Ideas #2). A change made on day D should only appear
     in analytics starting at local midnight of D+1.
  2. Source taxonomy - collapsing the various raw `source` strings
     written by different routes (OPERATOR_UPDATE, AI_SELECTION_APPLIED,
     ...) into a single CLIENT vs OPERATOR distinction, since the spec's
     ask is specifically "changes from the client side" being reported
     to the operator.

Nothing in main.py should hand-roll change_history filtering or
source-string comparisons anymore - route through the helpers below.
"""

from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any
from collections import Counter

from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from statemachine import REFERENCE_TZ, _local_now


# ==========================================
# Source taxonomy
# ==========================================

# Raw `source` values currently written by main.py routes. Extend this
# mapping (not the call sites) as new sources are added.
CLIENT_SOURCES = {"AI_SELECTION_APPLIED"}
OPERATOR_SOURCES = {"OPERATOR_UPDATE"}


def classify_source(raw_source: Optional[str]) -> str:
    """Collapse a raw log `source` string into CLIENT / OPERATOR / UNKNOWN."""
    if raw_source in CLIENT_SOURCES:
        return "CLIENT"
    if raw_source in OPERATOR_SOURCES:
        return "OPERATOR"
    return "UNKNOWN"


# ==========================================
# 00:00-next-day surfacing gate
# ==========================================

def _surface_boundary_for(entry_dt: datetime) -> datetime:
    """
    An entry timestamped on local calendar day D is surfaced starting at
    local midnight of D+1.
    """
    local_dt = entry_dt.astimezone(REFERENCE_TZ) if entry_dt.tzinfo else entry_dt.replace(tzinfo=REFERENCE_TZ)
    next_day = local_dt.date() + timedelta(days=1)
    return datetime.combine(next_day, datetime.min.time(), tzinfo=REFERENCE_TZ)


def is_surfaced(entry_timestamp: str, now: Optional[datetime] = None) -> bool:
    """
    True if a change_history entry (ISO timestamp string, as written via
    datetime.utcnow().isoformat() in main.py) should be visible to the
    operator yet.
    """
    now = _local_now(now)
    try:
        entry_dt = datetime.fromisoformat(entry_timestamp)
    except (TypeError, ValueError):
        # Malformed/missing timestamp - fail safe by surfacing it rather
        # than silently dropping data from the report.
        return True

    if entry_dt.tzinfo is None:
        # Existing entries are written with datetime.utcnow().isoformat(),
        # i.e. naive UTC - tag them as UTC before converting to local time.
        from zoneinfo import ZoneInfo
        entry_dt = entry_dt.replace(tzinfo=ZoneInfo("UTC"))

    return now >= _surface_boundary_for(entry_dt)


# ==========================================
# Flattening + aggregation
# ==========================================

def _flatten_log_entries(
    logs: List["models.MealAssignmentLog"],
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Expand each MealAssignmentLog's change_history (a JSON list) into
    individual, surfaced-only change entries enriched with client/date
    context. One MealAssignmentLog can yield 0-N entries.
    """
    now = _local_now(now)
    flattened: List[Dict[str, Any]] = []

    for log in logs:
        for raw_entry in (log.change_history or []):
            timestamp = raw_entry.get("timestamp")
            if not is_surfaced(timestamp, now=now):
                continue

            flattened.append(
                {
                    "assignment_id": log.assignment_id,
                    "client_id": log.client_id,
                    "assignment_date": str(log.assignment_date),
                    "timestamp": timestamp,
                    "action": raw_entry.get("action"),
                    "source": raw_entry.get("source"),
                    "source_category": classify_source(raw_entry.get("source")),
                    "previous_meal_id": raw_entry.get("previous_meal_id"),
                    "new_meal_id": raw_entry.get("new_meal_id") or raw_entry.get("meal_id"),
                }
            )

    flattened.sort(key=lambda e: e["timestamp"] or "", reverse=True)
    return flattened

def _flatten_change_logs(
    change_logs: List["models.ChangeLog"],
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Expand each ChangeLog record into individual, surfaced-only recipe
    modification entries.
    """
    now = _local_now(now)
    flattened: List[Dict[str, Any]] = []

    for clog in change_logs:
        timestamp = clog.timestamp
        if timestamp is None:
            continue

        timestamp_str = timestamp.isoformat() if isinstance(timestamp, datetime) else str(timestamp)
        if not is_surfaced(timestamp_str, now=now):
            continue

        flattened.append(
            {
                "assignment_id": None,
                "client_id": None,
                "assignment_date": None,
                "timestamp": timestamp_str,
                "action": clog.action,
                "changes": clog.changes,
                "source": "OPERATOR_UPDATE",
                "source_category": classify_source("OPERATOR_UPDATE"),
                "previous_meal_id": None,
                "new_meal_id": clog.meal_id,
            }
        )

    return flattened

def _enrich_with_names(
    entries: List[Dict[str, Any]], db: Session
) -> List[Dict[str, Any]]:
    """Attach client_name / meal names, batching lookups instead of querying per-entry."""
    client_ids = {e["client_id"] for e in entries if e["client_id"] is not None}
    meal_ids = {
        mid
        for e in entries
        for mid in (e["previous_meal_id"], e["new_meal_id"])
        if mid is not None
    }

    clients_by_id = {
        c.client_id: c.client_name
        for c in db.query(models.Client).filter(models.Client.client_id.in_(client_ids)).all()
    } if client_ids else {}

    meals_by_id = {
        m.meal_id: m.meal_name
        for m in db.query(models.Meal).filter(models.Meal.meal_id.in_(meal_ids)).all()
    } if meal_ids else {}

    for e in entries:
        e["client_name"] = clients_by_id.get(e["client_id"])
        e["previous_meal_name"] = meals_by_id.get(e["previous_meal_id"])
        e["new_meal_name"] = meals_by_id.get(e["new_meal_id"])

    return entries


def get_surfaced_change_entries(
    db: Session,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    now: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Main entry point: returns flattened, surfaced, name-enriched change
    entries from both MealAssignmentLog and ChangeLog, optionally scoped
    to a client and/or assignment_date / timestamp range.
    """
    # Fetch MealAssignmentLog entries
    assignment_query = db.query(models.MealAssignmentLog)
    if client_id is not None:
        assignment_query = assignment_query.filter(models.MealAssignmentLog.client_id == client_id)
    if start_date is not None:
        assignment_query = assignment_query.filter(models.MealAssignmentLog.assignment_date >= start_date)
    if end_date is not None:
        assignment_query = assignment_query.filter(models.MealAssignmentLog.assignment_date <= end_date)

    assignment_logs = assignment_query.all()
    assignment_entries = _flatten_log_entries(assignment_logs, now=now)

    # Fetch ChangeLog entries
    change_query = db.query(models.ChangeLog)
    if start_date is not None:
        change_query = change_query.filter(func.date(models.ChangeLog.timestamp) >= start_date)
    if end_date is not None:
        change_query = change_query.filter(func.date(models.ChangeLog.timestamp) <= end_date)
    
    if client_id is not None:
        assigned_meal_ids = (
            db.query(models.MealAssignment.meal_id)
            .filter(models.MealAssignment.client_id == client_id)
            .union(
                db.query(models.MealAssignmentLog.current_meal_id)
                .filter(models.MealAssignmentLog.client_id == client_id)
            )
            .subquery()
        )
        change_query = change_query.filter(models.ChangeLog.meal_id.in_(assigned_meal_ids))

    change_logs = change_query.all()
    change_entries = _flatten_change_logs(change_logs, now=now)

    # Combine, sort, and enrich
    all_entries = assignment_entries + change_entries
    all_entries.sort(key=lambda e: e["timestamp"] or "", reverse=True)

    return _enrich_with_names(all_entries, db)


def summarize(entries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Roll flattened entries up into operator-friendly counts."""
    action_counts = Counter(e["action"] for e in entries)
    source_counts = Counter(e["source_category"] for e in entries)
    per_client_counts = Counter(e["client_id"] for e in entries)

    return {
        "total_changes": len(entries),
        "by_action": dict(action_counts),
        "by_source": dict(source_counts),
        "by_client": [
            {"client_id": cid, "count": count} for cid, count in per_client_counts.most_common()
        ],
    }


def get_menu_analytics(
    db: Session,
    client_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Convenience wrapper combining entries + summary for the API route."""
    entries = get_surfaced_change_entries(
        db, client_id=client_id, start_date=start_date, end_date=end_date, now=now
    )
    return {
        "summary": summarize(entries),
        "entries": entries,
    }