// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// ── Banner ────────────────────────────────────────────────────────────────────
function showBanner(msg, type = 'info') {
  const b = document.getElementById('statusBanner');
  b.textContent = msg;
  b.className = `status-banner ${type}`;
  setTimeout(() => (b.className = 'status-banner hidden'), 3000);
}

// ── Log box ───────────────────────────────────────────────────────────────────
let lastStatus = '';
function appendLog(msg) {
  if (msg === lastStatus) return;
  lastStatus = msg;
  const box = document.getElementById('logBox');
  if (box.textContent === 'Waiting…') box.textContent = '';
  box.textContent += msg + '\n';
  box.scrollTop = box.scrollHeight;
}
function clearLog() {
  lastStatus = '';
  document.getElementById('logBox').textContent = '';
}

// ── Detect current page ───────────────────────────────────────────────────────
function detectPage() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0]?.url || '';
    const el = document.getElementById('pageStatus');
    if (/StudentFeedback\/Addfeedback/i.test(url)) {
      el.textContent = '✓ Form page — ready';
      el.style.color = '#166534';
    } else if (/StudentFeedback/i.test(url)) {
      el.textContent = '✓ Feedback list — ready';
      el.style.color = '#166534';
    } else if (/umt\.edu\.pk/i.test(url)) {
      el.textContent = 'UMT portal — navigate to Student Feedback page';
      el.style.color = '#92400e';
    } else {
      el.textContent = 'Not on UMT portal';
      el.style.color = '#dc2626';
    }
  });
}
detectPage();
document.getElementById('extVersion').textContent = 'v' + chrome.runtime.getManifest().version;

// ── Load saved settings ───────────────────────────────────────────────────────
chrome.storage.sync.get(['ratingPosition', 'commentLike', 'commentDislike', 'autoRun', 'autoSubmit'], (s) => {
  if (s.ratingPosition)  document.getElementById('ratingPosition').value = s.ratingPosition;
  if (s.commentLike)     document.getElementById('commentLike').value = s.commentLike;
  if (s.commentDislike)  document.getElementById('commentDislike').value = s.commentDislike;
  document.getElementById('autoRun').checked    = !!s.autoRun;
  document.getElementById('autoSubmit').checked = !!s.autoSubmit;
});

// ── Poll status + enable/disable Stop button ──────────────────────────────────
const btnStop = document.getElementById('btnStop');
setInterval(() => {
  chrome.storage.local.get(['status', 'statusTime', 'umtMode'], (r) => {
    if (r.status && r.statusTime && Date.now() - r.statusTime < 15000) {
      appendLog(r.status);
    }
    btnStop.disabled = !r.umtMode;
  });
}, 1000);

// ── Always inject fresh content script, then send message ────────────────────
// This ensures the latest code runs even if the extension was reloaded while
// the tab was already open (old script would otherwise keep running).
function sendToTab(tabId, action, onSuccess) {
  chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
    if (chrome.runtime.lastError) {
      showBanner('Cannot run here — go to the StudentFeedback page.', 'error');
      return;
    }
    // Small pause so the injected script finishes initialising
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action }, () => {
        void chrome.runtime.lastError; // suppress "no listener" noise
        onSuccess();
      });
    }, 150);
  });
}

// ── Fill & Submit ─────────────────────────────────────────────────────────────
document.getElementById('btnFillSubmit').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    clearLog();
    chrome.storage.local.set({ status: '', statusTime: 0 }); // wipe stale status
    sendToTab(tabs[0].id, 'runFeedback', () => {
      showBanner('Running…', 'info');
      appendLog('Fill & submit started.');
    });
  });
});

// ── Fill Only ─────────────────────────────────────────────────────────────────
document.getElementById('btnFillOnly').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    clearLog();
    chrome.storage.local.set({ status: '', statusTime: 0 });
    sendToTab(tabs[0].id, 'fillOnly', () => {
      showBanner('Filling (no submit)…', 'info');
      appendLog('Fill-only started.');
    });
  });
});

// ── Stop ──────────────────────────────────────────────────────────────────────
btnStop.addEventListener('click', () => {
  chrome.storage.local.set({ umtStop: true, umtMode: null, umtQueue: [], umtQueueIndex: 0 }, () => {
    btnStop.disabled = true;
    showBanner('Stopped.', 'error');
    appendLog('Run stopped by user.');
  });
});

// ── Save Settings ─────────────────────────────────────────────────────────────
document.getElementById('btnSaveSettings').addEventListener('click', () => {
  chrome.storage.sync.set({
    ratingPosition:  document.getElementById('ratingPosition').value,
    commentLike:     document.getElementById('commentLike').value,
    commentDislike:  document.getElementById('commentDislike').value,
    autoRun:         document.getElementById('autoRun').checked,
    autoSubmit:      document.getElementById('autoSubmit').checked,
  }, () => showBanner('Settings saved!', 'success'));
});
