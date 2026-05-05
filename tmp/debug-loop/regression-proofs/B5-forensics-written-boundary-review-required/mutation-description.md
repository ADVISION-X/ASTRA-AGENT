# B5 mutation: revert WRITTEN emission to success-only

Target file: src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts

Mutation:
- From: `if (!emitter || result.status === "failed") {`
- To: `if (!emitter || result.status !== "success") {`

Intent:
- Recreate the original B5 regression where persisted `FORENSICS_RECORD_WRITE_REQUESTED` survives but `FORENSICS_RECORD_WRITTEN` is suppressed for `review_required` writes.

Expected inspector effect:
- `tmp/debug-loop/post-fix-runtime-verification/run-forensics-write-boundary-subcheck.ts` must fail with `GRASSEYE-STRUCTURED-LOGGING-001-V1` for `src/capabilities/forensics-persistence/shared/forensics-write-boundary-events.ts`.
