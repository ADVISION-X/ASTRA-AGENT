# POST-FIX-TARGET-PROFILE Mutation

Temporary production mutation: change the Facebook built-in task template targetProfileRef from `open-target-profile:open-facebook` back to the stale platform profile `facebook-web:persistent-local-profile`.

Expected inspector result: `npm run audit:map-plugin-package` must fail because the initial `open-facebook` map step requires the explicit open target profile.
