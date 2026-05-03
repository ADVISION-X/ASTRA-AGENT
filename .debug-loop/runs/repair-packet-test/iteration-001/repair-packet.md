# Repair Packet

## Debug Session
repair-packet-test / iteration 1

## Scenario
facebook-product-video-runtime

## Failure Category
PROOF_CHAIN_ERROR

## Owner
visual-target

## Evidence
- runtime.jsonl#L10

## Root Cause
activationSnapshotRef missing

## Allowed Modify
- src/capabilities/visual-target/**

## Forbidden Modify
- src/capabilities/open/**

## Required Fix
- activationSnapshotRef missing

## Required Commands
- npm run ci:full

## Stop Rule
debug:loop PASS + CI FULL PASS

## Forbidden Actions
- Only modify allowedModify paths.
- Do not modify forbiddenModify paths.
- Do not downgrade laws.
- Do not disable inspectors.
- Do not remove negative proof.
- Do not hand-edit generated files to fake PASS.

