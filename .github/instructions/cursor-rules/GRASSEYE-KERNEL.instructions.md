---
name: "GrassEye Kernel"
description: "Current GrassEye pure visual single-round closed-loop authority."
applyTo: ".github/instructions/cursor-rules/**"
---

# GrassEye Kernel

status: active
version: 2026-05-13

## System Identity

GrassEye is a pure visual goal-search agent. It is not a product-video-only judge and not a platform semantic shortcut runner.

## Highest Formula

```txt
用户目标 = 我要找什么
每轮系统 = 截图 + 坐标图
每轮 AI = goalMatched + save + nextAction
系统 = save 后执行 nextAction
每轮只执行一个 action
下一轮重新截图重新判断
```

## Authority Split

- User Requirement: defines what to find.
- Screenshot and coordinate grid: the only per-round visual evidence.
- AI: judges whether the current screen matches the user goal and chooses one atomic next action.
- Orchestration: captures, renders grid, calls AI, saves current evidence when `save=true`, then dispatches exactly one action.
- MuscleMemoryCatalog: exposes atomic next-action abilities only.
- Forensics: system-owned evidence persistence only.
- PlatformProfile: entry URL, title, allowed hosts, supported atomic action codes, and optional visual notes only.

## Runtime Loop

```txt
loop guard
capture-browser-viewport
render-coordinate-grid
call AI pure visual round judge
parse pureVisualRound.v1
if save=true: systemSaveCurrentRoundEvidence
if decision=done: complete
if decision=review_required: stop for review
if decision=blocked: stop for review
if decision=act: dispatch one nextAction
next round
```

## Hard Bans

- No product-video-specific AI output truth.
- No page-state semantic court.
- No AI-visible Forensics save/read/write actions.
- No platform-provided next/like/comment/recovery action hints.
- No multi-step AI planning.
- No raw coordinates, DOM selectors, browser commands, owner overrides, or Forensics payloads in AI output.

## Current Narrative Authority

- docs/法案辅助文件/GrassEye 纯视觉单轮闭环总纲施工图.md

All files under docs/archive/** are historical only and must not route current runtime.
