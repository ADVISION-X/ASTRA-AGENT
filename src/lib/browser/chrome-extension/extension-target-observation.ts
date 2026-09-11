import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import type {
  ExtensionDebuggerDetachReason,
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
