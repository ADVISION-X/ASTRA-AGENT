import { resolve } from "node:path";
import { createDedicatedProfilePolicy } from "../browser/profile/dedicated-profile-policy.js";
import { attestManagedPolicyReadback } from "../browser/profile/managed-policy-readback.js";
import { createBrowserProfileEnrollment } from "../browser/profile/browser-profile-enrollment.js";
import { resolveProductionBrowserProfileConfig } from "../browser/profile/browser-profile-config.js";
import { BrowserInfrastructureSupervisor, type BrowserHealthSnapshot } from "../browser/infrastructure/browser-infrastructure-supervisor.js";
import type { BrowserExecutionBinding, BrowserTargetLease } from "../browser/browser-authority-api.js";
import { hashExtensionDirectoryV1 } from "../browser/release/extension-directory-hash-v1.js";
import { readUnpackedExtensionReleaseIdentity } from "../browser/release/unpacked-extension-release-identity.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export type WorkbenchBrowserAuthority = Readonly<{
  broker: Pick<ReturnType<BrowserInfrastructureSupervisor["authorityBroker"]>, "currentStatus">
    & Partial<Pick<ReturnType<BrowserInfrastructureSupervisor["authorityBroker"]>, "currentOperatorTargetStatus">>;
  health(): BrowserHealthSnapshot;
  readOperatorPairingState(): Readonly<{ authority: "present" | "absent"; pairingSecret: string | null }>;
  readReleaseBuildId(): string;
  readProductionRuntimeState(): Readonly<{
    browserAuthorityState: "present" | "absent";
    browserTargetState: "claimed" | "absent";
  }>;
  acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
  ): Promise<BrowserTargetLease>;
  acceptBrowserAuthoritySocket(input: Readonly<{ send(payload: string): void; close(code?: number): void }>): Readonly<{ receive(payload: string): void; disconnect(reasonCode?: string, refs?: Readonly<Record<string, string>>): void }>;
  shutdown(): Promise<void>;
}>;

export const createWorkbenchBrowserAuthority = async (
  dataDir: string,
  runtimeLogger: RuntimeLogger,
): Promise<WorkbenchBrowserAuthority> => {
  const profileConfig = resolveProductionBrowserProfileConfig(dataDir);
  const releaseIdentity = await readUnpackedExtensionReleaseIdentity(
    resolve(process.cwd(), ".grasseye-local", "browser-release", "release-record.json"),
  );
  const extensionTreeHash = await hashExtensionDirectoryV1(profileConfig.unpackedExtensionDirectory);
  if (releaseIdentity.extensionId !== profileConfig.extensionId
    || releaseIdentity.extensionDirectoryHashV1 !== extensionTreeHash) {
    throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
  }
  const policyReadback = attestManagedPolicyReadback(createDedicatedProfilePolicy(profileConfig));
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
  return {
    broker: supervisor.authorityBroker(),
    health: () => supervisor.health(),
    readOperatorPairingState: () => supervisor.readOperatorPairingState(),
    readReleaseBuildId: () => releaseIdentity.releaseBuildId,
    readProductionRuntimeState: () => ({
      browserAuthorityState: supervisor.authorityBroker().currentStatus().kind === "AVAILABLE" ? "present" : "absent",
      browserTargetState: supervisor.authorityBroker().currentOperatorTargetStatus(),
    }),
    acquireJobBoundTargetLease: (binding, ownerId) =>
      supervisor.acquireJobBoundTargetLease(binding, ownerId),
    acceptBrowserAuthoritySocket: (socket) => ({ receive: (payload) => supervisor.browserAuthorityWebSocket().receive(socket, payload), disconnect: (reasonCode, refs) => supervisor.browserAuthorityWebSocket().disconnect(socket, reasonCode, refs) }),
    shutdown: () => supervisor.stop(),
  };
};
