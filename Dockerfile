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
        libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# ── Environment ───────────────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    HF_HOME=/app/.cache/huggingface \
    TRANSFORMERS_CACHE=/app/.cache/huggingface

# ── Non-root user & directories ───────────────────────────────────────────────
RUN useradd -m -u 1000 -s /bin/bash appuser \
    && mkdir -p /app/downloads /app/logs /app/vector_db /app/vector_db_docs /app/temp /app/.cache/huggingface \
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
# Pre-download into HF_HOME (/app/.cache/huggingface) and set ownership for appuser
RUN python -c "\
from sentence_transformers import SentenceTransformer, CrossEncoder; \
SentenceTransformer('all-MiniLM-L6-v2'); \
CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2'); \
print('Models cached successfully.')" \
    && chown -R appuser:appuser /app/.cache

# ── Application code (invalidates only when code changes) ────────────────────
COPY --chown=appuser:appuser . .

# ── Runtime directory permissions ─────────────────────────────────────────────
RUN mkdir -p downloads logs vector_db vector_db_docs temp .cache/huggingface \
    && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
