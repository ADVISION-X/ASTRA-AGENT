import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { GPT_WEB_START_URL, requireGptWebPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeAuthenticatedMedia } from "./authenticated-media-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import { executeExtensionFileInput } from "./extension-file-input-runtime.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "./extension-runtime-types.js";

type TargetFrameSender = (
  kind: "TARGET_CLAIM" | "TARGET_REVOKE",
  body: Record<string, unknown>,
) => Promise<void>;

type TargetFailureReporter = (input: Readonly<{
  targetRef: string;
  reason: string;
  runtimeEventType: "debugger-detach" | "tab-remove";
}>) => void;

type PendingCreatedTarget = Readonly<{
  tabId: number;
  resolve(target: ExtensionDebugTarget): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
}>;

type MainFrame = Readonly<{ loaderId: string; url: string }>;

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
      const deterministicTargetRef = `target-tab-${target.tabId}`;
      const targetRef = this.activeTarget?.tabId === target.tabId
        ? this.activeTarget.targetRef
        : this.attachedTabId === target.tabId && this.parkedLoaderIds.has(deterministicTargetRef)
          ? deterministicTargetRef
          : null;
      if (!targetRef) return;
      this.targets.invalidateTab(target.tabId);
      this.parkedLoaderIds.delete(targetRef);
      this.activeTarget = null;
      this.activeLoaderId = null;
      this.attachedTabId = null;
      this.navigationPublication = null;
      this.reportTargetFailure({ targetRef, reason, runtimeEventType: "debugger-detach" });
      void this.send("TARGET_REVOKE", { targetRef });
    });
    this.chromeApi.debugger.onEvent.addListener((target, method, parameters) => {
      if (method !== "Page.frameNavigated" || this.activeTarget?.tabId !== target.tabId) return;
      const frame = asRecord(asRecord(parameters)?.frame);
      if (!frame || typeof frame.parentId === "string"
        || typeof frame.url !== "string" || typeof frame.loaderId !== "string") return;
      void this.publishMainFrameNavigation(frame.url, "", frame.loaderId);
    });
    this.chromeApi.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === "complete" && this.pendingCreatedTarget?.tabId === tabId) {
        this.completeCreatedTarget(tabId, tab);
      }
    });
    this.chromeApi.tabs.onRemoved?.addListener((tabId) => {
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
      this.reportTargetFailure({ targetRef, reason: "tab-removed", runtimeEventType: "tab-remove" });
      void this.send("TARGET_REVOKE", { targetRef });
    });
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    return this.targets.resolve(targetRef, documentRef);
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
      try { await this.chromeApi.tabs.remove(candidate.tabId); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw new Error("BROWSER_DEVTOOLS_CONFLICT", { cause: error });
    }
    try {
      await this.debuggerRuntime.send(candidate.tabId, "Page.enable");
      const mainFrame = await this.readMainFrame(candidate.tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      const target = this.targets.claimOperatorTarget(candidate.tabId);
      this.activeTarget = target;
      this.activeLoaderId = mainFrame.loaderId;
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        url: mainFrame.url,
        title: candidate.title,
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
    this.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
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
      const result = await executeRegisteredDomIntent(this.debuggerRuntime, target, command.intent);
      this.targets.resolve(target.targetRef, target.documentRef);
      return result;
    }
    if (command.kind === "observe") {
      const result = await executeRegisteredDomIntent(this.debuggerRuntime, target, { kind: "document" });
      this.targets.resolve(target.targetRef, target.documentRef);
      return result;
    }
    if (command.kind === "wait") return this.executeWait(command.durationMs);
    if (command.kind === "navigate") return this.executeNavigation(target, command.url, command.title);
    if (command.kind === "park-target") {
      await this.parkActiveTarget();
      return { parked: true };
    }
    if (command.kind === "close-target") {
      await this.debuggerRuntime.send(target.tabId, "Page.close");
      await this.releaseActiveTarget();
      return { closed: true };
    }
    if (command.kind === "file-input") {
      return executeExtensionFileInput({
        runtime: this.debuggerRuntime,
        target,
        assertCurrent: (targetRef, documentRef) => { this.targets.resolve(targetRef, documentRef); },
        selector: command.selector,
        grantRefs: command.grantRefs,
        resolvedFilePaths: command.resolvedFilePaths,
      });
    }
    if (command.kind === "authenticated-media") {
      return executeAuthenticatedMedia(
        this.debuggerRuntime, target, command.assistantTurnId, command.semanticMediaId,
      );
    }
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }

  private async createProductionCandidate(): Promise<ExtensionDebugTarget> {
    const created = await this.chromeApi.tabs.create({ active: false, url: GPT_WEB_START_URL });
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
      let mainFrame = await this.readMainFrame(parked.tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      if (resetToStart) {
        const response = asRecord(await this.debuggerRuntime.send(
          parked.tabId, "Page.navigate", { url: GPT_WEB_START_URL },
        ));
        mainFrame = typeof response?.loaderId === "string"
          ? { loaderId: response.loaderId, url: GPT_WEB_START_URL }
          : await this.readMainFrame(parked.tabId);
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
        url: mainFrame.url,
        title: "",
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
      candidates = (await this.chromeApi.debugger.getTargets()).filter((candidate) =>
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
      const mainFrame = await this.readMainFrame(tabId);
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
    return new Promise<ExtensionDebugTarget>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.rejectPendingCreatedTarget("BROWSER_TARGET_INVALID");
      }, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
      this.pendingCreatedTarget = { tabId, resolve, reject, timeout };
    });
  }

  private completeCreatedTarget(
    tabId: number,
    tab: Readonly<{ id?: number; url?: string; title?: string }>,
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
      this.rejectPendingCreatedTarget("BROWSER_TARGET_INVALID");
      return;
    }
    this.pendingCreatedTarget = null;
    globalThis.clearTimeout(pending.timeout);
    pending.resolve(target);
  }

  private rejectPendingCreatedTarget(reasonCode: string): void {
    const pending = this.pendingCreatedTarget;
    if (!pending) return;
    this.pendingCreatedTarget = null;
    globalThis.clearTimeout(pending.timeout);
    void this.chromeApi.tabs.remove(pending.tabId).catch((error: unknown) => {
      this.reportTargetFailure({
        targetRef: `job-owned-tab:${pending.tabId}`,
        reason: error instanceof Error ? error.name : "TabRemoveError",
        runtimeEventType: "tab-remove",
      });
    });
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
    await this.chromeApi.tabs.remove(tabId).catch((error) => { cleanupErrors.push(error); });
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "BROWSER_TARGET_CLEANUP_FAILED");
  }

  private async readMainFrame(tabId: number): Promise<MainFrame> {
    const result = asRecord(await this.debuggerRuntime.send(tabId, "Page.getFrameTree"));
    const frameTree = asRecord(result?.frameTree);
    const frame = asRecord(frameTree?.frame);
    if (!frame || typeof frame.url !== "string" || typeof frame.loaderId !== "string") {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    return { loaderId: frame.loaderId, url: frame.url };
  }

  private async executeWait(durationMs: number): Promise<Readonly<{ waitedMs: number }>> {
    if (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > BROWSER_COMMAND_DEFAULT_DEADLINE_MS) {
      throw new Error("BROWSER_CAPABILITY_REJECTED");
    }
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, durationMs));
    return { waitedMs: durationMs };
  }

  private async executeNavigation(target: ExtensionExactTarget, url: string, title: string): Promise<Record<string, unknown>> {
    const current = await executeRegisteredDomIntent(
      this.debuggerRuntime,
      target,
      { kind: "document" },
    ) as Readonly<{ url: string }>;
    const destination = new URL(url);
    if (destination.protocol !== "https:" || destination.origin !== new URL(current.url).origin) {
      throw new Error("BROWSER_ORIGIN_REJECTED");
    }
    const response = asRecord(await this.debuggerRuntime.send(target.tabId, "Page.navigate", { url }));
    const observed = typeof response?.loaderId === "string" ? { loaderId: response.loaderId, url: destination.href } : await this.readMainFrame(target.tabId);
    const next = await this.publishMainFrameNavigation(observed.url, title, observed.loaderId);
    return { targetRef: next.targetRef, documentRef: next.documentRef, navigationEpoch: next.navigationEpoch };
  }

  private async publishMainFrameNavigation(url: string, title: string, loaderId: string): Promise<ExtensionExactTarget> {
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
    const promise = this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(next, { url, title }));
    this.navigationPublication = { loaderId, promise };
    try { await promise; } finally {
      if (this.navigationPublication?.promise === promise) this.navigationPublication = null;
    }
    return next;
  }

}
