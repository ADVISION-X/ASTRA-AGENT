# Fresh Root Cause Matrix

| ID | Status | First failing event | Root cause candidate | Owner | Priority |
|---|---|---|---|---|---|
| BLOCKER-FRESH-1 | current | `CAPABILITY_CALL_FAILED prepare-ai-input` | Screenshot `prepare-ai-input` proof/result chain does not preserve `scaleMapping` into the runtime proof that is schema-validated. | Screenshot | P0 |

## Judgment

The old `source Required` failure is gone. The fresh P0 is not a startup, Nerve Bus, Commander, or map closure failure. It is the next Screenshot proof-chain failure in the AI handoff path.
