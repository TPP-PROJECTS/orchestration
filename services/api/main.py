"""
TPP Orchestration API - Main Entry Point

Bootstraps the FastAPI application: registers middleware, starts background services
(MCP manager, policy engine, OpenClaw reader/gateway, MongoDB), and mounts all routers.
Human-in-the-Loop (HITL) workflow with MCP module management and provenance tracking.

Module architecture:
  modules/policy/    → knowledge rules, MongoDB: policy
  modules/messages/  → message persistence, MongoDB: messages
  modules/registry/  → component registry, MongoDB: registry
  provenance/        → event chain, MongoDB: provenance (via MongoStore)
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from middleware import HttpLoggingMiddleware
from db import MongoStore
from services.mcp_manager import mcp_manager
from services.policy_engine import policy_engine
from services.skill_manager import skill_manager
from services.message_queue import message_queue
from services.openclaw_gateway_client import OpenClawGatewayClient
from services.openclaw_local_reader import openclaw_local_reader
from provenance.events import set_mongo_store
from routers.provenance import set_mongo


# MongoDB singleton for provenance
_mongo: MongoStore | None = None

# OpenClaw gateway client singleton
_openclaw_client: OpenClawGatewayClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    global _mongo

    # Auto-load MCP servers from environment
    mcp_script = os.getenv("MCP_SERVER_SCRIPT")
    if mcp_script and os.path.exists(mcp_script):
        try:
            server_id = "medical-calculator"
            await mcp_manager.register_server(
                server_id=server_id,
                name="Medical Calculator MCP",
                script_path=mcp_script,
                description="Medical calculation tools via MCP",
                python_cmd=os.getenv("BACKEND_PYTHON"),
                env_vars={}
            )
            await mcp_manager.connect_server(server_id)
        except Exception as e:
            print(f"[API] Failed to auto-load MCP server: {e}")

    # Initialize Policy Engine
    try:
        await policy_engine.initialize()
        print("[API] Policy engine initialized")
    except Exception as e:
        print(f"[API] Failed to initialize policy engine: {e}")

    # Initialize Skill Manager (uploads SKILL.md files to Anthropic API if not cached)
    try:
        await skill_manager.initialize()
        print("[API] Skill manager initialized")
    except Exception as e:
        print(f"[API] Failed to initialize skill manager: {e}")

    # Start OpenClaw local reader (workspace files, transcripts, mDNS) — always on
    try:
        await openclaw_local_reader.start()
        print("[API] OpenClaw local reader started")
    except Exception as e:
        print(f"[API] Failed to start OpenClaw local reader: {e}")

    # Start OpenClaw gateway client if configured
    global _openclaw_client
    if settings.OPENCLAW_GATEWAY_URL and settings.OPENCLAW_GATEWAY_TOKEN:
        try:
            scopes = [s.strip() for s in settings.OPENCLAW_GATEWAY_SCOPES.split(",") if s.strip()]
            _openclaw_client = OpenClawGatewayClient(
                url=settings.OPENCLAW_GATEWAY_URL,
                token=settings.OPENCLAW_GATEWAY_TOKEN,
                scopes=scopes,
            )
            await _openclaw_client.start()
            print("[API] OpenClaw gateway client started")
        except Exception as e:
            print(f"[API] Failed to start OpenClaw gateway client: {e}")

    # Initialize MongoDB if configured
    mongo_uri = os.getenv("MONGODB_URI")
    if mongo_uri:
        try:
            mongo_db = os.getenv("MONGODB_DB", "orch")
            mongo_collection = os.getenv("MONGODB_PROV_COLLECTION", "prov_events")
            _mongo = MongoStore(mongo_uri, database=mongo_db, collection=mongo_collection)
            await _mongo.connect()
            # Set mongo instance for provenance modules
            set_mongo_store(_mongo)
            set_mongo(_mongo)
            print("[API] MongoDB connected (provenance)")
        except Exception as e:
            print(f"[API] MongoDB connection failed: {e}")
            _mongo = None

        # Initialize module databases (policy, messages, registry)
        try:
            from modules.policy import db as policy_db
            await policy_db.ensure_indexes()
            await policy_db.ensure_library_indexes()
            await policy_db.seed_default_rules()
            print("[API] Policy module initialized")
        except Exception as e:
            print(f"[API] Policy module init failed: {e}")

        try:
            from modules.registry import db as reg_db
            await reg_db.ensure_indexes()
            await reg_db.seed_defaults()
            print("[API] Registry module initialized")
        except Exception as e:
            print(f"[API] Registry module init failed: {e}")

        try:
            await message_queue.init_persistence()
        except Exception as e:
            print(f"[API] Message queue persistence init failed: {e}")

    else:
        print("[API] MongoDB not configured (MONGODB_URI not set) — modules running in-memory only")

    yield

    # Shutdown
    print("[API] Shutting down...")

    # Stop OpenClaw local reader
    await openclaw_local_reader.stop()

    # Stop OpenClaw gateway client
    if _openclaw_client is not None:
        await _openclaw_client.stop()

    # Close MCP connections
    await mcp_manager.close_all()

    # Close MongoDB
    if _mongo is not None:
        await _mongo.close()

    # Close shared module DB client
    try:
        from core.db_base import close_client
        await close_client()
    except Exception:
        pass


# Create FastAPI app
app = FastAPI(
    title="TPP Orchestration API",
    description="Human-in-the-Loop workflow with MCP management and provenance",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# HTTP Logging middleware (added after CORS to capture all requests)
app.add_middleware(HttpLoggingMiddleware)

# Import and include routers
from routers import (
    health_router,
    stream_router,
    client_router,
    admin_router,
    provenance_router,
    mcp_router,
    registry_router,
    config_router,
    policy_router,
    logs_router,
    comm_logs_router,
    external_registry_router,
    inbound_events_router,
    knowledge_rules_router,
)
from routers.policy_library import router as policy_library_router

app.include_router(health_router)
app.include_router(stream_router)
app.include_router(client_router)
app.include_router(admin_router)
app.include_router(provenance_router)
app.include_router(mcp_router)
app.include_router(registry_router)
app.include_router(config_router)
app.include_router(policy_router)
app.include_router(logs_router)
app.include_router(comm_logs_router)
app.include_router(external_registry_router)
app.include_router(inbound_events_router)
app.include_router(knowledge_rules_router)
app.include_router(policy_library_router)


# Root endpoint
@app.get("/")
def root():
    """API root - returns service info."""
    return {
        "service": "TPP Orchestration API",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True
    )
