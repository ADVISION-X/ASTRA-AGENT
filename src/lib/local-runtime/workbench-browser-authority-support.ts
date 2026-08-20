import { createDedicatedProfilePolicy } from "../browser/profile/dedicated-profile-policy.js";
import { readFile } from "node:fs/promises";
import { attestManagedPolicyReadback } from "../browser/profile/managed-policy-readback.js";
import { createBrowserProfileEnrollment } from "../browser/profile/browser-profile-enrollment.js";
import { resolveProductionBrowserProfileConfig } from "../browser/profile/browser-profile-config.js";
import {
  BrowserInfrastructureSupervisor,
  type BrowserHealthSnapshot,
} from "../browser/infrastructure/browser-infrastructure-supervisor.js";

export type WorkbenchBrowserAuthority = Readonly<{
  broker: ReturnType<BrowserInfrastructureSupervisor["authorityBroker"]>;
  health(): BrowserHealthSnapshot;
  shutdown(): Promise<void>;
}>;

const unavailableArtifactResolver = {
  resolveArtifact: async () => { throw new Error("BROWSER_FILE_GRANT_INVALID"); },
};

const readReleaseActivationBlockReason = async (): Promise<string> => {
  try {
    const slot = JSON.parse(await readFile(new URL("../browser/release/active-activation.json", import.meta.url), "utf8")) as Record<string, unknown>;
    if (slot.state === "ABSENT" && slot.reasonCode === "BROWSER_ACTIVATION_TUPLE_INVALID") {
      return slot.reasonCode;
    }
  } catch {
    // An unreadable release slot is equally ineligible to start browser control.
  }
  return "BROWSER_ACTIVATION_TUPLE_INVALID";
};

export const createWorkbenchBrowserAuthority = async (dataDir: string): Promise<WorkbenchBrowserAuthority> => {
  const activationBlockedReasonCode = await readReleaseActivationBlockReason();
  const profileConfig = resolveProductionBrowserProfileConfig(dataDir);
  const policyReadback = attestManagedPolicyReadback(createDedicatedProfilePolicy(profileConfig));
  const enrolledProfile = createBrowserProfileEnrollment({
    config: profileConfig,
    policyHash: policyReadback.policyHash,
    extensionTreeHash: "sha256:unverified-extension-tree",
  });
  const supervisor = new BrowserInfrastructureSupervisor({
    dataDir,
    profileConfig,
    enrolledProfile,
    artifactResolver: unavailableArtifactResolver,
    activationBlockedReasonCode,
  });
  await supervisor.start();
  return {
    broker: supervisor.authorityBroker(),
    health: () => supervisor.health(),
    shutdown: () => supervisor.stop(),
  };
};
