import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Load env
load_dotenv()

app = FastAPI()

# CORS (safe)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
from backend.routes.query import router as query_router
app.include_router(query_router, prefix="/api")

# Static paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Serve assets
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")


# Serve React app
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    index_path = os.path.join(STATIC_DIR, "index.html")

    if os.path.exists(index_path):
        return FileResponse(index_path)

    return {"error": "Frontend not built"}