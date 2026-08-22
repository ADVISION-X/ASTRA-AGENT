import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import { requireBrowserSitePolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import type { ExtensionChromeApi } from "./extension-runtime-types.js";

type TargetFrameSender = (
  kind: "TARGET_CLAIM" | "TARGET_REVOKE",
  body: Record<string, unknown>,
) => Promise<void>;

type DebuggerDetachReporter = (input: Readonly<{
  targetRef: string;
  reason: string;
}>) => void;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export class ExtensionTargetAuthority {
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private activeTarget: ExtensionExactTarget | null = null;

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
      this.reportDebuggerDetach({ targetRef, reason });
      void this.send("TARGET_REVOKE", { targetRef });
    });
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    return this.targets.resolve(targetRef, documentRef);
  }

  public async claimActiveTarget(): Promise<void> {
    const tab = (await this.chromeApi.tabs.query({ active: true, currentWindow: true }))[0];
    const tabId = tab?.id;
    if (!tab || typeof tabId !== "number" || !Number.isInteger(tabId)
      || typeof tab.url !== "string" || !tab.url.startsWith("https://")) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    requireBrowserSitePolicyForUrl(tab.url);
    await this.releaseActiveTarget();
    await this.debuggerRuntime.attach(tabId);
    const target = this.targets.claimOperatorTarget(tabId);
    this.activeTarget = target;
    try {
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        url: tab.url,
        ...(tab.title === undefined ? {} : { title: tab.title }),
      }));
    } catch (error) {
      await this.releaseActiveTarget();
      throw error;
    }
  }

  public async releaseActiveTarget(notifyWorkbench = true): Promise<void> {
    const target = this.activeTarget;
    if (!target) return;
    this.activeTarget = null;
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
    await this.debuggerRuntime.send(target.tabId, "Page.navigate", { url });
    const next = this.targets.advanceDocument(target.targetRef);
    this.activeTarget = next;
    await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(next, {
      url: destination.href,
      title,
    }));
    return {
      targetRef: next.targetRef,
      documentRef: next.documentRef,
      navigationEpoch: next.navigationEpoch,
    };
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
