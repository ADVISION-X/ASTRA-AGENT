BLOCKER-1 recurrence proof

- Mutated production file: src/lib/local-runtime/workbench-human-command.ts
- Mutation: handleStartMission awaited runtime.orchestrationAbilityGroup.startMission before returning the command receipt.
- Inspector command: npm run audit:commander-console
- Expected FAIL observed: yes, see inspector-fail-output.txt.
- Rollback applied: yes, see rollback-proof.txt.
- Inspector PASS after rollback observed: yes, see inspector-pass-output.txt.
