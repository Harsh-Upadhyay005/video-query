const API_BASE = 'https://video-query-io3r.onrender.com';

// Open side panel when extension icon is clicked on a YouTube tab
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url?.includes('youtube.com/watch') || tab.url?.includes('youtu.be/')) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Set side panel behaviour — open on action click only
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

// ── Message relay ─────────────────────────────────────────────────────────────
// All fetch calls go through the service worker to avoid CORS issues from
// content scripts. Only the service worker has host_permissions to the backend.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_VIDEO') {
    handleAnalyze(message.payload).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true; // keep channel open for async response
  }

  if (message.type === 'POLL_JOB') {
    pollJob(message.jobId).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'SEND_CHAT') {
    sendChat(message.question, message.sessionId).then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'GET_LIBRARY') {
    getLibrary().then(sendResponse).catch((err) => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    chrome.sidePanel.open({ tabId: sender.tab?.id }).catch(() => {});
    return false;
  }
});

// ── API helpers ───────────────────────────────────────────────────────────────

async function handleAnalyze({ url, language = 'english' }) {
  const res = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: url, language }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function pollJob(jobId) {
  const res = await fetch(`${API_BASE}/api/v1/status/${jobId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function sendChat(question, sessionId) {
  const res = await fetch(`${API_BASE}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, session_id: sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// Library = the saved sessions stored locally
async function getLibrary() {
  const { library = [] } = await chrome.storage.local.get('library');
  return library;
}
