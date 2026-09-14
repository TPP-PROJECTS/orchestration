"""
External Component Registry - register external projects/components.

Supports three connection types:
  - http:      POST { message, trace_id } → { reply }
  - ws:        WebSocket, send JSON { message, trace_id }, receive JSON { reply }
  - openclaw:  OpenClaw Gateway WS protocol (challenge-response + device pairing)

Message flow (governed):
  user message → input policy → forward to component →
  wait for response → output policy → return to client
"""
from __future__ import annotations

import asyncio
import base64
import json
import time
import uuid
from typing import Any, Dict, List, Literal, Optional

import httpx
import websockets
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
)
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from services.event_bus import event_bus
from services.comm_logger import comm_logger

router = APIRouter(prefix="/api/external", tags=["External Registry"])

# ──────────────────────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────────────────────

class ExternalComponent(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    connection_type: Literal["http", "ws", "openclaw"] = "http"
    # For HTTP:      full URL e.g. http://localhost:3000/chat
    # For WS:        full URL e.g. ws://localhost:3000/ws
    # For OpenClaw:  gateway WS URL e.g. ws://127.0.0.1:18789
    endpoint: str
    auth_token: Optional[str] = None
    status: str = "registered"   # registered | connected | error
    error_message: Optional[str] = None
    trustWorthys: Optional[List[str]] = None
    trustWorthyDescription: Optional[str] = None
    # User-defined domains for policy search (free-form text)
    domains: List[str] = []
    policy_search_status: str = "none"  # none | searching | done | error
    created_at: float
    updated_at: float


class RegisterRequest(BaseModel):
    name: str
    description: Optional[str] = None
    connection_type: Literal["http", "ws", "openclaw"] = "http"
    endpoint: str
    auth_token: Optional[str] = None
    trustWorthys: Optional[List[str]] = None
    trustWorthyDescription: Optional[str] = None
    # Free-form domain tags — used to search for applicable external regulations
    # e.g. ["K-12 student data privacy", "AI tutoring systems"]
    domains: List[str] = []


class RegisterResponse(BaseModel):
    id: str
    name: str
    status: str


# Simple in-memory registry
_components: Dict[str, ExternalComponent] = {}


# ──────────────────────────────────────────────────────────────────────────────
# CRUD endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/components", response_model=List[ExternalComponent])
async def list_components() -> List[ExternalComponent]:
    """List all registered external components."""
    return list(_components.values())


@router.post("/components", response_model=RegisterResponse)
async def register_component(req: RegisterRequest) -> RegisterResponse:
    """
    Register a new external component.

    If `domains` are provided, an Anthropic web search is triggered in the
    background to find applicable external regulations and store them as
    knowledge rules (tier=external) for this component.
    """
    comp_id = f"ext-{uuid.uuid4().hex[:8]}"
    now = time.time()
    comp = ExternalComponent(
        id=comp_id,
        name=req.name,
        description=req.description,
        connection_type=req.connection_type,
        endpoint=req.endpoint,
        auth_token=req.auth_token,
        status="registered",
        trustWorthys=req.trustWorthys,
        trustWorthyDescription=req.trustWorthyDescription,
        domains=req.domains,
        policy_search_status="none" if not req.domains else "searching",
        created_at=now,
        updated_at=now,
    )
    _components[comp_id] = comp

    if req.domains:
        asyncio.create_task(_run_policy_search(comp_id, req.domains, req.name))

    return RegisterResponse(id=comp_id, name=comp.name, status=comp.status)


async def _run_policy_search(comp_id: str, domains: List[str], comp_name: str) -> None:
    """Background task: search external policies and update component status."""
    try:
        from services.policy_search import search_and_store_external_policies
        result = await search_and_store_external_policies(domains, comp_id, comp_name)
        status = "error" if result["errors"] and not result["rules_created"] else "done"
    except Exception as exc:
        print(f"[EXTERNAL-REGISTRY] Policy search failed for {comp_id}: {exc}")
        status = "error"

    if comp_id in _components:
        comp = _components[comp_id]
        comp.policy_search_status = status
        comp.updated_at = time.time()
        _components[comp_id] = comp


@router.patch("/components/{comp_id}")
async def update_component(comp_id: str, updates: Dict[str, Any]) -> ExternalComponent:
    """Update mutable fields of a registered external component."""
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")
    comp = _components[comp_id]
    allowed = {"name", "description", "endpoint", "auth_token", "connection_type",
               "trustWorthys", "trustWorthyDescription", "domains"}
    for key, val in updates.items():
        if key in allowed and val is not None:
            setattr(comp, key, val)
    comp.updated_at = time.time()
    _components[comp_id] = comp
    return comp


@router.delete("/components/{comp_id}")
async def delete_component(comp_id: str) -> Dict[str, str]:
    """Remove a registered external component."""
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")
    del _components[comp_id]
    return {"status": "deleted", "id": comp_id}


@router.post("/components/{comp_id}/test")
async def test_component(comp_id: str) -> Dict[str, Any]:
    """Ping the component endpoint to verify connectivity."""
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")

    comp = _components[comp_id]
    start = time.monotonic()

    if comp.connection_type == "openclaw":
        return await _test_openclaw(comp, start)
    elif comp.connection_type == "ws":
        return await _test_ws(comp, start)
    else:
        return await _test_http(comp, start)


@router.post("/components/{comp_id}/policies")
async def upload_component_policies(
    comp_id: str,
    files: List[UploadFile] = File(...),
) -> Dict[str, Any]:
    """
    Upload one or more internal policy documents for a registered external component.

    Each file is read as UTF-8 text and stored as knowledge rules in MongoDB with
    tier=internal so the policy engine applies them when this component is active.

    Supported formats: plain text (.txt), markdown (.md), PDF text (.pdf treated as text).
    """
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")

    comp = _components[comp_id]
    created_rule_ids: List[str] = []
    errors: List[str] = []

    try:
        from modules.policy import db as policy_db
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Policy database unavailable: {exc}")

    for upload in files:
        try:
            raw = await upload.read()
            text = raw.decode("utf-8", errors="replace").strip()
            if not text:
                errors.append(f"{upload.filename}: empty file")
                continue

            # Split document into chunks — one knowledge rule per logical paragraph
            # (paragraphs separated by blank lines), max 2000 chars each.
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
            # Merge very short fragments into the previous paragraph
            chunks: List[str] = []
            for para in paragraphs:
                if chunks and len(chunks[-1]) + len(para) < 2000 and len(para) < 100:
                    chunks[-1] = chunks[-1] + " " + para
                else:
                    chunks.append(para[:2000])

            filename = upload.filename or "policy_document"
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            for i, chunk in enumerate(chunks, start=1):
                rule_id = str(uuid.uuid4())
                rule = {
                    "id": rule_id,
                    "title": f"{filename} — §{i}",
                    "summary": chunk,
                    "domain": ["General"],
                    "tier": "internal",
                    "componentId": comp_id,
                    "componentName": comp.name,
                    "sourceFile": filename,
                    "status": "active",
                    "enforcement": ["pre_check", "post_check", "in_flight"],
                    "strength": "must",
                    "action": "deny",
                    "riskLevel": "high",
                    "jurisdiction": [],
                    "intentType": "internal_policy",
                    "scope": "component",
                    "lastModified": now_iso,
                }
                await policy_db.create_rule(rule)
                created_rule_ids.append(rule_id)

        except Exception as exc:
            errors.append(f"{upload.filename}: {exc}")

    return {
        "component_id": comp_id,
        "rules_created": len(created_rule_ids),
        "rule_ids": created_rule_ids,
        "errors": errors,
    }


@router.get("/components/{comp_id}/policies")
async def list_component_policies(comp_id: str) -> Dict[str, Any]:
    """List internal policy rules uploaded for a component."""
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")
    try:
        from modules.policy import db as policy_db
        rules = await policy_db.list_rules(tiers=["internal"], component_id=comp_id, limit=500)
        return {"component_id": comp_id, "rules": rules, "total": len(rules)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.delete("/components/{comp_id}/policies")
async def delete_component_policies(comp_id: str) -> Dict[str, Any]:
    """Delete all internal policy rules for a component."""
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")
    try:
        from modules.policy import db as policy_db
        from core.db_base import get_module_db, POLICY_DB
        result = await get_module_db(POLICY_DB)["knowledge_rules"].delete_many(
            {"tier": "internal", "componentId": comp_id}
        )
        return {"component_id": comp_id, "deleted": result.deleted_count}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


async def _test_http(comp: ExternalComponent, start: float) -> Dict[str, Any]:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if comp.auth_token:
        headers["Authorization"] = f"Bearer {comp.auth_token}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                comp.endpoint,
                json={"message": "__ping__", "trace_id": "test"},
                headers=headers,
            )
        latency_ms = int((time.monotonic() - start) * 1000)
        comp.status = "connected"
        comp.error_message = None
        comp.updated_at = time.time()
        _components[comp.id] = comp
        return {"success": True, "status_code": resp.status_code, "latency_ms": latency_ms}
    except Exception as exc:
        comp.status = "error"
        comp.error_message = str(exc)
        comp.updated_at = time.time()
        _components[comp.id] = comp
        return {"success": False, "error": str(exc)}


async def _test_ws(comp: ExternalComponent, start: float) -> Dict[str, Any]:
    """Generic WebSocket test - connects, sends a ping, waits for any reply."""
    extra_headers: Dict[str, str] = {}
    if comp.auth_token:
        extra_headers["Authorization"] = f"Bearer {comp.auth_token}"
    try:
        async with websockets.connect(
            comp.endpoint,
            extra_headers=extra_headers,
            open_timeout=10,
            close_timeout=5,
        ) as ws:
            await ws.send(json.dumps({"message": "__ping__", "trace_id": "test"}))
            # wait for any reply (or just connection success)
            try:
                await asyncio.wait_for(ws.recv(), timeout=5.0)
            except asyncio.TimeoutError:
                pass  # connection OK even without reply
        latency_ms = int((time.monotonic() - start) * 1000)
        comp.status = "connected"
        comp.error_message = None
        comp.updated_at = time.time()
        _components[comp.id] = comp
        return {"success": True, "latency_ms": latency_ms}
    except Exception as exc:
        comp.status = "error"
        comp.error_message = str(exc)
        comp.updated_at = time.time()
        _components[comp.id] = comp
        return {"success": False, "error": str(exc)}


async def _test_openclaw(comp: ExternalComponent, start: float) -> Dict[str, Any]:
    """
    OpenClaw Gateway test:
    Performs the challenge-response handshake + device pairing to verify
    the gateway is reachable and the token is valid.
    """
    try:
        device_key = _get_or_create_device_key(comp.id)
        session_key, device_token = await _openclaw_connect(
            endpoint=comp.endpoint,
            auth_token=comp.auth_token or "",
            device_key=device_key,
            comp_id=comp.id,
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        comp.status = "connected"
        comp.error_message = None
        comp.updated_at = time.time()
        _components[comp.id] = comp
        # Persist device token for future connections
        _device_tokens[comp.id] = device_token
        return {
            "success": True,
            "latency_ms": latency_ms,
            "session_key": session_key,
            "note": "OpenClaw gateway handshake succeeded",
        }
    except Exception as exc:
        comp.status = "error"
        comp.error_message = str(exc)
        comp.updated_at = time.time()
        _components[comp.id] = comp
        return {"success": False, "error": str(exc)}


# ──────────────────────────────────────────────────────────────────────────────
# OpenClaw Protocol Implementation
# ──────────────────────────────────────────────────────────────────────────────

# Persistent Ed25519 key pairs per component (in-memory; survives restarts via env)
_device_keys: Dict[str, Ed25519PrivateKey] = {}
# Persistent device tokens issued by OpenClaw after successful pairing
_device_tokens: Dict[str, str] = {}


def _get_or_create_device_key(comp_id: str) -> Ed25519PrivateKey:
    """
    Return (or generate) the Ed25519 private key for a given component.
    Keys are stored in memory; on restart a new pairing will be required.
    """
    if comp_id not in _device_keys:
        _device_keys[comp_id] = Ed25519PrivateKey.generate()
    return _device_keys[comp_id]


def _derive_device_id(public_key_bytes: bytes) -> str:
    """
    Derive a deterministic device ID from the raw Ed25519 public key bytes.

    OpenClaw source (client-Bkvpx3HG.js, deriveDeviceIdFromPublicKey):
        sha256(rawPublicKeyBytes).digest("hex")   →  full 64-char lowercase hex string
    """
    import hashlib
    return hashlib.sha256(public_key_bytes).hexdigest()  # 64-char hex, NOT base64, NOT truncated


def _build_device_auth_payload(
    device_id: str,
    client_id: str,
    client_mode: str,
    role: str,
    scopes: List[str],
    signed_at_ms: int,
    token: str,
    nonce: str,
) -> bytes:
    """
    Build the canonical payload for Ed25519 signing.

    OpenClaw source (client-Bkvpx3HG.js, buildDeviceAuthPayload):
        ["v2", deviceId, clientId, clientMode, role,
         scopes.join(","), String(signedAtMs), token ?? "", nonce].join("|")

    This is a pipe-delimited string, NOT JSON.
    """
    parts = [
        "v2",
        device_id,
        client_id,
        client_mode,
        role,
        ",".join(scopes),
        str(signed_at_ms),
        token or "",
        nonce,
    ]
    return "|".join(parts).encode("utf-8")


async def _openclaw_connect(
    endpoint: str,
    auth_token: str,
    device_key: Ed25519PrivateKey,
    comp_id: str,
) -> tuple[str, str]:
    """
    Perform the full OpenClaw WS handshake:
      1. Receive connect.challenge (nonce)
      2. Sign the device auth payload with Ed25519
      3. Send req/connect with device identity
      4. Parse hello-ok → extract sessionKey + deviceToken

    Returns (session_key, device_token).
    Raises on any failure.
    """
    pub_key = device_key.public_key()
    pub_bytes = pub_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
    device_id = _derive_device_id(pub_bytes)
    pub_b64 = base64.urlsafe_b64encode(pub_bytes).decode().rstrip("=")

    client_id = "gateway-client"
    client_mode = "backend"
    role = "operator"
    scopes = ["operator.admin", "operator.read", "operator.write", "operator.approvals"]

    # Check if we already have a device token from a previous successful pairing
    existing_device_token = _device_tokens.get(comp_id)

    async def _do_connect(ws: Any, use_device_token: Optional[str]) -> tuple[str, str]:
        """Inner connect attempt. Returns (session_key, new_device_token)."""
        raw_challenge = await asyncio.wait_for(ws.recv(), timeout=10.0)
        challenge = json.loads(raw_challenge)
        if challenge.get("event") != "connect.challenge":
            raise RuntimeError(f"Expected connect.challenge, got: {raw_challenge[:200]}")
        nonce = challenge["payload"]["nonce"]
        await comm_logger.log(
            source=f"openclaw:ext:{comp_id}",
            channel="event",
            kind="event",
            event="connect.challenge",
            payload={"nonce": nonce},
        )

        req_id = str(uuid.uuid4())
        signed_at_ms = int(time.time() * 1000)

        if use_device_token:
            connect_params: Dict[str, Any] = {
                "minProtocol": 3,
                "maxProtocol": 3,
                "client": {
                    "id": client_id,
                    "displayName": "TPP Orchestration Gateway",
                    "version": "1.0.0",
                    "platform": "darwin",
                    "mode": client_mode,
                },
                "caps": [],
                "auth": {"deviceToken": use_device_token},
                "role": role,
                "scopes": scopes,
            }
        else:
            payload_bytes = _build_device_auth_payload(
                device_id=device_id,
                client_id=client_id,
                client_mode=client_mode,
                role=role,
                scopes=scopes,
                signed_at_ms=signed_at_ms,
                token=auth_token,
                nonce=nonce,
            )
            signature_bytes = device_key.sign(payload_bytes)
            signature_b64 = base64.urlsafe_b64encode(signature_bytes).decode().rstrip("=")

            connect_params = {
                "minProtocol": 3,
                "maxProtocol": 3,
                "client": {
                    "id": client_id,
                    "displayName": "TPP Orchestration Gateway",
                    "version": "1.0.0",
                    "platform": "darwin",
                    "mode": client_mode,
                },
                "caps": [],
                "auth": {"token": auth_token},
                "device": {
                    "id": device_id,
                    "publicKey": pub_b64,
                    "signature": signature_b64,
                    "nonce": nonce,
                    "signedAt": signed_at_ms,
                },
                "role": role,
                "scopes": scopes,
            }

        connect_req = {
            "type": "req",
            "id": req_id,
            "method": "connect",
            "params": connect_params,
        }
        await ws.send(json.dumps(connect_req))
        await comm_logger.log(
            source=f"openclaw:ext:{comp_id}",
            channel="req",
            kind="request",
            method="connect",
            payload={"device_id": device_id, "use_device_token": use_device_token is not None},
        )

        raw_hello = await asyncio.wait_for(ws.recv(), timeout=15.0)
        hello = json.loads(raw_hello)

        if not hello.get("ok", False):
            err = hello.get("error", {})
            await comm_logger.log(
                source=f"openclaw:ext:{comp_id}",
                channel="res",
                kind="response",
                method="connect",
                ok=False,
                error=f"{err.get('code', 'unknown')}: {err.get('message', '')}",
            )
            raise RuntimeError(
                f"OpenClaw connect failed: {err.get('code', 'unknown')} - {err.get('message', raw_hello[:300])}"
            )

        payload = hello.get("payload", {})
        session_key = (
            payload.get("snapshot", {})
                   .get("sessionDefaults", {})
                   .get("mainSessionKey", "agent:main:main")
        )
        auth_info = payload.get("auth", {})
        new_device_token = auth_info.get("deviceToken", use_device_token or "")
        await comm_logger.log(
            source=f"openclaw:ext:{comp_id}",
            channel="res",
            kind="response",
            method="connect",
            ok=True,
            payload={"session_key": session_key},
        )
        return session_key, new_device_token

    # First attempt: use cached device token if available
    if existing_device_token:
        try:
            async with websockets.connect(endpoint, open_timeout=10, close_timeout=5) as ws:
                await comm_logger.log(source=f"openclaw:ext:{comp_id}", channel="ws", kind="connect", payload={"endpoint": endpoint})
                session_key, new_device_token = await _do_connect(ws, existing_device_token)
            return session_key, new_device_token
        except RuntimeError as exc:
            err_str = str(exc)
            if "NOT_PAIRED" in err_str or "device identity required" in err_str.lower():
                print(f"[OPENCLAW] Device token rejected ({err_str}), clearing and re-pairing...")
                await comm_logger.log(source=f"openclaw:ext:{comp_id}", channel="ws", kind="disconnect", error="NOT_PAIRED, re-pairing")
                _device_tokens.pop(comp_id, None)
                _device_keys.pop(comp_id, None)
                device_key = _get_or_create_device_key(comp_id)
                pub_key = device_key.public_key()
                pub_bytes = pub_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
                device_id = _derive_device_id(pub_bytes)
                pub_b64 = base64.urlsafe_b64encode(pub_bytes).decode().rstrip("=")
                # Fall through to fresh pairing below
            else:
                raise

    # Fresh pairing (no device token)
    async with websockets.connect(endpoint, open_timeout=10, close_timeout=5) as ws:
        await comm_logger.log(source=f"openclaw:ext:{comp_id}", channel="ws", kind="connect", payload={"endpoint": endpoint, "fresh_pair": True})
        session_key, new_device_token = await _do_connect(ws, None)
    _device_tokens[comp_id] = new_device_token
    return session_key, new_device_token


async def _openclaw_chat(
    endpoint: str,
    auth_token: str,
    device_key: Ed25519PrivateKey,
    comp_id: str,
    message: str,
) -> str:
    """
    Full OpenClaw chat flow:
      1. Handshake (connect) – with automatic re-pair on NOT_PAIRED
      2. Send chat.send
      3. Collect streaming chat events until final/error/aborted
    Returns the final reply text.
    """

    async def _attempt_chat(use_device_token: Optional[str]) -> str:
        """One full connect + chat attempt with the given device token (or None for fresh pair)."""
        pub_key = device_key.public_key()
        pub_bytes = pub_key.public_bytes(Encoding.Raw, PublicFormat.Raw)
        device_id = _derive_device_id(pub_bytes)
        pub_b64 = base64.urlsafe_b64encode(pub_bytes).decode().rstrip("=")

        client_id = "gateway-client"
        client_mode = "backend"
        role = "operator"
        scopes = ["operator.admin", "operator.read", "operator.write", "operator.approvals"]

        async with websockets.connect(endpoint, open_timeout=10, close_timeout=5) as ws:
            await comm_logger.log(
                source=f"openclaw:ext:{comp_id}",
                channel="ws",
                kind="connect",
                payload={"endpoint": endpoint},
            )
            try:
                # ── Step 1: Challenge ─────────────────────────────────────────────
                raw_challenge = await asyncio.wait_for(ws.recv(), timeout=10.0)
                challenge = json.loads(raw_challenge)
                if challenge.get("event") != "connect.challenge":
                    raise RuntimeError(f"Expected connect.challenge, got: {raw_challenge[:200]}")
                nonce = challenge["payload"]["nonce"]
                await comm_logger.log(
                    source=f"openclaw:ext:{comp_id}",
                    channel="event",
                    kind="event",
                    event="connect.challenge",
                    payload={"nonce": nonce},
                )

                signed_at_ms = int(time.time() * 1000)
                req_id = str(uuid.uuid4())

                if use_device_token:
                    connect_params: Dict[str, Any] = {
                        "minProtocol": 3,
                        "maxProtocol": 3,
                        "client": {
                            "id": client_id,
                            "displayName": "TPP Orchestration Gateway",
                            "version": "1.0.0",
                            "platform": "darwin",
                            "mode": client_mode,
                        },
                        "caps": [],
                        "auth": {"deviceToken": use_device_token},
                        "role": role,
                        "scopes": scopes,
                    }
                else:
                    payload_bytes = _build_device_auth_payload(
                        device_id=device_id,
                        client_id=client_id,
                        client_mode=client_mode,
                        role=role,
                        scopes=scopes,
                        signed_at_ms=signed_at_ms,
                        token=auth_token,
                        nonce=nonce,
                    )
                    signature_bytes = device_key.sign(payload_bytes)
                    signature_b64 = base64.urlsafe_b64encode(signature_bytes).decode().rstrip("=")

                    connect_params = {
                        "minProtocol": 3,
                        "maxProtocol": 3,
                        "client": {
                            "id": client_id,
                            "displayName": "TPP Orchestration Gateway",
                            "version": "1.0.0",
                            "platform": "darwin",
                            "mode": client_mode,
                        },
                        "caps": [],
                        "auth": {"token": auth_token},
                        "device": {
                            "id": device_id,
                            "publicKey": pub_b64,
                            "signature": signature_b64,
                            "nonce": nonce,
                            "signedAt": signed_at_ms,
                        },
                        "role": role,
                        "scopes": scopes,
                    }

                connect_req = {
                    "type": "req",
                    "id": req_id,
                    "method": "connect",
                    "params": connect_params,
                }
                await ws.send(json.dumps(connect_req))
                await comm_logger.log(
                    source=f"openclaw:ext:{comp_id}",
                    channel="req",
                    kind="request",
                    method="connect",
                    payload={"use_device_token": use_device_token is not None},
                )

                # ── Step 2: hello-ok ──────────────────────────────────────────────
                raw_hello = await asyncio.wait_for(ws.recv(), timeout=15.0)
                hello = json.loads(raw_hello)

                if not hello.get("ok", False):
                    err = hello.get("error", {})
                    await comm_logger.log(
                        source=f"openclaw:ext:{comp_id}",
                        channel="res",
                        kind="response",
                        method="connect",
                        ok=False,
                        error=f"{err.get('code', 'unknown')}: {err.get('message', '')}",
                    )
                    raise RuntimeError(
                        f"OpenClaw connect failed: {err.get('code', 'unknown')} - {err.get('message', raw_hello[:300])}"
                    )

                hello_payload = hello.get("payload", {})
                session_key = (
                    hello_payload.get("snapshot", {})
                                 .get("sessionDefaults", {})
                                 .get("mainSessionKey", "agent:main:main")
                )
                await comm_logger.log(
                    source=f"openclaw:ext:{comp_id}",
                    channel="res",
                    kind="response",
                    method="connect",
                    ok=True,
                    payload={"session_key": session_key},
                )

                # Persist device token
                auth_info = hello_payload.get("auth", {})
                new_device_token = auth_info.get("deviceToken")
                if new_device_token:
                    _device_tokens[comp_id] = new_device_token

                # ── Step 3: chat.send ─────────────────────────────────────────────
                chat_req_id = str(uuid.uuid4())
                chat_req = {
                    "type": "req",
                    "id": chat_req_id,
                    "method": "chat.send",
                    "params": {
                        "sessionKey": session_key,
                        "message": message,
                        "idempotencyKey": str(uuid.uuid4()),
                    },
                }
                await ws.send(json.dumps(chat_req))
                await comm_logger.log(
                    source=f"openclaw:ext:{comp_id}",
                    channel="req",
                    kind="request",
                    method="chat.send",
                    payload={"session_key": session_key, "message_preview": message[:100]},
                )

                # ── Step 4: Collect streaming events ─────────────────────────────
                reply_parts: List[str] = []
                deadline = asyncio.get_event_loop().time() + 60.0

                while True:
                    remaining = deadline - asyncio.get_event_loop().time()
                    if remaining <= 0:
                        raise asyncio.TimeoutError("OpenClaw chat timed out waiting for final response")

                    raw = await asyncio.wait_for(ws.recv(), timeout=remaining)
                    frame = json.loads(raw)

                    frame_type = frame.get("type")

                    # Direct response to chat.send (ok/error)
                    if frame_type == "res" and frame.get("id") == chat_req_id:
                        ok_val = frame.get("ok", True)
                        await comm_logger.log(
                            source=f"openclaw:ext:{comp_id}",
                            channel="res",
                            kind="response",
                            method="chat.send",
                            ok=bool(ok_val),
                            payload=frame.get("payload") or frame.get("error") or {},
                        )
                        if not ok_val:
                            err = frame.get("error", {})
                            raise RuntimeError(
                                f"chat.send failed: {err.get('code', 'unknown')} - {err.get('message', '')}"
                            )
                        continue

                    # Streaming chat events
                    if frame_type == "event" and frame.get("event") == "chat":
                        payload = frame.get("payload", {})
                        state = payload.get("state")
                        await comm_logger.log(
                            source=f"openclaw:ext:{comp_id}",
                            channel="event",
                            kind="event",
                            event=f"chat:{state}",
                            payload={"state": state},
                        )

                        if state == "delta":
                            # Text lives in payload.message.content[{type:"text", text:"..."}]
                            for item in payload.get("message", {}).get("content", []):
                                if isinstance(item, dict) and item.get("type") == "text":
                                    t = item.get("text", "")
                                    if t:
                                        # cumulative snapshot – keep only the latest
                                        reply_parts = [t]
                                    break

                        elif state == "final":
                            # Same structure as delta but this is the complete message
                            for item in payload.get("message", {}).get("content", []):
                                if isinstance(item, dict) and item.get("type") == "text":
                                    final_text = item.get("text", "")
                                    if final_text:
                                        return final_text
                                    break
                            return "".join(reply_parts) or "[No response from OpenClaw]"

                        elif state in ("error", "aborted"):
                            error_msg = (
                                payload.get("errorMessage")
                                or payload.get("error")
                                or payload.get("message")
                                or state
                            )
                            raise RuntimeError(f"OpenClaw chat {state}: {error_msg}")

                    else:
                        # Log other event/req/res frames
                        if frame_type == "event":
                            await comm_logger.log(
                                source=f"openclaw:ext:{comp_id}",
                                channel="event",
                                kind="event",
                                event=frame.get("event"),
                                payload=frame.get("payload") or {},
                            )

            except Exception:
                await comm_logger.log(
                    source=f"openclaw:ext:{comp_id}",
                    channel="ws",
                    kind="disconnect",
                )
                raise

    # Try with cached device token first; fall back to fresh pair on NOT_PAIRED
    existing_device_token = _device_tokens.get(comp_id)
    if existing_device_token:
        try:
            return await _attempt_chat(existing_device_token)
        except RuntimeError as exc:
            err_str = str(exc)
            if "NOT_PAIRED" in err_str or "device identity required" in err_str.lower():
                print(f"[OPENCLAW] Device token rejected ({err_str}), clearing and re-pairing...")
                _device_tokens.pop(comp_id, None)
                _device_keys.pop(comp_id, None)

                # Regenerate key so fresh device identity is produced
                _get_or_create_device_key(comp_id)


                device_key = _device_keys[comp_id]
            else:
                raise

    # Fresh pair (first time or after token invalidation)
    return await _attempt_chat(None)


# ──────────────────────────────────────────────────────────────────────────────
# Internal forwarding helpers
# ──────────────────────────────────────────────────────────────────────────────

class ForwardResponse(BaseModel):
    reply: str
    component_id: str
    component_name: str
    latency_ms: int


async def forward_to_component(
    comp_id: str,
    message: str,
    trace_id: str,
    history: Optional[List[Dict[str, str]]] = None,
    meta: Optional[Dict[str, Any]] = None,
) -> ForwardResponse:
    """Forward a (already-governed) message to the external component."""
    if comp_id not in _components:
        raise HTTPException(status_code=404, detail="Component not found")

    comp = _components[comp_id]
    if comp.connection_type == "openclaw":
        return await _forward_openclaw(comp, message, trace_id)
    elif comp.connection_type == "ws":
        return await _forward_ws(comp, message, trace_id, history, meta)
    else:
        return await _forward_http(comp, message, trace_id, history, meta)


async def _forward_http(
    comp: ExternalComponent,
    message: str,
    trace_id: str,
    history: Optional[List[Dict[str, str]]],
    meta: Optional[Dict[str, Any]],
) -> ForwardResponse:
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if comp.auth_token:
        headers["Authorization"] = f"Bearer {comp.auth_token}"

    payload: Dict[str, Any] = {"message": message, "trace_id": trace_id}
    if history:
        payload["history"] = history
    if meta:
        payload["meta"] = meta

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(comp.endpoint, json=payload, headers=headers)
        latency_ms = int((time.monotonic() - start) * 1000)

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Component returned HTTP {resp.status_code}: {resp.text[:200]}",
            )

        data = resp.json()
        reply = data.get("reply") or data.get("message") or data.get("content") or str(data)

        comp.status = "connected"
        comp.error_message = None
        comp.updated_at = time.time()
        _components[comp.id] = comp

        return ForwardResponse(
            reply=reply,
            component_id=comp.id,
            component_name=comp.name,
            latency_ms=latency_ms,
        )
    except HTTPException:
        raise
    except Exception as exc:
        comp.status = "error"
        comp.error_message = str(exc)
        comp.updated_at = time.time()
        _components[comp.id] = comp
        raise HTTPException(status_code=502, detail=f"Failed to reach component: {exc}")


async def _forward_ws(
    comp: ExternalComponent,
    message: str,
    trace_id: str,
    history: Optional[List[Dict[str, str]]],
    meta: Optional[Dict[str, Any]],
) -> ForwardResponse:
    """Generic WebSocket forwarding - send JSON payload, receive JSON reply."""
    extra_headers: Dict[str, str] = {}
    if comp.auth_token:
        extra_headers["Authorization"] = f"Bearer {comp.auth_token}"

    payload: Dict[str, Any] = {"message": message, "trace_id": trace_id}
    if history:
        payload["history"] = history
    if meta:
        payload["meta"] = meta

    start = time.monotonic()
    try:
        async with websockets.connect(
            comp.endpoint,
            extra_headers=extra_headers,
            open_timeout=10,
            close_timeout=5,
        ) as ws:
            await ws.send(json.dumps(payload))
            raw = await asyncio.wait_for(ws.recv(), timeout=60.0)

        latency_ms = int((time.monotonic() - start) * 1000)

        # Parse response
        try:
            data = json.loads(raw)
            reply = data.get("reply") or data.get("message") or data.get("content") or str(data)
        except Exception:
            reply = str(raw)

        comp.status = "connected"
        comp.error_message = None
        comp.updated_at = time.time()
        _components[comp.id] = comp

        return ForwardResponse(
            reply=reply,
            component_id=comp.id,
            component_name=comp.name,
            latency_ms=latency_ms,
        )
    except asyncio.TimeoutError:
        comp.status = "error"
        comp.error_message = "Timed out waiting for WebSocket reply"
        comp.updated_at = time.time()
        _components[comp.id] = comp
        raise HTTPException(status_code=504, detail="WebSocket reply timed out")
    except Exception as exc:
        comp.status = "error"
        comp.error_message = str(exc)
        comp.updated_at = time.time()
        _components[comp.id] = comp
        raise HTTPException(status_code=502, detail=f"WebSocket error: {exc}")


async def _forward_openclaw(
    comp: ExternalComponent,
    message: str,
    trace_id: str,
) -> ForwardResponse:
    """
    OpenClaw-specific forwarding using the proprietary WS protocol:
    challenge-response handshake + device pairing + chat.send + streaming events.
    """
    start = time.monotonic()
    try:
        device_key = _get_or_create_device_key(comp.id)
        reply = await _openclaw_chat(
            endpoint=comp.endpoint,
            auth_token=comp.auth_token or "",
            device_key=device_key,
            comp_id=comp.id,
            message=message,
        )
        latency_ms = int((time.monotonic() - start) * 1000)

        comp.status = "connected"
        comp.error_message = None
        comp.updated_at = time.time()
        _components[comp.id] = comp

        return ForwardResponse(
            reply=reply,
            component_id=comp.id,
            component_name=comp.name,
            latency_ms=latency_ms,
        )
    except asyncio.TimeoutError:
        comp.status = "error"
        comp.error_message = "Timed out waiting for OpenClaw response"
        comp.updated_at = time.time()
        _components[comp.id] = comp
        raise HTTPException(status_code=504, detail="OpenClaw response timed out")
    except Exception as exc:
        comp.status = "error"
        comp.error_message = str(exc)
        comp.updated_at = time.time()
        _components[comp.id] = comp
        raise HTTPException(status_code=502, detail=f"OpenClaw error: {exc}")


# ──────────────────────────────────────────────────────────────────────────────
# Direct forward endpoint (no governance)
# ──────────────────────────────────────────────────────────────────────────────

class ForwardRequest(BaseModel):
    message: str
    trace_id: str
    history: Optional[List[Dict[str, str]]] = None
    meta: Optional[Dict[str, Any]] = None


@router.post("/components/{comp_id}/forward", response_model=ForwardResponse)
async def forward_message(comp_id: str, req: ForwardRequest) -> ForwardResponse:
    """Directly forward a message to an external component (no governance)."""
    return await forward_to_component(
        comp_id=comp_id,
        message=req.message,
        trace_id=req.trace_id,
        history=req.history,
        meta=req.meta,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Governed chat endpoint
# ──────────────────────────────────────────────────────────────────────────────

class ExternalChatRequest(BaseModel):
    component_id: str
    message: str
    trace_id: Optional[str] = None
    history: Optional[List[Dict[str, str]]] = None
    meta: Optional[Dict[str, Any]] = None


class ExternalChatResponse(BaseModel):
    reply: str
    trace_id: str
    component_id: str
    component_name: str
    latency_ms: int
    input_policy: Optional[Dict[str, Any]] = None
    output_policy: Optional[Dict[str, Any]] = None


@router.post("/chat", response_model=ExternalChatResponse)
async def external_chat(req: ExternalChatRequest) -> ExternalChatResponse:
    """
    Governed chat with an external component:
    1. Input policy evaluation
    2. Forward message to external component (HTTP / WS / OpenClaw)
    3. Output policy evaluation
    4. Return reply
    """
    trace_id = req.trace_id or str(uuid.uuid4())
    ts = int(time.time() * 1000)

    component_domains: List[str] = []
    try:
        from modules.registry import db as reg_db
        component_domains = await reg_db.get_component_domains(req.component_id)
    except Exception as domain_error:
        print(f"[EXTERNAL-CHAT] Could not resolve component domains: {domain_error}")

    # ── 1. Input policy ──────────────────────────────────────────────────────
    input_eval_data: Optional[Dict[str, Any]] = None
    try:
        from services.policy_engine import policy_engine
        input_eval = await policy_engine.evaluate_content(
            content=req.message,
            policy_type="input",
            context={
                "trace_id": trace_id,
                "history": req.history or [],
                "meta": req.meta or {},
            },
            domains=component_domains or None,
            component_id=req.component_id,
        )
        input_eval_data = {
            "decision": input_eval.decision,
            "passed": input_eval.passed,
            "violations": [v.model_dump() for v in input_eval.violations],
            "summary": input_eval.summary,
            "evaluation_time_ms": input_eval.evaluation_time_ms,
            "evaluated_policies": input_eval.evaluated_policies,
        }
        await event_bus.publish({
            "type": "policy_evaluation",
            "trace_id": trace_id,
            "ts": ts,
            "data": {
                "message_id": trace_id,
                "policy_type": "input",
                **input_eval_data,
            },
        })
    except Exception as exc:
        print(f"[EXTERNAL-CHAT] Input policy error: {exc}")

    # ── 2. Forward to external component ────────────────────────────────────
    forward_result = await forward_to_component(
        comp_id=req.component_id,
        message=req.message,
        trace_id=trace_id,
        history=req.history,
        meta=req.meta,
    )

    # ── 3. Output policy ─────────────────────────────────────────────────────
    output_eval_data: Optional[Dict[str, Any]] = None
    try:
        from services.policy_engine import policy_engine
        output_eval = await policy_engine.evaluate_content(
            content=forward_result.reply,
            policy_type="output",
            context={
                "original_message": req.message,
                "history": req.history or [],
            },
            domains=component_domains or None,
            component_id=req.component_id,
        )
        output_eval_data = {
            "decision": output_eval.decision,
            "passed": output_eval.passed,
            "violations": [v.model_dump() for v in output_eval.violations],
            "summary": output_eval.summary,
            "evaluation_time_ms": output_eval.evaluation_time_ms,
            "evaluated_policies": output_eval.evaluated_policies,
        }
        await event_bus.publish({
            "type": "policy_evaluation",
            "trace_id": trace_id,
            "ts": int(time.time() * 1000),
            "data": {
                "message_id": trace_id,
                "policy_type": "output",
                **output_eval_data,
            },
        })
    except Exception as exc:
        print(f"[EXTERNAL-CHAT] Output policy error: {exc}")

    # ── 4. Publish to event bus ──────────────────────────────────────────────
    await event_bus.publish({
        "type": "external_chat",
        "trace_id": trace_id,
        "ts": int(time.time() * 1000),
        "data": {
            "component_id": req.component_id,
            "component_name": forward_result.component_name,
            "message": req.message,
            "reply": forward_result.reply,
            "latency_ms": forward_result.latency_ms,
        },
    })

    return ExternalChatResponse(
        reply=forward_result.reply,
        trace_id=trace_id,
        component_id=req.component_id,
        component_name=forward_result.component_name,
        latency_ms=forward_result.latency_ms,
        input_policy=input_eval_data,
        output_policy=output_eval_data,
    )
