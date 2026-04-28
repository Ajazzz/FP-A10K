import os
from groq import Groq
from backend.services.retriever import hybrid_retrieve


def rerank_with_llm(query, docs):
    """
    Use LLM to pick most relevant chunks
    """

    api_key = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=api_key)

    context = "\n\n".join([d["content"][:500] for d in docs])

    prompt = f"""
You are a financial analyst.

Given the QUERY and CONTEXT, select the most relevant information.

QUERY:
{query}

CONTEXT:
{context}

Return ONLY the most relevant information for answering the query.
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        temperature=0,
        messages=[
            {"role": "user", "content": prompt}
        ],
    )

    return response.choices[0].message.content


def run_rag_pipeline(query: str):
    # Step 1: Hybrid retrieval
    docs = hybrid_retrieve(query)

    print("\n--- HYBRID RETRIEVAL ---")
    for d in docs[:3]:
        print(d["content"][:200])
    print("------------------------\n")

    # Step 2: Rerank
    refined_context = rerank_with_llm(query, docs)

    # Step 3: Final answer generation
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
        messages=[
            {"role": "user", "content": final_prompt}
        ],
    )

    answer = response.choices[0].message.content

    return {
        "answer": answer,
        "sources": docs
    }