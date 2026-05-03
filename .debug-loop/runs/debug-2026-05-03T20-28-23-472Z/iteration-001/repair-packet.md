# Repair Packet

## Debug Session
debug-2026-05-03T20-28-23-472Z / iteration 1

## Scenario
local-workbench-smoke

## Failure Category
CODE_PURITY_ERROR

## Owner
audit-system

## Evidence
- runner-summary.json#L89
- runner-summary.json#L93
- runner-summary.json#L96
- runner-summary.json#L100
- runner-summary.json#L103

## Root Cause
          "lawId": "GRASSEYE-CODE-PURITY-003-V1",

## Allowed Modify
- scripts/audit/**
- package.json

## Forbidden Modify
- .github/instructions/cursor-rules/modules/**
- scripts/audit/generated/**
- src/capabilities/commander-console/**
- src/capabilities/orchestration/**
- src/capabilities/nerve-bus/**
- src/capabilities/open/**
- src/capabilities/page-state/**
- src/capabilities/screenshot/**
- src/capabilities/ai/**
- src/capabilities/visual-target/**
- src/capabilities/geometry-guard/**
- src/capabilities/mouse-click/**
- src/capabilities/mouse-scroll/**
- src/capabilities/text-input/**
- src/capabilities/post-action-verification/**
- src/capabilities/forensics-persistence/**

## Required Fix
-           "lawId": "GRASSEYE-CODE-PURITY-003-V1",

## Required Commands
- npm run audit:build
- npm run ci:full
- node scripts/debug-loop/run-debug-loop.mjs --scenario local-workbench-smoke --continue --runId debug-2026-05-03T20-28-23-472Z

## Stop Rule
debug:loop PASS + CI FULL PASS

## Forbidden Actions
- Only modify allowedModify paths.
- Do not modify forbiddenModify paths.
- Do not downgrade laws.
- Do not disable inspectors.
- Do not remove negative proof.
- Do not hand-edit generated files to fake PASS.

