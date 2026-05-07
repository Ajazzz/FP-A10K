from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.rag.pipeline import run_rag_pipeline

# ─────────────────────────────────────────────
# ROUTER
# ─────────────────────────────────────────────
router = APIRouter()

# ─────────────────────────────────────────────
# REQUEST MODEL
# ─────────────────────────────────────────────
class QueryRequest(BaseModel):
    query: str

# ─────────────────────────────────────────────
# QUERY ENDPOINT
# ─────────────────────────────────────────────
@router.post("/query")

async def query_endpoint(req: QueryRequest):

    try:

        query = req.query.strip()

        # Validation
        if not query:

            raise HTTPException(
                status_code=400,
                detail="Query cannot be empty"
            )

        print(f"\n🔍 QUERY: {query}")

        # Run pipeline
        result = run_rag_pipeline(query)

        # Safety fallback
        if not result:

            raise HTTPException(
                status_code=500,
                detail="Pipeline returned empty response"
            )

        return result

    except HTTPException:
        raise

    except Exception as e:

        print(f"\n❌ QUERY ERROR: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail=f"Backend error: {str(e)}"
        )