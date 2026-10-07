/**
 * Shared TypeScript types for AI Video Agent
 */

export interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
}

export interface AnalysisData {
  job_id?: string;
  title: string;
  type: 'video' | 'audio' | 'pdf';
  summary?: string;
  action_items?: string;
  key_decisions?: string;
  open_questions?: string;
  transcript?: string;
  segments?: TranscriptSegment[];
  transcript_source?: 'captions' | 'whisper' | 'sarvam' | string;
  video_id?: string;
  duration_seconds?: number;
  metadata?: {
    duration?: number;
    pages?: number;
    language?: string;
    source?: string;
    [key: string]: any;
  };
}

export interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface ChatRequest {
  question: string;
  session_id?: string | null;
  debug?: boolean;
}

export interface ChatResponse {
  answer: string;
  session_id?: string | null;
  sources?: Array<{
    content: string;
    metadata?: Record<string, any>;
  }>;
  query_type?: string;
}

export interface AnalysisRequest {
  source: string;
  language?: string;
}

export interface UploadRequest {
  file: File;
  language?: string;
}

export interface JobStatus {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  result?: AnalysisData;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services?: {
    mistral?: boolean;
    sarvam?: boolean;
    supabase?: boolean;
    vector_store?: boolean;
  };
}
