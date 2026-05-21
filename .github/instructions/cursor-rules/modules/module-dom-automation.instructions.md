---
name: "GrassEye DOM Automation Capability"
description: "Governs DOM snapshot, locator, fill, click, upload, wait, and verification primitives."
applyTo: "src/capabilities/dom-automation/**, src/plugins/amazon-invoice-upload/**"
---

# GrassEye DOM Automation Capability

status: active
version: 2026-05-21

## Boundary

DOM Automation is the main browser-page action ability group.

It owns:
- DOM snapshot summaries;
- semantic element location;
- approved text fill;
- clicking a located element;
- approved file upload;
- waiting for DOM state;
- DOM state verification.

It does not own:
- Amazon business flow;
- AI judging;
- browser session lifecycle;
- evidence storage truth;
- workflow planning.

## Law GRASSEYE-DOM-001-V2

DOM Automation must remain business-neutral.

Required:
- Public consumers import the DOM public facade only.
- DOM primitives receive approved inputs from the caller.
- DOM results state success, failure, or review-required conditions.
- Amazon-specific selectors and hints stay in the Amazon plugin.

Forbidden:
- DOM code deciding the Amazon upload workflow;
- DOM code calling AI to plan actions;
- DOM code emitting action-plan registry fields;
- DOM code requiring grid or geometry proof.

## Law GRASSEYE-DOM-002-V2

DOM Automation replaces standalone text input, mouse click, open, and upload action owners for the Amazon flow.

Required:
- Text entry is `dom.fill`.
- Clicks are `dom.click` on located elements.
- File attachment is `dom.uploadApprovedFile`.
- Verification is `dom.verify`.

Forbidden:
- AI-visible action codes;
- coordinate-first action execution;
- browser-control or evidence persistence ownership inside DOM.
