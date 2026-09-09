import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserMutationProgress } from "../exact-target/browser-mutation-store.js";
import {
  GPT_WEB_START_URL,
  gptWebClaimOriginForUrl,
  requireGptWebPolicyForUrl,
} from "../exact-target/browser-site-policy-registry.js";
import { ExtensionDebuggerRuntime, type ProviderInputState } from "./debugger-runtime.js";
import type { RegisteredExtensionCommand } from "./command-registry.js";
import { executeRegisteredExtensionCommand } from "./extension-command-runtime.js";
import { ExtensionCreatedTarget, type TargetFailureReporter } from "./extension-created-target.js";
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

type ActiveTabGeneration = Readonly<{
  generation: number;
  tabId: number;
}>;

type InteractionLease = Readonly<{
  generation: number;
  tabId: number;
  targetRef: string;
  documentRef: string;
  windowId: number;
}>;

const interactionRejectedReceipt = (): Readonly<Record<string, unknown>> => Object.freeze({
  candidateCount: 0,
  identityRevalidated: false,
  mutationCount: 0,
  postconditionVerified: false,
  qualificationRejected: true,
  qualificationStage: "candidate-set",
  failureCode: "BROWSER_TARGET_NOT_INTERACTIVE",
  nativeCauseCode: null,
});

export class ExtensionTargetAuthority {
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private activeTarget: ExtensionExactTarget | null = null;
  private activeLoaderId: string | null = null;
  private readonly parkedLoaderIds = new Map<string, string>();
  private attachedTabId: number | null = null;
  private readonly createdTarget: ExtensionCreatedTarget;
  private readonly activeTabsByWindow = new Map<number, ActiveTabGeneration>();
  private navigationPublication: Readonly<{ loaderId: string; promise: Promise<void> }> | null = null;

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: TargetFrameSender,
    private readonly reportTargetFailure: TargetFailureReporter,
  ) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
    this.createdTarget = new ExtensionCreatedTarget(this.debuggerRuntime, reportTargetFailure);
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
      void this.createdTarget.consumeTabUpdateAfterBarrier(tabId);
    });
    this.chromeApi.tabs.onActivated.addListener((activeInfo) => {
      this.recordActiveTab(activeInfo.windowId, activeInfo.tabId);
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
    if (this.activeTarget || this.createdTarget.isPending()) throw new Error("BROWSER_TARGET_INVALID");
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
    await this.createdTarget.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
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
    mutationClass: RegisteredExtensionCommand["mutationClass"],
    onMutationProgress: (progress: BrowserMutationProgress) => Promise<void> = async () => {},
  ): Promise<unknown> {
    const execute = async (): Promise<unknown> => {
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
        else if (!forkTransitionComplete(this.activeTarget, target)) {
          throw new Error("BROWSER_POSTCONDITION_FAILED");
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
        onMutationProgress,
      });
    };

    if (mutationClass !== "mutation") return execute();
    let interactionLease: InteractionLease;
    try {
      interactionLease = await this.ensureInteractionReady(target);
    } catch {
      return interactionRejectedReceipt();
    }
    const inputState: ProviderInputState = { started: false };
    try {
      return await this.debuggerRuntime.withProviderInputGuard(
        inputState,
        () => this.assertInteractionReady(interactionLease),
        execute,
      );
    } catch (error) {
      if (!inputState.started && error instanceof Error
        && error.message === "BROWSER_TARGET_NOT_INTERACTIVE") {
        return interactionRejectedReceipt();
      }
      throw error;
    }
  }

  private recordActiveTab(windowId: number, tabId: number): void {
    if (!Number.isSafeInteger(windowId) || !Number.isSafeInteger(tabId)) return;
    const current = this.activeTabsByWindow.get(windowId);
    if (current?.tabId === tabId) return;
    this.activeTabsByWindow.set(windowId, Object.freeze({
      generation: (current?.generation ?? 0) + 1,
      tabId,
    }));
  }

  private requireInteractiveTab(tab: ExtensionTab, target: ExtensionExactTarget): number {
    if (tab.id !== target.tabId || !Number.isSafeInteger(tab.windowId)
      || tab.active !== true || tab.discarded !== false || tab.status !== "complete"
      || typeof tab.url !== "string") {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE");
    }
    try {
      requireGptWebPolicyForUrl(tab.url);
    } catch (error) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error });
    }
    return tab.windowId as number;
  }

  private async ensureInteractionReady(target: ExtensionExactTarget): Promise<InteractionLease> {
    this.targets.resolve(target.targetRef, target.documentRef);
    let tab = await this.debuggerRuntime.readTab(target.tabId);
    if (tab.id !== target.tabId || tab.discarded !== false || tab.status !== "complete"
      || typeof tab.url !== "string" || !Number.isSafeInteger(tab.windowId)) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE");
    }
    try {
      requireGptWebPolicyForUrl(tab.url);
    } catch (error) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error });
    }
    if (tab.active !== true) {
      await this.debuggerRuntime.activateTab(target.tabId);
      tab = await this.debuggerRuntime.readTab(target.tabId);
    }
    const windowId = this.requireInteractiveTab(tab, target);
    this.recordActiveTab(windowId, target.tabId);
    const activationGeneration = this.activeTabsByWindow.get(windowId)?.generation;
    if (activationGeneration === undefined) throw new Error("BROWSER_TARGET_NOT_INTERACTIVE");
    const frame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    if (this.activeTarget?.targetRef !== target.targetRef
      || this.activeTarget.documentRef !== target.documentRef
      || this.activeTarget.tabId !== target.tabId
      || this.activeLoaderId === null || frame.loaderId !== this.activeLoaderId) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE");
    }
    try {
      requireGptWebPolicyForUrl(frame.url);
      this.targets.resolve(target.targetRef, target.documentRef);
    } catch (error) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error });
    }
    const finalTab = await this.debuggerRuntime.readTab(target.tabId);
    this.requireInteractiveTab(finalTab, target);
    const active = this.activeTabsByWindow.get(windowId);
    if (!active || active.tabId !== target.tabId || active.generation !== activationGeneration) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE");
    }
    return Object.freeze({
      generation: activationGeneration,
      tabId: target.tabId,
      targetRef: target.targetRef,
      documentRef: target.documentRef,
      windowId,
    });
  }

  private assertInteractionReady(lease: InteractionLease): void {
    const active = this.activeTabsByWindow.get(lease.windowId);
    if (!active || active.tabId !== lease.tabId || active.generation !== lease.generation
      || this.activeTarget?.targetRef !== lease.targetRef
      || this.activeTarget.documentRef !== lease.documentRef
      || this.activeTarget.tabId !== lease.tabId) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE");
    }
    try {
      this.targets.resolve(lease.targetRef, lease.documentRef);
    } catch (error) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error });
    }
  }

  private async createProductionCandidate(): Promise<ExtensionDebugTarget> {
    const created = await this.debuggerRuntime.createBackgroundTab(GPT_WEB_START_URL);
    if (!Number.isInteger(created.id)) throw new Error("BROWSER_TARGET_INVALID");
    return this.createdTarget.waitForCreatedTarget(created.id!);
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
      await this.retireForkSource(source.tabId, successor.tabId, timeoutMs);
      if (next.targetRef !== source.targetRef || next.tabId !== successor.tabId
        || next.navigationEpoch !== source.navigationEpoch + 1) {
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

  private async retireForkSource(sourceTabId: number, successorTabId: number, timeoutMs: number): Promise<void> {
    await this.debuggerRuntime.detach(sourceTabId);
    await this.debuggerRuntime.removeTab(sourceTabId);
    await this.debuggerRuntime.awaitPageReadPermission();
    const deadline = Date.now() + timeoutMs;
    await waitForDiscoveredTabAbsence(this.debuggerRuntime, sourceTabId, deadline);
    if (!await forkTargetSetSettled(this.debuggerRuntime, sourceTabId, successorTabId)) {
      throw new Error("BROWSER_POSTCONDITION_FAILED");
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
