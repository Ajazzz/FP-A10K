import os
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone

# 🔹 Load embedding model once
model = SentenceTransformer("all-MiniLM-L6-v2")

# 🔹 Pinecone init
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index_name = os.getenv("INDEX_NAME")
index = pc.Index(index_name)


def embed_text(text: str):
    return model.encode(text).tolist()


def hybrid_retrieve(query: str, top_k: int = 5):
    """
    Hybrid retrieval (vector only for now, extend later with BM25)
    """

    query_embedding = embed_text(query)

    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )

    docs = []

    for match in results.get("matches", []):
        metadata = match.get("metadata", {}) or {}

        docs.append({
            "content": metadata.get("text", ""),
            "metadata": {
                "source": metadata.get("source", "Unknown"),
                "page": metadata.get("page", 1),
                "score": match.get("score", 0)
            }
        })

    return docs