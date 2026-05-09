import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";

type JsonObject = Record<string, unknown>;

export type WorkbenchPageStateProofSummary = {
  outputRef: string;
  pageStateProofRef: string;
  pageStateChildCapabilityId: string;
  pageStateStatus: WorkbenchAbilityExecutionResult["status"];
  pageStateFingerprint: string;
  pageStateHash: string;
  currentUrl: string;
  currentTitle: string | null;
  observedAt: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
};

const summaries = new Map<string, WorkbenchPageStateProofSummary>();

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: JsonObject | null | undefined, key: string): string | null => {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
};

type PageStateProofSummaryFields = {
  pageStateProofRef: string;
  pageStateChildCapabilityId: string;
  pageStateFingerprint: string;
  pageStateHash: string;
  currentUrl: string;
  currentTitle: string | null;
  observedAt: string;
  missionId: string;
  runId: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
};

type PageStateProofSummaryRequiredFields = {
  pageStateProofRef: string;
  pageStateChildCapabilityId: string;
  pageStateFingerprint: string;
  pageStateHash: string;
  currentUrl: string;
  observedAt: string;
  missionId: string;
  runId: string;
  sessionId: string;
};

const resolvePageStateProofSummaryRequiredValues = (runtimeProof: JsonObject): PageStateProofSummaryRequiredFields | null => {
  const requiredValues = {
    pageStateProofRef: readString(runtimeProof, "proofId"),
    pageStateChildCapabilityId: readString(runtimeProof, "childCapabilityId"),
    pageStateFingerprint: readString(runtimeProof, "observationFingerprint"),
    pageStateHash: readString(runtimeProof, "snapshotHash") ?? readString(runtimeProof, "inputPayloadHash"),
    currentUrl: readString(runtimeProof, "currentUrl"),
    observedAt: readString(runtimeProof, "endedAt") ?? readString(runtimeProof, "startedAt"),
    missionId: readString(runtimeProof, "missionId"),
    runId: readString(runtimeProof, "runId"),
    sessionId: readString(runtimeProof, "sessionId"),
  };

  if (!requiredValues.pageStateProofRef || !requiredValues.pageStateChildCapabilityId || !requiredValues.pageStateFingerprint || !requiredValues.pageStateHash || !requiredValues.currentUrl || !requiredValues.observedAt || !requiredValues.missionId || !requiredValues.runId || !requiredValues.sessionId) {
    return null;
  }

  return requiredValues;
};

const resolvePageStateProofSummaryRequiredFields = (input: {
  result: WorkbenchAbilityExecutionResult;
}): PageStateProofSummaryRequiredFields | null => {
  if (input.result.abilityGroupId !== "page-state" || !isObject(input.result.runtimeProof)) {
    return null;
  }

  return resolvePageStateProofSummaryRequiredValues(input.result.runtimeProof);
};

const resolvePageStateProofSummaryFields = (input: {
  result: WorkbenchAbilityExecutionResult;
}): PageStateProofSummaryFields | null => {
  const requiredFields = resolvePageStateProofSummaryRequiredFields(input);
  if (!requiredFields) {
    return null;
  }

  const runtimeProof = input.result.runtimeProof;
  return {
    ...requiredFields,
    currentTitle: readString(runtimeProof, "currentTitle"),
    roundId: readString(runtimeProof, "roundId"),
    videoVisitId: readString(runtimeProof, "videoVisitId"),
  };
};

const buildSummary = (input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): WorkbenchPageStateProofSummary | null => {
  const fields = resolvePageStateProofSummaryFields({ result: input.result });
  if (!fields) {
    return null;
  }

  return {
    outputRef: input.outputRef,
    pageStateProofRef: fields.pageStateProofRef,
    pageStateChildCapabilityId: fields.pageStateChildCapabilityId,
    pageStateStatus: input.result.status,
    pageStateFingerprint: fields.pageStateFingerprint,
    pageStateHash: fields.pageStateHash,
    currentUrl: fields.currentUrl,
    currentTitle: fields.currentTitle,
    observedAt: fields.observedAt,
    missionId: fields.missionId,
    runId: fields.runId,
    sessionId: fields.sessionId,
    roundId: fields.roundId,
    videoVisitId: fields.videoVisitId,
  };
};

export function recordPageStateProofSummary(input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): void {
  const summary = buildSummary(input);
  if (!summary) {
    return;
  }

  summaries.set(summary.outputRef, summary);
  summaries.set(summary.pageStateProofRef, summary);
}

export function resolvePageStateProofSummary(
  ref: string | null | undefined,
): WorkbenchPageStateProofSummary | null {
  if (!ref) {
    return null;
  }

  return summaries.get(ref) ?? null;
}