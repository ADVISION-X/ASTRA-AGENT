# BLOCKER-4 Mutation

Replaced handleStartupBootstrapFailure in the startup hard-failure catch path with a direct logFail call. Expected audit:commander-console to fail because current startup failures would no longer produce a correlated debug-loop bundle.
