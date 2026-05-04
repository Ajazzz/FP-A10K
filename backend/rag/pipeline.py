import os
from groq import Groq
from backend.services.retriever import hybrid_retrieve


def rerank_with_llm(query, docs):
    """
    Use LLM to extract most relevant context
    """

    api_key = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=api_key)

    context = "\n\n".join([d.get("content", "")[:500] for d in docs])

    prompt = f"""
You are a financial analyst.

Given the QUERY and CONTEXT, extract the most relevant information.

QUERY:
{query}

CONTEXT:
{context}

Return only the relevant information.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )

    return response.choices[0].message.content


def run_rag_pipeline(query: str):
    # 🔹 Step 1: Retrieve
    docs = hybrid_retrieve(query)

    print("\n--- HYBRID RETRIEVAL ---")
    for d in docs[:3]:
        print(d.get("content", "")[:200])
    print("------------------------\n")

    # 🔹 Step 2: Rerank / refine
    refined_context = rerank_with_llm(query, docs)

    # 🔹 Step 3: Final answer
    api_key = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=api_key)

    final_prompt = f"""
You are an FP&A analyst.

Use ONLY the context below.

CONTEXT:
{refined_context}

QUESTION:
{query}

Answer clearly and precisely.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        temperature=0,
        messages=[{"role": "user", "content": final_prompt}],
    )

    answer = response.choices[0].message.content

    # 🔥 Step 4: Format sources for frontend
    formatted_sources = []

    for d in docs:
        metadata = d.get("metadata", {})

        formatted_sources.append({
            "document": metadata.get("source", "Unknown"),
            "page_number": metadata.get("page", 1),
            "snippet": d.get("content", "")[:300],
            "relevance_score": metadata.get("score", 0)
        })

    print("FORMATTED SOURCES:", formatted_sources[:2])

    return {
        "answer": answer,
        "sources": formatted_sources
    }