---
name: "GrassEye AI Capability"
description: "Governs the pure visual round judge prompt, schema, model call, and AI result proof."
applyTo: "src/capabilities/ai/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}, src/visual-mission/round/**/*.{ts,tsx}, docs/法案辅助文件/*AI*, docs/法案辅助文件/*Prompt*"
---

# GrassEye AI Capability

status: active
version: 2026-05-13

## Boundary

AI is the visual judge and next-action chooser for one round. AI does not execute actions, save evidence, call Forensics, own browser commands, output owner fields, or plan multiple steps.

## Required Output

AI output schema is `pureVisualRound.v1`:

- `goalMatched`
- `save`
- `saveReason`
- `confidence`
- `visualEvidence`
- `decision`
- `nextAction`
- `reviewRequiredReason`
- `doneReason`

`decision=act` requires exactly one `nextAction`. Other decisions require `nextAction=null`.

## Prompt Contract

Prompt must say:

- look only at current screenshot, coordinate grid, user goal, and ability registry
- judge whether the current screen satisfies the user goal
- if satisfied, output `save=true`
- choose one atomic next action, or `done`, `review_required`, or `blocked`
- do not output raw coordinates, DOM selectors, browser commands, owner fields, or Forensics payloads

## Forbidden

- Product-video-specific truth fields.
- UI inventory output layers.
- Page-state decision layers.
- Multi-action output.
- AI-visible record save/read/write action calls.
