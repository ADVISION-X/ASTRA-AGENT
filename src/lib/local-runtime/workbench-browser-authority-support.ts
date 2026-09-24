import { resolve } from "node:path";
import { createDedicatedProfilePolicy } from "../browser/profile/dedicated-profile-policy.js";
import { attestManagedPolicyReadback } from "../browser/profile/managed-policy-readback.js";
import { createBrowserProfileEnrollment } from "../browser/profile/browser-profile-enrollment.js";
import { resolveProductionBrowserProfileConfig } from "../browser/profile/browser-profile-config.js";
import {
  BrowserInfrastructureSupervisor,
  type BrowserHealthSnapshot,
} from "../browser/infrastructure/browser-infrastructure-supervisor.js";
import type {
  BrowserExecutionArtifact,
  BrowserExecutionArtifactBinding,
  BrowserExecutionArtifactLease,
  BrowserExecutionBinding,
  BrowserProviderEffectStepCallFact,
  BrowserAuthorityBroker,
  BrowserTargetLease,
  BrowserTargetReleaseAuthority,
  BrowserTargetLeaseWait,
} from "../browser/browser-authority-api.js";
import { hashExtensionDirectoryV1 } from "../browser/release/extension-directory-hash-v1.js";
import { readUnpackedExtensionReleaseIdentity } from "../browser/release/unpacked-extension-release-identity.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export type WorkbenchBrowserAuthority = Readonly<{
  broker: Pick<
    BrowserAuthorityBroker,
    "currentStatus"
  > &
    Partial<
      Pick<
        BrowserAuthorityBroker,
        "currentOperatorTargetStatus"
      >
    >;
  health(): BrowserHealthSnapshot;
  readOperatorPairingState(): Readonly<{
    authority: "present" | "absent";
    pairingSecret: string | null;
  }>;
  readReleaseBuildId(): string;
  readProductionRuntimeState(): Readonly<{
    browserAuthorityState: "present" | "absent";
    browserTargetState: "claimed" | "absent";
  }>;
  readBrowserLaneState(): "idle" | "busy" | "blocked";
  bindExecutionArtifacts(input: Readonly<{
    binding: BrowserExecutionArtifactBinding;
    artifacts: readonly BrowserExecutionArtifact[];
  }>): Promise<BrowserExecutionArtifactLease>;
  hasUnresolvedBrowserMutation(): boolean;
  hasBrowserMutationForJob(jobId: string): boolean;
  readJobBrowserHistoryEvidence(jobId: string): Readonly<{
    historyHash: `sha256:${string}`; rowCount: number; walHistoryVerified: boolean;
    targetSettlementHash: `sha256:${string}`; targetSettled: boolean;
    replayCalls: readonly Readonly<{ productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}` }>[];
    replayEffects: readonly Readonly<{ attemptId: string; resultRevision: number;
      state: "DISPATCHED" | "CONFIRMED" | "REJECTED";
      mutationOutcome: "no" | "dispatched" | "confirmed";
      productStepId: string; callId: string;
      childCapabilityId: string; sourceEffectSetHash: `sha256:${string}`;
      effectIdentityHash: `sha256:${string}`; authorityRef: string;
      oldTargetRefHash: `sha256:${string}`;
      oldDocumentRefHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}`;
      anchorState: "trusted" | "absent"; anchorProofHash: `sha256:${string}`;
      canonicalConversationHash: `sha256:${string}` | null;
      userTurnHash: `sha256:${string}` | null;
      physicalInputCount: number }>[];
    targetSettlements: readonly Readonly<{ targetRefHash: `sha256:${string}`;
      claimSource: "legacy_wal" | "authenticated_claim";
      outcome: "physical_absent" | "quiesced"; proofHash: `sha256:${string}`;
      releasedAt: string }>[];
  }>;
  readJobPhysicalInputState(jobId: string): "zero" | "possible" | "unknown";
  readAttemptPhysicalInputState(jobId: string, attemptId: string): "zero" | "possible" | "unknown";
  verifyRuntimeTaskProvenance(earliestTaskCreatedAt: string | null): void;
  readBoundJobRefHash(): `sha256:${string}` | null;
  readUnreleasedTargetClaims(): readonly Readonly<{
    jobRefHash: `sha256:${string}`; targetRef: string;
  }>[];
  countProviderTurnDispatches(jobId: string, attemptId: string): number;
  readProviderEffectStepCallFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    resultRevision: number;
    productStepId: string;
    callId: string;
    childCapabilityId: string;
  }>): BrowserProviderEffectStepCallFact | null;
  readProvenZeroInputProviderCommand(input: Readonly<{
    authorityRef: string; authorityHash: `sha256:${string}`;
    jobId: string; attemptId: string; resultRevision: number;
    effectIdentityHash: `sha256:${string}`;
  }>): Readonly<{ productStepId: string; callId: string; childCapabilityId: string;
    grantHash: `sha256:${string}` }> | null;
  readSourceConfirmedProviderEffect(input: Readonly<{
    jobId: string; sourceAttemptId: string; sourceResultRevision: number;
    productStepId: string; callId: string; childCapabilityId: string;
    effectIdentityHash: `sha256:${string}`; walAuthorityHash: `sha256:${string}`;
  }>): Readonly<{ exactCallIdentityHash: `sha256:${string}`; actionOrdinal: number;
    inputHash: `sha256:${string}`; terminalPayload: unknown;
    authorityRef: string; authorityHash: `sha256:${string}`; terminalAt: string }>;
  purgeBrowserJob(jobId: string): void;
  releaseJobBoundTarget(
    jobId: string,
    releaseAuthority: BrowserTargetReleaseAuthority,
    signal: AbortSignal,
  ): Promise<void>;
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease>;
  acceptBrowserAuthoritySocket(
    input: Readonly<{
      send(payload: string): void;
      close(code?: number): void;
    }>,
  ): Readonly<{
    receive(payload: string): void;
    disconnect(
      reasonCode?: string,
      refs?: Readonly<Record<string, string>>,
    ): void;
  }>;
  shutdown(): Promise<void>;
}>;

const assertReleaseIdentity = async (
  profileConfig: ReturnType<typeof resolveProductionBrowserProfileConfig>,
  releaseIdentity: Awaited<ReturnType<typeof readUnpackedExtensionReleaseIdentity>>,
): Promise<`sha256:${string}`> => {
  const extensionTreeHash = await hashExtensionDirectoryV1(profileConfig.unpackedExtensionDirectory);
  if (releaseIdentity.extensionId !== profileConfig.extensionId
    || releaseIdentity.extensionDirectoryHashV1 !== extensionTreeHash) {
    throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
  }
  return extensionTreeHash;
};

const startBrowserSupervisor = async (
  dataDir: string,
  runtimeLogger: RuntimeLogger,
  restoreBrowserHostVisibility?: (() => Promise<void>) | undefined,
): Promise<Readonly<{
  supervisor: BrowserInfrastructureSupervisor;
  releaseBuildId: string;
}>> => {
  const profileConfig = resolveProductionBrowserProfileConfig(dataDir);
  const releaseIdentity = await readUnpackedExtensionReleaseIdentity(
    resolve(
      process.cwd(),
      ".grasseye-local",
      "browser-release",
      "release-record.json",
    ),
  );
  const extensionTreeHash = await assertReleaseIdentity(profileConfig, releaseIdentity);
  const policyReadback = attestManagedPolicyReadback(
    createDedicatedProfilePolicy(profileConfig),
  );
  const enrolledProfile = createBrowserProfileEnrollment({
    config: profileConfig,
    policyHash: policyReadback.policyHash,
    extensionTreeHash,
  });
  const supervisor = new BrowserInfrastructureSupervisor({
    dataDir,
    sourceFingerprint: process.env.GRASSEYE_SOURCE_FINGERPRINT ?? "unknown",
    profileConfig,
    enrolledProfile,
    releaseIdentity,
    runtimeLogger,
    restoreBrowserHostVisibility,
  });
  await supervisor.start();
  return { supervisor, releaseBuildId: releaseIdentity.releaseBuildId };
};

export const createWorkbenchBrowserAuthority = async (
  dataDir: string,
  runtimeLogger: RuntimeLogger,
  restoreBrowserHostVisibility?: (() => Promise<void>) | undefined,
): Promise<WorkbenchBrowserAuthority> => {
  const { supervisor, releaseBuildId } = await startBrowserSupervisor(
    dataDir, runtimeLogger, restoreBrowserHostVisibility,
  );
  const endpoints = supervisor.endpoints();
  return {
    broker: endpoints.broker,
    health: () => supervisor.health(),
    readOperatorPairingState: () => supervisor.readOperatorPairingState(),
    readReleaseBuildId: () => releaseBuildId,
    readProductionRuntimeState: () => ({
      browserAuthorityState:
        endpoints.broker.currentStatus().kind === "AVAILABLE"
          ? "present"
          : "absent",
      browserTargetState: endpoints.broker.currentOperatorTargetStatus(),
    }),
    readBrowserLaneState: () => supervisor.readBrowserLaneState(),
    bindExecutionArtifacts: (input) => supervisor.bindExecutionArtifacts(input),
    hasUnresolvedBrowserMutation: () =>
      supervisor.hasUnresolvedBrowserMutation(),
    hasBrowserMutationForJob: (jobId) => supervisor.hasBrowserMutationForJob(jobId),
    readJobBrowserHistoryEvidence: (jobId) => supervisor.readJobBrowserHistoryEvidence(jobId),
    readJobPhysicalInputState: (jobId) => supervisor.readJobPhysicalInputState(jobId),
    readAttemptPhysicalInputState: (jobId, attemptId) =>
      supervisor.readAttemptPhysicalInputState(jobId, attemptId),
    verifyRuntimeTaskProvenance: (earliestTaskCreatedAt) =>
      supervisor.verifyRuntimeTaskProvenance(earliestTaskCreatedAt),
    readBoundJobRefHash: () => supervisor.readBoundJobRefHash(),
    readUnreleasedTargetClaims: () => supervisor.readUnreleasedTargetClaims(),
    countProviderTurnDispatches: (jobId, attemptId) =>
      supervisor.countProviderTurnDispatches(jobId, attemptId),
    readProviderEffectStepCallFact: (input) =>
      supervisor.readProviderEffectStepCallFact(input),
    readProvenZeroInputProviderCommand: (input) =>
      supervisor.readProvenZeroInputProviderCommand(input),
    readSourceConfirmedProviderEffect: (input) =>
      supervisor.readSourceConfirmedProviderEffect(input),
    purgeBrowserJob: (jobId) => supervisor.purgeBrowserJob(jobId),
    releaseJobBoundTarget: (jobId, releaseAuthority, signal) =>
      supervisor.releaseJobBoundTarget(jobId, releaseAuthority, signal),
    acquireJobBoundTargetLease: (binding, ownerId, wait) =>
      supervisor.acquireJobBoundTargetLease(binding, ownerId, wait),
    acceptBrowserAuthoritySocket: (socket) => ({
      receive: (payload) => endpoints.websocket.receive(socket, payload),
      disconnect: (reasonCode, refs) =>
        endpoints.websocket.disconnect(socket, reasonCode, refs),
    }),
    shutdown: () => supervisor.stop(),
  };
};
