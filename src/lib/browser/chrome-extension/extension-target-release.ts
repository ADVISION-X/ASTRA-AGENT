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

/** Releases only the current live same-job Target. No historical ref is accepted. */
export const releaseJobBoundTarget = async (
  context: ReleaseContext, jobRefHash: `sha256:${string}`,
): Promise<void> => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) throw new Error("BROWSER_TARGET_INVALID");
  await context.awaitOldCommandHandlers();
  await context.debuggerRuntime.awaitPageReadPermission();
  if (context.createdTarget.isPending() || context.readActiveJobRefHash() === jobRefHash) {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  const bound = context.targets.findByJobRefHash(jobRefHash);
  if (!bound) {
    await context.sendRevoke({ targetRef: null, jobRefHash, releaseOutcome: "absent" });
    return;
  }
  const live = await context.debuggerRuntime.readTargets();
  if (!live.some((target) => target.tabId === bound.tabId
    && target.id === bound.chromeTargetId)) {
    context.targets.invalidateTab(bound.tabId);
    await context.sendRevoke({ targetRef: bound.targetRef, jobRefHash,
      releaseOutcome: "absent" });
    return;
  }
  // Chrome reports this deliberate close through its own detach/removal events; unregister first so the
  // loss consumers find no Target to retire, and re-register if the close cannot be proven.
  context.targets.invalidateTab(bound.tabId);
  try {
    await context.debuggerRuntime.removeTab(bound.tabId);
    let tabAbsent = false;
    try { await context.debuggerRuntime.readTab(bound.tabId); }
    catch { tabAbsent = true; }
    const after = await context.debuggerRuntime.readTargets();
    if (!tabAbsent || after.some((target) => target.tabId === bound.tabId
      && target.id === bound.chromeTargetId)) {
      throw new Error("BROWSER_TARGET_CLEANUP_FAILED");
    }
  } catch (error) {
    context.targets.restore(bound);
    throw error;
  }
  context.debuggerRuntime.forgetAttached(bound.tabId);
  await context.sendRevoke({ targetRef: bound.targetRef, jobRefHash,
    releaseOutcome: "released" });
};
