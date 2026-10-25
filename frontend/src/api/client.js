// API client for backend communication

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Keep Render free-tier backend warm — ping every 14 minutes to prevent cold starts
if (typeof window !== 'undefined' && API_BASE_URL.includes('onrender.com')) {
  const ping = () => fetch(`${API_BASE_URL}/health`, { method: 'GET' }).catch(() => {});
  ping(); // immediate ping on page load
  setInterval(ping, 14 * 60 * 1000); // then every 14 minutes
}

/**
 * Get auth token from Supabase session (if available).
 * Returns null if auth is not configured or user is not logged in.
 */
async function _getAuthToken() {
  try {
    const { getAuthToken } = await import('../lib/supabase');
    return await getAuthToken();
  } catch {
    return null;
  }
}

class APIClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    // Inject auth token if available
    let authHeaders = {};
    try {
      const token = await _getAuthToken();
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Auth not available — continue as guest
    }

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers,
      },
      ...options,
    };

    try {
      let response;
      const canRetry = !config.method || ['GET', 'HEAD', 'OPTIONS'].includes(config.method.toUpperCase());
      for (let attempt = 0; attempt < (canRetry ? 3 : 1); attempt += 1) {
        try {
          response = await fetch(url, config);
        } catch (error) {
          if (attempt === 2 || !canRetry) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        if (![502, 503, 504].includes(response.status) || attempt === 2 || !canRetry) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
      

      
      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }

      if (!response.ok) {
        // Extract error message from response
        let errorMessage = 'Request failed';
        
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.detail) {
          // FastAPI validation errors
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            // Pydantic validation errors
            errorMessage = data.detail.map(err => err.msg).join(', ');
          } else if (typeof data.detail === 'object') {
            errorMessage = data.detail.message || JSON.stringify(data.detail);
          }
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.error) {
          errorMessage = data.error;
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        // Create proper Error object with message
        const error = new Error(errorMessage);
        error.status = response.status;
        error.statusText = response.statusText;
        error.data = data;
        
        console.error('API Error:', {
          url,
          status: response.status,
          statusText: response.statusText,
          message: errorMessage,
          data
        });
        
        throw error;
      }

      return data;
    } catch (error) {
      // If it's already our formatted error, re-throw it
      if (error.status) {
        throw error;
      }
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error(`Cannot connect to backend. Make sure backend is running on ${this.baseURL}`);
        networkError.isNetworkError = true;
        throw networkError;
      }
      
      // Re-throw other errors
      console.error('API Request Error:', error);
      throw error;
    }
  }

  // Health check
  async checkHealth() {
    return this.request('/health');
  }

  async checkDetailedHealth() {
    return this.request('/health/detailed');
  }

  // Video analysis
  async analyzeVideo(source, language = 'english') {
    return this.request('/api/v1/analyze/sync', {
      method: 'POST',
      body: JSON.stringify({ source, language }),
    });
  }

  async analyzeVideoAsync(source, language = 'english', onProgress = null) {
    const data = await this.request('/api/v1/analyze', {
      method: 'POST',
      body: JSON.stringify({ source, language }),
    });

    if (data?.job_id && (data.status === 'processing' || data.status === 'pending' || !data.title)) {
      return this.pollJobProgress(data.job_id, onProgress);
    }

    return this.normalizeAnalysisResult(data, data?.job_id);
  }

  // File upload and analysis
  async uploadAndAnalyze(file, language = 'english', onProgress = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    const url = `${this.baseURL}/api/v1/upload`;

    // Get auth token for upload requests too
    const headers = {};
    try {
      const token = await _getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // continue
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers,
      });

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: text };
      }

      if (!response.ok) {
        const errorMessage = data.detail || data.message || `Upload failed with status ${response.status}`;
        throw new Error(errorMessage);
      }

      // If we got a job_id, poll for progress
      if (data.job_id) {
        return this.pollJobProgress(data.job_id, onProgress);
      }

      return this.normalizeAnalysisResult(data);
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend. Make sure backend is running on ${this.baseURL}`);
      }
      console.error('Upload Error:', error.message);
      throw error;
    }
  }

  normalizeAnalysisResult(result, jobId = null) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    const sourceType = result.type || result.source_type || 'video';
    const type = sourceType === 'pdf' ? 'pdf' : sourceType === 'audio' ? 'audio' : 'video';

    return {
      ...result,
      job_id: result.job_id || jobId || null,
      type,
    };
  }

  // Poll job progress through REST. This is more reliable than a long-lived
  // SSE connection behind Render/Vercel proxies.
  async pollJobProgress(jobId, onProgress = null) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let transientErrors = 0;
      let timeoutId = null;
      const startedAt = Date.now();
      const timeoutMs = 30 * 60 * 1000;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        fn(value);
      };

      const poll = async () => {
        if (settled) return;
        if (Date.now() - startedAt >= timeoutMs) {
          finish(reject, new Error('Analysis timed out after 30 minutes'));
          return;
        }

        try {
          const data = await this.request(`/api/v1/status/${jobId}`);
          transientErrors = 0;

          if (onProgress && data.progress != null) {
            onProgress(data.progress, data);
          }

          if (data.status === 'completed' && data.result) {
            finish(resolve, this.normalizeAnalysisResult(data.result, jobId));
            return;
          }
          if (data.status === 'failed') {
            finish(reject, new Error(data.error || data.message || 'Analysis failed'));
            return;
          }
        } catch (error) {
          transientErrors += 1;
          if (error?.status === 404) {
            finish(reject, new Error(
              'The server restarted during analysis. Please submit the request again.'
            ));
            return;
          }
          if (transientErrors >= 10) {
            finish(reject, new Error(
              'The backend is temporarily unavailable. Please retry the analysis.'
            ));
            return;
          }
          console.warn(`Temporary status check failure (${transientErrors}/10)`, error);
        }

        timeoutId = setTimeout(poll, transientErrors ? 5000 : 2000);
      };

      poll();
    });
  }

  async getAnalysisStatus(jobId) {
    return this.request(`/api/v1/status/${jobId}`);
  }

  // Chat
  async sendChatMessage(question, sessionId = null) {
    const payload = { question };
    if (sessionId) {
      payload.session_id = sessionId;
    }
    return this.request('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Chat History — retrieve past messages for a session
  async getChatHistory(sessionId) {
    if (!sessionId) return { messages: [], count: 0 };
    return this.request(`/api/v1/chat/history/${encodeURIComponent(sessionId)}`);
  }

  // Chat Sessions — list all sessions for the current user
  async getChatSessions() {
    return this.request('/api/v1/chat/sessions');
  }

  async clearChatSession(sessionId) {
    return this.request(`/api/v1/chat/session/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async exportUserData() {
    const server = await this.request('/api/v1/account/export');
    let lastAnalysis = null;
    try {
      const raw = localStorage.getItem('lastStudioAnalysis');
      lastAnalysis = raw ? JSON.parse(raw) : null;
    } catch {
      lastAnalysis = null;
    }
    return {
      exported_at: new Date().toISOString(),
      last_analysis: lastAnalysis,
      server,
    };
  }

  // Share Links
  async createShare(analysisData, customSlug = null) {
    return this.request('/api/v1/shares', {
      method: 'POST',
      body: JSON.stringify({
        ...analysisData,
        custom_slug: customSlug,
      }),
    });
  }

  async getShare(slug) {
    return this.request(`/api/v1/shares/${encodeURIComponent(slug)}`);
  }

  async listUserShares() {
    return this.request('/api/v1/shares/user/me');
  }

  async deleteShare(slug) {
    return this.request(`/api/v1/shares/${encodeURIComponent(slug)}`, {
      method: 'DELETE',
    });
  }
}

export default new APIClient();
