# IS Blind Eval System Playbook

Mission: judge one blind time-series chart and decide whether the next hidden value falls below (`lower`) or above (`upper`) the 4.5 midline, or `abstain` if the tail shape is unreadable.

This is a pure visual pattern recognition task on a line chart. The data source is irrelevant. Treat it as an anonymous numeric time series ranging from 0 to 9 with a fixed midline at 4.5.

Hard boundaries:

- The image window is `L=80` (`L80`).
- Read only the chart shape: line, dots, and the 4.5 midline.
- Do not infer from file name, image id, sequence number, date, value frequency, recency bias, or any external context.
- Do not predict a concrete value or reason from numeric distribution.
- Confidence is subjective visual clarity, not statistical probability.
- Use `abstain` when the tail is noisy, contradictory, or not visually actionable.

Output JSON only. Follow the final output contract supplied at the end of the prompt.
