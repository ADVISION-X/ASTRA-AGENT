import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionExactTarget, ExtensionExactTargetRegistry } from "./exact-target-runtime.js";
import type { ExtensionCreatedTarget, TargetFailureReporter } from "./extension-created-target.js";
import { debuggerDetachFailure } from "./extension-target-observation.js";

type TargetLossDependencies = Readonly<{
  debuggerRuntime: ExtensionDebuggerRuntime;
  targets: ExtensionExactTargetRegistry;
  createdTarget: ExtensionCreatedTarget;
  readActiveTabId: () => number | null;
  clearActiveTarget: () => void;
  reportTargetFailure: TargetFailureReporter;
  sendRevoke: (body: Record<string, unknown>) => Promise<void>;
}>;

type LossFailure = Omit<Parameters<TargetFailureReporter>[0], "targetRef">;

/** Consumes Chrome debugger-detach and tab-removal events for the exact Target this extension holds. */
export class ExtensionTargetLoss {
  public constructor(private readonly deps: TargetLossDependencies) {}

  public async consumeDebuggerDetach(
    tabId: number,
    reason: Parameters<typeof debuggerDetachFailure>[0],
    eventTarget: ExtensionExactTarget | null,
  ): Promise<void> {
    const { debuggerRuntime, targets } = this.deps;
    await debuggerRuntime.awaitPageReadPermission();
    const known = targets.findByTabId(tabId);
    if (!known || !eventTarget || known.chromeTargetId !== eventTarget.chromeTargetId
      || known.jobRefHash !== eventTarget.jobRefHash) return;
    const live = await debuggerRuntime.readTargets();
    if (live.some((target) => target.tabId === tabId
      && target.id === known.chromeTargetId && target.attached)) return;
    await this.retire(tabId, known, {
      runtimeEventType: "debugger-detach", ...debuggerDetachFailure(reason),
    });
  }

  public async consumeTabRemoval(
    tabId: number, eventTarget: ExtensionExactTarget | null,
  ): Promise<void> {
    const { debuggerRuntime, targets, createdTarget } = this.deps;
    await debuggerRuntime.awaitPageReadPermission();
    try {
      await debuggerRuntime.readTab(tabId);
      return;
    } catch {
      const live = await debuggerRuntime.readTargets();
      if (live.some((target) => target.tabId === tabId)) return;
    }
    createdTarget.markTabRemoved(tabId);
    const known = targets.findByTabId(tabId);
    if (!known || !eventTarget || known.chromeTargetId !== eventTarget.chromeTargetId
      || known.jobRefHash !== eventTarget.jobRefHash) return;
    await this.retire(tabId, known, {
      runtimeEventType: "tab-remove", reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
    });
  }

  /** Invalidate the lost Target, drop it from active state, then report and revoke it exactly once. */
  private async retire(
    tabId: number, known: ExtensionExactTarget, failure: LossFailure,
  ): Promise<void> {
    this.deps.targets.invalidateTab(tabId);
    if (this.deps.readActiveTabId() === tabId) this.deps.clearActiveTarget();
    const identity = { targetRef: known.targetRef, jobRefHash: known.jobRefHash,
      documentRef: known.documentRef };
    await this.deps.reportTargetFailure({ ...identity, ...failure });
    await this.deps.sendRevoke(identity);
  }
}
