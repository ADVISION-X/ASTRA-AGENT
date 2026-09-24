import { requireCanonicalGptConversationUrl } from
  "../exact-target/browser-site-policy-registry.js";
import { ExtensionCreatedTarget } from "./extension-created-target.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";

export type TargetAcquisitionMode = "fresh" | "bound-observation"
  | "confirmed-readback" | "authorized-continuation";

/** Validates the single existing Target claim before any new tab is created. */
export const preflightTargetAcquisition = async (input: Readonly<{
  targetMode: TargetAcquisitionMode;
  jobRefHash: `sha256:${string}`;
  parentConversationUrl?: string | undefined;
  expectedTargetRef?: string | undefined;
  createdTarget: ExtensionCreatedTarget;
  targets: ExtensionExactTargetRegistry;
  activeTarget: ExtensionExactTarget | null;
}>): Promise<Readonly<{ continuationUrl: string | undefined;
  bound: ExtensionExactTarget | null }>> => {
  await input.createdTarget.reconcileOrphans();
  const continuationUrl = input.targetMode === "authorized-continuation"
    ? requireCanonicalGptConversationUrl(input.parentConversationUrl ?? "") : undefined;
  const requestValid = [
    ["fresh", "bound-observation", "confirmed-readback", "authorized-continuation"]
      .includes(input.targetMode),
    /^sha256:[a-f0-9]{64}$/u.test(input.jobRefHash),
    input.targetMode === "authorized-continuation" || input.parentConversationUrl === undefined,
  ].every(Boolean);
  if (!requestValid || input.activeTarget || input.createdTarget.isPending()) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const bound = input.targets.findByJobRefHash(input.jobRefHash);
  if (input.expectedTargetRef && !bound) {
    throw new Error("BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE");
  }
  if (input.expectedTargetRef && bound?.targetRef !== input.expectedTargetRef) {
    throw new Error("BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED");
  }
  if (!bound && input.targetMode === "bound-observation") {
    throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
  }
  return { continuationUrl, bound };
};
