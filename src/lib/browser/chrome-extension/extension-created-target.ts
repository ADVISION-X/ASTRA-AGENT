import { GPT_WEB_START_URL, requireGptWebPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { ExtensionInteractionReadiness } from "./extension-interaction-readiness.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { ExtensionDebugTarget } from "./extension-runtime-types.js";
import { readExtensionMainFrame, type ExtensionMainFrame } from "./extension-target-observation.js";
export type TargetFailureReporter = (input: Readonly<{ targetRef: string; runtimeEventType: "debugger-detach" | "tab-remove";
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT" | "BROWSER_TARGET_CLEANUP_FAILED";
  nativeCauseCode?: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER" }>) => Promise<void> | void;
type PendingCreatedTarget = Readonly<{ tabId: number; chromeTargetId: string; assertCurrent(): void; requireAttached: boolean;
  resolve(target: ExtensionDebugTarget): void; reject(error: Error): void; timeout: ReturnType<typeof globalThis.setTimeout> }>;

export class ExtensionCreatedTarget {
  private pendingTarget: PendingCreatedTarget | null = null;
  private readonly removedTabIds = new Set<number>();
  private readonly orphanCandidates = new Map<number, string | null>();
  private readonly orphanRetryTimers = new Map<number, ReturnType<typeof globalThis.setTimeout>>();
  private readonly orphanRetryCounts = new Map<number, number>();
  public constructor(private readonly debuggerRuntime: ExtensionDebuggerRuntime, private readonly reportTargetFailure: TargetFailureReporter,
    private readonly interactionReadiness: ExtensionInteractionReadiness) {}
  public isPending(): boolean { return this.pendingTarget !== null; }
  public wasTabRemoved(tabId: number): boolean { return this.removedTabIds.has(tabId); }
  public markTabRemoved(tabId: number): void {
    this.removedTabIds.add(tabId); this.orphanCandidates.delete(tabId); this.clearOrphanRetry(tabId);
    if (this.pendingTarget?.tabId === tabId) void this.rejectPendingCreatedTarget("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
  }
  public onTabUpdated(tabId: number): void {
    void this.consumeTabUpdateAfterBarrier(tabId);
    if (this.orphanCandidates.has(tabId)) void this.reconcileOrphanCandidate(tabId);
  }
  public async createProductionCandidate(deadlineAt: number, assertCurrent: () => void): Promise<ExtensionDebugTarget> {
    assertCurrent();
    if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
    const tab = await this.debuggerRuntime.createProductionTab(GPT_WEB_START_URL);
    if (!Number.isSafeInteger(tab.id)) throw new Error("BROWSER_TARGET_INVALID");
    const tabId = tab.id!; this.removedTabIds.delete(tabId);
    let identity: ExtensionDebugTarget | null = null;
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        assertCurrent();
        if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
        const matches = (await this.debuggerRuntime.readTargets()).filter(target => target.tabId === tabId && target.type === "page");
        if (matches.length === 1 && matches[0]!.id) { identity = matches[0]!; break; }
        if (attempt < 4) await new Promise<void>(resolve => globalThis.setTimeout(resolve, Math.max(1, Math.min(100, deadlineAt - Date.now()))));
      }
      if (!identity) throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
      return await this.waitForCreatedTarget(tabId, identity.id, deadlineAt, assertCurrent);
    } catch (error) {
      if (!this.wasTabRemoved(tabId)) {
        this.orphanCandidates.set(tabId, identity?.id ?? null);
        try { await this.reconcileOrphanCandidate(tabId); } finally { this.scheduleOrphanRetry(tabId); }
      }
      throw error;
    }
  }
  public async completeNavigation(target: ExtensionDebugTarget, deadlineAt: number, assertCurrent: () => void,
    destination?: string, forceNavigation = false, expectedLoaderId?: string): Promise<ExtensionMainFrame> {
    if (target.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    assertCurrent();
    if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
    const [before, assertActivation] = await this.qualifyCurrentFrame(target, deadlineAt, assertCurrent);
    const beforeUrl = new URL(before.url);
    const navigated = destination !== undefined && (forceNavigation || `${beforeUrl.origin}${beforeUrl.pathname}` !== destination);
    if (navigated) {
      if (expectedLoaderId !== undefined && before.loaderId !== expectedLoaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
      assertCurrent(); assertActivation();
      if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
      await this.debuggerRuntime.send(target.tabId, "Page.navigate", { url: destination });
    }
    await this.waitForCreatedTarget(target.tabId, target.id, deadlineAt, assertCurrent, true);
    const [frame, assertReadback] = await this.qualifyCurrentFrame(target, deadlineAt, assertCurrent);
    assertCurrent(); assertReadback();
    const afterUrl = new URL(frame.url);
    if (destination !== undefined && `${afterUrl.origin}${afterUrl.pathname}` !== destination) throw new Error("BROWSER_POSTCONDITION_FAILED");
    if (navigated && frame.loaderId === before.loaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    return frame;
  }
  private async qualifyCurrentFrame(target: ExtensionDebugTarget, deadlineAt: number, assertCurrent: () => void): Promise<readonly [ExtensionMainFrame, () => void]> {
    const tab = await this.debuggerRuntime.readTab(target.tabId!);
    const assertActivation = this.interactionReadiness.captureTabActivation(tab, target.tabId!);
    const frame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId!);
    requireGptWebPolicyForUrl(frame.url);
    const physical = (await this.debuggerRuntime.readTargets()).filter(row => row.tabId === target.tabId && row.id === target.id && row.type === "page");
    if (physical.length !== 1 || !physical[0]!.attached) throw new Error("BROWSER_TARGET_INVALID");
    assertCurrent();
    if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT");
    return [frame, assertActivation];
  }
  public waitForCreatedTarget(tabId: number, chromeTargetId: string, deadlineAt: number, assertCurrent: () => void,
    requireAttached = false): Promise<ExtensionDebugTarget> {
    if (this.pendingTarget || !chromeTargetId) throw new Error("BROWSER_TARGET_INVALID");
    const check = (): void => { assertCurrent(); if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT"); };
    check();
    const result = new Promise<ExtensionDebugTarget>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => { void this.rejectPendingCreatedTarget("BROWSER_TARGET_ACQUISITION_TIMEOUT"); }, deadlineAt - Date.now());
      this.pendingTarget = { tabId, chromeTargetId, assertCurrent: check, requireAttached, resolve, reject, timeout };
    });
    void this.consumeTabUpdateAfterBarrier(tabId);
    return result;
  }
  public async consumeTabUpdateAfterBarrier(tabId: number): Promise<void> {
    const pending = this.pendingTarget;
    if (!pending || pending.tabId !== tabId) return;
    try {
      await this.debuggerRuntime.awaitPageReadPermission(); pending.assertCurrent();
      const tab = await this.debuggerRuntime.readTab(tabId);
      if (tab.id !== tabId || tab.discarded !== false) throw new Error("BROWSER_TARGET_INVALID");
      if (tab.status !== "complete") return;
      const targets = (await this.debuggerRuntime.readTargets()).filter(target => target.tabId === tabId && target.id === pending.chromeTargetId && target.type === "page");
      pending.assertCurrent();
      if (targets.length !== 1 || pending.requireAttached && !targets[0]!.attached) throw new Error("BROWSER_TARGET_INVALID");
      if (this.pendingTarget !== pending) return;
      this.pendingTarget = null; globalThis.clearTimeout(pending.timeout); pending.resolve(targets[0]!);
    } catch (error) {
      if (this.pendingTarget !== pending) return;
      this.pendingTarget = null; globalThis.clearTimeout(pending.timeout);
      pending.reject(error instanceof Error ? error : new Error("BROWSER_TARGET_INVALID"));
    }
  }
  public async rejectPendingCreatedTarget(reasonCode: string): Promise<void> {
    const pending = this.pendingTarget;
    if (!pending) return;
    this.pendingTarget = null; globalThis.clearTimeout(pending.timeout); pending.reject(new Error(reasonCode));
  }
  public async removeExactCandidate(candidate: ExtensionDebugTarget): Promise<void> {
    const targets = await this.debuggerRuntime.readTargets();
    if (candidate.tabId === undefined || !targets.some(target => target.tabId === candidate.tabId && target.id === candidate.id)) {
      throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    }
    await this.debuggerRuntime.removeTab(candidate.tabId);
  }
  public async reconcileOrphans(): Promise<void> {
    for (const tabId of this.orphanCandidates.keys()) await this.reconcileOrphanCandidate(tabId);
  }
  private async reconcileOrphanCandidate(tabId: number): Promise<void> {
    if (!this.orphanCandidates.has(tabId) || this.wasTabRemoved(tabId)) return;
    let tab;
    try { tab = await this.debuggerRuntime.readTab(tabId); } catch { return; }
    if (tab.id !== tabId || this.wasTabRemoved(tabId)) return;
    let targets;
    try { targets = (await this.debuggerRuntime.readTargets()).filter(target => target.tabId === tabId && target.type === "page"); } catch { return; }
    const expected = this.orphanCandidates.get(tabId);
    if (targets.length !== 1 || !targets[0]!.id || expected === undefined || expected !== null && expected !== targets[0]!.id) return;
    this.orphanCandidates.set(tabId, targets[0]!.id);
    try { await this.removeExactCandidate(targets[0]!); this.orphanCandidates.delete(tabId); this.clearOrphanRetry(tabId); }
    catch { await this.reportTargetFailure({ targetRef: `job-owned-tab:${tabId}`, runtimeEventType: "tab-remove", reasonCode: "BROWSER_TARGET_CLEANUP_FAILED" }); }
  }
  private clearOrphanRetry(tabId: number): void {
    const timer = this.orphanRetryTimers.get(tabId);
    if (timer !== undefined) globalThis.clearTimeout(timer);
    this.orphanRetryTimers.delete(tabId); this.orphanRetryCounts.delete(tabId);
  }
  private scheduleOrphanRetry(tabId: number): void {
    if (!this.orphanCandidates.has(tabId) || this.orphanRetryTimers.has(tabId)) return;
    const count = this.orphanRetryCounts.get(tabId) ?? 0;
    if (count >= 15) return;
    this.orphanRetryCounts.set(tabId, count + 1);
    this.orphanRetryTimers.set(tabId, globalThis.setTimeout(() => {
      this.orphanRetryTimers.delete(tabId);
      void this.reconcileOrphanCandidate(tabId).finally(() => this.scheduleOrphanRetry(tabId));
    }, 2_000));
  }
}
