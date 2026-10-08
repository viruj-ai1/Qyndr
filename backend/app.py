# ============================================================
#  app.py  –  FastAPI Application Entry Point
# ============================================================
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

env_path = pathlib.Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

from database import init_db
from api.projects    import router as projects_router
from api.doe         import router as doe_router
from api.analysis    import router as analysis_router
from api.optimization import router as optimization_router
from api.report_routes import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB on startup."""
    init_db()
    print("\n  [OK]  DOE Workflow Studio - FastAPI Backend started")
    print("  [>>]  API docs: http://localhost:8000/docs\n")
    yield


app = FastAPI(
    title="DOE Workflow Studio API",
    description="Full-featured DOE + Bayesian Optimization backend for Viruj Pharma",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    print(f"\n[GLOBAL ERROR] {request.method} {request.url}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {str(exc)}"}
    )


# ── CORS ────────────────────────────────────────────────────
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)


# ── Routers ─────────────────────────────────────────────────
PREFIX = "/api"
app.include_router(projects_router,    prefix=PREFIX)
app.include_router(doe_router,         prefix=PREFIX)
app.include_router(analysis_router,    prefix=PREFIX)
app.include_router(optimization_router,prefix=PREFIX)
app.include_router(reports_router,     prefix=PREFIX)


# ── Root & Health ───────────────────────────────────────────
@app.get("/", tags=["System"])
def root():
    return {
        "status": "ok",
        "service": "DOE Workflow Studio API",
        "version": "1.0.0",
        "docs_url": "http://127.0.0.1:8000/docs",
        "frontend_url": "http://127.0.0.1:5173"
    }


@app.get("/api/health", tags=["System"])
def health():
    return {"status": "ok", "service": "DOE Workflow Studio", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
