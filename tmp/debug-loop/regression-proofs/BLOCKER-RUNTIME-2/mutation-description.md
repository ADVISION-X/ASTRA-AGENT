# BLOCKER-RUNTIME-2 Mutation

Production mutation removed `localProgram: createGovernedMacOSOpenLocalProgramAdapter()` from `src/lib/local-runtime/workbench-open-runtime.ts`.

Expected result: Open owner inspector must fail because Workbench Open runtime can no longer inject the governed `OpenLocalProgramPort` adapter.
