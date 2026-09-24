import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from
  "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionDebugTarget, ExtensionTab } from "./extension-runtime-types.js";
import { GPT_WEB_START_URL } from "../exact-target/browser-site-policy-registry.js";

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
  private readonly orphanCandidates = new Map<number, string | null>();
  private readonly orphanRetryTimers = new Map<number, ReturnType<typeof globalThis.setTimeout>>();
  private readonly orphanRetryCounts = new Map<number, number>();

  public constructor(
    private readonly debuggerRuntime: ExtensionDebuggerRuntime,
    private readonly reportTargetFailure: TargetFailureReporter,
  ) {}

  public isPending(): boolean {
    return this.pendingTarget !== null;
  }

  public markTabRemoved(tabId: number): void {
    this.removedTabIds.add(tabId);
    this.orphanCandidates.delete(tabId);
    this.clearOrphanRetry(tabId);
  }
  public wasTabRemoved(tabId: number): boolean { return this.removedTabIds.has(tabId); }

  public async reconcileOrphans(): Promise<void> {
    for (const tabId of this.orphanCandidates.keys()) await this.reconcileOrphanCandidate(tabId);
  }

  public onTabUpdated(tabId: number): void {
    void this.consumeTabUpdateAfterBarrier(tabId);
    if (this.orphanCandidates.has(tabId)) void this.reconcileOrphanCandidate(tabId);
  }

  public async createProductionCandidate(): Promise<ExtensionDebugTarget> {
    const created = await this.debuggerRuntime.createProductionTab(GPT_WEB_START_URL);
    if (!Number.isInteger(created.id)) throw new Error("BROWSER_TARGET_INVALID");
    const tabId = created.id!;
    this.removedTabIds.delete(tabId);
    let createdIdentity: ExtensionDebugTarget | null = null;
    try {
      for (let index = 0; index < 5; index += 1) {
        const targets = (await this.debuggerRuntime.readTargets())
          .filter((target) => target.tabId === tabId && target.type === "page");
        if (targets.length === 1 && targets[0]!.id) {
          createdIdentity = targets[0]!;
          break;
        }
        if (index < 4) await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 100));
      }
      if (!createdIdentity) throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
      const pending = this.waitForCreatedTarget(tabId, createdIdentity.id);
      void this.consumeTabUpdateAfterBarrier(tabId);
      const candidate = await pending;
      const targets = (await this.debuggerRuntime.readTargets())
        .filter((target) => target.tabId === candidate.tabId && target.id === candidate.id);
      if (targets.length !== 1) throw new Error("BROWSER_TARGET_INVALID");
      return targets[0]!;
    } catch (error) {
      if (!this.removedTabIds.has(tabId)) {
        this.orphanCandidates.set(tabId, createdIdentity?.id ?? null);
        try { await this.reconcileOrphanCandidate(tabId); }
        finally { this.scheduleOrphanRetry(tabId); }
      }
      throw error;
    }
  }

  public async removeExactCandidate(candidate: ExtensionDebugTarget): Promise<void> {
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    const current = await this.debuggerRuntime.readTargets();
    if (!current.some((target) => target.tabId === candidate.tabId && target.id === candidate.id)) {
      throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    }
    await this.debuggerRuntime.removeTab(candidate.tabId);
  }

  private async reconcileOrphanCandidate(tabId: number): Promise<void> {
    if (!this.orphanCandidates.has(tabId) || this.removedTabIds.has(tabId)) return;
    await this.debuggerRuntime.awaitPageReadPermission();
    let tab: Readonly<{ id?: number }>;
    try { tab = await this.debuggerRuntime.readTab(tabId); }
    catch { return; }
    if (tab.id !== tabId || this.removedTabIds.has(tabId)) {
      this.orphanCandidates.delete(tabId);
      this.clearOrphanRetry(tabId);
      return;
    }
    const expected = this.orphanCandidates.get(tabId);
    if (expected === undefined) return;
    let visibleTargets: readonly ExtensionDebugTarget[];
    try { visibleTargets = await this.debuggerRuntime.readTargets(); }
    catch { return; }
    const targets = visibleTargets
      .filter((target) => target.tabId === tabId && target.type === "page");
    if (targets.length !== 1 || !targets[0]!.id
      || (expected !== null && targets[0]!.id !== expected)) return;
    if (this.orphanCandidates.get(tabId) === null) this.orphanCandidates.set(tabId, targets[0]!.id);
    try {
      await this.removeExactCandidate(targets[0]!);
      this.orphanCandidates.delete(tabId);
      this.clearOrphanRetry(tabId);
    } catch {
      await this.reportTargetFailure({ targetRef: `job-owned-tab:${tabId}`,
        runtimeEventType: "tab-remove", reasonCode: "BROWSER_TARGET_CLEANUP_FAILED" });
    }
  }

  private clearOrphanRetry(tabId: number): void {
    const timer = this.orphanRetryTimers.get(tabId);
    if (timer !== undefined) globalThis.clearTimeout(timer);
    this.orphanRetryTimers.delete(tabId);
    this.orphanRetryCounts.delete(tabId);
  }

  private scheduleOrphanRetry(tabId: number): void {
    if (!this.orphanCandidates.has(tabId) || this.orphanRetryTimers.has(tabId)) return;
    const count = this.orphanRetryCounts.get(tabId) ?? 0;
    if (count >= 15) return;
    this.orphanRetryCounts.set(tabId, count + 1);
    const timer = globalThis.setTimeout(() => {
      this.orphanRetryTimers.delete(tabId);
      void this.reconcileOrphanCandidate(tabId).finally(() => this.scheduleOrphanRetry(tabId));
    }, 2_000);
    this.orphanRetryTimers.set(tabId, timer);
  }

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
