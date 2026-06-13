// UMT Feedback Auto-Submitter — Content Script
// Version guard: increment VERSION whenever content.js changes.
// Old injections see the version mismatch and their listeners go silent.
const VERSION = 14;
if (window.__umtFeedbackVersion === VERSION) {
  // exact same version already running — nothing to do
} else {
window.__umtFeedbackVersion = VERSION;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function log(msg) { console.log(`[UMT Feedback] ${msg}`); }
function setStatus(text) { chrome.storage.local.set({ status: text, statusTime: Date.now() }); }

async function isStopped() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['umtStop'], (r) => resolve(!!r.umtStop));
  });
}

// ── Fill the form page ────────────────────────────────────────────────────────
// The form has 25 questions (radio0–radio24).
// Each question has 5 hidden radio inputs with the same id (e.g. id="radio0"),
// all value="False". The actual rating is recorded via onclick → feedbackFunc().
// We group by id so we get 25 groups of 5, then click the right option.

async function fillCurrentForm(settings) {
  const pos = settings.ratingPosition || 'random-high';

  // Pick which radio index to use for a given question.
  // random-high: picks randomly from options 3–5 (indices 2-4) — looks natural, stays positive.
  // random: any of the 5 options, fully varied per question.
  function pickIndex(radios) {
    const len = radios.length; // always 5
    if (pos === 'first')       return 0;
    if (pos === 'mid')         return Math.floor(len / 2);
    if (pos === 'random')      return Math.floor(Math.random() * len);
    if (pos === 'random-high') return (len - 3) + Math.floor(Math.random() * 3); // indices 2,3,4
    return len - 1; // 'last'
  }

  // Group radio inputs by their id attribute (radio0, radio1, … radio24)
  const groups = {};
  for (const r of document.querySelectorAll('input[type="radio"]')) {
    if (!groups[r.id]) groups[r.id] = [];
    groups[r.id].push(r);
  }

  log(`Found ${Object.keys(groups).length} question group(s). Mode: ${pos}`);

  // Build list of chosen radios + their feedbackFunc onclick strings.
  const entries = Object.entries(groups);
  const chosen = entries.map(([, radios]) => {
    const idx = pickIndex(radios);
    const radio = radios[idx];
    return { radio, onclick: radio.getAttribute('onclick') };
  });

  // Scroll to top so the user appears to start from the beginning.
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await sleep(600 + Math.floor(Math.random() * 600));

  // Fill questions one at a time — scroll to each, fire mouse events, then call feedbackFunc.
  let filled = 0;
  for (let i = 0; i < chosen.length; i++) {
    if (await isStopped()) { log('Stopped during fill.'); setStatus('Stopped.'); return 0; }

    const { radio, onclick } = chosen[i];

    // Scroll the radio into view (human reads the question before answering).
    radio.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300 + Math.floor(Math.random() * 500));

    // Fire a realistic mouse event sequence on the radio element.
    radio.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true, cancelable: true }));
    await sleep(40 + Math.floor(Math.random() * 80));
    radio.dispatchEvent(new MouseEvent('mousemove',  { bubbles: true, cancelable: true }));
    await sleep(30 + Math.floor(Math.random() * 60));
    radio.dispatchEvent(new MouseEvent('mousedown',  { bubbles: true, cancelable: true }));
    await sleep(60 + Math.floor(Math.random() * 80));
    radio.dispatchEvent(new MouseEvent('mouseup',    { bubbles: true, cancelable: true }));
    radio.dispatchEvent(new MouseEvent('click',      { bubbles: true, cancelable: true }));
    radio.checked = true;

    // Call feedbackFunc in page context so questionIndex is updated.
    if (onclick) {
      const s = document.createElement('script');
      s.textContent = onclick;
      (document.head || document.documentElement).appendChild(s);
      s.remove();
      filled++;
    }

    setStatus(`Filling question ${i + 1} of ${chosen.length}…`);

    // Variable delay: 20% chance of a longer "thinking" pause (1.5–3 s), rest 500–1400 ms.
    const delay = Math.random() < 0.2
      ? 1500 + Math.floor(Math.random() * 1500)
      : 500  + Math.floor(Math.random() * 900);
    await sleep(delay);
  }

  // Fill the two required text areas.
  // Try by known IDs first; fall back to all textareas in DOM order (1st = like, 2nd = dislike).
  const likeDefault    = 'The course content was well structured and effectively delivered.';
  const dislikeDefault = 'The course was well managed with no significant issues to report.';

  const allTextareas = [...document.querySelectorAll('textarea')];
  const likeField    = document.getElementById('like')    || allTextareas[0] || null;
  const dislikeField = document.getElementById('dislike') || allTextareas[1] || null;

  // Simulate human typing into a textarea character by character.
  async function typeInto(el, text) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(400 + Math.floor(Math.random() * 400));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    el.focus();
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    await sleep(200 + Math.floor(Math.random() * 200));
    for (const char of text) {
      if (await isStopped()) return;
      el.value += char;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: char, inputType: 'insertText' }));
      await sleep(40 + Math.floor(Math.random() * 80)); // ~60-90 WPM
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  }

  if (!likeField?.value.trim())    await typeInto(likeField,    settings.commentLike    || settings.comment || likeDefault);
  if (!dislikeField?.value.trim()) await typeInto(dislikeField, settings.commentDislike || settings.comment || dislikeDefault);

  log(`Textareas found: like=${!!likeField}, dislike=${!!dislikeField}`);

  log(`Filled ${filled} question(s) + textareas.`);
  setStatus(`Filled ${filled} questions.`);
  return filled;
}

// ── PAGE: /StudentFeedback (course list) ──────────────────────────────────────
async function handleListPage(mode) {
  // Clear stop flag and any stale status from old runs immediately
  await chrome.storage.local.set({ umtStop: false, status: 'Finding pending forms…', statusTime: Date.now() });
  await sleep(500);

  const addLinks = [...document.querySelectorAll('a.btn-outline-success[href*="Addfeedback"]')]
    .map(a => a.href);

  if (!addLinks.length) {
    setStatus('No pending feedback forms found.');
    log('No Add buttons found on list page.');
    return;
  }

  log(`Found ${addLinks.length} pending form(s).`);
  setStatus(`Found ${addLinks.length} form(s) — opening first…`);

  await chrome.storage.local.set({ umtQueue: addLinks, umtQueueIndex: 0, umtMode: mode });
  await sleep(200);
  window.location.href = addLinks[0];
}

// ── PAGE: /StudentFeedback/Addfeedback/* (form) ───────────────────────────────
async function handleFormPage(settings, mode) {
  const myVersion = VERSION;
  await sleep(1200 + Math.floor(Math.random() * 1000)); // simulate reading the form header

  // If a newer injection has since taken over, this instance is stale — bail out.
  if (window.__umtFeedbackVersion !== myVersion) return;

  log(`Form page — mode: ${mode}`);
  setStatus('Filling form…');

  const filled = await fillCurrentForm(settings);

  if (mode === 'fill') {
    // Highlight submit button so user can review and click manually
    const btn = document.getElementById('feedbackbtn');
    if (btn) {
      btn.style.outline = '3px solid #f59e0b';
      btn.style.outlineOffset = '3px';
      btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setStatus('Form filled — review and click Submit Feedback.');
    chrome.storage.local.set({ umtMode: null, umtQueue: [], umtQueueIndex: 0 });
    return;
  }

  // mode === 'submit'
  const submitBtn = document.getElementById('feedbackbtn');
  if (!submitBtn) {
    log('Submit button #feedbackbtn not found.');
    setStatus('Submit button not found.');
    return;
  }

  // Scroll to submit button — human would scroll down to find it
  submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await sleep(600 + Math.floor(Math.random() * 600));
  if (await isStopped()) { log('Stopped before submit.'); setStatus('Stopped.'); return; }

  // Patch: call feedbackFunc for any missing questionIndex slots (0–24).
  // Uses feedbackFunc's own serialisation so radiohidden format stays correct.
  const patch = document.createElement('script');
  patch.textContent = `
    (function() {
      if (typeof questionIndex === 'undefined') window.questionIndex = {};
      for (var i = 0; i < 25; i++) {
        if (questionIndex[i] === undefined || questionIndex[i] === null) {
          if (typeof feedbackFunc === 'function') {
            feedbackFunc('5', 'radio' + i, '' + i, '25');
          } else {
            questionIndex[i] = '5';
          }
        }
      }
      console.log('[UMT] questionIndex entries before submit:', Object.values(questionIndex).length);
    })();
  `;
  (document.head || document.documentElement).appendChild(patch);
  patch.remove();

  log('Clicking Submit Feedback…');
  setStatus('Submitting…');
  submitBtn.click();
  // After submit the server redirects back to /StudentFeedback (list page).
  // The list page handler resumes the queue automatically.
}

// ── Resume queue when redirected back to list page ────────────────────────────
async function resumeQueue(queue, nextIndex, mode, settings) {
  if (nextIndex >= queue.length) {
    log('All feedback forms done!');
    setStatus('All feedback forms submitted!');
    chrome.storage.local.set({ umtMode: null, umtQueue: [], umtQueueIndex: 0 });
    return;
  }

  if (await isStopped()) { log('Stopped before next form.'); setStatus('Stopped.'); return; }

  const remaining = queue.length - nextIndex;
  log(`Queue resume: ${remaining} form(s) left.`);
  setStatus(`Submitting form ${nextIndex + 1} of ${queue.length}…`);

  await chrome.storage.local.set({ umtQueueIndex: nextIndex });
  await sleep(400);
  window.location.href = queue[nextIndex];
}

// ── Route by current page ─────────────────────────────────────────────────────
const path = window.location.pathname;
const isListPage = /^\/StudentFeedback\/?$/i.test(path);
const isFormPage = /\/StudentFeedback\/Addfeedback\//i.test(path);

// Auto-resume when list page loads after a form submission
if (isListPage) {
  chrome.storage.local.get(['umtMode', 'umtQueue', 'umtQueueIndex'], (data) => {
    if (data.umtMode && data.umtQueue && data.umtQueue.length) {
      const nextIndex = (data.umtQueueIndex || 0) + 1;
      chrome.storage.sync.get(['ratingPosition', 'comment', 'commentLike', 'commentDislike'], (settings) => {
        resumeQueue(data.umtQueue, nextIndex, data.umtMode, settings);
      });
    }
  });
}

// Auto-fill when form page loads during an active run
if (isFormPage) {
  chrome.storage.local.get(['umtMode'], (data) => {
    if (data.umtMode) {
      // Set status immediately so popup shows something before the 800ms sleep
      chrome.storage.local.set({ status: 'Form loaded — starting fill…', statusTime: Date.now() });
      chrome.storage.sync.get(['ratingPosition', 'comment', 'commentLike', 'commentDislike'], (settings) => {
        handleFormPage(settings, data.umtMode);
      });
    }
  });
}

// ── Message listener (popup buttons) ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // If a newer version has since loaded, this listener is stale — ignore.
  if (window.__umtFeedbackVersion !== VERSION) return false;

  if (message.action === 'runFeedback' || message.action === 'fillOnly') {
    const mode = message.action === 'fillOnly' ? 'fill' : 'submit';
    chrome.storage.sync.get(['ratingPosition', 'comment', 'commentLike', 'commentDislike'], (settings) => {
      if (isListPage)      handleListPage(mode);
      else if (isFormPage) handleFormPage(settings, mode);
    });
    sendResponse({ ok: true });
  }
  return true;
});

} // end version guard
