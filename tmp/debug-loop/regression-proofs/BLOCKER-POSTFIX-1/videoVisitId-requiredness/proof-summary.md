# Proof Summary

Scenario `videoVisitId-requiredness` proves that moving nullable `videoVisitId` into the runtimeProof required chain is machine-blocked.

Result:

- Mutated production governance file caused `npm run audit:screenshot` to fail.
- Rolling back the same production file restored `npm run audit:screenshot` pass.
