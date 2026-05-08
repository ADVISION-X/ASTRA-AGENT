import { getDevelopmentMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { createId } from "./ids.js";
import { shouldDurablyPersistCommanderDebugEvent } from "./workbench-debug-persistence-policy.js";
import type { WorkbenchBaseRuntime } from "./workbench-contract.js";

const buildCommanderMapChain = (input: {
  mapId?: string | null | undefined;
  taskTemplateId?: string | null | undefined;
}) => {
  const registry = getDevelopmentMapPluginRegistry().active;
  const record = input.mapId
    ? registry.getActiveOperationalMapRecord(input.mapId)
    : input.taskTemplateId
      ? registry.getActiveOperationalMapRecordByTaskTemplateId(input.taskTemplateId)
      : null;

  if (!record) {
    return {
      mapPackageId: null,
      mapPackageVersion: null,
      selectedMapId: input.mapId ?? null,
      selectedMapVersion: null,
      activationSnapshotRef: null,
    };
  }

  return {
    mapPackageId: record.packageId,
    mapPackageVersion: record.packageVersion,
    selectedMapId: record.mapId,
    selectedMapVersion: record.mapVersion,
    activationSnapshotRef: record.activationSnapshotRef,
  };
};

const buildCommanderDebugIdentity = (input: {
  eventType: string;
  traceId: string;
  spanId: string;
  attemptId: string;
	  missionId?: string | null;
	  runId?: string | null;
	  mapId?: string | null;
  taskTemplateId?: string | null;
}) => ({
  eventId: createId("event"),
  eventType: input.eventType,
  level: "DEBUG",
  phase: "mission-command",
  component: "commander-console",
  owner: "Commander Console",
  abilityGroupId: "commander-console",
  childCapabilityId: "issue-human-command",
  skillId: null,
  skillCategory: null,
	  sessionId: input.traceId,
	  runId: input.runId ?? input.traceId,
	  missionId: input.missionId ?? null,
  roundId: input.attemptId,
  videoVisitId: null,
  mapId: input.mapId ?? null,
  taskTemplateId: input.taskTemplateId ?? null,
  traceId: input.traceId,
  spanId: input.spanId,
  attemptId: input.attemptId,
});

const buildCommanderDebugOutcome = (
  runtime: WorkbenchBaseRuntime,
  input: {
    status: "started" | "success" | "failed" | "review_required";
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
    refs?: string[];
    inputRefs?: string[];
    outputRefs?: string[];
    proofRefs?: string[];
    artifactRefs?: string[];
  },
) => ({
  browserProfileRef: runtime.browserSessionConfig.profileRef,
  loginState: runtime.browserController.getSessionState().loginState,
  step: "task_start",
  previousStep: null,
  nextStep: null,
  status: input.status,
  reason: input.reason ?? null,
  failureReason: input.failureReason ?? null,
  reviewRequiredReason: input.status === "review_required" ? input.failureReason ?? input.reason ?? null : null,
  actionableMessage: input.actionableMessage ?? null,
  ownerResponsible: input.ownerResponsible ?? null,
  decision: input.decision ?? null,
  roundOutcome: null,
  finalizationType: null,
  samplingStrategy: null,
  expectedFrameCount: null,
  validFrameCount: null,
  fallbackReason: null,
  missingFrames: [],
  snapshotSummary: null,
  createdAt: new Date().toISOString(),
  durationMs: input.durationMs ?? null,
  refs: input.refs ?? [],
  inputRefs: input.inputRefs ?? [],
  outputRefs: input.outputRefs ?? [],
  evidenceRefs: [],
  proofRefs: input.proofRefs ?? [],
  artifactRefs: input.artifactRefs ?? [],
  actionLogRefs: [],
  dataQualityFlags: [],
});

const buildCommanderDebugStructuredRuntimeEvent = (
  runtime: WorkbenchBaseRuntime,
  input: {
    eventType: string;
    status: "started" | "success" | "failed" | "review_required";
    traceId: string;
    spanId: string;
    attemptId: string;
	    missionId?: string | null;
	    runId?: string | null;
	    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
    refs?: string[];
    inputRefs?: string[];
    outputRefs?: string[];
    proofRefs?: string[];
    artifactRefs?: string[];
  },
) => StructuredRuntimeEventSchema.parse({
  ...buildCommanderDebugIdentity(input),
  ...buildCommanderDebugOutcome(runtime, input),
});

export const recordCommanderDebugEvent = async (
  runtime: WorkbenchBaseRuntime,
  input: {
    eventType: string;
    status: "started" | "success" | "failed" | "review_required";
    traceId: string;
    spanId: string;
    attemptId: string;
	    missionId?: string | null;
	    runId?: string | null;
	    mapId?: string | null;
    taskTemplateId?: string | null;
    reason?: string | null;
    failureReason?: string | null;
    actionableMessage?: string | null;
    ownerResponsible?: string | null;
    decision?: string | null;
    durationMs?: number | null;
    refs?: string[];
    inputRefs?: string[];
    outputRefs?: string[];
    proofRefs?: string[];
    artifactRefs?: string[];
  },
): Promise<void> => {
  const structuredRuntimeEvent = buildCommanderDebugStructuredRuntimeEvent(runtime, input);
  if (!shouldDurablyPersistCommanderDebugEvent(input.eventType)) {
    runtime.structuredLogBus.emitRuntimeEvent(structuredRuntimeEvent);
    return;
  }

  const mapChain = buildCommanderMapChain({ mapId: input.mapId, taskTemplateId: input.taskTemplateId });
  await runtime.forensicsPersistenceAbilityGroup.writeStructuredRuntimeEvent({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "commander-console",
    sourceAbilityGroupId: "commander-console",
    sourceChildCapabilityId: "issue-human-command-debug",
    missionId: input.missionId ?? input.traceId,
    runId: input.runId ?? input.traceId,
    sessionId: input.traceId,
    roundId: input.attemptId,
    videoVisitId: null,
    stepId: "task_start",
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: mapChain.selectedMapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: input.spanId,
    inputRefs: input.inputRefs ?? [],
    outputRefs: input.outputRefs ?? [],
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: input.artifactRefs ?? [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent,
    },
  });
};
