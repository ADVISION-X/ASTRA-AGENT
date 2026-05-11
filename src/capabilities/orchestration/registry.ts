import type { OrchestrationChildCapabilityId } from "./contract.js";
import { ORCHESTRATION_CHILD_CAPABILITY_IDS } from "./schema.js";

export function listOrchestrationChildren(): OrchestrationChildCapabilityId[] {
  return [...ORCHESTRATION_CHILD_CAPABILITY_IDS];
}

export function getOrchestrationChildEntry(childCapabilityId: string): OrchestrationChildCapabilityId | null {
  return (ORCHESTRATION_CHILD_CAPABILITY_IDS as readonly string[]).includes(childCapabilityId)
    ? (childCapabilityId as OrchestrationChildCapabilityId)
    : null;
}
