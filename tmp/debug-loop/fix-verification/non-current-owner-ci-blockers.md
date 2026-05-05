# Non-Current-Owner CI Blockers

## Scope note

Current task owner slices:

- screenshot dispatch adapter chain + recurrence enforcement
- orchestration CAPABILITY_CALL_STARTED runtime proof + recurrence enforcement

Current task owner validations already pass:

- npm run audit:screenshot
- npm run audit:orchestration

The remaining failures below are outside the current blocker root-cause set.

## Command blockers

### npm run audit

- Status: FAIL
- Blocking owner: audit-system
- Evidence: tmp/debug-loop/fix-and-recurrence-prevention/command-results/audit.txt
- Detail: fail-fast stops at `audit-system` after `map-plugin-package` and `debug-loop-boundary` pass.

### npm run typecheck

- Status: FAIL
- Evidence: tmp/debug-loop/fix-and-recurrence-prevention/command-results/typecheck.txt
- Non-current-owner files:
  - scripts/audit/census/assert-census-complete.ts
  - scripts/audit/core/static-clause-coverage-artifact.ts
  - scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts
  - scripts/audit/domains/post-action-verification-capability/run-governed-runtime-checks.ts
  - src/lib/local-runtime/workbench-commander-console.ts
  - src/lib/local-runtime/workbench-status.ts
  - src/lib/local-runtime/workbench.ts
- Detail: the current task's helper typing errors were removed before this note was written; the remaining failures are pre-existing external blockers.

### npm run lint

- Status: FAIL
- Evidence: tmp/debug-loop/fix-and-recurrence-prevention/command-results/lint.txt
- Detail: lint delegates to typecheck and fails on the same external files listed above.

### npm run ci:full

- Status: FAIL
- Evidence: tmp/debug-loop/fix-and-recurrence-prevention/command-results/ci-full.txt
- Detail: ci:full fail-fast stops at typecheck on the same external blockers listed above.

### git diff --check

- Status: FAIL
- Evidence: tmp/debug-loop/fix-and-recurrence-prevention/command-results/git-diff-check.txt
- Blocking file: .github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md
- Detail: failure is trailing whitespace in a law file. This task does not modify law files, so the blocker is recorded rather than repaired here.Non-current-owner CI blockers observed during phase 2 verification

Static commands executed:
- npm run audit:build: PASS, see audit-build-output.txt.
- npm run audit: FAIL-FAST at audit-system fake enforcement, see audit-output.txt.
- npm run typecheck: FAIL, see typecheck-output.txt.
- npm run lint: FAIL because lint delegates to typecheck, see lint-output.txt.
- npm run ci:full: FAIL-FAST at typecheck, see ci-full-output.txt.
- git diff --check: PASS, see git-diff-check-output.txt.

Failures outside the current P0 runtime blocker owners:
- scripts/audit/census/assert-census-complete.ts has existing unknown/undefined strict TypeScript errors.
- scripts/audit/core/static-clause-coverage-artifact.ts has an unresolved AuditSummaryEntry type and null handling errors.
- scripts/audit/domains/forensics-persistence-capability/run-forensics-structured-log-runtime-checks.ts has an existing possibly-undefined error in unrelated dirty Forensics work.
- scripts/audit/domains/post-action-verification-capability/run-governed-runtime-checks.ts has existing .ts import extension errors and null handling.
- src/lib/local-runtime/workbench-status.ts has an existing exactOptionalPropertyTypes mismatch on optional mission readiness fields.
- npm run audit fails at audit-system fake enforcement before reaching the full plan.

Current owner checks completed:
- npm run audit:commander-console: PASS after production mutation rollback.
- npm run audit:page-state: PASS after production mutation rollback.
