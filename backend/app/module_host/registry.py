"""Discovery and in-process registration for deployment-installed modules."""

from __future__ import annotations

import importlib.util
import logging
import re
import sys
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from fastapi import FastAPI

from .contract import ArgusModuleHost, ModuleRegistration


LOGGER = logging.getLogger(__name__)
MODULE_ID_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{1,63}$")


@dataclass(frozen=True, slots=True)
class ModuleDiscoveryFailure:
    source: str
    reason: str


class ModuleRegistry:
    def __init__(self) -> None:
        self._registrations: dict[str, ModuleRegistration] = {}
        self._failures: list[ModuleDiscoveryFailure] = []

    @property
    def registrations(self) -> tuple[ModuleRegistration, ...]:
        return tuple(
            self._registrations[key] for key in sorted(self._registrations)
        )

    @property
    def failures(self) -> tuple[ModuleDiscoveryFailure, ...]:
        return tuple(self._failures)

    def get(self, module_id: str) -> ModuleRegistration | None:
        return self._registrations.get(module_id)

    def register(self, registration: ModuleRegistration) -> None:
        module_id = registration.metadata.module_id
        if not MODULE_ID_PATTERN.fullmatch(module_id):
            raise ValueError(f"Invalid module ID: {module_id!r}")
        if module_id in self._registrations:
            raise ValueError(f"Duplicate module ID: {module_id}")
        if not registration.metadata.name.strip() or not registration.metadata.version.strip():
            raise ValueError("Module name and version are required")
        self._registrations[module_id] = registration

    def record_failure(self, source: str, error: Exception) -> None:
        failure = ModuleDiscoveryFailure(source=source, reason=type(error).__name__)
        self._failures.append(failure)
        LOGGER.exception("Unable to load installed ARGUS module from %s", source)


def _load_registration(entrypoint: Path, host: ArgusModuleHost) -> ModuleRegistration:
    digest = sha256(str(entrypoint.resolve()).encode()).hexdigest()[:16]
    import_name = f"_argus_installed_module_{digest}"
    spec = importlib.util.spec_from_file_location(import_name, entrypoint)
    if spec is None or spec.loader is None:
        raise ImportError("Module entrypoint could not be loaded")
    module = importlib.util.module_from_spec(spec)
    sys.modules[import_name] = module
    module_root = str(entrypoint.parent)
    sys.path.insert(0, module_root)
    try:
        spec.loader.exec_module(module)
        register = getattr(module, "register", None)
        if not callable(register):
            raise TypeError("Module entrypoint must expose register(host)")
        registration = register(host)
        if not isinstance(registration, ModuleRegistration):
            raise TypeError("register(host) must return ModuleRegistration")
        return registration
    finally:
        sys.path.remove(module_root)


def discover_installed_modules(
    app: FastAPI,
    *,
    host: ArgusModuleHost,
    registry: ModuleRegistry,
    modules_dir: str | None,
) -> ModuleRegistry:
    """Load each immediate child containing ``argus_module.py``.

    A broken optional module is isolated from core startup and reported through
    the registry. Successfully loaded routers run inside this FastAPI process.
    """

    if not modules_dir:
        return registry
    root = Path(modules_dir)
    if not root.is_dir():
        return registry

    for candidate in sorted(root.iterdir(), key=lambda item: item.name):
        entrypoint = candidate / "argus_module.py"
        if not candidate.is_dir() or not entrypoint.is_file():
            continue
        try:
            registration = _load_registration(entrypoint, host)
            registry.register(registration)
            for exception_type, handler in registration.exception_handlers:
                app.add_exception_handler(exception_type, handler)
            for router in registration.routers:
                app.include_router(router)
        except Exception as error:  # Keep a faulty optional module from taking down core.
            registry.record_failure(candidate.name, error)

    return registry
