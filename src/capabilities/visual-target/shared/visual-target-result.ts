import type { SuccessfulVisualTarget, VisualTarget } from "../contract.js";

export function isSuccessfulVisualTarget(target: VisualTarget): target is SuccessfulVisualTarget {
  return target.status === "success"
    && target.targetNature === "action"
    && target.output !== null
    && target.output.targetNature === "action";
}