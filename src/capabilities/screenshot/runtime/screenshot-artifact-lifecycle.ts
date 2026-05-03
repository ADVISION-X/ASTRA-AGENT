import type {
  ScreenshotAbilityInput,
  ScreenshotArtifactCleanupGate,
  ScreenshotArtifactBudgetPolicy,
  ScreenshotArtifactBudgetSnapshot,
  ScreenshotChildCapabilityId,
  ScreenshotPromotionStatus,
  ScreenshotRetentionClass,
} from "../contract.js";
import { ScreenshotArtifactCleanupGateSchema } from "../schema.js";
import {
  DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_POLICY,
} from "../shared/screenshot-policy.js";
import { addHoursToIsoTimestamp } from "./system-screenshot-clock-port.js";

type ArtifactBudgetFailure = {
  reason: string;
  message: string;
};

type ScreenshotArtifactLifecyclePlan = {
  retentionClass: ScreenshotRetentionClass;
  promotionStatus: ScreenshotPromotionStatus;
  expiresAt: string | null;
  deleteAfter: string | null;
  cleanupEligible: boolean;
  cleanupGate: ScreenshotArtifactCleanupGate;
};

const TRANSIENT_RETENTION_CLASSES = new Set<ScreenshotRetentionClass>([
  "transient-capture",
  "transient-region",
  "transient-ai-input",
  "transient-contact-sheet",
  "diagnostic-debug",
]);

const resolveArtifactBudgetPolicy = (request: ScreenshotAbilityInput): ScreenshotArtifactBudgetPolicy => {
  return request.capturePolicy.artifactBudget ?? DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_POLICY;
};

const resolveArtifactBudgetSnapshot = (request: ScreenshotAbilityInput): ScreenshotArtifactBudgetSnapshot => {
  return request.artifactBudgetSnapshot;
};

const buildCleanupGate = (input: {
  childCapabilityId: ScreenshotChildCapabilityId;
}): ScreenshotArtifactCleanupGate => {
  const cleanupGate = ScreenshotArtifactCleanupGateSchema.parse({
    manifestExists: true,
    expired: false,
    missionActive: true,
    aiPending: input.childCapabilityId === "prepare-ai-input",
    visualTargetPending: input.childCapabilityId === "capture-region",
    postActionVerificationPending: false,
    promoted: false,
    pinnedByForensics: false,
    legalHold: false,
    refCount: 1,
  });
  return cleanupGate;
};

const isCleanupBlockedByLifecycleState = (cleanupGate: ScreenshotArtifactCleanupGate): boolean => {
  return !cleanupGate.manifestExists || !cleanupGate.expired || cleanupGate.promoted || cleanupGate.pinnedByForensics || cleanupGate.legalHold;
};

const isCleanupBlockedByPendingWork = (cleanupGate: ScreenshotArtifactCleanupGate): boolean => {
  return cleanupGate.missionActive || cleanupGate.aiPending || cleanupGate.visualTargetPending || cleanupGate.postActionVerificationPending;
};

const hasNoCleanupReferences = (cleanupGate: ScreenshotArtifactCleanupGate): boolean => cleanupGate.refCount === 0;

const isCleanupEligible = (cleanupGate: ScreenshotArtifactCleanupGate): boolean => {
  return !isCleanupBlockedByLifecycleState(cleanupGate)
    && !isCleanupBlockedByPendingWork(cleanupGate)
    && hasNoCleanupReferences(cleanupGate);
};

function buildLifecycleExpiry(createdAt: string, hours: number) {
  const expiresAt = addHoursToIsoTimestamp(createdAt, hours);
  return { expiresAt, deleteAfter: expiresAt };
}

function isTransientLifecycleRetentionClass(retentionClass: ScreenshotRetentionClass) {
  return retentionClass === "transient-capture"
    || retentionClass === "transient-region"
    || retentionClass === "transient-ai-input"
    || retentionClass === "transient-contact-sheet";
}

function resolveLifecycleTimestamps(input: {
  retentionClass: ScreenshotRetentionClass;
  createdAt: string;
  artifactBudget: ScreenshotArtifactBudgetPolicy;
}) {
  if (input.retentionClass === "diagnostic-debug") {
    return buildLifecycleExpiry(input.createdAt, input.artifactBudget.diagnosticDebugTtlHours);
  }

  return isTransientLifecycleRetentionClass(input.retentionClass)
    ? buildLifecycleExpiry(input.createdAt, input.artifactBudget.transientTtlHours)
    : { expiresAt: null, deleteAfter: null };
}

export function resolveScreenshotRetentionClass(childCapabilityId: ScreenshotChildCapabilityId): ScreenshotRetentionClass {
  switch (childCapabilityId) {
    case "capture-browser-viewport":
    case "capture-desktop-screen":
    case "optimize-lossless":
      return "transient-capture";
    case "capture-region":
      return "transient-region";
    case "prepare-ai-input":
      return "transient-ai-input";
  }
}

export function isTransientScreenshotRetentionClass(retentionClass: ScreenshotRetentionClass): boolean {
  return TRANSIENT_RETENTION_CLASSES.has(retentionClass);
}

export function resolveScreenshotArtifactLifecyclePlan(input: {
  request: ScreenshotAbilityInput;
  childCapabilityId: ScreenshotChildCapabilityId;
  createdAt: string;
}): ScreenshotArtifactLifecyclePlan {
  const retentionClass = resolveScreenshotRetentionClass(input.childCapabilityId);
  const artifactBudget = resolveArtifactBudgetPolicy(input.request);
  const { expiresAt, deleteAfter } = resolveLifecycleTimestamps({ retentionClass, createdAt: input.createdAt, artifactBudget });
  const cleanupGate = buildCleanupGate({ childCapabilityId: input.childCapabilityId });

  return {
    retentionClass,
    promotionStatus: "not_promoted",
    expiresAt,
    deleteAfter,
    cleanupEligible: isCleanupEligible(cleanupGate),
    cleanupGate,
  };
}

function createBudgetFailure(reason: string, message: string): ArtifactBudgetFailure {
  return { reason, message };
}

function evaluateArtifactCountBudget(input: {
  request: ScreenshotAbilityInput;
  policy: ScreenshotArtifactBudgetPolicy;
  snapshot: ScreenshotArtifactBudgetSnapshot;
}) {
  if (input.snapshot.currentArtifactsPerMission + 1 > input.policy.maxArtifactsPerMission) {
    return createBudgetFailure("mission_artifact_limit_exceeded", "Screenshot artifact budget exceeded maxArtifactsPerMission.");
  }
  if (input.request.roundId !== null && input.snapshot.currentArtifactsPerRound + 1 > input.policy.maxArtifactsPerRound) {
    return createBudgetFailure("round_artifact_limit_exceeded", "Screenshot artifact budget exceeded maxArtifactsPerRound.");
  }
  if (input.request.videoVisitId !== null && input.snapshot.currentArtifactsPerVideoVisit + 1 > input.policy.maxArtifactsPerVideoVisit) {
    return createBudgetFailure("video_visit_artifact_limit_exceeded", "Screenshot artifact budget exceeded maxArtifactsPerVideoVisit.");
  }
  return null;
}

function evaluateArtifactByteBudget(input: {
  request: ScreenshotAbilityInput;
  byteSize: number;
  policy: ScreenshotArtifactBudgetPolicy;
  snapshot: ScreenshotArtifactBudgetSnapshot;
}) {
  if (input.snapshot.currentBytesPerMission + input.byteSize > input.policy.maxBytesPerMission) {
    return createBudgetFailure("mission_byte_limit_exceeded", "Screenshot artifact budget exceeded maxBytesPerMission.");
  }
  if (input.request.roundId !== null && input.snapshot.currentBytesPerRound + input.byteSize > input.policy.maxBytesPerRound) {
    return createBudgetFailure("round_byte_limit_exceeded", "Screenshot artifact budget exceeded maxBytesPerRound.");
  }
  if (input.request.videoVisitId !== null && input.snapshot.currentBytesPerVideoVisit + input.byteSize > input.policy.maxBytesPerVideoVisit) {
    return createBudgetFailure("video_visit_byte_limit_exceeded", "Screenshot artifact budget exceeded maxBytesPerVideoVisit.");
  }
  return null;
}

function evaluateTransientArtifactBudget(input: {
  byteSize: number;
  retentionClass: ScreenshotRetentionClass;
  policy: ScreenshotArtifactBudgetPolicy;
  snapshot: ScreenshotArtifactBudgetSnapshot;
}) {
  if (isTransientScreenshotRetentionClass(input.retentionClass) && input.snapshot.pendingTransientArtifacts + 1 > input.policy.maxPendingTransientArtifacts) {
    return createBudgetFailure("pending_transient_artifact_limit_exceeded", "Screenshot artifact budget exceeded maxPendingTransientArtifacts.");
  }
  if (isTransientScreenshotRetentionClass(input.retentionClass) && input.snapshot.pendingTransientBytes + input.byteSize > input.policy.maxPendingTransientBytes) {
    return createBudgetFailure("pending_transient_byte_limit_exceeded", "Screenshot artifact budget exceeded maxPendingTransientBytes.");
  }
  return null;
}

export function evaluateScreenshotArtifactBudget(input: {
  request: ScreenshotAbilityInput;
  byteSize: number;
  retentionClass: ScreenshotRetentionClass;
}): ArtifactBudgetFailure | null {
  const policy = resolveArtifactBudgetPolicy(input.request);
  const snapshot = resolveArtifactBudgetSnapshot(input.request);
  return evaluateArtifactCountBudget({ request: input.request, policy, snapshot })
    ?? evaluateArtifactByteBudget({ request: input.request, byteSize: input.byteSize, policy, snapshot })
    ?? evaluateTransientArtifactBudget({ byteSize: input.byteSize, retentionClass: input.retentionClass, policy, snapshot });
}