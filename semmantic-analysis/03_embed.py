"""
Step 3: Embed note chunks and exam questions using BAAI/bge-large-en-v1.5.

Embeddings are cached to disk as .npy files. Re-running this script is a no-op
unless the source data has changed (detected by record count mismatch).

Requires: pip install sentence-transformers numpy

Outputs:
  results/embeddings_notes.npy       shape (N_notes, 1024)
  results/embeddings_questions.npy   shape (N_questions, 1024)
"""

import os
import json
import numpy as np
from pathlib import Path

# Force offline mode — model must be in local HuggingFace cache.
# This prevents the library from hanging trying to reach huggingface.co
# on corporate networks with SSL inspection.
os.environ.setdefault("HF_HUB_OFFLINE", "1")

RESULTS = Path(__file__).parent / "results"
NOTES_DATA = RESULTS / "notes_data.json"
QUESTIONS_DATA = RESULTS / "questions_data.json"
NOTES_EMB = RESULTS / "embeddings_notes.npy"
QUESTIONS_EMB = RESULTS / "embeddings_questions.npy"

MODEL_NAME = "BAAI/bge-large-en-v1.5"


def is_cache_valid(emb_path: Path, expected_count: int) -> bool:
    if not emb_path.exists():
        return False
    try:
        arr = np.load(emb_path, mmap_mode="r")
        return arr.shape[0] == expected_count
    except Exception:
        return False


def embed_texts(model, texts: list, desc: str, batch_size: int = 32) -> np.ndarray:
    print(f"  Embedding {len(texts)} {desc}...")
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,   # cosine sim = dot product on L2-normalised vectors
        convert_to_numpy=True,
    )
    return embeddings


def main():
    # --- Check prerequisites ---
    for path in [NOTES_DATA, QUESTIONS_DATA]:
        if not path.exists():
            raise FileNotFoundError(
                f"{path.name} not found. Run 01_load_notes.py and 02_load_questions.py first."
            )

    notes = json.loads(NOTES_DATA.read_text(encoding="utf-8"))
    questions = json.loads(QUESTIONS_DATA.read_text(encoding="utf-8"))

    print(f"Notes to embed:     {len(notes)}")
    print(f"Questions to embed: {len(questions)}")

    notes_ok = is_cache_valid(NOTES_EMB, len(notes))
    questions_ok = is_cache_valid(QUESTIONS_EMB, len(questions))

    if notes_ok and questions_ok:
        print(
            "\nEmbedding cache is up to date. Nothing to do.\n"
            "Delete the .npy files in results/ to force re-embedding."
        )
        return

    # --- Load model ---
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        raise ImportError(
            "sentence-transformers not installed. Run:\n"
            "  pip install sentence-transformers"
        )

    print(f"\nLoading model: {MODEL_NAME}")
    model = SentenceTransformer(MODEL_NAME)
    dim = model.get_sentence_embedding_dimension()
    print(f"  Embedding dimension: {dim}")

    # --- Embed notes ---
    if not notes_ok:
        note_texts = [r["text"] for r in notes]
        note_embs = embed_texts(model, note_texts, "note chunks")
        np.save(NOTES_EMB, note_embs)
        print(f"  Saved -> {NOTES_EMB}  shape={note_embs.shape}")
    else:
        print(f"Notes cache OK ({len(notes)} items), skipping.")

    # --- Embed questions ---
    if not questions_ok:
        q_texts = [r["text"] for r in questions]
        q_embs = embed_texts(model, q_texts, "exam questions")
        np.save(QUESTIONS_EMB, q_embs)
        print(f"  Saved -> {QUESTIONS_EMB}  shape={q_embs.shape}")
    else:
        print(f"Questions cache OK ({len(questions)} items), skipping.")

    print("\nDone.")


if __name__ == "__main__":
    main()
