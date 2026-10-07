import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.database.session import Base, engine
from app import models  # noqa: F401 ensures all models are registered
from app import tools  # noqa: F401 ensures all tools are registered
from app.api.routes import (
    agent,
    approvals,
    audit,
    auth,
    business,
    crm,
    dashboard,
    documents,
    finance,
    notifications,
    tasks,
    workflows,
)
from app.services import scheduler_service
from app.services.browser_service import shutdown_worker as shutdown_browser_worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")
    scheduler_service.load_all_workflows()
    logger.info("Workflow scheduler started.")
    yield
    scheduler_service.shutdown_scheduler()
    shutdown_browser_worker()


app = FastAPI(title="AI Operations Agent", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak internal stack traces to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "An internal server error occurred."})


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(business.router)
app.include_router(crm.router)
app.include_router(tasks.router)
app.include_router(finance.router)
app.include_router(documents.router)
app.include_router(agent.router)
app.include_router(approvals.router)
app.include_router(audit.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(workflows.router)
