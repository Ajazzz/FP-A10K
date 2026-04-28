import os
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

#model = SentenceTransformer("BAAI/bge-small-en-v1.5")



from sentence_transformers import SentenceTransformer
import os

model = None

def get_model():
    global model
    if model is None:
        print("🔄 Loading embedding model...")
        model = SentenceTransformer(
            "BAAI/bge-small-en-v1.5",
            device="cpu"
        )
    return model


def embed_query(query: str):
    model = get_model()
    return model.encode(query).tolist()


def get_index():
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("INDEX_NAME")

    pc = Pinecone(api_key=api_key)
    return pc.Index(index_name)


def embed_text(text: str):
    return model.encode(text).tolist()


def keyword_score(query, text):
    """
    Simple BM25-like scoring (lightweight)
    """
    query_words = set(query.lower().split())
    text_words = set(text.lower().split())

    overlap = query_words.intersection(text_words)

    return len(overlap)


def hybrid_retrieve(query: str, top_k: int = 15):
    index = get_index()

    query_embedding = embed_text(query)

    results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )

    docs = []

    for match in results["matches"]:
        text = match["metadata"].get("text", "")

        docs.append({
            "content": text,
            "vector_score": match["score"],
            "keyword_score": keyword_score(query, text)
        })

    # 🔥 Combine scores
    for d in docs:
        d["final_score"] = (0.7 * d["vector_score"]) + (0.3 * d["keyword_score"])

    # Sort by final score
    docs = sorted(docs, key=lambda x: x["final_score"], reverse=True)

    return docs[:8]  # return top 8