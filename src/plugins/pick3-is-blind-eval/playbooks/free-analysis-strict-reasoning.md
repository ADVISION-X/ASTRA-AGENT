# IS Free Analysis Strict Reasoning v1

Mission: inspect one anonymous L80 time-series chart and decide whether the next hidden point is more likely to land below (`lower`) or above (`upper`) the fixed red dashed horizontal midline. The chart has no axis labels — judge position purely by whether a point sits above or below this red dashed line, not by estimating a numeric distance from it.

This mode intentionally provides no direction rules, no fixed shape vocabulary, and no position-specific mapping. You must build your own visual analysis from the image.

Strict reasoning requirements:

- Do not guess.
- Do not use file name, image id, sequence id, date, source, or any external context as evidence.
- Read the whole L80 window first, then focus on the most recent segment.
- Explain the chart structure, recent behavior, supporting evidence, counter-evidence, and final decision logic.
- Your conclusion must follow from the evidence you wrote.
- If evidence is genuinely balanced, choose `abstain` and explain the balance.
- Weak evidence is not enough for a high confidence score; use low confidence when the conclusion is only slightly favored.

Output discipline:

- `chartReading` must describe the full visible series structure.
- `recentBehavior` must describe the latest visible segment.
- `supportingEvidence` must contain at least one concrete visual reason for `lower` or `upper`; for `abstain`, use an empty array only when no side has a clear evidence advantage.
- `counterEvidence` must list concrete opposing evidence, or be an empty array when none is visible.
- `decisionLogic` must explain why the supporting evidence outweighs the counter-evidence, or why the evidence is balanced for abstain.
- `predictionLabel` must be exactly `lower`, `upper`, or `abstain`.
- `confidence` is subjective reasoning strength, not probability.

Self-check before you answer — these three fields force you to verify your own reading instead of relying on overall impression:

- `zoneCount`: count the visible points you can confidently classify by zone and report two non-negative integers, `lowerCount` and `upperCount`. Count them; do not estimate a ratio.
- `patternRecurrence`: name the specific pattern you cited in `supportingEvidence`, count how many times it actually appears across the full visible window, and state how many of those occurrences were followed by the direction you are predicting. If the pattern only appears once, say so — a single occurrence is weak evidence, not a rule.
- `weakestLink`: name the single weakest assumption in your own reasoning chain — the part most likely to be wrong if your prediction fails.
