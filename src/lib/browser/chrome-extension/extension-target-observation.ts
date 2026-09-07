import { requireCanonicalGptConversationUrl } from "../exact-target/browser-site-policy-registry.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type {
  ExtensionDebuggerDetachReason,
  ExtensionDebugTarget,
} from "./extension-runtime-types.js";

export type ExtensionMainFrame = Readonly<{ loaderId: string; url: string }>;

const DEBUGGER_DETACH_FAILURE: Readonly<Record<ExtensionDebuggerDetachReason, Readonly<{
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT";
  nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER";
}>>> = Object.freeze({
  target_closed: Object.freeze({
    reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
    nativeCauseCode: "CHROME_DEBUGGER_TARGET_CLOSED",
  }),
  canceled_by_user: Object.freeze({
    reasonCode: "BROWSER_DEVTOOLS_CONFLICT",
    nativeCauseCode: "CHROME_DEBUGGER_CANCELED_BY_USER",
  }),
});

export const debuggerDetachFailure = (reason: ExtensionDebuggerDetachReason) =>
  DEBUGGER_DETACH_FAILURE[reason];

export const exactAssistantReadLoaderId = (
  intentKind: string,
  requested: ExtensionExactTarget,
  active: ExtensionExactTarget | null,
  loaderId: string | null,
): string | undefined => intentKind === "readExactAssistantTurn"
  && active?.targetRef === requested.targetRef
  && active.documentRef === requested.documentRef
  ? loaderId ?? undefined : undefined;

export const forkTransitionComplete = (
  current: ExtensionExactTarget | null,
  source: ExtensionExactTarget,
): boolean => current !== null
  && current.targetRef === source.targetRef
  && current.tabId !== source.tabId
  && current.documentRef !== source.documentRef
  && current.navigationEpoch === source.navigationEpoch + 1;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const readExtensionMainFrame = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  tabId: number,
): Promise<ExtensionMainFrame> => {
  const result = asRecord(await debuggerRuntime.send(tabId, "Page.getFrameTree"));
  const frameTree = asRecord(result?.frameTree);
  const frame = asRecord(frameTree?.frame);
  if (!frame || typeof frame.url !== "string" || typeof frame.loaderId !== "string") {
    throw new Error("BROWSER_TARGET_INVALID");
  }
  return { loaderId: frame.loaderId, url: frame.url };
};

export const executeBoundedBrowserWait = async (
  durationMs: number,
): Promise<Readonly<{ waitedMs: number }>> => {
  if (!Number.isInteger(durationMs) || durationMs < 1
    || durationMs > BROWSER_COMMAND_DEFAULT_DEADLINE_MS) {
    throw new Error("BROWSER_CAPABILITY_REJECTED");
  }
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, durationMs));
  return { waitedMs: durationMs };
};

export const readDiscoveredTabIds = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
): Promise<ReadonlySet<number>> => {
  try {
    return new Set((await debuggerRuntime.readTargets())
      .flatMap((candidate) => Number.isSafeInteger(candidate.tabId) ? [candidate.tabId!] : []));
  } catch (error) {
    throw new Error("BROWSER_TARGET_DISCOVERY_UNAVAILABLE", { cause: error });
  }
};

const waitForTargetObservation = async (deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.min(50, remaining)));
};

export const waitForCanonicalGptMainFrame = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  tabId: number,
  deadline: number,
): Promise<ExtensionMainFrame> => {
  do {
    const frame = await readExtensionMainFrame(debuggerRuntime, tabId);
    try {
      requireCanonicalGptConversationUrl(frame.url);
      return frame;
    } catch (error) {
      if (frame.url !== "" && frame.url !== "about:blank") throw error;
    }
    await waitForTargetObservation(deadline);
  } while (Date.now() < deadline);
  throw new Error("BROWSER_POSTCONDITION_FAILED");
};

export const waitForDiscoveredTabAbsence = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  tabId: number,
  deadline: number,
): Promise<void> => {
  do {
    if (!(await readDiscoveredTabIds(debuggerRuntime)).has(tabId)) return;
    await waitForTargetObservation(deadline);
  } while (Date.now() < deadline);
  throw new Error("BROWSER_POSTCONDITION_FAILED");
};

export const discoverGptForkSuccessor = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  baselineTabIds: ReadonlySet<number>,
  deadline: number,
): Promise<ExtensionDebugTarget> => {
  do {
    let discovered: readonly ExtensionDebugTarget[];
    try {
      discovered = (await debuggerRuntime.readTargets()).filter((candidate) =>
        Number.isSafeInteger(candidate.tabId) && !baselineTabIds.has(candidate.tabId!));
    } catch (error) {
      throw new Error("BROWSER_TARGET_DISCOVERY_UNAVAILABLE", { cause: error });
    }
    if (discovered.length > 1) throw new Error("BROWSER_POSTCONDITION_FAILED");
    if (discovered.length === 1) {
      const successor = discovered[0]!;
      if (successor.type !== "page" || !Number.isSafeInteger(successor.tabId)) {
        throw new Error("BROWSER_POSTCONDITION_FAILED");
      }
      return successor;
    }
    await waitForTargetObservation(deadline);
  } while (Date.now() < deadline);
  throw new Error("BROWSER_POSTCONDITION_FAILED");
};

export const forkTargetSetSettled = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  sourceTabId: number,
  successorTabId: number,
): Promise<boolean> => {
  const settled = (await debuggerRuntime.readTargets()).filter((candidate) =>
    (candidate.tabId === sourceTabId || candidate.tabId === successorTabId)
      && candidate.type === "page");
  return settled.length === 1 && settled[0]?.tabId === successorTabId;
};

export const collectForkCleanupFailures = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  input: Readonly<{
    attached: boolean;
    sourceTabId: number;
    successorTabId: number | null;
    takeoverCommitted: boolean;
  }>,
): Promise<unknown[]> => {
  const cleanupTasks: Promise<unknown>[] = [];
  if (input.successorTabId !== null && !input.takeoverCommitted && input.attached) {
    cleanupTasks.push(debuggerRuntime.detach(input.successorTabId));
  }
  if (input.successorTabId !== null && input.takeoverCommitted) {
    cleanupTasks.push(debuggerRuntime.detach(input.sourceTabId));
    cleanupTasks.push(debuggerRuntime.removeTab(input.sourceTabId));
  }
  const cleanup = await Promise.allSettled(cleanupTasks);
  return cleanup.flatMap((result) => result.status === "rejected" ? [result.reason] : []);
};

export { waitForTargetObservation };
