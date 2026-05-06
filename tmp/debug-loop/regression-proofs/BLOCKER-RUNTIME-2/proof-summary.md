# BLOCKER-RUNTIME-2 Proof Summary

- Mutated production file: `src/lib/local-runtime/workbench-open-runtime.ts`
- Inspector command: `GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF=1 node --import tsx scripts/audit/domains/open-capability/run-inspector.ts`
- Expected FAIL observed: yes
- Rollback PASS observed: yes
- Covered blocker: `OpenLocalProgramPort is not configured`.
