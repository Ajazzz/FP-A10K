import os
import cohere
import numpy as np

from pinecone import Pinecone
from rank_bm25 import BM25Okapi

# ─────────────────────────────────────────────
# INIT CLIENTS
# ─────────────────────────────────────────────
COHERE_API_KEY = os.getenv("COHERE_API_KEY")

if not COHERE_API_KEY:
    raise ValueError("COHERE_API_KEY missing")

co = cohere.Client(COHERE_API_KEY)

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

index_name = os.getenv("INDEX_NAME")

index = pc.Index(index_name)

# ─────────────────────────────────────────────
# EMBEDDING
# ─────────────────────────────────────────────
def embed_query(query: str):

    response = co.embed(
        texts=[query],
        model="embed-english-v3.0",
        input_type="search_query",
        embedding_types=["float"]
    )

    return response.embeddings.float[0]

# ─────────────────────────────────────────────
# VECTOR SEARCH
# ─────────────────────────────────────────────
def vector_search(query, top_k=15):

    query_embedding = embed_query(query)

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
                "section": metadata.get("section", "GENERAL"),
                "score": float(match.get("score", 0))
            }
        })

    return docs

# ─────────────────────────────────────────────
# BM25 SEARCH
# ─────────────────────────────────────────────
def bm25_search(query, vector_docs, top_k=10):

    corpus = [doc["content"] for doc in vector_docs]

    tokenized_corpus = [doc.split(" ") for doc in corpus]

    bm25 = BM25Okapi(tokenized_corpus)

    tokenized_query = query.split(" ")

    scores = bm25.get_scores(tokenized_query)

    ranked_indices = np.argsort(scores)[::-1][:top_k]

    bm25_docs = []

    for idx in ranked_indices:

        doc = vector_docs[idx]

        doc["metadata"]["bm25_score"] = float(scores[idx])

        bm25_docs.append(doc)

    return bm25_docs

# ─────────────────────────────────────────────
# RERANK
# ─────────────────────────────────────────────
def rerank_documents(query, docs, top_k=7):

    documents = [d["content"] for d in docs]

    response = co.rerank(
        query=query,
        documents=documents,
        model="rerank-english-v3.0",
        top_n=top_k
    )

    reranked_docs = []

    for result in response.results:

        original_doc = docs[result.index]

        original_doc["metadata"]["rerank_score"] = float(
            result.relevance_score
        )

        reranked_docs.append(original_doc)

    return reranked_docs

# ─────────────────────────────────────────────
# HYBRID RETRIEVAL
# ─────────────────────────────────────────────
def hybrid_retrieve(query: str, top_k: int = 7):

    # Dense vector retrieval
    vector_docs = vector_search(query, top_k=20)

    # Sparse BM25 reranking
    bm25_docs = bm25_search(
        query,
        vector_docs,
        top_k=15
    )

    # Final reranking
    reranked_docs = rerank_documents(
        query,
        bm25_docs,
        top_k=top_k
    )

    return reranked_docs