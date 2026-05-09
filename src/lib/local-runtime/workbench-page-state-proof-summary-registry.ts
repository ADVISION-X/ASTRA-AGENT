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

const resolvePageStateProofSummaryFields = (input: {
  result: WorkbenchAbilityExecutionResult;
}): PageStateProofSummaryFields | null => {
  if (input.result.abilityGroupId !== "page-state" || !isObject(input.result.runtimeProof)) {
    return null;
  }

  const runtimeProof = input.result.runtimeProof;
  const pageStateProofRef = readString(runtimeProof, "proofId");
  const pageStateChildCapabilityId = readString(runtimeProof, "childCapabilityId");
  const pageStateFingerprint = readString(runtimeProof, "observationFingerprint");
  const pageStateHash = readString(runtimeProof, "snapshotHash") ?? readString(runtimeProof, "inputPayloadHash");
  const currentUrl = readString(runtimeProof, "currentUrl");
  const observedAt = readString(runtimeProof, "endedAt") ?? readString(runtimeProof, "startedAt");
  const missionId = readString(runtimeProof, "missionId");
  const runId = readString(runtimeProof, "runId");
  const sessionId = readString(runtimeProof, "sessionId");

  if (!pageStateProofRef || !pageStateChildCapabilityId || !pageStateFingerprint || !pageStateHash || !currentUrl || !observedAt || !missionId || !runId || !sessionId) {
    return null;
  }

  return {
    pageStateProofRef,
    pageStateChildCapabilityId,
    pageStateFingerprint,
    pageStateHash,
    currentUrl,
    currentTitle: readString(runtimeProof, "currentTitle"),
    observedAt,
    missionId,
    runId,
    sessionId,
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