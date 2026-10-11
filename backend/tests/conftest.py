import os
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("OPSDASH_DB_PATH", str(db_path))
    monkeypatch.setenv("OPSDASH_MOCK_AUTH", "1")
    # reimport modules bound to env at import time
    for mod in list(sys.modules):
        if mod == "app" or mod.startswith("app.") or mod == "seed":
            del sys.modules[mod]
    import seed
    from fastapi.testclient import TestClient
    from app.main import app

    seed.seed()
    return TestClient(app)


ANALYST = {"X-User-Id": "1"}
SUPPORT = {"X-User-Id": "2"}
ENGINEER = {"X-User-Id": "3"}
MANAGER = {"X-User-Id": "4"}
