from collections.abc import Iterator
from typing import Any

import anyio.to_thread
import httpx
import pytest
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from app.module_host import ModuleMetadata, ModuleRegistration
from app.module_host.api import create_module_api_router, make_require_module_enabled
from app.module_host.registry import ModuleRegistry
from app.module_host.registry import discover_installed_modules
from app.core_operations import set_record_lifecycle_in_transaction
from app.models import ArgusModuleState, RecordAssignment


pytestmark = pytest.mark.anyio


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


async def run_sync_inline(
    function,
    *args: Any,
    abandon_on_cancel: bool = False,
    limiter: object | None = None,
) -> Any:
    del abandon_on_cancel, limiter
    return function(*args)


async def test_module_state_defaults_disabled() -> None:
    state = ArgusModuleState(
        module_id="example_tools",
        installed_version="1.2.3",
    )
    assert state.enabled is None or state.enabled is False


async def test_host_lifecycle_operation_is_commit_free_and_preserves_close_rules(
    db: Session,
    make_record,
    make_responder,
) -> None:
    record = make_record(status="new")
    responder = make_responder("assigned-responder")
    db.add(
        RecordAssignment(
            record_id=record.id,
            responder_id=responder.id,
            assignment_state="assigned",
            assigned_by="dispatcher",
        ),
    )
    db.commit()

    set_record_lifecycle_in_transaction(
        db,
        record_id=record.id,
        status="under_review",
        actor_id=responder.subject_id,
    )
    assert record.status == "under_review"
    db.rollback()
    assert db.get(type(record), record.id).status == "new"

    with pytest.raises(HTTPException) as captured:
        set_record_lifecycle_in_transaction(
            db,
            record_id=record.id,
            status="closed",
            actor_id=responder.subject_id,
            closure={"outcome_type": "completed", "outcome_notes": "Done"},
        )
    assert captured.value.status_code == 400
    assert db.get(type(record), record.id).status == "new"


async def test_generic_admin_state_controls_operational_router(
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    registry = ModuleRegistry()
    operational = APIRouter(prefix="/api/modules/example_tools")

    def get_test_db() -> Iterator[Session]:
        yield db

    require_enabled = make_require_module_enabled(registry, get_test_db)

    @operational.get("/ping", dependencies=[Depends(require_enabled("example_tools"))])
    def ping():
        return {"ok": True}

    registry.register(
        ModuleRegistration(
            metadata=ModuleMetadata(
                module_id="example_tools",
                name="Example Tools",
                version="1.2.3",
                description="A generic test module",
            ),
            routers=(operational,),
            health=lambda _db: {"status": "ok"},
            migration_status=lambda _db: {"status": "current"},
        ),
    )

    test_app = FastAPI()
    test_app.include_router(
        create_module_api_router(
            registry=registry,
            get_db=get_test_db,
            require_current_responder=lambda: object(),
            require_admin_responder=lambda: object(),
        ),
    )
    test_app.include_router(operational)
    monkeypatch.setattr(anyio.to_thread, "run_sync", run_sync_inline)
    transport = httpx.ASGITransport(app=test_app)
    client = httpx.AsyncClient(transport=transport, base_url="http://test")

    admin = await client.get("/api/admin/modules")
    assert admin.status_code == 200
    assert admin.json()["modules"] == [
        {
            "module_id": "example_tools",
            "name": "Example Tools",
            "description": "A generic test module",
            "version": "1.2.3",
            "enabled": False,
            "health": {"status": "ok"},
            "migration_status": {"status": "current"},
        },
    ]
    assert (await client.get("/api/modules/example_tools/ping")).status_code == 503

    enabled = await client.patch(
        "/api/admin/modules/example_tools",
        json={"enabled": True},
    )
    assert enabled.status_code == 200
    assert enabled.json()["enabled"] is True
    assert (await client.get("/api/modules/example_tools/ping")).json() == {"ok": True}
    assert (await client.get("/api/modules")).json()["modules"][0]["module_id"] == "example_tools"

    disabled = await client.patch(
        "/api/admin/modules/example_tools",
        json={"enabled": False},
    )
    assert disabled.status_code == 200
    assert (await client.get("/api/modules/example_tools/ping")).status_code == 503
    assert db.get(ArgusModuleState, "example_tools") is not None
    await client.aclose()


async def test_module_registry_rejects_duplicate_ids() -> None:
    registry = ModuleRegistry()
    registration = ModuleRegistration(
        metadata=ModuleMetadata(
            module_id="example_tools",
            name="Example Tools",
            version="1.0.0",
        ),
        routers=(),
    )
    registry.register(registration)

    try:
        registry.register(registration)
    except ValueError as error:
        assert "Duplicate module ID" in str(error)
    else:
        raise AssertionError("duplicate module registration was accepted")


async def test_discovery_loads_child_entrypoint_into_same_fastapi_app(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module_dir = tmp_path / "example_package"
    module_dir.mkdir()
    (module_dir / "argus_module.py").write_text(
        """
from fastapi import APIRouter
from app.module_host import ModuleMetadata, ModuleRegistration

def register(host):
    router = APIRouter(prefix='/api/modules/discovered_example')
    @router.get('/ping')
    def ping():
        return {'ok': True}
    return ModuleRegistration(
        metadata=ModuleMetadata(
            module_id='discovered_example',
            name='Discovered Example',
            version='1.0.0',
        ),
        routers=(router,),
    )
""",
    )
    registry = ModuleRegistry()
    test_app = FastAPI()
    discover_installed_modules(
        test_app,
        host=object(),
        registry=registry,
        modules_dir=str(tmp_path),
    )
    assert registry.get("discovered_example") is not None

    monkeypatch.setattr(anyio.to_thread, "run_sync", run_sync_inline)
    transport = httpx.ASGITransport(app=test_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/modules/discovered_example/ping")
    assert response.json() == {"ok": True}
