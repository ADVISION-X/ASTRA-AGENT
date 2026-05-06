# BLOCKER-RUNTIME-1 Proof Summary

- Mutated production file: `src/lib/local-runtime/workbench-screenshot-dispatch-input.ts`
- Inspector command: `GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF=1 node --import tsx scripts/audit/domains/screenshot-capability/run-inspector.ts`
- Expected FAIL observed: yes
- Rollback PASS observed: yes
- Covered blocker: `prepare-ai-input` missing governed stored-image `source`.
