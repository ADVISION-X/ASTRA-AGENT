import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { BrowserAuthorityTargetRevoke } from "../transport/browser-authority-frame-payload.js";
import { ExtensionExactTargetRegistry } from "./exact-target-runtime.js";

type ReleaseContext = Readonly<{ targets: ExtensionExactTargetRegistry; debuggerRuntime: ExtensionDebuggerRuntime;
  readActiveJobRefHash: () => string | null;
  awaitOldCommandHandlers: () => Promise<void> }>;

/** Only the current registry can authorize closing an exact system Target. */
export const releaseJobBoundTarget = async (context: ReleaseContext, jobRefHash: `sha256:${string}`): Promise<Omit<Extract<BrowserAuthorityTargetRevoke, { releaseOutcome: string }>, "requestSequence">> => {
  if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) throw new Error("BROWSER_TARGET_INVALID");
  await context.awaitOldCommandHandlers();
  await context.debuggerRuntime.awaitPageReadPermission();
  if (context.readActiveJobRefHash() === jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
  const bound = context.targets.findByJobRefHash(jobRefHash);
  if (!bound) return { targetRef: null, jobRefHash, releaseOutcome: "absent" };
  const live = await context.debuggerRuntime.readTargets();
  if (context.targets.findByJobRefHash(jobRefHash) !== bound) throw new Error("BROWSER_TARGET_INVALID");
  if (!live.some(target => target.tabId === bound.tabId && target.id === bound.chromeTargetId)) {
    context.targets.invalidateTab(bound.tabId);
    context.debuggerRuntime.forgetAttached(bound.tabId);
    return { targetRef: null, jobRefHash, releaseOutcome: "absent" };
  }
  context.targets.invalidateTab(bound.tabId);
  try {
    await context.debuggerRuntime.removeTab(bound.tabId);
    let tabAbsent = false;
    try { await context.debuggerRuntime.readTab(bound.tabId); } catch { tabAbsent = true; }
    const after = await context.debuggerRuntime.readTargets();
    if (!tabAbsent || after.some(target => target.tabId === bound.tabId && target.id === bound.chromeTargetId)) throw new Error("BROWSER_TARGET_CLEANUP_FAILED");
  } catch (error) { context.targets.restore(bound); throw error; }
  context.debuggerRuntime.forgetAttached(bound.tabId);
  return { targetRef: bound.targetRef, jobRefHash, releaseOutcome: "released" };
};
