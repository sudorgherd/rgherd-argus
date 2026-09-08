"""Small, explicit contract between ARGUS and installed backend modules."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter
from sqlalchemy.orm import DeclarativeBase, Session


StatusProvider = Callable[[Session], object]
ExceptionHandler = tuple[type[Exception], Callable[..., Any]]


@dataclass(frozen=True, slots=True)
class ModuleMetadata:
    module_id: str
    name: str
    version: str
    description: str | None = None


@dataclass(frozen=True, slots=True)
class ModuleRegistration:
    metadata: ModuleMetadata
    routers: tuple[APIRouter, ...]
    health: StatusProvider | None = None
    migration_status: StatusProvider | None = None
    exception_handlers: tuple[ExceptionHandler, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class CoreModels:
    base: type[DeclarativeBase]
    record: type
    assignment: type
    responder: type
    zone: type
    audit_event: type


@dataclass(frozen=True, slots=True)
class ArgusModuleHost:
    """Capabilities intentionally exposed to installed modules.

    Modules receive this object during registration and should avoid importing
    unrelated ARGUS implementation modules.
    """

    models: CoreModels
    get_db: Callable[..., Any]
    require_current_responder: Callable[..., Any]
    require_admin_responder: Callable[..., Any]
    require_dispatch_responder: Callable[..., Any]
    require_respond_responder: Callable[..., Any]
    require_module_enabled: Callable[[str], Callable[..., Any]]
    create_record: Callable[..., Any]
    create_assignment: Callable[..., Any]
    delete_assignment: Callable[..., Any]
    set_record_lifecycle: Callable[..., Any]
