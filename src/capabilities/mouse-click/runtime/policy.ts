import type { ParsedMouseClickAbilityInput } from "../contract.js";

export type PolicyDecision = { ok: true } | { ok: false; reason: MouseClickPolicyFailReason };

export type MouseClickPolicyFailReason =
  | "geometry_guard_not_allow"
  | "policy_blocked";

/**
 * Mouse Click policy is intentionally minimal.
 *
 * Mouse Click checks only that:
 *   1. childCapabilityId is one of the three registered atomic children
 *   2. Geometry Guard approved the coordinate (guardDecision = "allow")
 *   3. Source evidence refs are present
 *   4. Purpose is non-empty
 *
 * Business semantics (like/open_comments/next_video) are NOT inspected here.
 * Those are resolved upstream by Orchestration and AI.
 */
export function checkMouseClickPolicy(
  input: ParsedMouseClickAbilityInput,
): PolicyDecision {
  if (input.guardDecision !== "allow") {
    return { ok: false, reason: "geometry_guard_not_allow" };
  }

  if (!input.geometryGuardRef || !input.geometryGuardProofRef) {
    return { ok: false, reason: "geometry_guard_not_allow" };
  }

  if (!input.sourceRef || !input.sourceCoordinateProofRef) {
    return { ok: false, reason: "policy_blocked" };
  }

  if (!input.purpose) {
    return { ok: false, reason: "policy_blocked" };
  }

  return { ok: true };
}
