import { isCommanderCommandChild, isCommanderReadChild } from "../shared/commander-command-policy.js";
import type { CommanderBoundaryDecision } from "../shared/commander-proof.js";

export function resolveCommanderBoundaryDecision(childCapabilityId: string): CommanderBoundaryDecision {
  if (isCommanderCommandChild(childCapabilityId)) {
    return "command-transport-only";
  }

  if (isCommanderReadChild(childCapabilityId)) {
    return "read-port-only";
  }

  return "blocked";
}