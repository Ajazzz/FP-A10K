import os
import re
import fitz  # PyMuPDF
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────────
# LOAD ENV
# ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(BASE_DIR, "..", ".env")

load_dotenv(ENV_PATH)

print("ENV PATH:", ENV_PATH)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("INDEX_NAME")

print("ENV CHECK:", PINECONE_API_KEY)
print("INDEX NAME:", INDEX_NAME)

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY missing")

if not INDEX_NAME:
    raise ValueError("INDEX_NAME missing")

# ─────────────────────────────────────────────
# INIT MODEL (CPU SAFE)
# ─────────────────────────────────────────────
model = SentenceTransformer(
    "BAAI/bge-small-en-v1.5",
    device="cpu"
)

# ─────────────────────────────────────────────
# PINECONE SETUP
# ─────────────────────────────────────────────
pc = Pinecone(api_key=PINECONE_API_KEY)

existing_indexes = [i.name for i in pc.list_indexes()]

if INDEX_NAME not in existing_indexes:
    print(f"Creating index: {INDEX_NAME}")
    pc.create_index(
        name=INDEX_NAME,
        dimension=384,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")
    )
else:
    print(f"Using existing index: {INDEX_NAME}")

index = pc.Index(INDEX_NAME)

# ─────────────────────────────────────────────
# PDF → TEXT (SAFE EXTRACTION)
# ─────────────────────────────────────────────
def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)

    full_text = ""

    for page_num, page in enumerate(doc):
        text = page.get_text()

        if text.strip():
            full_text += f"\n\n# Page {page_num + 1}\n"
            full_text += text

    return full_text

# ─────────────────────────────────────────────
# CONTEXT-AWARE + RECURSIVE CHUNKING
# ─────────────────────────────────────────────
def split_by_sections(text):
    pattern = r"(Item\s+\d+[A-Z]?\.)"
    parts = re.split(pattern, text)

    sections = []
    current = ""

    for part in parts:
        if part.startswith("# Page"):
            if current:
                sections.append(current.strip())
            current = part
        else:
            current += "\n" + part

    if current:
        sections.append(current.strip())

    return sections


def recursive_chunk(text, chunk_size=300, overlap=50):
    words = text.split()

    chunks = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += (chunk_size - overlap)

    return chunks


def create_chunks(text):
    sections = split_by_sections(text)

    final_chunks = []

    for sec in sections:
        if len(sec.split()) < 300:
            final_chunks.append(sec)
        else:
            final_chunks.extend(recursive_chunk(sec))

    return final_chunks

# ─────────────────────────────────────────────
# INDEXING (BATCH SAFE)
# ─────────────────────────────────────────────
def index_pdf(pdf_path):
    print("Extracting text...")
    text = extract_text_from_pdf(pdf_path)

    print("Creating chunks...")
    chunks = create_chunks(text)

    print(f"Total chunks: {len(chunks)}")

    batch_size = 20

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]

        vectors = []

        for j, chunk in enumerate(batch):
            embedding = model.encode(chunk).tolist()

            vectors.append({
                "id": f"chunk-{i+j}",
                "values": embedding,
                "metadata": {
                    "text": chunk,
                    "source": "10K-NVDA"
                }
            })

        index.upsert(vectors=vectors)

        print(f"Uploaded batch {i // batch_size + 1}")

    print("Indexing complete.")

# ─────────────────────────────────────────────
# RUN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    pdf_path = os.path.join(os.path.dirname(__file__), "data", "10K-NVDA.pdf")

    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    index_pdf(pdf_path)