from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(users.router)
app.include_router(kyc.router)
app.include_router(refunds.router)
app.include_router(flags.router)
app.include_router(audit.router)
app.include_router(documents.router)
