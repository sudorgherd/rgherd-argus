import os

from .core.config import BOOT_CONFIG
import requests
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from authlib.integrations.starlette_client import OAuth

MAS_ISSUER = BOOT_CONFIG.mas_issuer
MAS_CLIENT_ID = BOOT_CONFIG.mas_client_id
MAS_CLIENT_SECRET = BOOT_CONFIG.mas_client_secret
ARGUS_BASE_URL = BOOT_CONFIG.argus_base_url

DISCOVERY_URL = f"{MAS_ISSUER}.well-known/openid-configuration"
discovery = requests.get(DISCOVERY_URL, timeout=5).json()
JWKS_URL = discovery["jwks_uri"]

security = HTTPBearer()
jwks = requests.get(JWKS_URL, timeout=5).json()

oauth = OAuth()
oauth.register(
    name="mas",
    client_id=MAS_CLIENT_ID,
    client_secret=MAS_CLIENT_SECRET,
    server_metadata_url=DISCOVERY_URL,
    client_kwargs={"scope": "openid email"},
)


def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            jwks,
            algorithms=[
                "RS256", "RS384", "RS512",
                "ES256", "ES384", "ES256K",
                "PS256", "PS384", "PS512",
            ],
            issuer=MAS_ISSUER,
            options={"verify_aud": False},
        )
        return payload
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid authentication token")
