# Fresh Enforcement Gap Matrix

| Gap ID | Escaped problem | Why it escaped | Next enforcement action |
|---|---|---|---|
| SCREENSHOT-GAP-2 | `prepare-ai-input` proof missing `scaleMapping` | Existing blocker repair/negative proof focused on source handoff. Inspector has schema markers for scale mapping but no production mutation proving `prepare-ai-input` cannot lose scaleMapping in the success proof/result path. | Extend Screenshot required-shape and negative proof to mutate the production success path so losing `resolvePrepareAiInputScaleMapping()` or omitting `scaleMapping` fails before runtime. |
