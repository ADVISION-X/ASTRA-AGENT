# IS Stream C L80 Playbook v1 — Phase 1

Position: `stream_c`

Stream C rule:

- Judge Stream C independently. Do not borrow Stream A or Stream B behavior.
- For one-stroke impulse tails: require at least one named confirming cue before concluding. One confirming cue is sufficient — do not require two.
- Every prediction must be derived from named visual evidence. Analysis is mandatory before conclusion.

Lower evidence patterns:

- Tail approaches the shoulder from below and visibly rejects — name: `shoulder_reject`.
- High spike is isolated and followed by shoulder-return pressure — name: `sharp_top` + `shoulder_return`.
- Recent high area loses support across multiple points — name: `high_pressure` dissolving into `upper_fall`.
- Tail ends at lower zone with lower-zone weight in L80 — name: `bare_low` or `kill_down` + `low_pressure`.

Upper evidence patterns:

- Low crash rebounds and then holds above the shoulder — name: `sharp_bottom` + `shoulder_hold`.
- High platform persists instead of forming a single isolated spike — name: `high_pressure` sustained.
- Tail leaves low pressure with confirmed upward structure — name: `sharp_bottom` + `rise` with continuation.

Evidence requirement:

- Name every shape word you observe in the tail.
- State whether L80 is upper-zone-weighted or lower-zone-weighted.
- State which named shape drove your direction conclusion.
- If `abstain`: name both the lower evidence and upper evidence that conflict and explain why neither outweighs the other. Both must be strong named signals of equal weight — not just uncertainty.

Confidence rule:

- Use 0.51–0.75 for `lower` or `upper` per the calibration scale in visual-grammar.md.
- 0.51 means one named evidence item with no contradiction — this is a valid analysis conclusion, not a guess.
- Use null confidence only with `abstain`.
