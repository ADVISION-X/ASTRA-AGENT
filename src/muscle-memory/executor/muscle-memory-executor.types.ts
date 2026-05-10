import type { ExecutionPlan } from "../decoder/action-plan-decoder.js";

export type PayloadRefs = Record<string, unknown> & {
  abilityResultRef?: string | null;
  productLeadRecordRef?: string | null;
  nextItemAdvanceProofRef?: string | null;
};

type ExecutionChain = {
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
};

type AbilityDispatchResult = {
  status: "success" | "failed" | "review_required";
  failureReason: string | null;
  payloadRefs: PayloadRefs;
};

type AbilityDispatchCommand = {
  missionId: string;
  mapId: string;
  stepId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  mapPackageId: string;
  mapPackageVersion: string;
  selectedMapVersion: string;
  activationId: string;
  activationSnapshotRef: string;
  targetAbilityGroupId: string;
  childCapabilityId: string;
  expectedOutputSchemaRef: string;
  postClickObservation: boolean;
  payloadRefs: PayloadRefs;
  sequenceNo: number;
  idempotencyKey: string;
  timeoutMs: number;
};

export type ExecuteMuscleMemoryPlanInput = {
  state: { payloadRefs: PayloadRefs };
  map: { mapId: string };
  missionId: string;
  chain: ExecutionChain;
  sequenceNo: number;
  idempotencyKey: string;
  plan: ExecutionPlan;
  nerveBus: {
    sendCommandToAbility(command: AbilityDispatchCommand): Promise<AbilityDispatchResult>;
  };
};

export type ExecutionAction = ExecutionPlan["actions"][number];