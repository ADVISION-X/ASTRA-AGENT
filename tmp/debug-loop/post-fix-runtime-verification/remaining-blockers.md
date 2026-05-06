# Remaining Blockers

## BLOCKER-FRESH-1

- owner: Screenshot
- blocker: `prepare-ai-input proof requires scaleMapping`
- evidence: `tmp/debug-loop/post-fix-runtime-verification/runtime-log.txt`
- next fix category: `DELETE_AND_REBUILD` owner-local Screenshot success proof/result path, then add required-shape and negative proof mutation for `scaleMapping`.

## Static blockers outside current owner scope

- `npm run audit`: fail-fast stopped at `commander-console-capability`.
- `npm run ci:full`: failed with internal audit timeout/fail-fast, recorded in `tmp/debug-loop/fix-verification/ci-full.txt`.
