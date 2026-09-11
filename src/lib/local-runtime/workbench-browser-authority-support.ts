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
  BrowserExactCallMutationFact,
  BrowserAuthorityBroker,
  BrowserTargetLease,
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
  readBrowserLaneWaiterCount(): number;
  bindExecutionArtifacts(input: Readonly<{
    binding: BrowserExecutionArtifactBinding;
    artifacts: readonly BrowserExecutionArtifact[];
  }>): Promise<BrowserExecutionArtifactLease>;
  hasUnresolvedBrowserMutation(): boolean;
  hasBrowserMutationForJob(jobId: string): boolean;
  countProviderTurnDispatches(jobId: string, attemptId: string): number;
  readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    ownerPluginId: string;
    pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>): BrowserExactCallMutationFact | null;
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

export const createWorkbenchBrowserAuthority = async (
  dataDir: string,
  runtimeLogger: RuntimeLogger,
): Promise<WorkbenchBrowserAuthority> => {
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
  });
  await supervisor.start();
  const endpoints = supervisor.endpoints();
  return {
    broker: endpoints.broker,
    health: () => supervisor.health(),
    readOperatorPairingState: () => supervisor.readOperatorPairingState(),
    readReleaseBuildId: () => releaseIdentity.releaseBuildId,
    readProductionRuntimeState: () => ({
      browserAuthorityState:
        endpoints.broker.currentStatus().kind === "AVAILABLE"
          ? "present"
          : "absent",
      browserTargetState: endpoints.broker.currentOperatorTargetStatus(),
    }),
    readBrowserLaneState: () => supervisor.readBrowserLaneState(),
    readBrowserLaneWaiterCount: () => supervisor.readBrowserLaneWaiterCount(),
    bindExecutionArtifacts: (input) => supervisor.bindExecutionArtifacts(input),
    hasUnresolvedBrowserMutation: () =>
      supervisor.hasUnresolvedBrowserMutation(),
    hasBrowserMutationForJob: (jobId) => supervisor.hasBrowserMutationForJob(jobId),
    countProviderTurnDispatches: (jobId, attemptId) =>
      supervisor.countProviderTurnDispatches(jobId, attemptId),
    readExactCallMutationFact: (input) => supervisor.readExactCallMutationFact(input),
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
