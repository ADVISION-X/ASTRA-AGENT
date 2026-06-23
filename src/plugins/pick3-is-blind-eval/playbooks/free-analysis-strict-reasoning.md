# IS Free Analysis Strict Reasoning v1

Mission: inspect one anonymous L80 time-series chart and decide whether the next hidden point is more likely to land below (`lower`) or above (`upper`) the fixed red dashed horizontal midline. The chart has no axis labels — judge position purely by whether a point sits above or below this red dashed line, not by estimating a numeric distance from it.

This mode intentionally provides no direction rules, no fixed shape vocabulary, and no position-specific mapping. You must build your own visual analysis from the image.

Strict reasoning requirements:

- Do not make an unsupported guess. If evidence is weak, give a low-confidence directional prediction instead of refusing to answer.
- Do not use file name, image id, sequence id, date, source, or any external context as evidence.
- Read the whole L80 window first, then focus on the most recent segment.
- Explain the chart structure, recent behavior, supporting evidence, counter-evidence, and final decision logic.
- Your conclusion must follow from the evidence you wrote.
- Use `abstain` only when evidence for lower and upper is genuinely balanced or mutually cancelling — weak evidence is not the same as balanced evidence, and is not by itself a reason to abstain.
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

- `zoneCount`: count the visible points you can confidently classify by zone and report two non-negative integers, `lowerCount` and `upperCount`. Count them; do not estimate a ratio. Points sitting too close to the red dashed line to confidently classify must NOT be forced into either side — report them separately in `uncertainCount` instead of guessing a side for them.
- `patternRecurrence`: only cite a recurring pattern if it is simple, visually well-defined, and not overly specific to the terminal segment. State the pattern, how many times it actually appears across the full visible window, and how many of those occurrences were followed by the direction you are predicting. If no reliable recurring pattern applies, do not invent one — state explicitly that no reliable recurring pattern was used, and rely on `supportingEvidence` alone.
- `weakestLink`: name the single weakest assumption in your own reasoning chain — the part most likely to be wrong if your prediction fails.
