"""Generic module catalog, state, and enablement dependencies."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from ..models import ArgusModuleState
from .registry import ModuleRegistry


class ModuleStateUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool


def _module_payload(
    registration,
    state: ArgusModuleState | None,
    *,
    include_status: bool,
    db: Session,
) -> dict[str, Any]:
    metadata = registration.metadata
    payload: dict[str, Any] = {
        "module_id": metadata.module_id,
        "name": metadata.name,
        "description": metadata.description,
        "version": metadata.version,
        "enabled": bool(state and state.enabled),
    }
    if include_status:
        for key, provider in (
            ("health", registration.health),
            ("migration_status", registration.migration_status),
        ):
            if provider is None:
                payload[key] = None
                continue
            try:
                payload[key] = provider(db)
            except Exception:
                payload[key] = {"status": "error"}
    return payload


def sync_discovered_states(db: Session, registry: ModuleRegistry) -> None:
    now = datetime.utcnow()
    for registration in registry.registrations:
        metadata = registration.metadata
        state = db.get(ArgusModuleState, metadata.module_id)
        if state is None:
            db.add(
                ArgusModuleState(
                    module_id=metadata.module_id,
                    enabled=False,
                    installed_version=metadata.version,
                    updated_at=now,
                ),
            )
        elif state.installed_version != metadata.version:
            state.installed_version = metadata.version
            state.updated_at = now
    db.flush()


def make_require_module_enabled(registry: ModuleRegistry, get_db):
    def factory(module_id: str):
        def require_enabled(db: Session = Depends(get_db)) -> None:
            if registry.get(module_id) is None:
                raise HTTPException(
                    status_code=404,
                    detail={"code": "module_not_installed", "module_id": module_id},
                )
            state = db.get(ArgusModuleState, module_id)
            if state is None or not state.enabled:
                raise HTTPException(
                    status_code=503,
                    detail={"code": "module_disabled", "module_id": module_id},
                )

        return require_enabled

    return factory


def create_module_api_router(
    *,
    registry: ModuleRegistry,
    get_db,
    require_current_responder,
    require_admin_responder,
) -> APIRouter:
    router = APIRouter(tags=["modules"])

    @router.get("/api/modules")
    def list_enabled_modules(
        _responder=Depends(require_current_responder),
        db: Session = Depends(get_db),
    ):
        states = {
            state.module_id: state
            for state in db.query(ArgusModuleState)
            .filter(ArgusModuleState.enabled.is_(True))
            .all()
        }
        modules = [
            _module_payload(registration, states.get(registration.metadata.module_id), include_status=False, db=db)
            for registration in registry.registrations
            if registration.metadata.module_id in states
        ]
        return {"count": len(modules), "modules": modules}

    @router.get("/api/admin/modules")
    def list_admin_modules(
        _responder=Depends(require_admin_responder),
        db: Session = Depends(get_db),
    ):
        try:
            sync_discovered_states(db, registry)
            db.commit()
        except Exception:
            db.rollback()
            raise
        states = {
            state.module_id: state for state in db.query(ArgusModuleState).all()
        }
        modules = [
            _module_payload(registration, states.get(registration.metadata.module_id), include_status=True, db=db)
            for registration in registry.registrations
        ]
        return {
            "count": len(modules),
            "modules": modules,
            "discovery_failures": [
                {"source": failure.source, "reason": failure.reason}
                for failure in registry.failures
            ],
        }

    @router.patch("/api/admin/modules/{module_id}")
    def update_module_state(
        module_id: str,
        payload: ModuleStateUpdate,
        _responder=Depends(require_admin_responder),
        db: Session = Depends(get_db),
    ):
        registration = registry.get(module_id)
        if registration is None:
            raise HTTPException(status_code=404, detail="Module not discovered")
        try:
            state = db.get(ArgusModuleState, module_id)
            if state is None:
                state = ArgusModuleState(
                    module_id=module_id,
                    installed_version=registration.metadata.version,
                )
                db.add(state)
            state.enabled = payload.enabled
            state.installed_version = registration.metadata.version
            state.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(state)
        except Exception:
            db.rollback()
            raise
        return _module_payload(registration, state, include_status=True, db=db)

    return router
