// Injected into every youtube.com/watch page.
// Adds an "Analyze with VideoQuery" button next to the YouTube action bar.

(function () {
  'use strict';

  let injected = false;

  function getCurrentVideoUrl() {
    return window.location.href;
  }

  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('v') || '';
  }

  function getVideoTitle() {
    return document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
      || document.title.replace(' - YouTube', '').trim()
      || 'YouTube Video';
  }

  function createButton() {
    const btn = document.createElement('button');
    btn.id = 'vq-analyze-btn';
    btn.className = 'vq-btn';
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      <span>Analyze with VideoQuery</span>
    `;

    btn.addEventListener('click', () => {
      // Tell background to open the side panel
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });

      // Pass video metadata to the side panel via storage so it
      // can auto-populate the URL field
      chrome.storage.local.set({
        pendingVideo: {
          url: getCurrentVideoUrl(),
          videoId: getVideoId(),
          title: getVideoTitle(),
        },
      });
    });

    return btn;
  }

  function inject() {
    if (injected || document.getElementById('vq-analyze-btn')) return;

    // YouTube's action bar (like, dislike, share, clip, save…)
    const actionBar = document.querySelector('#actions-inner #menu ytd-menu-renderer #top-level-buttons-computed');
    if (!actionBar) return;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.marginLeft = '8px';
    wrapper.appendChild(createButton());
    actionBar.appendChild(wrapper);
    injected = true;
  }

  // YouTube is a SPA — re-check on navigation events
  function onNavigate() {
    injected = false;
    // Give YouTube time to render the new page DOM
    setTimeout(inject, 1500);
  }

  // Observe URL changes (YouTube doesn't fire full page loads)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onNavigate();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial inject
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(inject, 1500));
  } else {
    setTimeout(inject, 1500);
  }
})();
