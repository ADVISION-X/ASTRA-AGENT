# IS Blind Eval System Playbook — Phase 1

What you are looking at:

- This is a trend chart. Each black dot is one historical data point, in time order from left (oldest) to right (most recent). A blue line connects the dots in order so you can see the path the series took over time.
- The red dashed horizontal line is a fixed reference line. It does not move and has no number attached to it — judge a dot's position only by whether it sits above or below this line, never by estimating a numeric distance from it.
- The right edge of the chart has blank empty space after the last dot. That blank space is where the next point — the one you are asked to predict — would appear. It does not exist yet on the chart.

What you must do:

- Based on the historical path shown by the dots and line, decide whether the next point (the one that would appear in that blank space on the right) will land below (`lower`) or above (`upper`) the red dashed line.
- Every prediction must be derived from named visual evidence you actually observed in the chart. Analysis is mandatory. Guessing is forbidden.

Hard boundaries:

- The image window is `L=80` (`L80`).
- Read only the chart shape: line, dots, and the red dashed horizontal midline.
- Do not infer from file name, image id, sequence number, date, value frequency, recency bias, or any external context.
- Do not predict a concrete value or reason from numeric distribution.
- Confidence reflects the strength of your visual evidence, not statistical probability.
- Every prediction of `lower` or `upper` must be grounded in at least one named shape word from the grammar vocabulary. A prediction without named evidence is invalid.
- Ambiguity alone is not sufficient reason to abstain.
- Use `abstain` only when your analysis identifies strong lower evidence AND strong upper evidence of equal weight that directly cancel each other out. `abstain` is an analysis conclusion, not a retreat from analysis.
- Weak evidence is not a reason to abstain. Weak evidence produces a low-confidence prediction (0.51), not abstain.

Evidence requirement:

- `tailShapes`: list every named grammar motion/shape word you observe in the last 3–8 tail points. Minimum 1 item. A response without tailShapes is invalid. Words must come from the visual-grammar vocabulary only — informal descriptors (climb, ascending, drop, descend, or any word not in the grammar list) are invalid and will cause parse failure.
- `zoneWeight`: one of `"lower_weighted"`, `"upper_weighted"`, or `"balanced"` — your assessment of where the full L80 window spends more time relative to the red dashed horizontal midline.
- `drivingEvidence`: one sentence naming the specific shape that determined your direction conclusion.
- `discountedEvidence`: one sentence naming any opposing signal you noticed but chose not to let override your conclusion. Use null if you observed no opposing signal. Do not use an empty string. Contrarian override rule: if your position playbook instructs you to treat a signal opposite to the standard grammar (e.g., Stream B treating `shoulder_hold` as lower evidence), the standard grammar interpretation you are overriding IS your discounted evidence — `discountedEvidence` must NOT be null in this case.
- `reason`: the full analytical chain. Do not write one sentence. Write: which shapes you named, the zone weight, and how they together produced your conclusion.
- If `abstain`: `abstainReason` must name both the lower evidence and the upper evidence that conflict, and explain why neither outweighs the other.

Output JSON only. Follow the final output contract supplied at the end of the prompt.
