---
name: "GrassEye Local Browser Session"
description: "Governs local browser session and screenshot evidence foundation."
applyTo: "src/lib/browser/**, src/lib/local-runtime/**"
---

# GrassEye Local Browser Session

status: active
version: 2026-05-21

Browser owns:
- opening URLs;
- waiting;
- current session state;
- screenshot capture for evidence;
- file-input foundation used by DOM upload.

Browser does not own:
- business workflow;
- AI judgment;
- evidence truth;
- business job decisions.
