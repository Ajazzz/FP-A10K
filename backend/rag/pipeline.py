import os
from groq import Groq

from backend.services.retriever import hybrid_retrieve

# ─────────────────────────────────────────────
# INIT GROQ
# ─────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY missing")

client = Groq(api_key=GROQ_API_KEY)

# ─────────────────────────────────────────────
# BUILD CONTEXT
# ─────────────────────────────────────────────
def build_context(docs):

    context_parts = []

    for i, d in enumerate(docs):

        metadata = d.get("metadata", {})

        source = metadata.get("source", "Unknown")

        page = metadata.get("page", 1)

        section = metadata.get("section", "GENERAL")

        content = d.get("content", "")

        context_parts.append(
            f"""
SOURCE {i+1}
Document: {source}
Page: {page}
Section: {section}

CONTENT:
{content}
"""
        )

    return "\n\n".join(context_parts)

# ─────────────────────────────────────────────
# FINAL ANSWER GENERATION
# ─────────────────────────────────────────────
def generate_answer(query, context):

    prompt = f"""
You are a senior FP&A analyst.

Answer ONLY using the provided context.

If the answer is not available in the context,
say:
"I could not find that information in the documents."

Provide:
- concise analysis
- financial insights
- direct answer
- clear wording

CONTEXT:
{context}

QUESTION:
{query}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        temperature=0,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ],
    )

    return response.choices[0].message.content

# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────
def run_rag_pipeline(query: str):

    # 🔹 Step 1: Hybrid Retrieval
    docs = hybrid_retrieve(query)

    print("\n--- HYBRID RETRIEVAL ---")

    for d in docs[:3]:

        metadata = d.get("metadata", {})

        print(
            f"""
SOURCE: {metadata.get('source')}
PAGE: {metadata.get('page')}
SECTION: {metadata.get('section')}
SCORE: {metadata.get('rerank_score', 0)}

{d.get('content', '')[:300]}
"""
        )

    print("------------------------\n")

    # 🔹 Step 2: Build Context
    context = build_context(docs)

    # 🔹 Step 3: Final Answer
    answer = generate_answer(query, context)

    # 🔹 Step 4: Format Sources
    formatted_sources = []

    for d in docs:

        metadata = d.get("metadata", {})

        formatted_sources.append({
            "document": metadata.get("source", "Unknown"),
            "page_number": metadata.get("page", 1),
            "section": metadata.get("section", "GENERAL"),
            "snippet": d.get("content", "")[:400],
            "relevance_score": metadata.get(
                "rerank_score",
                metadata.get("score", 0)
            )
        })

    return {
        "answer": answer,
        "sources": formatted_sources
    }