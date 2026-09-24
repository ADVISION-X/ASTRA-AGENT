import { ExtensionCreatedTarget } from "./extension-created-target.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { ExtensionExactTargetRegistry } from "./exact-target-runtime.js";

type ReleaseContext = Readonly<{
  targets: ExtensionExactTargetRegistry;
  debuggerRuntime: ExtensionDebuggerRuntime;
  createdTarget: ExtensionCreatedTarget;
  readActiveJobRefHash: () => string | null;
  awaitOldCommandHandlers: () => Promise<void>;
  sendRevoke: (body: Record<string, unknown>) => Promise<void>;
}>;

/** Retires old Target claims only after exact Chrome identity and physical absence checks. */
export const releaseJobBoundTarget = async (
  context: ReleaseContext,
  jobRefHash: `sha256:${string}`,
  targetRefs: readonly string[],
): Promise<void> => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) throw new Error("BROWSER_TARGET_INVALID");
  await context.awaitOldCommandHandlers();
  await context.debuggerRuntime.awaitPageReadPermission();
  if (context.createdTarget.isPending() || context.readActiveJobRefHash() === jobRefHash) {
    throw new Error("BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED");
  }
  const bound = context.targets.findByJobRefHash(jobRefHash);
  if (bound && !targetRefs.includes(bound.targetRef)) {
    throw new Error("BROWSER_TARGET_PHYSICAL_ABSENCE_UNPROVEN");
  }
  if (targetRefs.length === 0) {
    await context.sendRevoke({ targetRef: null, jobRefHash,
      releaseOutcome: "absent", targetRefs: [] });
    return;
  }
  let allPhysicallyAbsent = true;
  for (const targetRef of targetRefs) {
    if (!(await releaseOneTarget(context, jobRefHash, targetRef))) allPhysicallyAbsent = false;
  }
  await context.sendRevoke({ targetRef: targetRefs[0], jobRefHash,
    releaseOutcome: allPhysicallyAbsent ? "released" : "quiesced", targetRefs });
};

const releaseOneTarget = async (
  context: ReleaseContext,
  jobRefHash: `sha256:${string}`,
  targetRef: string,
): Promise<boolean> => {
  const match = /^target-tab-(\d+)$/u.exec(targetRef);
  const tabId = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("BROWSER_TARGET_INVALID");
  const current = context.targets.findByTabId(tabId);
  if (current && (current.jobRefHash !== jobRefHash || current.targetRef !== targetRef)) {
    // A reused numeric tab id belongs to its current job; never remove that tab.
    return false;
  }
  if (!current) return false;
  if (context.createdTarget.wasTabRemoved(tabId)) {
    context.targets.invalidateTab(tabId);
    return false;
  }
  const currentTargets = await context.debuggerRuntime.readTargets();
  if (!currentTargets.some((target) => target.tabId === tabId
    && target.id === current.chromeTargetId)) {
    context.targets.invalidateTab(tabId);
    return false;
  }
  const absent = await removeAndVerifyPhysicalAbsence(context, tabId);
  context.targets.invalidateTab(tabId);
  context.debuggerRuntime.forgetAttached(tabId);
  return absent;
};

const removeAndVerifyPhysicalAbsence = async (
  context: ReleaseContext, tabId: number,
): Promise<boolean> => {
  try { await context.debuggerRuntime.removeTab(tabId); }
  catch { return false; }
  let tabStillPresent = true;
  try { await context.debuggerRuntime.readTab(tabId); }
  catch { tabStillPresent = false; }
  const targets = await context.debuggerRuntime.readTargets();
  return context.createdTarget.wasTabRemoved(tabId)
    && !tabStillPresent && !targets.some((target) => target.tabId === tabId);
};
