chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['ratingPosition'], (s) => {
    if (!s.ratingPosition) {
      chrome.storage.sync.set({ ratingPosition: 'random-high', autoSubmit: false, autoRun: false });
    }
  });
});

// Whenever the form/list page finishes loading during an active run,
// inject the latest content.js from disk to override any cached manifest version.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || !tab.url.includes('online.umt.edu.pk/StudentFeedback')) return;

  chrome.storage.local.get(['umtMode'], (data) => {
    if (!data.umtMode) return;
    chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      .catch(() => {}); // silently ignore non-injectable tabs
  });
});
