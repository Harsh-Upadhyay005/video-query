'use strict';

const API_BASE = 'https://video-query-io3r.onrender.com';

// ── State ──────────────────────────────────────────────────────────────────
let currentJobId   = null;
let currentSession = null;
let selectedLang   = 'english';
let resultData     = null;
let pollTimer      = null;

// ── DOM refs ───────────────────────────────────────────────────────────────
const urlInput         = document.getElementById('url-input');
const pasteBtn         = document.getElementById('paste-btn');
const analyzeBtn       = document.getElementById('analyze-btn');
const retryBtn         = document.getElementById('retry-btn');
const saveBtn          = document.getElementById('save-btn');
const progressSection  = document.getElementById('progress-section');
const progressLabel    = document.getElementById('progress-label');
const progressPct      = document.getElementById('progress-pct');
const progressBar      = document.getElementById('progress-bar');
const errorSection     = document.getElementById('error-section');
const errorMsg         = document.getElementById('error-msg');
const resultSection    = document.getElementById('result-section');
const chatSection      = document.getElementById('chat-section');
const chatMessages     = document.getElementById('chat-messages');
const chatInput        = document.getElementById('chat-input');
const chatSend         = document.getElementById('chat-send');
const transcriptToggle = document.getElementById('transcript-toggle');
const transcriptBody   = document.getElementById('transcript-body');
const libraryList      = document.getElementById('library-list');
const libraryEmptyHint = document.getElementById('library-empty-hint');

// ── Nav ────────────────────────────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    if (view === 'library') renderLibrary();
  });
});

// ── Language selector ──────────────────────────────────────────────────────
document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedLang = btn.dataset.lang;
  });
});

// ── Paste button ───────────────────────────────────────────────────────────
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text.includes('youtube.com') || text.includes('youtu.be')) {
      urlInput.value = text.trim();
    }
  } catch { /* clipboard permission denied */ }
});

// ── Auto-populate from content script ─────────────────────────────────────
chrome.storage.local.get('pendingVideo', ({ pendingVideo }) => {
  if (pendingVideo?.url) {
    urlInput.value = pendingVideo.url;
    chrome.storage.local.remove('pendingVideo');
  }
});

// Listen for new pending videos while panel is open
chrome.storage.onChanged.addListener((changes) => {
  if (changes.pendingVideo?.newValue?.url) {
    urlInput.value = changes.pendingVideo.newValue.url;
    chrome.storage.local.remove('pendingVideo');
  }
});

// ── Analyze ────────────────────────────────────────────────────────────────
analyzeBtn.addEventListener('click', startAnalysis);
retryBtn.addEventListener('click', () => {
  hide(errorSection);
  startAnalysis();
});

async function startAnalysis() {
  const url = urlInput.value.trim();
  if (!url) { showError('Please enter a YouTube URL.'); return; }
  if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
    showError('Only YouTube URLs are supported in the extension. Use the full web app for file uploads.');
    return;
  }

  reset();
  showProgress('Connecting to backend…', 0);
  analyzeBtn.disabled = true;

  try {
    // Start the job
    const res = await apiFetch('/api/v1/analyze', {
      method: 'POST',
      body: JSON.stringify({ source: url, language: selectedLang }),
    });

    if (!res.job_id) throw new Error('Backend did not return a job ID.');

    currentJobId = res.job_id;
    showProgress('Job queued — waiting for server…', 5);
    startPolling(currentJobId);

  } catch (err) {
    analyzeBtn.disabled = false;
    showError(err.message);
  }
}

// ── SSE polling ────────────────────────────────────────────────────────────
function startPolling(jobId) {
  if (pollTimer) clearInterval(pollTimer);

  // Use EventSource for live progress
  const es = new EventSource(`${API_BASE}/api/v1/progress/${jobId}`);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.progress != null) {
        showProgress(data.message || data.stage || 'Processing…', data.progress);
      }

      if (data.status === 'completed' && data.result) {
        es.close();
        analyzeBtn.disabled = false;
        hide(progressSection);
        showResult(data.result, jobId);
      } else if (data.status === 'failed') {
        es.close();
        analyzeBtn.disabled = false;
        showError(data.error || data.message || 'Analysis failed.');
      }
    } catch { /* malformed event */ }
  };

  es.onerror = () => {
    es.close();
    // Fall back to polling the status endpoint
    pollTimer = setInterval(() => pollStatus(jobId, pollTimer), 3000);
  };
}

async function pollStatus(jobId, timer) {
  try {
    const data = await apiFetch(`/api/v1/status/${jobId}`);
    if (data.progress != null) showProgress(data.message || 'Processing…', data.progress);
    if (data.status === 'completed' && data.result) {
      clearInterval(timer);
      analyzeBtn.disabled = false;
      hide(progressSection);
      showResult(data.result, jobId);
    } else if (data.status === 'failed') {
      clearInterval(timer);
      analyzeBtn.disabled = false;
      showError(data.error || 'Analysis failed.');
    }
  } catch { /* transient — keep polling */ }
}

// ── Render result ──────────────────────────────────────────────────────────
function showResult(result, jobId) {
  resultData = { ...result, job_id: jobId };
  currentSession = jobId;

  // Badges
  const src = result.transcript_source;
  document.getElementById('source-badge').classList.toggle('hidden', src !== 'captions');
  document.getElementById('source-badge-whisper').classList.toggle('hidden', src !== 'whisper');
  document.getElementById('source-badge-sarvam').classList.toggle('hidden', src !== 'sarvam');

  const segs = result.segments || [];
  const segBadge = document.getElementById('segment-count');
  if (segs.length > 0) {
    segBadge.textContent = `${segs.length} timestamps`;
    segBadge.classList.remove('hidden');
  }

  document.getElementById('result-title').textContent = result.title || 'Untitled';
  document.getElementById('summary-text').textContent  = result.summary || '—';

  const actionCard = document.getElementById('action-card');
  if (result.action_items) {
    document.getElementById('action-text').textContent = result.action_items;
    actionCard.classList.remove('hidden');
  }

  const decisionCard = document.getElementById('decision-card');
  if (result.key_decisions) {
    document.getElementById('decision-text').textContent = result.key_decisions;
    decisionCard.classList.remove('hidden');
  }

  // Transcript
  buildTranscript(segs, result.transcript, result.video_id);

  // Hint for segment toggle
  document.getElementById('seg-toggle-hint').textContent =
    segs.length > 0 ? `(${segs.length} timestamped segments)` : '';

  show(resultSection);
  show(chatSection);
  // Clear old chat
  chatMessages.innerHTML = '';
  addBubble('assistant', `I've analyzed "${result.title}". Ask me anything about it!`);
}

function buildTranscript(segments, plainText, videoId) {
  transcriptBody.innerHTML = '';

  if (segments && segments.length > 0) {
    segments.forEach((seg) => {
      const row = document.createElement('div');
      row.className = 'seg-row';

      const ts = document.createElement('a');
      ts.className = 'seg-ts';
      ts.textContent = formatTime(seg.start);
      if (videoId) {
        ts.href = `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seg.start)}`;
        ts.target = '_blank';
        ts.rel = 'noopener noreferrer';
      }

      const txt = document.createElement('span');
      txt.className = 'seg-text';
      txt.textContent = seg.text;

      row.appendChild(ts);
      row.appendChild(txt);
      transcriptBody.appendChild(row);
    });
  } else if (plainText) {
    const p = document.createElement('p');
    p.className = 'plain-text';
    p.textContent = plainText;
    transcriptBody.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.className = 'plain-text';
    p.textContent = 'No transcript available.';
    transcriptBody.appendChild(p);
  }
}

// ── Transcript toggle ──────────────────────────────────────────────────────
transcriptToggle.addEventListener('click', () => {
  const hidden = transcriptBody.classList.toggle('hidden');
  transcriptToggle.textContent = hidden ? 'Show' : 'Hide';
});

// ── Copy buttons ───────────────────────────────────────────────────────────
document.querySelectorAll('.copy-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    if (target) {
      navigator.clipboard.writeText(target.textContent).then(() => {
        btn.style.color = '#166534';
        setTimeout(() => (btn.style.color = ''), 1500);
      });
    }
  });
});

// ── Save to library ────────────────────────────────────────────────────────
saveBtn.addEventListener('click', async () => {
  if (!resultData) return;
  const { library = [] } = await chrome.storage.local.get('library');
  const entry = {
    job_id:   resultData.job_id,
    title:    resultData.title,
    url:      urlInput.value.trim(),
    savedAt:  new Date().toISOString(),
    transcript_source: resultData.transcript_source,
    summary:  resultData.summary,
    segments: resultData.segments || [],
    video_id: resultData.video_id,
  };
  // Replace existing entry for same job_id
  const filtered = library.filter((e) => e.job_id !== entry.job_id);
  filtered.unshift(entry);
  await chrome.storage.local.set({ library: filtered.slice(0, 50) });
  saveBtn.textContent = '✅ Saved!';
  setTimeout(() => (saveBtn.textContent = '💾 Save to My Library'), 2000);
});

// ── Chat ───────────────────────────────────────────────────────────────────
chatSend.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});

async function sendChatMessage() {
  const q = chatInput.value.trim();
  if (!q) return;
  chatInput.value = '';

  addBubble('user', q);
  const thinking = addBubble('thinking', 'Thinking…');

  try {
    const res = await apiFetch('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify({ question: q, session_id: currentSession }),
    });
    thinking.remove();
    addBubble('assistant', res.answer || res.message || JSON.stringify(res));
    if (res.session_id) currentSession = res.session_id;
  } catch (err) {
    thinking.remove();
    addBubble('assistant', `Error: ${err.message}`);
  }
}

function addBubble(role, text) {
  const div = document.createElement('div');
  div.className = `chat-bubble ${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// ── Library ────────────────────────────────────────────────────────────────
async function renderLibrary() {
  const { library = [] } = await chrome.storage.local.get('library');
  libraryList.innerHTML = '';

  if (library.length === 0) {
    libraryEmptyHint.classList.remove('hidden');
    return;
  }
  libraryEmptyHint.classList.add('hidden');

  library.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'library-item';

    const title = document.createElement('div');
    title.className = 'library-item-title';
    title.textContent = entry.title || 'Untitled';

    const meta = document.createElement('div');
    meta.className = 'library-item-meta';
    const d = new Date(entry.savedAt);
    meta.textContent = `${entry.transcript_source || 'unknown'} · ${d.toLocaleDateString()}`;

    const del = document.createElement('button');
    del.className = 'library-delete';
    del.textContent = 'Remove';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      const { library: lib = [] } = await chrome.storage.local.get('library');
      await chrome.storage.local.set({ library: lib.filter((l) => l.job_id !== entry.job_id) });
      renderLibrary();
    });

    // Click item → load it into analyze view
    item.addEventListener('click', () => {
      urlInput.value = entry.url || '';
      // Switch to analyze view
      document.querySelectorAll('.nav-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === 'analyze');
      });
      document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
      document.getElementById('view-analyze').classList.remove('hidden');

      // Re-render result from saved data
      if (entry.summary) {
        showResult(entry, entry.job_id);
      }
    });

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(del);
    libraryList.appendChild(item);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function showProgress(label, pct) {
  show(progressSection);
  hide(errorSection);
  hide(resultSection);
  hide(chatSection);
  progressLabel.textContent = label;
  progressPct.textContent   = `${Math.round(pct)}%`;
  progressBar.style.width   = `${pct}%`;
}

function showError(msg) {
  hide(progressSection);
  hide(resultSection);
  hide(chatSection);
  errorMsg.textContent = msg;
  show(errorSection);
}

function reset() {
  hide(progressSection);
  hide(errorSection);
  hide(resultSection);
  hide(chatSection);
  document.getElementById('action-card').classList.add('hidden');
  document.getElementById('decision-card').classList.add('hidden');
  document.getElementById('source-badge').classList.add('hidden');
  document.getElementById('source-badge-whisper').classList.add('hidden');
  document.getElementById('source-badge-sarvam').classList.add('hidden');
  document.getElementById('segment-count').classList.add('hidden');
  transcriptBody.classList.add('hidden');
  transcriptToggle.textContent = 'Show';
  currentJobId = null;
  currentSession = null;
  resultData = null;
}

function show(el) { el?.classList.remove('hidden'); }
function hide(el) { el?.classList.add('hidden'); }

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : { message: await res.text() };
  if (!res.ok) {
    throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  }
  return data;
}
