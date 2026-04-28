import os
from dotenv import load_dotenv

# ─────────────────────────────────────────────
# Load ENV FIRST (CRITICAL)
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(BASE_DIR, ".env")

load_dotenv(env_path)

print("PINECONE KEY:", os.getenv("PINECONE_API_KEY"))

# ─────────────────────────────────────────────
# Now safe to import rest of app
# ─────────────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.routes.query import router as query_router

app = FastAPI()

# ─────────────────────────────────────────────
# CORS (safe for dev)
# ─────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────
app.include_router(query_router, prefix="/api")

# ─────────────────────────────────────────────
# Static Files (React build)
# ─────────────────────────────────────────────
STATIC_DIR = os.path.join(BASE_DIR, "static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")

if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# ─────────────────────────────────────────────
# SPA Fallback (React)
# ─────────────────────────────────────────────
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    index_path = os.path.join(STATIC_DIR, "index.html")

    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {
        "message": "Frontend not built yet. Run 'npm run build' inside frontend folder."
    }