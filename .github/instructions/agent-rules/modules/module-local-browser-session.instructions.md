---
name: "GrassEye Local Browser Session"
description: "Governs local browser session and screenshot evidence foundation."
applyTo: "src/lib/browser/**, src/lib/local-runtime/**"
---

# GrassEye Local Browser Session

status: active
version: 2026-08-16.1

Browser owns:
- one operator-authorized local Chrome profile and one BrowserController instance;
- minting opaque, session-bound `BrowserTargetRef` and generation-bound `BrowserDocumentRef` values;
- binding navigate, evaluate, click, fill, scroll, screenshot and DOM file-input work to the exact target and document supplied by the owning flow;
- the private Controller -> owner-only Unix socket -> Native host -> Chrome Native Messaging -> MV3 service worker -> `chrome.debugger` transport;
- target lifecycle, document-generation invalidation, bounded command deadlines and fail-closed disconnection semantics;
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

Page work never activates Chrome, raises a window, uses the system mouse,
system keyboard, clipboard, native file picker or foreground-tab identity.
All file input is an exact-target extension command; no physical focus lease or
OS action transport remains in the active Browser owner.

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
    "evaluate_target remains an observation command; generic click, scroll and text input use click_target, scroll_target and text_target, while governed DOM click/fill use click_dom_target and fill_dom_target and file input uses set_file_input_files against the same exact target and current document generation.",
    "click_dom_target and fill_dom_target each resolve one selector, compare the current element identity with the caller-captured identity, validate the exact receiver and perform the mutation within that same Chrome command; they never consume a previously observed coordinate.",
    "set_file_input_files resolves the one real enabled file receiver inside an open author shadow root when the governed light-DOM input is only a hidden component proxy, dispatches the approved file selection once, and never treats a later input.files read as component attachment truth because a consuming component may clear the receiver synchronously.",
    "text_target remains a generic Browser text command; DOM fill cannot compose it with a prior coordinate click and must use the atomic fill_dom_target contract.",
    "Deterministic acceptance proves top-level return works through the production wrapper, and real-Chrome acceptance proves evaluation and dedicated mutations affect only the controlled background target."
  ],
  "forbidden": [
    "passing a raw function body directly to Runtime.evaluate",
    "caller-local wrapping, private evaluators, eval or Function constructors",
    "wrapping the expression again in the Native host or MV3 service worker",
    "DOM click, scroll, fill or upload mutation hidden inside evaluate_target",
    "reporting business file attachment success from the Browser command, the hidden proxy, or a later input.files read instead of an owner-observed component postcondition",
    "using click_target plus text_target as a governed DOM fill compatibility path",
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
    "Every Native port owns one nonce and one command sequence session. Only messages emitted by the currently registered port may authenticate, reset sequence state or execute commands; a late message from a disconnected or replaced port is ignored before any session mutation. A new current port resets its sequence exactly once on its own controller challenge and then accepts command sequence 1.",
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
    ,"allowing a retired Native port's delayed challenge, command or response to reset or mutate the current port's authenticated command sequence"
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
  "summary": "Chrome extension exact-target commands are the only page and file-action transport; physical focus and OS action paths are absent.",
  "required": [
    "Navigate, evaluate, click, fill, scroll, screenshot and DOM file-input work execute only through the exact-target MV3 extension transport.",
    "The public Browser contract and extension protocol expose no native picker, system clipboard, OS pointer, OS keyboard, window activation or focus-target command.",
    "Retired focus-lease and native-file-picker source files are physically absent."
  ],
  "forbidden": [
    "PhysicalFocusLease or any replacement focus owner",
    "native picker, system clipboard, AppleScript/JXA, OS pointer or OS keyboard file transport",
    "application-wide activation or foreground focus as target identity proof",
    "a second file-input transport beside set_file_input_files"
  ],
  "clauses": [
    {
      "clauseId": "apex-local-browser-003-requirement",
      "statement": "The exact-target Chrome extension is the only page and file-action transport, with physical focus and OS action paths physically absent.",
      "evidenceMode": "real-chrome",
      "ownerDomain": "local-browser-session"
    }
  ]
}
```
