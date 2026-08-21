import { createDedicatedProfilePolicy } from "../browser/profile/dedicated-profile-policy.js";
import { attestManagedPolicyReadback } from "../browser/profile/managed-policy-readback.js";
import { createBrowserProfileEnrollment } from "../browser/profile/browser-profile-enrollment.js";
import { resolveProductionBrowserProfileConfig } from "../browser/profile/browser-profile-config.js";
import { BrowserInfrastructureSupervisor, type BrowserHealthSnapshot } from "../browser/infrastructure/browser-infrastructure-supervisor.js";
import type { WorkbenchExtensionChannelRequest, WorkbenchExtensionChannelResponse } from "../browser/transport/workbench-extension-channel.js";

export type WorkbenchBrowserAuthority = Readonly<{
  broker: ReturnType<BrowserInfrastructureSupervisor["authorityBroker"]>;
  health(): BrowserHealthSnapshot;
  workbenchExtensionChannel(input: WorkbenchExtensionChannelRequest): Promise<WorkbenchExtensionChannelResponse>;
  shutdown(): Promise<void>;
}>;

const unavailableArtifactResolver = { resolveArtifact: async () => { throw new Error("BROWSER_FILE_GRANT_INVALID"); } };

export const createWorkbenchBrowserAuthority = async (dataDir: string): Promise<WorkbenchBrowserAuthority> => {
  const profileConfig = resolveProductionBrowserProfileConfig(dataDir);
  const policyReadback = attestManagedPolicyReadback(createDedicatedProfilePolicy(profileConfig));
  const enrolledProfile = createBrowserProfileEnrollment({
    config: profileConfig,
    policyHash: policyReadback.policyHash,
    extensionTreeHash: "sha256:unverified-extension-tree",
  });
  const supervisor = new BrowserInfrastructureSupervisor({ dataDir, profileConfig, enrolledProfile, artifactResolver: unavailableArtifactResolver });
  await supervisor.start();
  return {
    broker: supervisor.authorityBroker(),
    health: () => supervisor.health(),
    workbenchExtensionChannel: (input) => supervisor.workbenchExtensionChannel(input),
    shutdown: () => supervisor.stop(),
  };
};
