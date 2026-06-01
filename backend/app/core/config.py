from __future__ import annotations

import os
from dataclasses import dataclass


def required_env(name: str) -> str:
    value = (os.getenv(name) or "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def optional_env(name: str) -> str | None:
    value = (os.getenv(name) or "").strip()
    return value or None


def optional_int_env(name: str, default: int) -> int:
    value = (os.getenv(name) or "").strip()
    if not value:
        return default

    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


def normalize_issuer(value: str) -> str:
    return value.rstrip("/") + "/"


def normalize_base_url(value: str) -> str:
    return value.rstrip("/")


@dataclass(frozen=True)
class BootConfig:
    session_secret: str
    mas_issuer: str
    mas_client_id: str
    mas_client_secret: str
    argus_base_url: str
    mas_admin_base_url: str | None
    mas_admin_client_id: str | None
    mas_admin_client_secret: str | None
    mas_admin_request_timeout_seconds: int


def load_boot_config() -> BootConfig:
    mas_admin_base_url = optional_env("MAS_ADMIN_BASE_URL")

    return BootConfig(
        session_secret=required_env("SESSION_SECRET"),
        mas_issuer=normalize_issuer(required_env("MAS_ISSUER")),
        mas_client_id=required_env("MAS_CLIENT_ID"),
        mas_client_secret=required_env("MAS_CLIENT_SECRET"),
        argus_base_url=normalize_base_url(required_env("ARGUS_BASE_URL")),
        mas_admin_base_url=normalize_base_url(mas_admin_base_url) if mas_admin_base_url else None,
        mas_admin_client_id=optional_env("MAS_ADMIN_CLIENT_ID"),
        mas_admin_client_secret=optional_env("MAS_ADMIN_CLIENT_SECRET"),
        mas_admin_request_timeout_seconds=optional_int_env("MAS_ADMIN_REQUEST_TIMEOUT_SECONDS", 8),
    )


BOOT_CONFIG = load_boot_config()
