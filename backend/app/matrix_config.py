import os
from dataclasses import dataclass


def _matrix_domain_from_user_id(user_id: str | None) -> str | None:
    value = (user_id or "").strip()
    if not value.startswith("@") or ":" not in value:
        return None
    return value.rsplit(":", 1)[-1].strip() or None


@dataclass(frozen=True)
class MatrixConfig:
    homeserver_url: str
    sender_user_id: str | None
    access_token: str | None
    request_timeout_seconds: int
    user_domain: str | None

    @property
    def configured(self) -> bool:
        return bool(self.homeserver_url and self.sender_user_id and self.access_token)


def load_matrix_config() -> MatrixConfig:
    homeserver_url = (os.getenv("MATRIX_HOMESERVER_URL") or "").rstrip("/")
    sender_user_id = (os.getenv("MATRIX_SENDER_USER_ID") or "").strip() or None
    access_token = (os.getenv("MATRIX_ACCESS_TOKEN") or "").strip() or None
    request_timeout_seconds = int(os.getenv("MATRIX_REQUEST_TIMEOUT_SECONDS", "10"))

    explicit_user_domain = (os.getenv("MATRIX_USER_DOMAIN") or "").strip() or None
    derived_user_domain = _matrix_domain_from_user_id(sender_user_id)

    return MatrixConfig(
        homeserver_url=homeserver_url,
        sender_user_id=sender_user_id,
        access_token=access_token,
        request_timeout_seconds=request_timeout_seconds,
        user_domain=explicit_user_domain or derived_user_domain,
    )


MATRIX_CONFIG = load_matrix_config()
