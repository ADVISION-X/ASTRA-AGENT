Non-current-owner CI blockers observed during phase 2 verification

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
