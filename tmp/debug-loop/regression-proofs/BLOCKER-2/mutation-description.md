# BLOCKER-2 Mutation

Removed ensureStartupMapPackageReadiness() from performLaunch. Expected audit:commander-console to fail because startup would start readiness without the map package pre-service gate.
