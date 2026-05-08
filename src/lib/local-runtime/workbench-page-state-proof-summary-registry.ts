import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";

type JsonObject = Record<string, unknown>;
type PageStateDecision = "allow" | "review_required" | "block";

export type WorkbenchPageStateProofSummary = {
  outputRef: string;
  pageStateProofRef: string;
  pageStateType: string;
  decision: PageStateDecision;
  pageStateFingerprint: string;
  pageStateHash: string;
  currentUrl: string;
  currentTitle: string | null;
  observedAt: string;
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

const resolvePageStateType = (childCapabilityId: string | null): string | null => {
  switch (childCapabilityId) {
    case "observe-feed-surface":
    case "observe-video-surface":
      return "platform_feed";
    case "observe-comment-panel-surface":
      return "comments_panel";
    case "observe-modal-overlay-surface":
      return "modal_overlay";
    case "observe-login-surface":
      return "login_surface";
    case "observe-safety-surface":
      return "safety_surface";
    case "observe-platform-surface":
      return "platform_surface";
    case "observe-page-abnormality-surface":
      return "page_abnormality_surface";
    default:
      return null;
  }
};

const resolveDecision = (
  status: WorkbenchAbilityExecutionResult["status"],
): PageStateDecision => {
  switch (status) {
    case "success":
      return "allow";
    case "review_required":
      return "review_required";
    default:
      return "block";
  }
};

const buildSummary = (input: {
  outputRef: string;
  result: WorkbenchAbilityExecutionResult;
}): WorkbenchPageStateProofSummary | null => {
  if (input.result.abilityGroupId !== "page-state" || !isObject(input.result.runtimeProof)) {
    return null;
  }

  const runtimeProof = input.result.runtimeProof;
  const pageStateProofRef = readString(runtimeProof, "proofId");
  const pageStateType = resolvePageStateType(readString(runtimeProof, "childCapabilityId"));
  const pageStateFingerprint = readString(runtimeProof, "observationFingerprint");
  const pageStateHash = readString(runtimeProof, "snapshotHash") ?? readString(runtimeProof, "inputPayloadHash");
  const currentUrl = readString(runtimeProof, "currentUrl");
  const observedAt = readString(runtimeProof, "endedAt") ?? readString(runtimeProof, "startedAt");
  const sessionId = readString(runtimeProof, "sessionId");

  if (!pageStateProofRef || !pageStateType || !pageStateFingerprint || !pageStateHash || !currentUrl || !observedAt || !sessionId) {
    return null;
  }

  return {
    outputRef: input.outputRef,
    pageStateProofRef,
    pageStateType,
    decision: resolveDecision(input.result.status),
    pageStateFingerprint,
    pageStateHash,
    currentUrl,
    currentTitle: readString(runtimeProof, "currentTitle"),
    observedAt,
    sessionId,
    roundId: readString(runtimeProof, "roundId"),
    videoVisitId: readString(runtimeProof, "videoVisitId"),
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