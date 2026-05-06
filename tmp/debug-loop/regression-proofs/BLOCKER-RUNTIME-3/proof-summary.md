# BLOCKER-RUNTIME-3 Proof Summary

- Mutation: changed iPhone Mirroring open step failureBranch to an undeclared/unbacked transition id.
- Expected: map-plugin-package inspector FAIL.
- Observed: FAIL during development activation with transition_not_closed findings.
- Rollback: restored open-iphone-mirroring:failed.
- Observed after rollback: PASS with negative proof skipped for targeted rollback proof.
