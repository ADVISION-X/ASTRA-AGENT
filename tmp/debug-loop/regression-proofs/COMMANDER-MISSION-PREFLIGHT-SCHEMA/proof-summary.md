coveredLawIds:
- GRASSEYE-STARTUP-ENTRYPOINT-005-V1

Mutated production file caused commander-console inspector to FAIL:
- file: src/lib/local-runtime/workbench-mission-command-preflight.ts
- mutation: MissionCommandSchema.safeParse changed to MissionCommandSchema.parse
- observed: commander-console inspector reported MissionStartPreflight must dry-run MissionCommandSchema before COMMANDER dispatch

Rollback restored the production file:
- rollback: PASS observed after restoring MissionCommandSchema.safeParse

Evidence:
- mutated-file.patch
- inspector-fail-output.txt
- rollback-proof.txt
- inspector-pass-output.txt
