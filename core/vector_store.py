"""
Vector Store with Hybrid Search (BM25 + Dense) and Cross-Encoder Reranking.

Architecture:
1. Dense retrieval: Chroma with all-MiniLM-L6-v2 embeddings (semantic search)
2. Sparse retrieval: BM25 (keyword/lexical search)
3. Hybrid: EnsembleRetriever combining both
4. Reranking: Cross-encoder for final relevance scoring

Persistence:
- Chroma: Persisted to disk in CHROMA_DIR
- BM25: In-memory, rebuilt from persisted documents (stored as pickle)
"""

import os 
import hashlib
import pickle
from typing import List, Optional
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from core.logger import get_logger

logger = get_logger(__name__)

CHROMA_DIR = "vector_db"
DOCS_DIR = "vector_db_docs"  # Store chunked documents for BM25
COLLECTION_NAME = "meeting_transcript"  # Default for backward compatibility
EMBEDDING_MODEL = "all-MiniLM-L6-v2"

# Hybrid search configuration
HYBRID_DENSE_WEIGHT = 0.5   # Weight for dense (embedding) retrieval
HYBRID_SPARSE_WEIGHT = 0.5  # Weight for sparse (BM25) retrieval

# Ensure docs directory exists
os.makedirs(DOCS_DIR, exist_ok=True)


def _get_collection_name(video_id: str = None) -> str:
    """
    Generate a unique collection name for a video to prevent cross-contamination.
    
    Args:
        video_id: Optional video identifier
        
    Returns:
        Collection name (sanitized for ChromaDB)
    """
    if not video_id:
        return COLLECTION_NAME  # Backward compatible default
    
    # Sanitize video_id for ChromaDB (alphanumeric, underscores, hyphens only)
    # ChromaDB collection names must be 3-63 chars, start/end with alphanumeric
    sanitized = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in video_id)
    
    # Ensure it starts with letter or number
    if sanitized and not sanitized[0].isalnum():
        sanitized = 'v_' + sanitized
    
    # Limit length (ChromaDB max is 63 chars)
    if len(sanitized) > 60:
        # Use hash suffix to ensure uniqueness
        hash_suffix = hashlib.md5(video_id.encode()).hexdigest()[:8]
        sanitized = sanitized[:50] + '_' + hash_suffix
    
    return sanitized or COLLECTION_NAME

# Singleton cache for embeddings model
_embeddings_instance = None
_docs_cache = {}


def get_embeddings():
    """
    Get singleton HuggingFace embeddings model with optimized batching.
    
    Optimizations:
    - Cached singleton to avoid reloading
    - Batch size 128 for faster encoding
    - Normalized embeddings for better similarity search
    """
    global _embeddings_instance
    if _embeddings_instance is None:
        device = os.getenv("EMBEDDING_DEVICE", "cpu")
        logger.info(f"[VectorStore] Initializing singleton embeddings ({EMBEDDING_MODEL}) on {device}")
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            model_kwargs={"device": device},
            encode_kwargs={
                "batch_size": 128,
                "normalize_embeddings": True,
            }
        )
        logger.info("[VectorStore] Embeddings model initialized and cached")
    return _embeddings_instance

def build_vector_store(transcript: str, metadata: dict = None) -> Chroma:
    """
    Build vector store from transcript with optional metadata.
    Also persists chunked documents for BM25 retrieval.
    
    Optimized for speed:
    - Larger chunks (3000 chars) reduce total chunk count
    - Batch embedding with size 128 for faster processing
    - Parallel-ready architecture
    
    Args:
        transcript: Full transcript text
        metadata: Optional dict with video_id, source, timestamps, etc.
    
    Returns:
        Chroma vector store
    """
    logger.info("[VectorStore] Building vector store with hybrid search support")

    # Optimized chunk size for speed (fewer chunks = faster embedding)
    # 3000 chars is ~750 tokens, good balance of speed and semantic coherence
    chunk_size = int(os.getenv("VECTOR_CHUNK_SIZE", "3000"))
    chunk_overlap = int(os.getenv("VECTOR_CHUNK_OVERLAP", "300"))
    
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""]  # Prefer natural boundaries
    )
    chunks = splitter.split_text(transcript)

    logger.info(f"[VectorStore]   Created {len(chunks)} chunks (size: {chunk_size}, overlap: {chunk_overlap})")

    # Build documents with metadata
    docs = []
    base_metadata = metadata or {}
    video_id = base_metadata.get('video_id')
    
    for i, chunk in enumerate(chunks):
        chunk_metadata = {
            'chunk_index': i,
            'chunk_total': len(chunks),
            **base_metadata  # Include any additional metadata
        }
        docs.append(Document(page_content=chunk, metadata=chunk_metadata))

    # Get embeddings model (singleton, cached)
    embeddings = get_embeddings()
    
    # Use per-video collection to prevent cross-contamination
    collection_name = _get_collection_name(video_id)
    
    logger.info(f"[VectorStore]   Generating embeddings for {len(docs)} documents...")
    
    # Create vector store with batched embedding
    vector_store = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        collection_name=collection_name,
        persist_directory=CHROMA_DIR
    )

    # Persist documents for BM25 retrieval (caches in memory and writes to disk)
    _persist_documents(docs, video_id)

    logger.info(f"[VectorStore]   Vector store ready in collection '{collection_name}'")
    logger.info("[VectorStore]   Documents ready for BM25 retrieval")
    return vector_store



def load_vector_store(video_id: str = None) -> Optional[Chroma]:
    """
    Load a persisted Chroma collection for a source.
    
    Args:
        video_id: Job/session ID used when the collection was created.
    """
    embeddings = get_embeddings()
    collection_name = _get_collection_name(video_id)
    
    try:
        vector_store = Chroma(
            collection_name=collection_name,
            embedding_function=embeddings,
            persist_directory=CHROMA_DIR
        )
        
        count = 0
        try:
            count = vector_store._collection.count()
        except Exception:
            try:
                count = len(vector_store.get().get("ids") or [])
            except Exception:
                count = 0
        
        if count == 0:
            logger.warning(
                f"[VectorStore] Collection '{collection_name}' is empty or missing"
            )
            return None
        
        logger.info(
            f"[VectorStore]   Loaded collection '{collection_name}' ({count} chunks)"
        )
        return vector_store
    except Exception as e:
        logger.error(f"[VectorStore] Failed to load collection '{collection_name}': {e}")
        return None


def get_retriever(vector_store: Chroma, k: int = 4):
    """
    Get basic dense retriever (for backward compatibility).
    
    For better results, use get_hybrid_retriever or get_reranked_retriever.
    """
    return vector_store.as_retriever(
        search_type='similarity',
        search_kwargs={"k": k}
    )


def _persist_documents(docs: List[Document], video_id: str = None):
    """
    Persist chunked documents for BM25 retrieval.
    
    BM25Retriever is in-memory and needs documents to be rebuilt on load.
    We persist them as pickle files keyed by video_id.
    
    Args:
        docs: List of Document chunks
        video_id: Video/source identifier
    """
    try:
        collection_name = _get_collection_name(video_id)
        _docs_cache[collection_name] = docs
        docs_path = os.path.join(DOCS_DIR, f"{collection_name}_docs.pkl")
        
        with open(docs_path, 'wb') as f:
            pickle.dump(docs, f)
        
        logger.info(f"[VectorStore]   Persisted {len(docs)} documents to memory and {docs_path}")
        
    except Exception as e:
        logger.error(f"[VectorStore] Failed to persist documents: {e}")


def _load_documents(video_id: str = None) -> Optional[List[Document]]:
    """
    Load persisted documents for BM25 retrieval.
    Checks memory cache first to avoid disk I/O.
    
    Args:
        video_id: Video/source identifier
        
    Returns:
        List of Document chunks or None if not found
    """
    try:
        collection_name = _get_collection_name(video_id)
        if collection_name in _docs_cache:
            return _docs_cache[collection_name]

        docs_path = os.path.join(DOCS_DIR, f"{collection_name}_docs.pkl")
        
        if not os.path.exists(docs_path):
            logger.warning(f"[VectorStore] No persisted documents found at {docs_path}")
            return None
        
        with open(docs_path, 'rb') as f:
            docs = pickle.load(f)
        
        _docs_cache[collection_name] = docs
        logger.info(f"[VectorStore]   Loaded {len(docs)} persisted documents from disk")
        return docs
        
    except Exception as e:
        logger.error(f"[VectorStore] Failed to load documents: {e}")
        return None


def get_bm25_retriever(docs: List[Document], k: int = 20):
    """
    Create BM25 sparse retriever from documents.
    
    BM25 is a keyword-based ranking function that excels at:
    - Exact keyword matches
    - Proper nouns and named entities
    - Technical terms
    
    Args:
        docs: List of Document chunks
        k: Number of documents to retrieve
        
    Returns:
        BM25Retriever instance or None if unavailable
    """
    try:
        from langchain_community.retrievers import BM25Retriever
        
        logger.info(f"[VectorStore] Creating BM25 retriever with {len(docs)} docs")
        
        bm25_retriever = BM25Retriever.from_documents(docs)
        bm25_retriever.k = k
        
        logger.info(f"[VectorStore]   BM25 retriever created (k={k})")
        return bm25_retriever
        
    except ImportError:
        logger.warning("[VectorStore] BM25Retriever not available (install rank-bm25)")
        return None
    except Exception as e:
        logger.error(f"[VectorStore] Failed to create BM25 retriever: {e}")
        return None


def get_hybrid_retriever(
    vector_store: Chroma,
    docs: List[Document],
    k: int = 20,
    dense_weight: float = HYBRID_DENSE_WEIGHT,
    sparse_weight: float = HYBRID_SPARSE_WEIGHT
):
    """
    Create hybrid retriever combining dense (Chroma) and sparse (BM25) search.
    
    Hybrid search combines:
    - Dense retrieval: Semantic similarity via embeddings (good for concepts)
    - Sparse retrieval: Keyword matching via BM25 (good for exact terms)
    
    The EnsembleRetriever merges results using weighted reciprocal rank fusion.
    
    Args:
        vector_store: Chroma vector store
        docs: Document chunks (for BM25)
        k: Number of candidates to fetch from each retriever
        dense_weight: Weight for dense retriever (default: 0.5)
        sparse_weight: Weight for sparse retriever (default: 0.5)
        
    Returns:
        EnsembleRetriever or fallback to dense-only retriever
    """
    try:
        try:
            from langchain.retrievers import EnsembleRetriever
        except ImportError:
            from langchain_community.retrievers import EnsembleRetriever
        
        logger.info(f"[VectorStore] Creating hybrid retriever (k={k})")
        
        # Dense retriever (embeddings)
        dense_retriever = vector_store.as_retriever(
            search_type='similarity',
            search_kwargs={"k": k}
        )
        
        # Sparse retriever (BM25)
        sparse_retriever = get_bm25_retriever(docs, k=k)
        
        if sparse_retriever is None:
            logger.warning("[VectorStore] BM25 unavailable, using dense-only retrieval")
            return dense_retriever
        
        # Combine with ensemble
        ensemble_retriever = EnsembleRetriever(
            retrievers=[dense_retriever, sparse_retriever],
            weights=[dense_weight, sparse_weight]
        )
        
        logger.info(
            f"[VectorStore]   Hybrid retriever created "
            f"(dense={dense_weight}, sparse={sparse_weight})"
        )
        return ensemble_retriever
        
    except ImportError as e:
        logger.warning(f"[VectorStore] EnsembleRetriever not available: {e}")
        logger.warning("[VectorStore] Falling back to dense-only retrieval")
        return vector_store.as_retriever(search_kwargs={"k": k})
    except Exception as e:
        logger.error(f"[VectorStore] Failed to create hybrid retriever: {e}")
        logger.warning("[VectorStore] Falling back to dense-only retrieval")
        return vector_store.as_retriever(search_kwargs={"k": k})


def get_reranked_retriever(
    vector_store: Chroma,
    docs: List[Document],
    fetch_k: int = 20,
    top_n: int = 5,
    use_hybrid: bool = True
):
    """
    Create retriever with cross-encoder reranking.
    
    Full pipeline:
    1. Hybrid retrieval: Fetch fetch_k candidates (dense + sparse)
    2. Cross-encoder reranking: Score all (query, doc) pairs
    3. Return top_n highest-scoring documents
    
    Args:
        vector_store: Chroma vector store
        docs: Document chunks (for BM25)
        fetch_k: Number of candidates to fetch before reranking
        top_n: Number of final documents after reranking
        use_hybrid: Use hybrid search (True) or dense-only (False)
        
    Returns:
        ContextualCompressionRetriever with reranking or base retriever
    """
    from core.reranker import get_reranked_retriever as wrap_with_reranker
    
    # Get base retriever (hybrid or dense)
    if use_hybrid:
        base_retriever = get_hybrid_retriever(vector_store, docs, k=fetch_k)
    else:
        base_retriever = vector_store.as_retriever(search_kwargs={"k": fetch_k})
    
    # Wrap with cross-encoder reranking
    reranked_retriever = wrap_with_reranker(
        base_retriever=base_retriever,
        top_n=top_n
    )
    
    logger.info(
        f"[VectorStore]   Reranked retriever ready "
        f"(hybrid={use_hybrid}, fetch_k={fetch_k}, top_n={top_n})"
    )
    
    return reranked_retriever


