# Non-current-owner CI blockers

Current blocker scope: Page State local-runtime dispatch invalid_input drift.

Fresh acceptance results:
- PASS: npm run audit:page-state
- PASS: git diff --check
- FAIL: npm run typecheck
- FAIL: npm run lint
- FAIL: npm run ci:full

The failing files below are outside the current Page State blocker root-cause slice and were not modified as part of this closeout:

1. scripts/audit/core/static-clause-coverage-artifact.ts
- `Cannot find name 'AuditSummaryEntry'`
- `Argument of type 'string | null' is not assignable to parameter of type 'string'`

2. scripts/audit/domains/post-action-verification-capability/run-governed-runtime-checks.ts
- multiple `.ts` import-extension errors under current tsconfig
- `runId: null` is not assignable to required `string`

3. src/lib/local-runtime/workbench-human-command.ts
- `WorkbenchMissionState` is missing required `activationSnapshotRef` for `MissionStartState`

4. src/lib/local-runtime/workbench-status.ts
- exactOptionalPropertyTypes mismatch for `taskTemplateId` and adjacent optional preflight fields

These failures block repository-wide READY, but they do not falsify the current Page State blocker repair, whose local owner audit, negative proof, mutation proof bundle, real restart verification, and fresh live log re-analysis all passed.
