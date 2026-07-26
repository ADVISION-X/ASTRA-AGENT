---
name: "GrassEye Local Browser Session"
description: "Governs local browser session and screenshot evidence foundation."
applyTo: "src/lib/browser/**, src/lib/local-runtime/**"
---

# GrassEye Local Browser Session

status: active
version: 2026-07-26

Browser owns:
- opening URLs;
- keeping browser actions on the one currently controlled physical tab;
- evaluating the active controlled tab and failing closed when it is no longer the expected provider origin;
- waiting;
- current session state;
- screenshot capture for evidence;
- file-input foundation used by DOM upload.

Browser does not own:
- business workflow;
- AI judgment;
- evidence truth;
- business job decisions.

External jobs and websites may never provide a tab id, window index, chat title,
selector, marker, concurrency value or browser command. BrowserController does
not create a provider-tab pool and does not decide which business steps may run
concurrently. The AI Input Gateway owns conversation-level switching inside the
single controlled provider tab.
