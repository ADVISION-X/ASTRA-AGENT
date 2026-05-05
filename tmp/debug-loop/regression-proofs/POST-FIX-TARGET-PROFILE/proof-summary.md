# POST-FIX-TARGET-PROFILE Proof Summary

- Mutation: changed Facebook built-in task template `targetProfileRef` from `open-target-profile:open-facebook` to `facebook-web:persistent-local-profile`.
- Inspector command: `npm run audit:map-plugin-package`.
- Mutated result: FAIL with `taskTemplate.targetProfileRef: invalid_platform_profile`.
- Rollback result: PASS with `rollbackExitCode=0`.
- Recurrence guard: built-in map package validation rejects initial open steps whose task template target profile does not match the governed open-target-profile ref.
