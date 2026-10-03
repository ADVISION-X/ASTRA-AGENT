import { requireCanonicalGptConversationUrl } from "../exact-target/browser-site-policy-registry.js";
import type { ExtensionCreatedTarget } from "./extension-created-target.js";
import type { ExtensionExactTarget, ExtensionExactTargetRegistry } from "./exact-target-runtime.js";

export type TargetAcquisitionMode = "fresh" | "bound-observation"
  | "confirmed-readback" | "authorized-continuation";

export const preflightTargetAcquisition = async (input: Readonly<{
  targetMode: TargetAcquisitionMode;
  jobRefHash: `sha256:${string}`;
  parentConversationUrl?: string | undefined;
  createdTarget: ExtensionCreatedTarget;
  targets: ExtensionExactTargetRegistry;
  activeTarget: ExtensionExactTarget | null;
}>): Promise<Readonly<{ continuationUrl: string | undefined; bound: ExtensionExactTarget | null }>> => {
  if (!["fresh", "bound-observation", "confirmed-readback", "authorized-continuation"].includes(input.targetMode)
    || !/^sha256:[a-f0-9]{64}$/u.test(input.jobRefHash)
    || (input.targetMode !== "authorized-continuation" && input.parentConversationUrl !== undefined)
    || input.activeTarget || input.createdTarget.isPending()) throw new Error("BROWSER_TARGET_INVALID");
  const continuationUrl = input.targetMode === "authorized-continuation"
    ? requireCanonicalGptConversationUrl(input.parentConversationUrl ?? "") : undefined;
  await input.createdTarget.reconcileOrphans();
  const bound = input.targets.findByJobRefHash(input.jobRefHash);
  if (!bound && input.targetMode === "bound-observation") {
    throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
  }
  return { continuationUrl, bound };
};
