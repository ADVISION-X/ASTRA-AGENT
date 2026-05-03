import type {
  ScreenshotArtifactCleanupGate,
  ScreenshotChildCapabilityId,
  ScreenshotImageKind,
  ScreenshotPromotionStatus,
  ScreenshotRetentionClass,
} from "../contract.js";
import { ScreenshotStoredArtifactSchema } from "../schema.js";

export interface ScreenshotArtifactPort {
  readonly portKind: "filesystem-screenshot-artifact-port";
  storeArtifact(input: {
    childCapabilityId: ScreenshotChildCapabilityId;
    evidenceId: string;
    sourceFilePath: string;
    mimeType: string;
    sha256: string;
    width: number;
    height: number;
    imageKind: ScreenshotImageKind;
    createdAt: string;
    missionId: string;
    runId: string;
    sessionId: string;
    roundId: string | null;
    videoVisitId: string | null;
    stepId: string;
    mapPackageId: string;
    mapPackageVersion: string;
    selectedMapId: string;
    selectedMapVersion: string;
    activationSnapshotRef: string;
    capabilityCallId: string;
    nerveBusEnvelopeId: string;
    requestedBy: string;
    purpose: string;
    retentionClass: ScreenshotRetentionClass;
    promotionStatus: ScreenshotPromotionStatus;
    expiresAt: string | null;
    deleteAfter: string | null;
    cleanupEligible: boolean;
    cleanupGate: ScreenshotArtifactCleanupGate;
  }): Promise<ReturnType<typeof ScreenshotStoredArtifactSchema.parse>>;
  getRootDir(): string;
}
