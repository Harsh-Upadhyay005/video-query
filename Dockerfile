# ──────────────────────────────────────────────────────────────────────────────
# AI Video Agent — Production Dockerfile
#
# Build-time optimisations:
#   • Single stage (no multi-stage copy penalty for ML packages)
#   • requirements split into "heavy" (torch/ML) and "app" layers so the
#     expensive ML layer is cached and only re-runs when it changes
#   • Test packages excluded via requirements-prod.txt
#   • Node.js removed (not used at runtime)
#   • HuggingFace model pre-downloaded into the image layer so the first
#     request is instant instead of triggering a 400 MB download
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        curl \
        gcc \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN useradd -m -u 1000 -s /bin/bash appuser \
    && mkdir -p /app/downloads /app/logs /app/vector_db /app/vector_db_docs \
    && chown -R appuser:appuser /app

WORKDIR /app

# ── Layer 1: Heavy ML deps (cached unless requirements-ml.txt changes) ────────
COPY requirements-ml.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements-ml.txt

# ── Layer 2: App deps (cached unless requirements-app.txt changes) ────────────
COPY requirements-app.txt .
RUN pip install --no-cache-dir -r requirements-app.txt

# ── Layer 3: Pre-download embedding + reranker models into the image ──────────
# This means the first request never blocks on a 400 MB download.
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('all-MiniLM-L6-v2'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2'); \
print('Models cached.')"

# ── Application code (invalidates only when code changes) ────────────────────
COPY --chown=appuser:appuser . .

# ── Runtime directories ───────────────────────────────────────────────────────
RUN mkdir -p downloads logs vector_db vector_db_docs \
    && chown -R appuser:appuser downloads logs vector_db vector_db_docs

# ── Environment ───────────────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    # Point HuggingFace cache at a writable path inside the image
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
