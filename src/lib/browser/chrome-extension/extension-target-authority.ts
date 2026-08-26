import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { GPT_WEB_CHAT_START_URL, requireGptWebChatPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "./extension-runtime-types.js";

type TargetFrameSender = (
  kind: "TARGET_CLAIM" | "TARGET_REVOKE",
  body: Record<string, unknown>,
) => Promise<void>;

type DebuggerDetachReporter = (input: Readonly<{
  targetRef: string;
  reason: string;
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
  private pendingCreatedTarget: PendingCreatedTarget | null = null;
  private navigationPublication: Readonly<{ loaderId: string; promise: Promise<void> }> | null = null;

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: TargetFrameSender,
    private readonly reportDebuggerDetach: DebuggerDetachReporter,
  ) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
  }

  public start(): void {
    this.chromeApi.debugger.onDetach.addListener((target, reason) => {
      if (this.activeTarget?.tabId !== target.tabId) return;
      const targetRef = this.activeTarget.targetRef;
      this.targets.invalidateTab(target.tabId);
      this.activeTarget = null;
      this.activeLoaderId = null;
      this.navigationPublication = null;
      this.reportDebuggerDetach({ targetRef, reason });
      void this.send("TARGET_REVOKE", { targetRef });
    });
    this.chromeApi.debugger.onEvent.addListener((target, method, parameters) => {
      if (method !== "Page.frameNavigated" || this.activeTarget?.tabId !== target.tabId) return;
      const frame = asRecord(asRecord(parameters)?.frame);
      if (!frame || typeof frame.parentId === "string"
        || typeof frame.url !== "string" || typeof frame.loaderId !== "string") return;
      void this.publishMainFrameNavigation(frame.url, "", frame.loaderId);
    });
    this.chromeApi.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.status === "complete" && this.pendingCreatedTarget?.tabId === tabId) {
        void this.completeCreatedTarget(tabId, true);
      }
    });
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    return this.targets.resolve(targetRef, documentRef);
  }

  public async claimPreauthorizedChatGptTarget(): Promise<void> {
    if (this.activeTarget || this.pendingCreatedTarget) throw new Error("BROWSER_TARGET_INVALID");
    const candidate = await this.resolvePreauthorizedCandidate();
    if (candidate.attached || candidate.tabId === undefined) throw new Error("BROWSER_DEVTOOLS_CONFLICT");
    try {
      await this.debuggerRuntime.attach(candidate.tabId);
    } catch {
      throw new Error("BROWSER_DEVTOOLS_CONFLICT");
    }
    try {
      await this.debuggerRuntime.send(candidate.tabId, "Page.enable");
      const mainFrame = await this.readMainFrame(candidate.tabId);
      requireGptWebChatPolicyForUrl(mainFrame.url);
      const target = this.targets.claimOperatorTarget(candidate.tabId);
      this.activeTarget = target;
      this.activeLoaderId = mainFrame.loaderId;
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        url: mainFrame.url,
        title: candidate.title,
      }));
    } catch (error) {
      await this.releaseActiveTarget(false);
      throw error;
    }
  }

  public async releaseActiveTarget(notifyWorkbench = true): Promise<void> {
    this.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    const target = this.activeTarget;
    if (!target) return;
    this.activeTarget = null;
    this.activeLoaderId = null;
    this.navigationPublication = null;
    this.targets.remove(target.targetRef);
    await this.debuggerRuntime.detach(target.tabId);
    if (notifyWorkbench) await this.send("TARGET_REVOKE", { targetRef: target.targetRef });
  }

  public async executeRegisteredCommand(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
  ): Promise<unknown> {
    if (command.kind === "dom-intent") {
      return executeRegisteredDomIntent(this.debuggerRuntime, target, command.intent);
    }
    if (command.kind === "observe") {
      return executeRegisteredDomIntent(this.debuggerRuntime, target, { kind: "document" });
    }
    if (command.kind === "wait") return this.executeWait(command.durationMs);
    if (command.kind === "navigate") return this.executeNavigation(target, command.url, command.title);
    if (command.kind === "close-target") {
      await this.debuggerRuntime.send(target.tabId, "Page.close");
      await this.releaseActiveTarget();
      return { closed: true };
    }
    if (command.kind === "file-input") {
      return this.executeFileInput(target, command.selector, command.grantRefs, command.resolvedFilePaths);
    }
    throw new Error("BROWSER_FILE_GRANT_INVALID");
  }

  private async resolvePreauthorizedCandidate(): Promise<ExtensionDebugTarget> {
    const matching = (await this.chromeApi.debugger.getTargets()).filter(isPreauthorizedChatGptTarget);
    if (matching.length > 1) throw new Error("BROWSER_TARGET_INVALID");
    if (matching[0]) return matching[0];
    const created = await this.chromeApi.tabs.create({ active: false, url: GPT_WEB_CHAT_START_URL });
    if (!Number.isInteger(created.id)) throw new Error("BROWSER_TARGET_INVALID");
    return this.waitForCreatedTarget(created.id!);
  }

  private waitForCreatedTarget(tabId: number): Promise<ExtensionDebugTarget> {
    if (this.pendingCreatedTarget) throw new Error("BROWSER_TARGET_INVALID");
    return new Promise<ExtensionDebugTarget>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.rejectPendingCreatedTarget("BROWSER_TARGET_INVALID");
      }, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
      this.pendingCreatedTarget = { tabId, resolve, reject, timeout };
      void this.completeCreatedTarget(tabId, false);
    });
  }

  private async completeCreatedTarget(tabId: number, pageComplete: boolean): Promise<void> {
    const pending = this.pendingCreatedTarget;
    if (!pending || pending.tabId !== tabId) return;
    const target = (await this.chromeApi.debugger.getTargets()).find((candidate) => candidate.type === "page" && candidate.tabId === tabId);
    if (!target || !isPreauthorizedChatGptTarget(target)) {
      if (pageComplete) this.rejectPendingCreatedTarget("BROWSER_ORIGIN_REJECTED");
      return;
    }
    this.pendingCreatedTarget = null;
    globalThis.clearTimeout(pending.timeout);
    if (target.attached) pending.reject(new Error("BROWSER_DEVTOOLS_CONFLICT"));
    else pending.resolve(target);
  }

  private rejectPendingCreatedTarget(reasonCode: string): void {
    const pending = this.pendingCreatedTarget;
    if (!pending) return;
    this.pendingCreatedTarget = null;
    globalThis.clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
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
      requireGptWebChatPolicyForUrl(url);
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

  private async executeFileInput(
    target: ExtensionExactTarget,
    selector: string,
    grantRefs: readonly string[],
    resolvedFilePaths: readonly string[],
  ): Promise<Readonly<{ selectedFileCount: number }>> {
    if (selector !== "#upload-files" || grantRefs.length < 1 || grantRefs.length > 20
      || resolvedFilePaths.length !== grantRefs.length || new Set(grantRefs).size !== grantRefs.length
      || resolvedFilePaths.some((filePath) => !filePath.startsWith("/"))) {
      throw new Error("BROWSER_FILE_GRANT_INVALID");
    }
    const document = asRecord(await this.debuggerRuntime.send(
      target.tabId,
      "DOM.getDocument",
      { depth: -1, pierce: false },
    ));
    const root = asRecord(document?.root);
    if (!root || typeof root.nodeId !== "number") throw new Error("BROWSER_TARGET_INVALID");
    const selection = asRecord(await this.debuggerRuntime.send(
      target.tabId,
      "DOM.querySelectorAll",
      { nodeId: root.nodeId, selector: "#upload-files" },
    ));
    const nodeIds = Array.isArray(selection?.nodeIds)
      ? selection.nodeIds.filter((value): value is number => typeof value === "number")
      : [];
    if (nodeIds.length !== 1) throw new Error("BROWSER_TARGET_INVALID");
    await this.debuggerRuntime.send(target.tabId, "DOM.setFileInputFiles", {
      nodeId: nodeIds[0],
      files: [...resolvedFilePaths],
    });
    return { selectedFileCount: resolvedFilePaths.length };
  }
}

const isPreauthorizedChatGptTarget = (target: ExtensionDebugTarget): boolean => {
  if (target.type !== "page" || !Number.isInteger(target.tabId)) return false;
  try {
    requireGptWebChatPolicyForUrl(target.url);
    return true;
  } catch {
    return false;
  }
};
