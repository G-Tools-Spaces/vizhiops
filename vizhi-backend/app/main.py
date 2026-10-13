"""Main FastAPI application entrypoint."""

from __future__ import annotations

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import settings
from app.api.agents import router as agents_router
from app.api.agent_queue import router as agent_queue_router
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.health import router as health_router
from app.api.models import router as models_router
from app.api.queries import router as queries_router
from app.api.metrics import router as metrics_router
from app.api.dashboard import router as dashboard_router
from app.providers.http_client import close_http_client
from app.services.health_checker import (
    start_background_health_checks,
    stop_background_health_checks,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle — start provider health checks; close shared resources.

    The database schema is owned by Alembic (`alembic upgrade head` before
    the server starts); nothing here touches the database, so a cold start
    does not wait on it.
    """

    # 1. Start provider health-check background loop
    start_background_health_checks()

    yield

    # 2. On shutdown: stop health checks, close the shared HTTP client
    stop_background_health_checks()
    await close_http_client()


app = FastAPI(
    title="Vizhi API Gateway",
    description="Unified API Gateway and Query Tracking Core for AI Agents",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware for Frontend connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router)
app.include_router(agents_router)
app.include_router(agent_queue_router)
app.include_router(chat_router)
app.include_router(models_router)
app.include_router(queries_router)
app.include_router(health_router)
app.include_router(metrics_router)
app.include_router(dashboard_router)


@app.get("/")
async def root() -> dict[str, str]:
    """Health check/root endpoint."""
    return {
        "name": "Vizhi API Gateway",
        "status": "healthy",
        "version": "1.0.0",
    }
