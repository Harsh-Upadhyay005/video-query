"""
LLM Service Abstraction for RAG Queries.
This service should ONLY be used for:
1. Answering user questions using retrieved context
2. Explicit user-requested analysis (after RAG retrieval)

This service should NEVER be used during:
1. PDF ingestion
2. Document chunking
3. Automatic analysis without user request

The LLM receives RETRIEVED context, not entire documents.
"""

import os
from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod

from core.logger import get_logger
from core.mistral_client import get_mistral_client, MistralRateLimitError

logger = get_logger(__name__)


class LLMService(ABC):
    """Abstract base class for LLM services."""
    
    @abstractmethod
    def answer_question(
        self, 
        question: str, 
        context: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Answer a question using provided context.
        
        Args:
            question: User's question
            context: Retrieved context from RAG (NOT entire document)
            conversation_history: Optional conversation history
            
        Returns:
            Answer text
        """
        pass
    
    @abstractmethod
    def extract_structured_info(
        self,
        context: str,
        extraction_type: str,
        instructions: str
    ) -> str:
        """
        Extract structured information from context.
        Used for explicit user requests like "extract key decisions".
        
        Args:
            context: Retrieved context (NOT entire document)
            extraction_type: Type of extraction (decisions, questions, etc.)
            instructions: Specific extraction instructions
            
        Returns:
            Extracted information
        """
        pass
    
    @abstractmethod
    def summarize_context(self, context: str, max_length: int = 500) -> str:
        """
        Summarize provided context.
        
        Args:
            context: Retrieved context to summarize
            max_length: Maximum summary length in words
            
        Returns:
            Summary text
        """
        pass


class MistralLLMService(LLMService):
    """
    Mistral-based LLM service for RAG queries.
    
    IMPORTANT: This uses Mistral's LLM/chat capabilities (text → reasoning),
    NOT Mistral's STT capabilities (audio → text).
    """
    
    def __init__(self):
        """Initialize Mistral LLM service."""
        self.mistral_client = get_mistral_client(temperature=0.3)
        logger.info("[MistralLLM] Initialized for RAG queries only")
    
    def answer_question(
        self,
        question: str,
        context: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """
        Answer question using retrieved context.
        
        Args:
            question: User's question
            context: Retrieved context from vector store (NOT entire document)
            conversation_history: Optional [{question: ..., answer: ...}]
            
        Returns:
            Answer text
        """
        logger.info(f"[MistralLLM] Answering question with {len(context)} chars of context")
        
        try:
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            
            # Build prompt with context
            system_prompt = """You are a helpful AI assistant answering questions based on provided context.

Rules:
1. Answer ONLY using information from the provided context
2. If the context doesn't contain the answer, say "I cannot find this information in the provided content"
3. Cite page numbers or sections when available in the context
4. Be concise but complete
5. Do not make up information not present in the context

Context:
{context}"""
            
            # Add conversation history if available
            if conversation_history and len(conversation_history) > 0:
                history_text = "\n\nPrevious conversation:\n"
                for exchange in conversation_history[-3:]:  # Last 3 exchanges
                    history_text += f"Q: {exchange['question']}\nA: {exchange['answer']}\n"
                system_prompt += history_text
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", system_prompt),
                ("human", "{question}")
            ])
            
            llm = self.mistral_client._get_llm()
            chain = prompt | llm | StrOutputParser()
            
            # Use retry logic from mistral_client
            answer = self.mistral_client.invoke_with_retry(
                chain,
                {"context": context, "question": question},
                operation_name="RAG question answering"
            )
            
            logger.info(f"[MistralLLM] Generated answer: {len(answer)} chars")
            return answer
            
        except MistralRateLimitError as e:
            logger.error(f"[MistralLLM] Rate limit exceeded: {e}")
            return (
                "I'm currently experiencing high demand. "
                "Please wait a moment and try again, or rephrase your question."
            )
        except Exception as e:
            logger.error(f"[MistralLLM] Error answering question: {e}", exc_info=True)
            return "I encountered an error processing your question. Please try again."
    
    def extract_structured_info(
        self,
        context: str,
        extraction_type: str,
        instructions: str
    ) -> str:
        """
        Extract structured information from retrieved context.
        
        This is for EXPLICIT user requests, not automatic ingestion.
        Example: User clicks "Extract Key Decisions" button.
        
        Args:
            context: Retrieved context (NOT entire document)
            extraction_type: Type (e.g., "key_decisions", "action_items")
            instructions: Extraction instructions
            
        Returns:
            Extracted information
        """
        logger.info(f"[MistralLLM] Extracting {extraction_type} from {len(context)} chars")
        
        try:
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", instructions),
                ("human", "Content to analyze:\n\n{context}")
            ])
            
            llm = self.mistral_client._get_llm()
            chain = prompt | llm | StrOutputParser()
            
            result = self.mistral_client.invoke_with_retry(
                chain,
                {"context": context},
                operation_name=f"{extraction_type} extraction"
            )
            
            logger.info(f"[MistralLLM] Extracted {len(result)} chars")
            return result
            
        except MistralRateLimitError as e:
            logger.error(f"[MistralLLM] Rate limit during extraction: {e}")
            return f"Extraction temporarily unavailable due to rate limiting. Please try again shortly."
        except Exception as e:
            logger.error(f"[MistralLLM] Extraction error: {e}", exc_info=True)
            return f"Error during extraction: {str(e)}"
    
    def summarize_context(self, context: str, max_length: int = 500) -> str:
        """
        Summarize retrieved context.
        
        Args:
            context: Retrieved context to summarize
            max_length: Maximum summary length in words
            
        Returns:
            Summary text
        """
        logger.info(f"[MistralLLM] Summarizing {len(context)} chars (max {max_length} words)")
        
        try:
            from langchain_core.prompts import ChatPromptTemplate
            from langchain_core.output_parsers import StrOutputParser
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", f"""Create a concise summary of the provided content.
                
Maximum length: {max_length} words
Be clear, factual, and preserve key information.
Do not add information not present in the content."""),
                ("human", "{context}")
            ])
            
            llm = self.mistral_client._get_llm()
            chain = prompt | llm | StrOutputParser()
            
            summary = self.mistral_client.invoke_with_retry(
                chain,
                {"context": context},
                operation_name="context summarization"
            )
            
            logger.info(f"[MistralLLM] Generated summary: {len(summary)} chars")
            return summary
            
        except Exception as e:
            logger.error(f"[MistralLLM] Summarization error: {e}")
            return "Summary unavailable."


class AnalysisRequest:
    """
    Request for LLM-based analysis.
    Used for explicit user requests, not automatic processing.
    """
    
    def __init__(
        self,
        analysis_type: str,
        vector_store_key: str,
        query: Optional[str] = None,
        top_k: int = 10
    ):
        """
        Initialize analysis request.
        
        Args:
            analysis_type: Type of analysis (key_decisions, questions, summary)
            vector_store_key: Key to retrieve content from vector store
            query: Optional specific query for retrieval
            top_k: Number of chunks to retrieve
        """
        self.analysis_type = analysis_type
        self.vector_store_key = vector_store_key
        self.query = query
        self.top_k = top_k


class RAGLLMOrchestrator:
    """
    Orchestrates RAG retrieval + LLM processing.
    Ensures LLM only receives retrieved context, never entire documents.
    """
    
    def __init__(self, llm_service: Optional[LLMService] = None):
        """
        Initialize orchestrator.
        
        Args:
            llm_service: LLM service instance (defaults to MistralLLMService)
        """
        self.llm_service = llm_service or MistralLLMService()
        logger.info("[RAGLLMOrchestrator] Initialized")
    
    def answer_with_retrieval(
        self,
        vector_store,
        question: str,
        top_k: int = 5,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        custom_retriever=None
    ) -> Dict[str, Any]:
        """
        Answer question using RAG: Retrieve → LLM.
        
        Args:
            vector_store: Vector store to retrieve from
            question: User's question
            top_k: Number of chunks to retrieve (ignored if custom_retriever provided)
            conversation_history: Optional conversation history
            custom_retriever: Optional custom retriever (hybrid + reranked)
            
        Returns:
            Dict with answer, sources, retrieved_chunks
        """
        logger.info(f"[RAGOrchestrator] Answering question with top_k={top_k}")
        
        try:
            # STEP 1: Retrieve relevant context (NOT entire document)
            if custom_retriever:
                logger.info("[RAGOrchestrator] Using custom retriever (hybrid+reranked)")
                retriever = custom_retriever
            else:
                logger.info("[RAGOrchestrator] Using default dense retriever")
                retriever = vector_store.as_retriever(search_kwargs={"k": top_k})
            
            retrieved_docs = None
            if hasattr(retriever, "invoke"):
                retrieved_docs = retriever.invoke(question)
            elif hasattr(retriever, "get_relevant_documents"):
                retrieved_docs = retriever.get_relevant_documents(question)
            else:
                raise TypeError(f"Retriever {type(retriever).__name__} has no invoke/get_relevant_documents")
            
            if retrieved_docs and not hasattr(retrieved_docs[0], "page_content"):
                # Ensemble / compressor may wrap results unexpectedly
                normalized = []
                for item in retrieved_docs:
                    if hasattr(item, "page_content"):
                        normalized.append(item)
                    elif isinstance(item, tuple) and item and hasattr(item[0], "page_content"):
                        normalized.append(item[0])
                retrieved_docs = normalized
            
            retrieved_docs = retrieved_docs or []
            logger.info(f"[RAGOrchestrator] Retrieved {len(retrieved_docs)} chunks")
            
            if not retrieved_docs:
                return {
                    "answer": "I couldn't find relevant information to answer your question.",
                    "sources": [],
                    "retrieved_chunks": 0
                }
            
            # STEP 2: Format context from retrieved chunks
            context = "\n\n".join([
                f"[Chunk {i+1}]\n{doc.page_content}"
                for i, doc in enumerate(retrieved_docs)
            ])
            
            # STEP 3: Send ONLY retrieved context to LLM (not entire document)
            answer = self.llm_service.answer_question(
                question=question,
                context=context,
                conversation_history=conversation_history
            )
            
            # Extract source metadata
            sources = []
            for doc in retrieved_docs:
                if hasattr(doc, 'metadata') and doc.metadata:
                    sources.append(doc.metadata)
            
            return {
                "answer": answer,
                "sources": sources,
                "retrieved_chunks": len(retrieved_docs)
            }
            
        except Exception as e:
            logger.error(f"[RAGOrchestrator] Error: {e}", exc_info=True)
            return {
                "answer": f"Error processing question: {str(e)}",
                "sources": [],
                "retrieved_chunks": 0
            }
    
    def analyze_with_retrieval(
        self,
        vector_store,
        analysis_request: AnalysisRequest
    ) -> str:
        """
        Perform analysis using RAG: Retrieve → LLM.
        
        This is for EXPLICIT user requests, not automatic processing.
        
        Args:
            vector_store: Vector store to retrieve from
            analysis_request: Analysis request details
            
        Returns:
            Analysis result
        """
        logger.info(f"[RAGOrchestrator] Analyzing: {analysis_request.analysis_type}")
        
        try:
            # STEP 1: Retrieve relevant context
            query = analysis_request.query or self._get_default_query(
                analysis_request.analysis_type
            )
            
            retriever = vector_store.as_retriever(
                search_kwargs={"k": analysis_request.top_k}
            )
            retrieved_docs = retriever.invoke(query)
            
            logger.info(f"[RAGOrchestrator] Retrieved {len(retrieved_docs)} chunks")
            
            if not retrieved_docs:
                return f"No relevant content found for {analysis_request.analysis_type}."
            
            # STEP 2: Format context
            context = "\n\n".join([doc.page_content for doc in retrieved_docs])
            
            # STEP 3: Extract with LLM
            instructions = self._get_extraction_instructions(
                analysis_request.analysis_type
            )
            
            result = self.llm_service.extract_structured_info(
                context=context,
                extraction_type=analysis_request.analysis_type,
                instructions=instructions
            )
            
            return result
            
        except Exception as e:
            logger.error(f"[RAGOrchestrator] Analysis error: {e}", exc_info=True)
            return f"Analysis failed: {str(e)}"
    
    def _get_default_query(self, analysis_type: str) -> str:
        """Get default query for analysis type."""
        queries = {
            "key_decisions": "decisions made, conclusions reached, choices, determinations",
            "action_items": "tasks, action items, to-do, follow-up, next steps",
            "open_questions": "questions, uncertainties, unknowns, issues to resolve",
            "summary": "main points, key topics, important information"
        }
        return queries.get(analysis_type, "relevant information")
    
    def _get_extraction_instructions(self, analysis_type: str) -> str:
        """Get extraction instructions for analysis type."""
        instructions = {
            "key_decisions": """Extract key decisions from the provided content.

List each decision clearly with:
1. What was decided
2. Context (if available)

Format as a numbered list. Only include actual decisions, not discussions.""",
            
            "action_items": """Extract action items from the provided content.

List each action item with:
1. The task or action
2. Owner (if mentioned)
3. Deadline (if mentioned)

Format as a numbered list. Only include actionable items.""",
            
            "open_questions": """Extract open questions and unresolved issues from the provided content.

List each question or issue clearly.
Only include actual unanswered questions or unresolved points.""",
            
            "summary": """Create a clear, concise summary of the main points in the provided content."""
        }
        return instructions.get(analysis_type, "Extract relevant information.")


# Singleton instance
_llm_service_instance = None
_rag_orchestrator_instance = None


def get_llm_service() -> LLMService:
    """Get singleton LLM service instance."""
    global _llm_service_instance
    
    if _llm_service_instance is None:
        _llm_service_instance = MistralLLMService()
    
    return _llm_service_instance


def get_rag_orchestrator() -> RAGLLMOrchestrator:
    """Get singleton RAG orchestrator instance."""
    global _rag_orchestrator_instance
    
    if _rag_orchestrator_instance is None:
        _rag_orchestrator_instance = RAGLLMOrchestrator()
    
    return _rag_orchestrator_instance


def structured_output(
    prompt: str,
    output_model,
    context: str = "",
    max_retries: int = 1,
    temperature: float = 0.2,
):
    """
    Call Mistral with a JSON schema and validate with Pydantic.
    Retries once on parse failure.

    Args:
        prompt: System prompt / instructions
        output_model: Pydantic BaseModel class (used for validation)
        context: Content to analyze
        max_retries: Number of retries on validation failure
        temperature: LLM temperature

    Returns:
        Validated Pydantic model instance

    Raises:
        ValueError: If output cannot be parsed after retries
    """
    import json as _json
    from pydantic import ValidationError as PydanticValidationError

    logger.info(f"[StructuredOutput] Generating {output_model.__name__}")

    mistral_client = get_mistral_client(temperature=temperature)

    # Build the schema description for the prompt
    schema_json = _json.dumps(output_model.model_json_schema(), indent=2)

    system_prompt = f"""{prompt}

You MUST respond with valid JSON that matches this schema exactly:
{schema_json}

Respond ONLY with the JSON object, no markdown fences, no explanation."""

    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser

    chain_prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{context}"),
    ])

    llm = mistral_client._get_llm()
    chain = chain_prompt | llm | StrOutputParser()

    last_error = None

    for attempt in range(max_retries + 1):
        try:
            raw = mistral_client.invoke_with_retry(
                chain,
                {"context": context},
                operation_name=f"structured output ({output_model.__name__})",
            )

            # Strip markdown fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                # Remove ```json ... ``` wrapper
                lines = cleaned.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                cleaned = "\n".join(lines)

            parsed = _json.loads(cleaned)
            result = output_model.model_validate(parsed)

            logger.info(f"[StructuredOutput] Successfully parsed {output_model.__name__}")
            return result

        except (PydanticValidationError, _json.JSONDecodeError) as e:
            last_error = e
            logger.warning(
                f"[StructuredOutput] Parse attempt {attempt + 1} failed: {e}"
            )
            if attempt < max_retries:
                logger.info("[StructuredOutput] Retrying...")
                continue

        except Exception as e:
            logger.error(f"[StructuredOutput] LLM error: {e}")
            raise

    raise ValueError(
        f"Failed to parse structured output for {output_model.__name__} "
        f"after {max_retries + 1} attempts: {last_error}"
    )
