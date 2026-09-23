import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from
  "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionDebugTarget, ExtensionTab } from "./extension-runtime-types.js";

export type TargetFailureReporter = (input: Readonly<{
  targetRef: string;
  runtimeEventType: "debugger-detach" | "tab-remove";
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT"
    | "BROWSER_TARGET_CLEANUP_FAILED";
  nativeCauseCode?: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER";
}>) => Promise<void> | void;

type PendingCreatedTarget = Readonly<{
  tabId: number;
  chromeTargetId: string;
  resolve(target: ExtensionDebugTarget): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof globalThis.setTimeout> | null;
}>;

export class ExtensionCreatedTarget {
  private pendingTarget: PendingCreatedTarget | null = null;
  private readonly removedTabIds = new Set<number>();

  public constructor(
    private readonly debuggerRuntime: ExtensionDebuggerRuntime,
    private readonly reportTargetFailure: TargetFailureReporter,
  ) {}

  public isPending(): boolean {
    return this.pendingTarget !== null;
  }

  public markTabRemoved(tabId: number): void { this.removedTabIds.add(tabId); }

  public waitForCreatedTarget(tabId: number, chromeTargetId: string): Promise<ExtensionDebugTarget> {
    if (this.pendingTarget) throw new Error("BROWSER_TARGET_INVALID");
    if (!chromeTargetId) throw new Error("BROWSER_TARGET_INVALID");
    this.removedTabIds.delete(tabId);
    const pending = new Promise<ExtensionDebugTarget>((resolve, reject) => {
      this.pendingTarget = { tabId, chromeTargetId, resolve, reject, timeout: null };
    });
    void this.startCreatedTargetDeadlineAfterBarrier(tabId);
    return pending;
  }

  public async consumeTabUpdateAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    if (this.pendingTarget?.tabId !== tabId) return;
    const tab = await this.debuggerRuntime.readTab(tabId);
    if (tab.status === "complete") this.completeCreatedTarget(tabId, tab);
  }

  public async rejectPendingCreatedTarget(reasonCode: string): Promise<void> {
    const pending = this.pendingTarget;
    if (!pending) return;
    this.pendingTarget = null;
    if (pending.timeout !== null) globalThis.clearTimeout(pending.timeout);
    try {
      if (this.removedTabIds.has(pending.tabId)
        || !(await this.debuggerRuntime.readTargets()).some((target) =>
          target.tabId === pending.tabId && target.id === pending.chromeTargetId)) {
        throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
      }
      await this.debuggerRuntime.removeTab(pending.tabId);
    } catch (error) {
      await this.reportTargetFailure({
        targetRef: `job-owned-tab:${pending.tabId}`,
        runtimeEventType: "tab-remove",
        reasonCode: "BROWSER_TARGET_CLEANUP_FAILED",
      });
      pending.reject(new Error(reasonCode, { cause: error }));
      return;
    }
    pending.reject(new Error(reasonCode));
  }

  private async startCreatedTargetDeadlineAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const pending = this.pendingTarget;
    if (!pending || pending.tabId !== tabId || pending.timeout !== null) return;
    const timeout = globalThis.setTimeout(() => {
      void this.rejectPendingCreatedTarget("BROWSER_TARGET_INVALID");
    }, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    this.pendingTarget = { ...pending, timeout };
  }

  private completeCreatedTarget(tabId: number, tab: ExtensionTab): void {
    const pending = this.pendingTarget;
    if (!pending || pending.tabId !== tabId) return;
    const target: ExtensionDebugTarget = Object.freeze({
      attached: false,
      id: pending.chromeTargetId,
      tabId,
      title: tab.title ?? "",
      type: "page",
      url: tab.url ?? "",
    });
    this.pendingTarget = null;
    if (pending.timeout !== null) globalThis.clearTimeout(pending.timeout);
    pending.resolve(target);
  }
}
