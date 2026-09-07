import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import {
  GPT_WEB_START_URL,
  gptWebClaimOriginForUrl,
  requireGptWebPolicyForUrl,
} from "../exact-target/browser-site-policy-registry.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredExtensionCommand } from "./extension-command-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import {
  collectForkCleanupFailures,
  debuggerDetachFailure,
  discoverGptForkSuccessor,
  exactAssistantReadLoaderId,
  forkTransitionComplete,
  forkTargetSetSettled,
  readDiscoveredTabIds,
  readExtensionMainFrame,
  waitForCanonicalGptMainFrame,
  waitForDiscoveredTabAbsence,
} from "./extension-target-observation.js";
import type {
  ExtensionChromeApi,
  ExtensionDebugTarget,
  ExtensionTab,
} from "./extension-runtime-types.js";

type TargetFrameSender = (
  kind: "TARGET_CLAIM" | "TARGET_REVOKE",
  body: Record<string, unknown>,
) => Promise<void>;

type TargetFailureReporter = (input: Readonly<{
  targetRef: string;
  runtimeEventType: "debugger-detach" | "tab-remove";
  reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT" | "BROWSER_DEVTOOLS_CONFLICT";
  nativeCauseCode?: "CHROME_DEBUGGER_TARGET_CLOSED" | "CHROME_DEBUGGER_CANCELED_BY_USER";
}>) => Promise<void> | void;

type PendingCreatedTarget = Readonly<{
  tabId: number;
  resolve(target: ExtensionDebugTarget): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof globalThis.setTimeout> | null;
}>;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;


export class ExtensionTargetAuthority {
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private activeTarget: ExtensionExactTarget | null = null;
  private activeLoaderId: string | null = null;
  private readonly parkedLoaderIds = new Map<string, string>();
  private attachedTabId: number | null = null;
  private pendingCreatedTarget: PendingCreatedTarget | null = null;
  private navigationPublication: Readonly<{ loaderId: string; promise: Promise<void> }> | null = null;

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: TargetFrameSender,
    private readonly reportTargetFailure: TargetFailureReporter,
  ) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
  }

  public start(): void {
    this.chromeApi.debugger.onDetach.addListener((target, reason) => {
      void this.consumeDebuggerDetachAfterBarrier(target.tabId, reason);
    });
    this.chromeApi.debugger.onEvent.addListener((target, method) => {
      if (method !== "Page.frameNavigated" || this.activeTarget?.tabId !== target.tabId) return;
      void this.consumeFrameNavigationAfterBarrier(target.tabId);
    });
    this.chromeApi.tabs.onUpdated.addListener((tabId) => {
      void this.consumeTabUpdateAfterBarrier(tabId);
    });
    this.chromeApi.tabs.onRemoved?.addListener((tabId) => {
      void this.consumeTabRemovalAfterBarrier(tabId);
    });
  }

  private async consumeDebuggerDetachAfterBarrier(
    tabId: number,
    reason: Parameters<typeof debuggerDetachFailure>[0],
  ): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const deterministicTargetRef = `target-tab-${tabId}`;
    const targetRef = this.activeTarget?.tabId === tabId
      ? this.activeTarget.targetRef
      : this.attachedTabId === tabId && this.parkedLoaderIds.has(deterministicTargetRef)
        ? deterministicTargetRef
        : null;
    if (!targetRef) return;
    this.targets.invalidateTab(tabId);
    this.parkedLoaderIds.delete(targetRef);
    this.activeTarget = null;
    this.activeLoaderId = null;
    this.attachedTabId = null;
    this.navigationPublication = null;
    await this.publishTargetFailure({
      targetRef, runtimeEventType: "debugger-detach", ...debuggerDetachFailure(reason),
    });
  }

  private async consumeFrameNavigationAfterBarrier(
    tabId: number,
  ): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    if (this.activeTarget?.tabId !== tabId) return;
    const frame = await readExtensionMainFrame(this.debuggerRuntime, tabId);
    await this.publishMainFrameNavigation(frame.url, frame.loaderId);
  }

  private async consumeTabUpdateAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    if (this.pendingCreatedTarget?.tabId !== tabId) return;
    const tab = await this.debuggerRuntime.readTab(tabId);
    if (tab.status === "complete") this.completeCreatedTarget(tabId, tab);
  }

  private async consumeTabRemovalAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const targetRef = `target-tab-${tabId}`;
    const known = this.activeTarget?.tabId === tabId || this.parkedLoaderIds.has(targetRef);
    if (!known) return;
    this.targets.invalidateTab(tabId);
    this.parkedLoaderIds.delete(targetRef);
    if (this.activeTarget?.tabId === tabId) {
      this.activeTarget = null;
      this.activeLoaderId = null;
      this.navigationPublication = null;
    }
    if (this.attachedTabId === tabId) this.attachedTabId = null;
    await this.publishTargetFailure({
      targetRef, runtimeEventType: "tab-remove",
      reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
    });
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    return this.targets.resolve(targetRef, documentRef);
  }

  private async publishTargetFailure(input: Parameters<TargetFailureReporter>[0]): Promise<void> {
    await this.reportTargetFailure(input);
    await this.send("TARGET_REVOKE", { targetRef: input.targetRef });
  }

  public async acquireJobBoundChatGptTarget(targetRef?: string): Promise<void> {
    if (this.activeTarget || this.pendingCreatedTarget) throw new Error("BROWSER_TARGET_INVALID");
    if (targetRef) return this.reacquireParkedTarget(targetRef);
    const parkedTargetRef = this.singleParkedTargetRef();
    if (parkedTargetRef) return this.reacquireParkedTarget(parkedTargetRef, true);
    const candidate = await this.createProductionCandidate();
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    try {
      await this.debuggerRuntime.attach(candidate.tabId);
      this.attachedTabId = candidate.tabId;
    } catch (error) {
      try { await this.debuggerRuntime.removeTab(candidate.tabId); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw new Error("BROWSER_DEVTOOLS_CONFLICT", { cause: error });
    }
    try {
      await this.debuggerRuntime.send(candidate.tabId, "Page.enable");
      const mainFrame = await readExtensionMainFrame(this.debuggerRuntime, candidate.tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      const target = this.targets.claimOperatorTarget(candidate.tabId);
      this.activeTarget = target;
      this.activeLoaderId = mainFrame.loaderId;
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        claimOrigin: gptWebClaimOriginForUrl(mainFrame.url),
      }));
    } catch (error) {
      try { await this.discardJobOwnedTarget(candidate.tabId); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw error;
    }
  }

  public async releaseActiveTarget(notifyWorkbench = true): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    await this.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    const target = this.activeTarget;
    if (!target) return;
    const loaderId = this.activeLoaderId;
    this.activeTarget = null;
    this.activeLoaderId = null;
    this.navigationPublication = null;
    if (notifyWorkbench) {
      this.targets.remove(target.targetRef);
      this.parkedLoaderIds.delete(target.targetRef);
    } else if (loaderId && (this.parkedLoaderIds.size === 0 || this.parkedLoaderIds.has(target.targetRef))) {
      this.parkedLoaderIds.set(target.targetRef, loaderId);
    } else {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    if (notifyWorkbench) {
      if (this.attachedTabId === target.tabId) this.attachedTabId = null;
      await this.debuggerRuntime.detach(target.tabId);
    }
    if (notifyWorkbench) await this.send("TARGET_REVOKE", { targetRef: target.targetRef });
  }

  public async parkActiveTarget(): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const target = this.activeTarget;
    const loaderId = this.activeLoaderId;
    if (!target || !loaderId) throw new Error("BROWSER_TARGET_INVALID");
    this.activeTarget = null;
    this.activeLoaderId = null;
    this.navigationPublication = null;
    this.parkedLoaderIds.set(target.targetRef, loaderId);
    await this.send("TARGET_REVOKE", { targetRef: target.targetRef });
  }

  public async executeRegisteredCommand(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
  ): Promise<unknown> {
    if (command.kind === "dom-intent") {
      const assertCurrent = (): void => { this.targets.resolve(target.targetRef, target.documentRef); };
      const forkTransition = command.intent.kind === "click"
        ? command.intent.postClickTargetTransition : undefined;
      const targetBaseline = forkTransition === undefined
        ? null : await readDiscoveredTabIds(this.debuggerRuntime);
      const expectedMainFrameLoaderId = exactAssistantReadLoaderId(
        command.intent.kind, target, this.activeTarget, this.activeLoaderId,
      );
      if (command.intent.kind === "readExactAssistantTurn" && !expectedMainFrameLoaderId) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
      const result = await executeRegisteredDomIntent(
        this.debuggerRuntime, target, command.intent, assertCurrent,
        expectedMainFrameLoaderId ?? undefined,
        forkTransition === undefined || targetBaseline === null ? undefined
          : () => this.normalizeGptForkSuccessor(target, targetBaseline, forkTransition.timeoutMs),
      );
      if (forkTransition === undefined) this.targets.resolve(target.targetRef, target.documentRef);
      else {
        if (!forkTransitionComplete(this.activeTarget, target)) {
          throw new Error("BROWSER_POSTCONDITION_FAILED");
        }
      }
      return result;
    }
    return executeRegisteredExtensionCommand(this.debuggerRuntime, target, command, {
      assertCurrent: () => { this.targets.resolve(target.targetRef, target.documentRef); },
      closeTarget: async () => {
        await this.debuggerRuntime.send(target.tabId, "Page.close");
        await this.releaseActiveTarget();
      },
      navigate: (url) => this.executeNavigation(target, url),
      parkTarget: () => this.parkActiveTarget(),
    });
  }

  private async createProductionCandidate(): Promise<ExtensionDebugTarget> {
    const created = await this.debuggerRuntime.createBackgroundTab(GPT_WEB_START_URL);
    if (!Number.isInteger(created.id)) throw new Error("BROWSER_TARGET_INVALID");
    return this.waitForCreatedTarget(created.id!);
  }

  private async reacquireParkedTarget(targetRef: string, resetToStart = false): Promise<void> {
    const priorLoaderId = this.parkedLoaderIds.get(targetRef) ?? null;
    const parked = await this.readOrRecoverExactTarget(targetRef);
    const attachedHere = this.attachedTabId !== parked.tabId;
    if (attachedHere) {
      await this.debuggerRuntime.attach(parked.tabId);
      this.attachedTabId = parked.tabId;
    }
    try {
      await this.debuggerRuntime.send(parked.tabId, "Page.enable");
      let mainFrame = await readExtensionMainFrame(this.debuggerRuntime, parked.tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      if (resetToStart) {
        await this.debuggerRuntime.send(
          parked.tabId, "Page.navigate", { url: GPT_WEB_START_URL },
        );
        await this.debuggerRuntime.awaitPageReadPermission();
        mainFrame = await readExtensionMainFrame(this.debuggerRuntime, parked.tabId);
        if (priorLoaderId === null || mainFrame.loaderId === priorLoaderId) {
          throw new Error("BROWSER_DOCUMENT_INVALID");
        }
      }
      const target = priorLoaderId === null || mainFrame.loaderId === priorLoaderId
        ? parked : this.targets.advanceDocument(targetRef);
      this.activeTarget = target;
      this.activeLoaderId = mainFrame.loaderId;
      this.parkedLoaderIds.delete(targetRef);
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        claimOrigin: gptWebClaimOriginForUrl(mainFrame.url),
      }));
    } catch (error) {
      if (attachedHere) {
        if (this.attachedTabId === parked.tabId) this.attachedTabId = null;
        try {
          await this.debuggerRuntime.detach(parked.tabId);
        } catch (detachError) {
          throw new AggregateError([error, detachError], "BROWSER_TARGET_DETACH_FAILED");
        }
      }
      this.activeTarget = null;
      this.activeLoaderId = null;
      throw error;
    }
  }

  private async readOrRecoverExactTarget(targetRef: string): Promise<ExtensionExactTarget> {
    try {
      return this.targets.read(targetRef);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "BROWSER_TARGET_INVALID") throw error;
    }
    const match = /^target-tab-(0|[1-9][0-9]*)$/u.exec(targetRef);
    const tabId = match ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(tabId)) throw new Error("BROWSER_EXACT_TARGET_UNAVAILABLE");
    let candidates: readonly ExtensionDebugTarget[];
    try {
      candidates = (await this.debuggerRuntime.readTargets()).filter((candidate) =>
        candidate.tabId === tabId);
    } catch (error) {
      throw new Error("BROWSER_TARGET_DISCOVERY_UNAVAILABLE", { cause: error });
    }
    if (candidates.length === 0) throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    if (candidates.length !== 1
      || candidates[0]!.type !== "page"
      || candidates[0]!.attached !== true) {
      throw new Error("BROWSER_EXACT_TARGET_UNAVAILABLE");
    }
    try {
      requireGptWebPolicyForUrl(candidates[0]!.url);
      this.debuggerRuntime.adoptAttached(tabId);
      const mainFrame = await readExtensionMainFrame(this.debuggerRuntime, tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      const recovered = this.targets.claimOperatorTarget(tabId);
      if (recovered.targetRef !== targetRef) throw new Error("BROWSER_EXACT_TARGET_UNAVAILABLE");
      this.attachedTabId = tabId;
      this.parkedLoaderIds.set(targetRef, mainFrame.loaderId);
      return recovered;
    } catch (error) {
      this.debuggerRuntime.forgetAttached(tabId);
      this.attachedTabId = null;
      if (error instanceof Error && (error.message === "BROWSER_EXACT_TARGET_UNAVAILABLE"
        || error.message === "BROWSER_ORIGIN_REJECTED")) throw error;
      throw new Error("BROWSER_EXACT_TARGET_UNAVAILABLE", { cause: error });
    }
  }

  private singleParkedTargetRef(): string | null {
    if (this.parkedLoaderIds.size === 0) return null;
    if (this.parkedLoaderIds.size !== 1) throw new Error("BROWSER_TARGET_INVALID");
    return this.parkedLoaderIds.keys().next().value as string;
  }

  private waitForCreatedTarget(tabId: number): Promise<ExtensionDebugTarget> {
    if (this.pendingCreatedTarget) throw new Error("BROWSER_TARGET_INVALID");
    const pending = new Promise<ExtensionDebugTarget>((resolve, reject) => {
      this.pendingCreatedTarget = { tabId, resolve, reject, timeout: null };
    });
    void this.startCreatedTargetDeadlineAfterBarrier(tabId);
    return pending;
  }

  private async startCreatedTargetDeadlineAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const pending = this.pendingCreatedTarget;
    if (!pending || pending.tabId !== tabId || pending.timeout !== null) return;
    const timeout = globalThis.setTimeout(() => {
      void this.rejectPendingCreatedTarget("BROWSER_TARGET_INVALID");
    }, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    this.pendingCreatedTarget = { ...pending, timeout };
  }

  private completeCreatedTarget(
    tabId: number,
    tab: ExtensionTab,
  ): void {
    const pending = this.pendingCreatedTarget;
    if (!pending || pending.tabId !== tabId) return;
    const target: ExtensionDebugTarget = Object.freeze({
      attached: false,
      id: `job-owned-tab:${tabId}`,
      tabId,
      title: tab.title ?? "",
      type: "page",
      url: tab.url ?? "",
    });
    if (target.tabId !== pending.tabId) {
      void this.rejectPendingCreatedTarget("BROWSER_TARGET_INVALID");
      return;
    }
    this.pendingCreatedTarget = null;
    if (pending.timeout !== null) globalThis.clearTimeout(pending.timeout);
    pending.resolve(target);
  }

  private async rejectPendingCreatedTarget(reasonCode: string): Promise<void> {
    const pending = this.pendingCreatedTarget;
    if (!pending) return;
    this.pendingCreatedTarget = null;
    if (pending.timeout !== null) globalThis.clearTimeout(pending.timeout);
    try {
      await this.debuggerRuntime.removeTab(pending.tabId);
    } catch {
      await this.reportTargetFailure({
        targetRef: `job-owned-tab:${pending.tabId}`,
        runtimeEventType: "tab-remove",
        reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
      });
    }
    pending.reject(new Error(reasonCode));
  }

  private async discardJobOwnedTarget(tabId: number): Promise<void> {
    const cleanupErrors: unknown[] = [];
    if (this.activeTarget?.tabId === tabId) {
      await this.releaseActiveTarget().catch((error) => { cleanupErrors.push(error); });
    } else {
      if (this.attachedTabId === tabId) this.attachedTabId = null;
      await this.debuggerRuntime.detach(tabId).catch((error) => { cleanupErrors.push(error); });
    }
    await this.debuggerRuntime.removeTab(tabId).catch((error) => { cleanupErrors.push(error); });
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "BROWSER_TARGET_CLEANUP_FAILED");
  }

  private async normalizeGptForkSuccessor(
    source: ExtensionExactTarget,
    baselineTabIds: ReadonlySet<number>,
    timeoutMs: number,
  ): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    let deadline = Date.now() + timeoutMs;
    let successor: ExtensionDebugTarget | null = null;
    let attached = false;
    let takeoverCommitted = false;
    try {
      successor = await discoverGptForkSuccessor(this.debuggerRuntime, baselineTabIds, deadline);
      if (successor.tabId === undefined) throw new Error("BROWSER_POSTCONDITION_FAILED");

      await this.debuggerRuntime.attach(successor.tabId);
      attached = true;
      await this.debuggerRuntime.send(successor.tabId, "Page.enable");
      const childFrame = await waitForCanonicalGptMainFrame(
        this.debuggerRuntime, successor.tabId, deadline,
      );

      const next = this.targets.transferPhysicalTab(
        source.targetRef, source.documentRef, successor.tabId,
      );
      this.activeTarget = next;
      this.activeLoaderId = childFrame.loaderId;
      this.attachedTabId = successor.tabId;
      this.navigationPublication = null;
      takeoverCommitted = true;
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(next, {
        claimOrigin: gptWebClaimOriginForUrl(childFrame.url),
      }));
      await this.debuggerRuntime.detach(source.tabId);
      await this.debuggerRuntime.removeTab(source.tabId);
      await this.debuggerRuntime.awaitPageReadPermission();
      deadline = Date.now() + timeoutMs;
      await waitForDiscoveredTabAbsence(this.debuggerRuntime, source.tabId, deadline);
      if (next.targetRef !== source.targetRef || next.tabId !== successor.tabId
        || next.navigationEpoch !== source.navigationEpoch + 1) {
        throw new Error("BROWSER_POSTCONDITION_FAILED");
      }
      if (!await forkTargetSetSettled(this.debuggerRuntime, source.tabId, successor.tabId)) {
        throw new Error("BROWSER_POSTCONDITION_FAILED");
      }
    } catch (error) {
      const cleanupFailures = await collectForkCleanupFailures(
        this.debuggerRuntime, {
          attached, sourceTabId: source.tabId, successorTabId: successor?.tabId ?? null,
          takeoverCommitted,
        },
      );
      if (error instanceof Error && error.message === "BROWSER_TARGET_DISCOVERY_UNAVAILABLE") throw error;
      throw new AggregateError([error, ...cleanupFailures], "BROWSER_POSTCONDITION_FAILED");
    }
  }

  private async executeNavigation(target: ExtensionExactTarget, url: string): Promise<Record<string, unknown>> {
    const current = await executeRegisteredDomIntent(
      this.debuggerRuntime,
      target,
      { kind: "document" },
      () => { this.targets.resolve(target.targetRef, target.documentRef); },
    ) as Readonly<{ url: string }>;
    const destination = new URL(url);
    if (destination.protocol !== "https:" || destination.origin !== new URL(current.url).origin) {
      throw new Error("BROWSER_ORIGIN_REJECTED");
    }
    await this.debuggerRuntime.send(target.tabId, "Page.navigate", { url });
    await this.debuggerRuntime.awaitPageReadPermission();
    const observed = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    const next = await this.publishMainFrameNavigation(observed.url, observed.loaderId);
    return { targetRef: next.targetRef, documentRef: next.documentRef, navigationEpoch: next.navigationEpoch };
  }

  private async publishMainFrameNavigation(url: string, loaderId: string): Promise<ExtensionExactTarget> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const current = this.activeTarget;
    if (!current) throw new Error("BROWSER_TARGET_INVALID");
    if (loaderId === this.activeLoaderId) {
      if (this.navigationPublication?.loaderId === loaderId) await this.navigationPublication.promise;
      return this.activeTarget ?? current;
    }
    try {
      requireGptWebPolicyForUrl(url);
    } catch (error) {
      await this.releaseActiveTarget();
      throw error;
    }
    const next = this.targets.advanceDocument(current.targetRef);
    this.activeTarget = next;
    this.activeLoaderId = loaderId;
    const promise = this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(next, {
      claimOrigin: gptWebClaimOriginForUrl(url),
    }));
    this.navigationPublication = { loaderId, promise };
    try { await promise; } finally {
      if (this.navigationPublication?.promise === promise) this.navigationPublication = null;
    }
    return next;
  }

}
