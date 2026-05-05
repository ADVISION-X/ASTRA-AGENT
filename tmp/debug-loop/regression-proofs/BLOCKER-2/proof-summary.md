BLOCKER-2 recurrence proof

- Mutated production file: src/capabilities/page-state/children/detect-safety-page/implementation.ts
- Mutation: page_normal reused only positive blocker observation ids instead of collecting governed negative observations.
- Inspector command: npm run audit:page-state
- Expected FAIL observed: yes, see inspector-fail-output.txt.
- Rollback applied: yes, see rollback-proof.txt.
- Inspector PASS after rollback observed: yes, see inspector-pass-output.txt.
