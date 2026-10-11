import math

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .db import Base, engine
from .routers import audit, documents, flags, kyc, refunds, users

app = FastAPI(title="OpsDash")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)


def _json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": _json_safe(jsonable_encoder(exc.errors()))},
    )


@app.get("/api/health")
def health():
    from .auth import mock_auth_enabled

    return {"status": "ok", "mock_auth": mock_auth_enabled()}


app.include_router(users.router)
app.include_router(kyc.router)
app.include_router(refunds.router)
app.include_router(flags.router)
app.include_router(audit.router)
app.include_router(documents.router)
