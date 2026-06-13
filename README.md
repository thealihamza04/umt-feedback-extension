# UMT Feedback Auto-Submitter

A Chrome Extension (Manifest V3) that automatically fills and submits Student Feedback forms on the UMT Online Portal (`online.umt.edu.pk/StudentFeedback`).

---

## Features

- Fills all 25 rating questions automatically
- Fills both required comment fields
- Auto-advances through every pending course in one click
- Human-like behaviour — scrolls, hovers, types at realistic speed
- Randomised ratings (mostly Agree/Strongly Agree by default)
- Stop button to halt mid-run
- Fill Only mode — fills the form but lets you review before submitting

---

## Installation

> No Chrome Web Store listing — load it manually in Developer Mode.

1. Download or clone this repository
   ```
   git clone https://github.com/thealihamza04/umt-feedback-extension.git
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked**

5. Select the cloned folder

The **UMT** icon will appear in your Chrome toolbar.

---

## Usage

1. Log in to the UMT portal at `online.umt.edu.pk`

2. Navigate to **Student Feedback** — you should see the list of pending courses

3. Click the **UMT** extension icon in the toolbar

4. Choose an action:
   - **Fill & Submit All Forms** — fills and submits every pending form automatically
   - **Fill Only** — fills the current form and highlights the Submit button for manual review

5. Watch the Log section for live progress

6. Click **Stop** at any time to halt the run

---

## Settings

Open the extension popup and click the **Settings** tab.

| Setting | Description |
|---|---|
| Rating | **Random (Mostly Agree/Excellent)** — default, picks varied high ratings per question |
| | **Always Highest** — Strongly Agree for every question |
| | **Random (fully varied)** — any rating, fully random |
| | **Always Middle** — Neutral for every question |
| | **Always Lowest** — Strongly Disagree for every question |
| Best features comment | Custom text for the first textarea (uses a default if left blank) |
| Improvement comment | Custom text for the second textarea (uses a default if left blank) |
| Auto-run on page load | Automatically starts when you open the feedback list page |
| Auto-submit forms | Automatically submits without pausing |

Click **Save Settings** after making changes.

---

## Requirements

- Google Chrome (or any Chromium-based browser)
- Must be logged in to the UMT portal before using the extension
- Developer mode enabled in `chrome://extensions/`

---

## Notes

- The extension only activates on `online.umt.edu.pk/StudentFeedback` pages
- No data is sent anywhere — everything runs locally in your browser
- Each form takes 1–3 minutes to fill (intentionally slow to appear human-like)
