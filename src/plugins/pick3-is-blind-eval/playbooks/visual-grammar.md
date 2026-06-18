# IS L80 Visual Grammar

Use this grammar to describe the unfinished tail of one no-text chart.

Motion words:

- `surge_up`: large upward tail stroke, clearly crossing the shoulder upward.
- `rise`: clear upward move, approaching or touching the shoulder from below.
- `slow_rise`: small upward move, tail still clearly below shoulder.
- `hold`: flat or nearly flat tail, no directional commitment.
- `slow_fall`: small downward move, tail still near shoulder.
- `upper_fall`: clear downward move from an upper-zone area, still in progress.
- `kill_down`: large downward drop, ending at or near recent lows.

Shape words:

- `sharp_top`: upward motion followed by visible downward pressure. Spike-like. One isolated high.
- `sharp_bottom`: downward motion followed by upward pressure ALREADY VISIBLE in the tail. V-shape forming. The rebound must have started — a bare low point with no rebound is not a sharp_bottom.
- `bare_low`: tail ends at a recent extreme low with NO rebound visible. Direction still down.
- `upward_inertia`: repeated upward tail movement across 3+ recent points.
- `downward_inertia`: repeated downward tail movement across 3+ recent points.
- `shoulder_return`: tail returns toward the 4.5 line from either side.
- `shoulder_reject`: tail approaches 4.5 but fails to cross or hold. Clear bounce away.
- `shoulder_hold`: tail crosses 4.5 and stays above it for 2+ recent points.
- `high_pressure`: repeated upper-band contact above the shoulder across multiple recent points.
- `low_pressure`: repeated lower-band contact below the shoulder across multiple recent points. Tail weight is in the lower zone.
- `high_to_shoulder_edge`: tail descends from the upper band and the most recent point sits near the shoulder edge, still falling.
- `oscillation_hold_upper`: alternating moves but consistently returning to upper zone after each lower dip.
- `disordered_chop`: alternating moves with no stable continuation. Cannot determine dominant zone.

Decision discipline:

- Interpret the last 3–8 points first, then check the broader L80 context for weight and rhythm.
- `sharp_bottom` requires a visible upward rebound already forming — do NOT call it sharp_bottom if the tail just dropped and stopped.
- `bare_low` (tail ends at a low with no rebound) is ambiguous: lean abstain unless broader context is strongly directional.
- `upper_fall` alone does NOT predict lower reliably. Many upper_fall sequences bounce upward to upper zone. Require additional evidence before committing to lower.
- `high_to_shoulder_edge` is a reliable lower signal: tail was in the upper band and has since descended to the shoulder edge, still falling. Treat as lower when this is clear.
- `low_pressure` sustained across 3+ recent points is a reliable lower signal — the weight of the tail is in the lower zone.
- `shoulder_hold` sustained across 2+ recent points is a reliable upper signal — the tail has crossed and stayed above 4.5.
- `oscillation_hold_upper` is a reliable upper signal — even with dips, the tail consistently returns to the upper zone, weight is above the midline.
- When a motion word and a shape word conflict, trust the last 3-8 point shape first. Example: `surge_up` followed by `sharp_top` is exhaustion risk, while `kill_down` followed by `sharp_bottom` is rebound evidence.
- When lower and upper signals both appear, require multi-signal agreement before choosing a side; otherwise choose `abstain`.
- Momentum alone is not enough. One extreme stroke creates reversal risk.
- Noisy contradiction means `abstain`.
- When confidence is low (can't clearly name a shape), always choose `abstain`.

Confidence calibration:

- `0.51`: shape is barely readable, one weak directional cue only.
- `0.55`: clear named shape with consistent tail direction (2+ confirming points).
- `0.60`: strong multi-signal convergence — named shape + broader L80 context agree + no contradicting cues.
- Never exceed `0.60`. If visual clarity feels stronger than 0.60, cap confidence at `0.60` and keep the chosen label.
