from fastapi import APIRouter
from pydantic import BaseModel
from backend.rag.pipeline import run_rag_pipeline

router = APIRouter()


class QueryRequest(BaseModel):
    query: str


@router.post("/query")
def query_endpoint(req: QueryRequest):
    return run_rag_pipeline(req.query)