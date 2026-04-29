import {
  EmergencyStopChildInputSchema,
  EmergencyStopChildOutputSchema,
  EvaluateStepTransitionChildInputSchema,
  EvaluateStepTransitionChildOutputSchema,
  ExecuteMapStepChildInputSchema,
  ExecuteMapStepChildOutputSchema,
  FinalizeMissionChildInputSchema,
  FinalizeMissionChildOutputSchema,
  OrchestrationChildCapabilityIdSchema,
  PauseMissionChildInputSchema,
  PauseMissionChildOutputSchema,
  RequestHumanReviewChildInputSchema,
  RequestHumanReviewChildOutputSchema,
  ResumeMissionChildInputSchema,
  ResumeMissionChildOutputSchema,
  StartMissionChildInputSchema,
  StartMissionChildOutputSchema,
  StopMissionChildInputSchema,
  StopMissionChildOutputSchema,
} from "./schema.js";
import type { OrchestrationChildCapabilityId } from "./contract.js";

export type OrchestrationRegistryEntry = {
  childCapabilityId: OrchestrationChildCapabilityId;
  commandKind:
    | "start-mission"
    | "pause-mission"
    | "resume-mission"
    | "stop-mission"
    | "emergency-stop"
    | "submit-review-decision";
  inputSchema: unknown;
  outputSchema: unknown;
  allowedCaller: "commander-console" | "orchestration";
  requiresMissionId: boolean;
  requiresMapId: boolean;
  requiresNerveBus: boolean;
  emergencyPriority: "normal" | "hard-stop";
  maxDurationMs: number;
  idempotencyPolicy: "per-mission-command" | "per-sequence-step" | "single-flight";
};

const REGISTRY = [
  {
    childCapabilityId: "start-mission",
    commandKind: "start-mission",
    inputSchema: StartMissionChildInputSchema,
    outputSchema: StartMissionChildOutputSchema,
    allowedCaller: "commander-console",
    requiresMissionId: true,
    requiresMapId: false,
    requiresNerveBus: true,
    emergencyPriority: "normal",
    maxDurationMs: 30000,
    idempotencyPolicy: "per-mission-command",
  },
  {
    childCapabilityId: "pause-mission",
    commandKind: "pause-mission",
    inputSchema: PauseMissionChildInputSchema,
    outputSchema: PauseMissionChildOutputSchema,
    allowedCaller: "commander-console",
    requiresMissionId: true,
    requiresMapId: false,
    requiresNerveBus: false,
    emergencyPriority: "normal",
    maxDurationMs: 1000,
    idempotencyPolicy: "single-flight",
  },
  {
    childCapabilityId: "resume-mission",
    commandKind: "resume-mission",
    inputSchema: ResumeMissionChildInputSchema,
    outputSchema: ResumeMissionChildOutputSchema,
    allowedCaller: "commander-console",
    requiresMissionId: true,
    requiresMapId: false,
    requiresNerveBus: true,
    emergencyPriority: "normal",
    maxDurationMs: 30000,
    idempotencyPolicy: "single-flight",
  },
  {
    childCapabilityId: "stop-mission",
    commandKind: "stop-mission",
    inputSchema: StopMissionChildInputSchema,
    outputSchema: StopMissionChildOutputSchema,
    allowedCaller: "commander-console",
    requiresMissionId: true,
    requiresMapId: false,
    requiresNerveBus: false,
    emergencyPriority: "normal",
    maxDurationMs: 1000,
    idempotencyPolicy: "single-flight",
  },
  {
    childCapabilityId: "emergency-stop",
    commandKind: "emergency-stop",
    inputSchema: EmergencyStopChildInputSchema,
    outputSchema: EmergencyStopChildOutputSchema,
    allowedCaller: "commander-console",
    requiresMissionId: true,
    requiresMapId: false,
    requiresNerveBus: false,
    emergencyPriority: "hard-stop",
    maxDurationMs: 1000,
    idempotencyPolicy: "single-flight",
  },
  {
    childCapabilityId: "execute-map-step",
    commandKind: "resume-mission",
    inputSchema: ExecuteMapStepChildInputSchema,
    outputSchema: ExecuteMapStepChildOutputSchema,
    allowedCaller: "orchestration",
    requiresMissionId: true,
    requiresMapId: true,
    requiresNerveBus: true,
    emergencyPriority: "normal",
    maxDurationMs: 30000,
    idempotencyPolicy: "per-sequence-step",
  },
  {
    childCapabilityId: "evaluate-step-transition",
    commandKind: "resume-mission",
    inputSchema: EvaluateStepTransitionChildInputSchema,
    outputSchema: EvaluateStepTransitionChildOutputSchema,
    allowedCaller: "orchestration",
    requiresMissionId: true,
    requiresMapId: true,
    requiresNerveBus: false,
    emergencyPriority: "normal",
    maxDurationMs: 1000,
    idempotencyPolicy: "per-sequence-step",
  },
  {
    childCapabilityId: "request-human-review",
    commandKind: "submit-review-decision",
    inputSchema: RequestHumanReviewChildInputSchema,
    outputSchema: RequestHumanReviewChildOutputSchema,
    allowedCaller: "orchestration",
    requiresMissionId: true,
    requiresMapId: true,
    requiresNerveBus: true,
    emergencyPriority: "normal",
    maxDurationMs: 10000,
    idempotencyPolicy: "per-sequence-step",
  },
  {
    childCapabilityId: "finalize-mission",
    commandKind: "submit-review-decision",
    inputSchema: FinalizeMissionChildInputSchema,
    outputSchema: FinalizeMissionChildOutputSchema,
    allowedCaller: "orchestration",
    requiresMissionId: true,
    requiresMapId: true,
    requiresNerveBus: false,
    emergencyPriority: "normal",
    maxDurationMs: 1000,
    idempotencyPolicy: "per-sequence-step",
  },
] as const satisfies readonly OrchestrationRegistryEntry[];

const REGISTRY_BY_ID = new Map(REGISTRY.map((entry) => [entry.childCapabilityId, entry]));

export function listOrchestrationChildren(): OrchestrationChildCapabilityId[] {
  return OrchestrationChildCapabilityIdSchema.options.slice();
}

export function createOrchestrationCapabilityRegistry(): ReadonlyMap<OrchestrationChildCapabilityId, OrchestrationRegistryEntry> {
  return REGISTRY_BY_ID;
}

export function getOrchestrationRegistryEntry(childCapabilityId: OrchestrationChildCapabilityId): OrchestrationRegistryEntry {
  const entry = REGISTRY_BY_ID.get(childCapabilityId);
  if (!entry) {
    throw new Error(`Unknown orchestration child capability: ${childCapabilityId}`);
  }
  return entry;
}