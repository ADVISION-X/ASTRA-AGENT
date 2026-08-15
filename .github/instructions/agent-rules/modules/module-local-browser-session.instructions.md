---
name: "GrassEye Local Browser Session"
description: "Governs local browser session and screenshot evidence foundation."
applyTo: "src/lib/browser/**, src/lib/local-runtime/**"
---

# GrassEye Local Browser Session

status: active
version: 2026-08-16

Browser owns:
- one operator-authorized local Chrome profile and one BrowserController instance;
- minting opaque, session-bound `BrowserTargetRef` and generation-bound `BrowserDocumentRef` values;
- binding navigate, evaluate, click, fill, scroll, screenshot and DOM file-input work to the exact target and document supplied by the owning flow;
- the private Controller -> owner-only Unix socket -> Native host -> Chrome Native Messaging -> MV3 service worker -> `chrome.debugger` transport;
- target lifecycle, document-generation invalidation, bounded command deadlines and fail-closed disconnection semantics;
- a short `PhysicalFocusLease` only for approved native file-picker or unavoidable OS pointer/keyboard actions;
- waiting, session state and screenshot/file-input foundations.

Browser does not own:
- business workflow;
- AI judgment;
- evidence truth;
- business job decisions.

External jobs and websites may never provide a tab id, window index, target id,
session id, chat title, selector, marker, concurrency value or browser command.
Raw Chrome ids never leave `src/lib/browser/**`, never enter task state/evidence,
and never survive process restart. A stale target or document ref fails closed
and is reacquired only from an owning business checkpoint.

When an owning plugin acknowledges `takeover`, Browser sends the exact
`release_target` command, the extension detaches `chrome.debugger` without
closing the operator's tab, and Controller invalidates the old target/document
refs. No background task may reacquire that owner target until the same task is
explicitly resumed. Resume never revives old refs; the next owner action mints
new refs after exact URL, origin and document verification.

Ordinary page work never activates Chrome, raises a window, uses the system
mouse/keyboard, or depends on the foreground tab. Only `native_file_picker`,
`os_pointer_action`, and `os_keyboard_action` may acquire a focus lease; every
lease is bounded to fifteen seconds, is cancelled when the operator changes
focus, and is never automatically reacquired after an operator interruption.

The Controller does not create a provider-tab pool and does not decide business
concurrency. AI Input Gateway still owns conversation switching inside exactly
one physical ChatGPT target. Other jobs may hold their own exact target refs;
they cannot mutate, inspect, focus, close, or navigate another owner's target.

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "The unique BrowserController must bind ordinary page actions to opaque exact target and document identities without foreground focus.",
  "required": [
    "One BrowserController mints opaque session-bound BrowserTargetRef and generation-bound BrowserDocumentRef values while raw Chrome ids remain private.",
    "Navigate, evaluate, click, fill, scroll, screenshot and DOM file-input commands execute only against the supplied exact target and current document generation.",
    "A navigation or lifecycle change invalidates the prior document ref; stale, foreign or ambiguous refs fail closed without URL-first, first-page or active-tab fallback.",
    "Plugin takeover detaches chrome.debugger from the exact tab without closing it, invalidates the old refs, blocks automatic reacquisition while the operator owns the tab, and requires fresh exact target resolution after explicit resume.",
    "Real-Chrome acceptance proves a controlled background target can change while a non-target foreground tab keeps its URL, title, scroll position and input value unchanged."
  ],
  "forbidden": [
    "a second BrowserController or public Chrome transport",
    "URL-first, first-page, current-page or active-tab target selection",
    "raw tabId, windowId, targetId, sessionId or debugger id outside the browser owner",
    "ordinary page actions activating Chrome or using system mouse and keyboard",
    "compatibility wrappers, fallback, shadow transports or dual target identity"
    ,"background target reacquisition while a plugin task remains taken_over"
  ],
  "clauses": [
    {
      "clauseId": "apex-local-browser-001-requirement",
      "statement": "The unique BrowserController must bind ordinary page actions to opaque exact target and document identities without foreground focus.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "local-browser-session"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "The unique Browser owner must convert the public function-body evaluation contract into one executable expression exactly once, while page mutations use dedicated exact-target commands.",
  "required": [
    "BrowserTargetSession.evaluate accepts a governed JavaScript function body and the exact-target Browser runtime wraps that body into one executable expression exactly once before transport.",
    "The MV3 service worker executes the already-normalized expression and does not add another function, eval, Function constructor or caller-specific wrapper.",
    "evaluate_target remains an observation command; click, scroll, text input and file input mutations use click_target, scroll_target, text_target and set_file_input_files against the same exact target and current document generation.",
    "set_file_input_files resolves the one real enabled file receiver inside an open author shadow root when the governed light-DOM input is only a hidden component proxy, dispatches the approved file selection once, and never treats a later input.files read as component attachment truth because a consuming component may clear the receiver synchronously.",
    "text_target type-text dispatches one ordered real keyboard event sequence per approved character and fill commits with Tab; Input.insertText is not an admitted replacement for component-observed keyboard input.",
    "Deterministic acceptance proves top-level return works through the production wrapper, and real-Chrome acceptance proves evaluation and dedicated mutations affect only the controlled background target."
  ],
  "forbidden": [
    "passing a raw function body directly to Runtime.evaluate",
    "caller-local wrapping, private evaluators, eval or Function constructors",
    "wrapping the expression again in the Native host or MV3 service worker",
    "DOM click, scroll, fill or upload mutation hidden inside evaluate_target",
    "reporting business file attachment success from the Browser command, the hidden proxy, or a later input.files read instead of an owner-observed component postcondition",
    "using Input.insertText for governed component text entry",
    "compatibility bridges, fallback evaluation modes or dual evaluation contracts"
  ],
  "clauses": [
    {
      "clauseId": "apex-local-browser-004-requirement",
      "statement": "The unique Browser owner must normalize the function-body evaluation contract exactly once and keep page mutation on dedicated exact-target commands.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "local-browser-session"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance",
  "summary": "Chrome control must use one private authenticated MV3 Native Messaging debugger transport with bounded lifecycle and no startup-owned installation.",
  "codePurityLiveness": {
    "externalEntryFiles": [
      "src/lib/browser/chrome-extension/build.mjs",
      "src/lib/browser/chrome-extension/service-worker.ts",
      "src/lib/browser/chrome-extension/dist/service-worker.js",
      "src/lib/browser/native-messaging-host/host.mjs"
    ]
  },
  "required": [
    "The Controller connects through an owner-only Unix socket and memory-only nonce to one Native host, one fixed-id MV3 extension and chrome.debugger.",
    "Extension, Native host and Controller versions are checked before admission; disconnect, extension reload, DevTools attachment conflict and target close fail closed.",
    "Release, extension disconnect, debugger detach and tab close remove extension attachment state so a human or another approved debugger can use the tab.",
    "Dedicated Browser infrastructure install, verify and uninstall scripts own registration; the GrassEye startup entry remains unchanged and never installs or activates browser business infrastructure."
  ],
  "forbidden": [
    "cookies, storage, password or token permissions",
    "wildcard Native Messaging allowed_origins",
    "world-readable socket, nonce or host manifest",
    "Startup installing the extension, registering the host or starting a business job",
    "silent CDP or AppleScript/JXA fallback"
  ],
  "clauses": [
    {
      "clauseId": "apex-local-browser-002-requirement",
      "statement": "Chrome control must use one private authenticated MV3 Native Messaging debugger transport with bounded lifecycle and no startup-owned installation.",
      "evidenceMode": "acceptance",
      "ownerDomain": "local-browser-session"
    }
  ]
}
```

```apex-law
{
  "lawId": "APEX-LOCAL-BROWSER-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "local-browser-session",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+ast+acceptance+real-chrome",
  "summary": "Physical focus is an explicit short lease reserved for approved OS actions and must never be required by ordinary page control.",
  "required": [
    "Only native_file_picker, os_pointer_action and os_keyboard_action may request PhysicalFocusLease.",
    "A lease is bound to one exact target/window/document, lasts at most fifteen seconds and is cancelled on timeout, identity change or operator focus change.",
    "Provider generation wait and ordinary navigate/evaluate/click/fill/scroll/screenshot/DOM file-input work never hold a focus lease."
  ],
  "forbidden": [
    "automatic focus reacquisition after operator interruption",
    "application-wide activation as target identity proof",
    "focus leases controlled by external callers or business UI",
    "holding physical focus while waiting for provider output"
  ],
  "clauses": [
    {
      "clauseId": "apex-local-browser-003-requirement",
      "statement": "Physical focus is an explicit short lease reserved for approved OS actions and must never be required by ordinary page control.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "local-browser-session"
    }
  ]
}
```
