# Repair Packet

## Debug Session
debug-2026-05-03T20-30-49-789Z / iteration 1

## Scenario
facebook-auth-check

## Failure Category
CI_ERROR

## Owner
nerve-bus

## Evidence
- audit-build.stdout.log#L2
- audit-build.stdout.log#L3
- audit-build.stdout.log#L6
- ci-full.stdout.log#L2
- ci-full.stdout.log#L5

## Root Cause
src/capabilities/nerve-bus/runtime/transport-success-result.ts(12,3): error TS1131: Property or signature expected.

## Allowed Modify
- src/capabilities/nerve-bus/**
- scripts/audit/domains/nerve-bus-capability/**

## Forbidden Modify
- .github/instructions/cursor-rules/modules/**
- scripts/audit/generated/**
- src/capabilities/commander-console/**
- src/capabilities/orchestration/**
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
- src/capabilities/nerve-bus/runtime/transport-success-result.ts(12,3): error TS1131: Property or signature expected.

## Required Commands
- npm run audit:build
- npm run ci:full
- node scripts/debug-loop/run-debug-loop.mjs --scenario facebook-auth-check --continue --runId debug-2026-05-03T20-30-49-789Z

## Stop Rule
debug:loop PASS + CI FULL PASS

## Forbidden Actions
- Only modify allowedModify paths.
- Do not modify forbiddenModify paths.
- Do not downgrade laws.
- Do not disable inspectors.
- Do not remove negative proof.
- Do not hand-edit generated files to fake PASS.

