"""Real cron scheduling for workflows (spec #37 "every day at 9 AM...") using
APScheduler's BackgroundScheduler. This runs inside the backend process, so
a scheduled workflow only fires while the backend is running -- exactly
like any other local background service (spec #31).
"""
import logging

from apscheduler.jobstores.base import JobLookupError
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database.session import SessionLocal
from app.models.business import Business
from app.models.workflow import Workflow

logger = logging.getLogger("scheduler")

_scheduler: BackgroundScheduler | None = None


def _job_id(workflow_id: str) -> str:
    return f"workflow:{workflow_id}"


def _run_scheduled_workflow(workflow_id: str) -> None:
    from app.services import workflow_service  # local import avoids a circular import at module load time

    db = SessionLocal()
    try:
        workflow = db.get(Workflow, workflow_id)
        if not workflow or not workflow.enabled:
            return
        business = db.get(Business, workflow.business_id)
        if not business:
            return
        try:
            workflow_service.execute_workflow(db, business, workflow, triggered_by="scheduler", user_id="scheduler")
        except Exception:  # noqa: BLE001
            logger.exception("Scheduled workflow %s failed to run", workflow_id)
    finally:
        db.close()


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="UTC")
        _scheduler.start()
    return _scheduler


def schedule_workflow(workflow: Workflow) -> None:
    scheduler = get_scheduler()
    job_id = _job_id(workflow.id)
    if workflow.trigger_type == "CRON" and workflow.enabled and workflow.cron_expression:
        trigger = CronTrigger.from_crontab(workflow.cron_expression, timezone="UTC")
        scheduler.add_job(_run_scheduled_workflow, trigger=trigger, args=[workflow.id], id=job_id, replace_existing=True)
    else:
        unschedule_workflow(workflow.id)


def unschedule_workflow(workflow_id: str) -> None:
    scheduler = get_scheduler()
    try:
        scheduler.remove_job(_job_id(workflow_id))
    except JobLookupError:
        pass


def load_all_workflows() -> None:
    """Called at app startup to (re)register every enabled CRON workflow."""
    db = SessionLocal()
    try:
        workflows = (
            db.query(Workflow)
            .filter(Workflow.trigger_type == "CRON", Workflow.enabled == True)  # noqa: E712
            .all()
        )
        for wf in workflows:
            try:
                schedule_workflow(wf)
            except Exception:  # noqa: BLE001
                logger.exception("Could not schedule workflow %s (%s)", wf.id, wf.cron_expression)
    finally:
        db.close()


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
