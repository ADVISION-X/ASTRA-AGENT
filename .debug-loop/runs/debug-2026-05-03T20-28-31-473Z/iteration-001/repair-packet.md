# Repair Packet

## Debug Session
debug-2026-05-03T20-28-31-473Z / iteration 1

## Scenario
facebook-auth-check

## Failure Category
NEGATIVE_PROOF_ERROR

## Owner
audit-system

## Evidence
- runner-summary.json#L72
- runner-summary.json#L75
- runner-summary.json#L78
- runner-summary.json#L396
- runner-summary.json#L417

## Root Cause
          "name": "negative-proof-harness",

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
-           "name": "negative-proof-harness",

## Required Commands
- npm run audit:build
- npm run ci:full
- node scripts/debug-loop/run-debug-loop.mjs --scenario facebook-auth-check --continue --runId debug-2026-05-03T20-28-31-473Z

## Stop Rule
debug:loop PASS + CI FULL PASS

## Forbidden Actions
- Only modify allowedModify paths.
- Do not modify forbiddenModify paths.
- Do not downgrade laws.
- Do not disable inspectors.
- Do not remove negative proof.
- Do not hand-edit generated files to fake PASS.

