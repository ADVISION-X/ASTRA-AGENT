import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import {
  GPT_WEB_START_URL,
  gptWebClaimOriginForUrl,
  requireCanonicalGptConversationUrl,
  requireGptWebPolicyForUrl,
} from "../exact-target/browser-site-policy-registry.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { RegisteredExtensionCommand } from "./command-registry.js";
import { executeRegisteredExtensionCommand } from "./extension-command-runtime.js";
import { ExtensionCreatedTarget, type TargetFailureReporter } from "./extension-created-target.js";
import { ExtensionInteractionReadiness } from "./extension-interaction-readiness.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import {
  debuggerDetachFailure,
  exactAssistantReadLoaderId,
  readExtensionMainFrame,
} from "./extension-target-observation.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "./extension-runtime-types.js";
import { ChatGptPageAccessGate } from "./chatgpt-page-access-gate.js";
import {
  knownGptRateLimitBlockerReceipt,
  observeKnownGptRateLimitDialog,
} from "./gpt-rate-limit-dialog.js";

type TargetFrameSender = (
  kind: "TARGET_CLAIM" | "TARGET_REVOKE",
  body: Record<string, unknown>,
) => Promise<void>;

export class ExtensionTargetAuthority {
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private activeTarget: ExtensionExactTarget | null = null;
  private readonly createdTarget: ExtensionCreatedTarget;
  private readonly interactionReadiness: ExtensionInteractionReadiness;
  private readonly pageAccessGate = new ChatGptPageAccessGate();
  private navigationPublication: Promise<void> | null = null;

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: TargetFrameSender,
    private readonly reportTargetFailure: TargetFailureReporter,
  ) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
    this.debuggerRuntime.requireLogicalPageAccessCycles();
    this.createdTarget = new ExtensionCreatedTarget(this.debuggerRuntime, reportTargetFailure);
    this.interactionReadiness = new ExtensionInteractionReadiness(
      this.debuggerRuntime,
      (targetRef, documentRef) => this.targets.resolve(targetRef, documentRef),
      () => Object.freeze({ target: this.activeTarget, loaderId: this.activeTarget?.loaderId ?? null }),
    );
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
      this.interactionReadiness.recordActiveTab(activeInfo.windowId, activeInfo.tabId);
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
    const known = this.targets.findByTabId(tabId);
    if (!known) return;
    this.targets.invalidateTab(tabId);
    if (this.activeTarget?.tabId === tabId) {
      this.activeTarget = null;
      this.navigationPublication = null;
    }
    await this.publishTargetFailure({
      targetRef: known.targetRef, runtimeEventType: "debugger-detach", ...debuggerDetachFailure(reason),
    });
  }

  private async consumeFrameNavigationAfterBarrier(
    tabId: number,
  ): Promise<void> {
    return this.debuggerRuntime.withLogicalPageAccess(
      () => this.pageAccessGate.enter(),
      () => this.consumeFrameNavigationCycle(tabId),
    );
  }

  private async consumeFrameNavigationCycle(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    if (this.activeTarget?.tabId !== tabId) return;
    if (this.navigationPublication) return void await this.navigationPublication;
    const frame = await readExtensionMainFrame(this.debuggerRuntime, tabId);
    await this.publishMainFrameNavigation(frame.url, frame.loaderId);
  }

  private async consumeTabRemovalAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const known = this.targets.findByTabId(tabId);
    if (!known) return;
    this.targets.invalidateTab(tabId);
    if (this.activeTarget?.tabId === tabId) {
      this.activeTarget = null;
      this.navigationPublication = null;
    }
    await this.publishTargetFailure({
      targetRef: known.targetRef, runtimeEventType: "tab-remove",
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

  public async acquireJobBoundChatGptTarget(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string,
  ): Promise<void> {
    return this.debuggerRuntime.withLogicalPageAccess(
      () => this.pageAccessGate.enter(),
      () => this.acquireJobBoundChatGptTargetCycle(targetMode, jobRefHash, parentConversationUrl),
    );
  }

  private async acquireJobBoundChatGptTargetCycle(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string,
  ): Promise<void> {
    const continuationUrl = targetMode === "authorized-continuation"
      ? requireCanonicalGptConversationUrl(parentConversationUrl ?? "") : undefined;
    const requestValid = [
      ["fresh", "bound-observation", "confirmed-readback", "authorized-continuation"].includes(targetMode),
      /^sha256:[a-f0-9]{64}$/u.test(jobRefHash),
      targetMode === "authorized-continuation" || parentConversationUrl === undefined,
    ].every(Boolean);
    if (!requestValid) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    if (this.activeTarget || this.createdTarget.isPending()) throw new Error("BROWSER_TARGET_INVALID");
    const bound = this.targets.findByJobRefHash(jobRefHash);
    if (bound) return this.reacquireParkedTarget(
      bound.targetRef, targetMode === "fresh", continuationUrl,
    );
    if (targetMode === "bound-observation") throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    const candidate = await this.createProductionCandidate();
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    try {
      await this.debuggerRuntime.attach(candidate.tabId);
    } catch (error) {
      try { await this.debuggerRuntime.removeTab(candidate.tabId); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw new Error("BROWSER_DEVTOOLS_CONFLICT", { cause: error });
    }
    try {
      await this.debuggerRuntime.send(candidate.tabId, "Page.enable");
      let mainFrame = await readExtensionMainFrame(this.debuggerRuntime, candidate.tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      if (continuationUrl) {
        await this.debuggerRuntime.send(candidate.tabId, "Page.navigate", { url: continuationUrl });
        mainFrame = await readExtensionMainFrame(this.debuggerRuntime, candidate.tabId);
        if (requireCanonicalGptConversationUrl(mainFrame.url) !== continuationUrl) {
          throw new Error("BROWSER_POSTCONDITION_FAILED");
        }
      }
      const target = this.targets.claimOperatorTarget(candidate.tabId, jobRefHash, mainFrame.loaderId);
      this.activeTarget = target;
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

  public async releaseJobBoundChatGptTarget(jobRefHash: `sha256:${string}`): Promise<void> {
    if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)
      || this.activeTarget || this.createdTarget.isPending()) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    const bound = this.targets.findByJobRefHash(jobRefHash);
    if (!bound) {
      await this.send("TARGET_REVOKE", {
        targetRef: null, jobRefHash, releaseOutcome: "absent",
      });
      return;
    }
    this.targets.remove(bound.targetRef);
    try {
      await this.debuggerRuntime.removeTab(bound.tabId);
      this.debuggerRuntime.forgetAttached(bound.tabId);
    } catch (error) {
      this.targets.restore(bound);
      throw new AggregateError([error], "BROWSER_TARGET_CLEANUP_FAILED");
    }
    await this.send("TARGET_REVOKE", {
      targetRef: bound.targetRef, jobRefHash, releaseOutcome: "released",
    });
  }

  public async releaseActiveTarget(notifyWorkbench = true): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    await this.createdTarget.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    const target = this.activeTarget;
    if (!target) return;
    this.activeTarget = null;
    this.navigationPublication = null;
    if (notifyWorkbench) {
      this.targets.remove(target.targetRef);
    }
    if (notifyWorkbench) {
      await this.debuggerRuntime.detach(target.tabId);
    }
    if (notifyWorkbench) await this.send("TARGET_REVOKE", { targetRef: target.targetRef });
  }

  public async parkActiveTarget(): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const target = this.activeTarget;
    if (!target || !target.loaderId) throw new Error("BROWSER_TARGET_INVALID");
    this.activeTarget = null;
    this.navigationPublication = null;
    await this.send("TARGET_REVOKE", { targetRef: target.targetRef });
  }

  public async executeRegisteredCommand(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
    mutationClass: RegisteredExtensionCommand["mutationClass"],
    assertCommandActive: () => void = () => undefined,
  ): Promise<unknown> {
    const acknowledgeRateLimit = command.kind === "dom-intent"
      && command.intent.kind === "acknowledgeKnownGptRateLimit";
    const transientDomConfirmationStage = command.kind === "wait"
      ? command.transientDomConfirmationStage : undefined;
    return this.debuggerRuntime.withLogicalPageAccess(
      acknowledgeRateLimit ? async () => undefined
        : transientDomConfirmationStage === undefined ? () => this.pageAccessGate.enter()
          : () => this.pageAccessGate.awaitTransientDomConfirmationStage(
            transientDomConfirmationStage,
          ),
      () => this.executeRegisteredCommandCycle(
        command, target, mutationClass, assertCommandActive,
      ),
      acknowledgeRateLimit ? "rate-limit-ack" : "ordinary",
    );
  }

  private async executeRegisteredCommandCycle(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
    mutationClass: RegisteredExtensionCommand["mutationClass"],
    assertCommandActive: () => void,
  ): Promise<unknown> {
    const execute = async (): Promise<unknown> => {
      assertCommandActive();
      if (!(command.kind === "dom-intent"
        && (command.intent.kind === "acknowledgeKnownGptRateLimit"
          || command.intent.kind === "readKnownGptRateLimitClearance"))) {
        const blocker = await observeKnownGptRateLimitDialog(this.debuggerRuntime, target);
        assertCommandActive();
        if (blocker) return knownGptRateLimitBlockerReceipt(blocker);
      }
      if (command.kind === "dom-intent") {
        if (command.intent.kind === "selectExactGptConversation") {
          return this.executeConversationSelection(target, command.intent.canonicalConversationUrl);
        }
        const assertCurrent = (): void => {
          assertCommandActive();
          this.targets.resolve(target.targetRef, target.documentRef);
        };
        const expectedMainFrameLoaderId = exactAssistantReadLoaderId(
          command.intent.kind, target, this.activeTarget, this.activeTarget?.loaderId ?? null,
        );
        if (command.intent.kind === "readExactAssistantTurn" && !expectedMainFrameLoaderId) {
          throw new Error("BROWSER_DOCUMENT_INVALID");
        }
        const result = await executeRegisteredDomIntent(
          this.debuggerRuntime, target, command.intent, assertCurrent,
          expectedMainFrameLoaderId ?? undefined,
        );
        if (command.intent.kind === "renameExactGptConversation") return result;
        assertCurrent();
        return result;
      }
      return executeRegisteredExtensionCommand(this.debuggerRuntime, target, command, {
        assertCurrent: () => {
          assertCommandActive();
          this.targets.resolve(target.targetRef, target.documentRef);
        },
        parkTarget: () => this.parkActiveTarget(),
      });
    };

    if (mutationClass === "mutation") {
      return this.interactionReadiness.executeMutation(target, execute);
    }
    return mutationClass === "observation"
      ? this.interactionReadiness.executeObservation(target, execute)
      : execute();
  }

  public async retireInvalidCommandTarget(
    error: unknown,
    intentKind: string | null,
  ): Promise<void> {
    const reasonCode = error instanceof Error ? error.message : "";
    if (!["BROWSER_DOCUMENT_INVALID", "BROWSER_ORIGIN_REJECTED", "BROWSER_TARGET_INVALID"]
      .includes(reasonCode)
      && !(reasonCode === "BROWSER_POSTCONDITION_FAILED"
        && intentKind === "selectExactGptConversation")) return;
    await this.parkActiveTarget();
  }

  private async createProductionCandidate(): Promise<ExtensionDebugTarget> {
    const created = await this.debuggerRuntime.createProductionTab(GPT_WEB_START_URL);
    if (!Number.isInteger(created.id)) throw new Error("BROWSER_TARGET_INVALID");
    return this.createdTarget.waitForCreatedTarget(created.id!);
  }

  private async reacquireParkedTarget(
    targetRef: string,
    resetToStart = false,
    continuationUrl?: string,
  ): Promise<void> {
    const parked = this.targets.read(targetRef);
    await this.debuggerRuntime.attach(parked.tabId);
    try {
      await this.debuggerRuntime.send(parked.tabId, "Page.enable");
      let tab = await this.debuggerRuntime.readTab(parked.tabId);
      if (tab.discarded === true || tab.status !== "complete") {
        throw new Error("BROWSER_TARGET_INVALID");
      }
      if (tab.active !== true) {
        await this.debuggerRuntime.activateTab(parked.tabId);
        tab = await this.debuggerRuntime.readTab(parked.tabId);
      }
      if (tab.active !== true || tab.discarded === true || tab.status !== "complete") {
        throw new Error("BROWSER_TARGET_INVALID");
      }
      let mainFrame = await readExtensionMainFrame(this.debuggerRuntime, parked.tabId);
      requireGptWebPolicyForUrl(mainFrame.url);
      if (continuationUrl
        && requireCanonicalGptConversationUrl(mainFrame.url) !== continuationUrl) {
        throw new Error("BROWSER_POSTCONDITION_FAILED");
      }
      if (resetToStart) {
        await this.debuggerRuntime.send(
          parked.tabId, "Page.navigate", { url: GPT_WEB_START_URL },
        );
        await this.debuggerRuntime.awaitPageReadPermission();
        mainFrame = await readExtensionMainFrame(this.debuggerRuntime, parked.tabId);
        if (mainFrame.loaderId === parked.loaderId) {
          throw new Error("BROWSER_DOCUMENT_INVALID");
        }
      }
      const target = mainFrame.loaderId === parked.loaderId
        ? parked : this.targets.advanceDocument(targetRef, mainFrame.loaderId);
      this.activeTarget = target;
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        claimOrigin: gptWebClaimOriginForUrl(mainFrame.url),
      }));
    } catch (error) {
      this.activeTarget = null;
      throw error;
    }
  }

  private async discardJobOwnedTarget(tabId: number): Promise<void> {
    const cleanupErrors: unknown[] = [];
    if (this.activeTarget?.tabId === tabId) {
      await this.releaseActiveTarget().catch((error) => { cleanupErrors.push(error); });
    } else {
      await this.debuggerRuntime.detach(tabId).catch((error) => { cleanupErrors.push(error); });
    }
    await this.debuggerRuntime.removeTab(tabId).catch((error) => { cleanupErrors.push(error); });
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "BROWSER_TARGET_CLEANUP_FAILED");
  }

  private async executeConversationSelection(
    target: ExtensionExactTarget,
    canonicalConversationUrl: string,
  ): Promise<Record<string, unknown>> {
    const expected = requireCanonicalGptConversationUrl(canonicalConversationUrl);
    this.targets.resolve(target.targetRef, target.documentRef);
    const currentFrame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    requireGptWebPolicyForUrl(currentFrame.url);
    const current = new URL(currentFrame.url);
    if (`${current.origin}${current.pathname}` === expected) return { targetRef: target.targetRef,
      documentRef: target.documentRef, navigationEpoch: target.navigationEpoch };
    if (this.navigationPublication) throw new Error("BROWSER_TARGET_INVALID");
    let releasePublication!: () => void;
    const publication = new Promise<void>((resolve) => { releasePublication = resolve; });
    this.navigationPublication = publication;
    try {
      await this.debuggerRuntime.send(target.tabId, "Page.navigate", { url: expected });
      const mainFrame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
      if (requireCanonicalGptConversationUrl(mainFrame.url) !== expected) {
        throw new Error("BROWSER_POSTCONDITION_FAILED");
      }
      const next = await this.publishMainFrameNavigation(mainFrame.url, mainFrame.loaderId, true);
      return { targetRef: next.targetRef, documentRef: next.documentRef,
        navigationEpoch: next.navigationEpoch };
    } finally {
      releasePublication();
      if (this.navigationPublication === publication) this.navigationPublication = null;
    }
  }

  private async publishMainFrameNavigation(
    url: string,
    loaderId: string,
    ownsPublication = false,
  ): Promise<ExtensionExactTarget> {
    await this.debuggerRuntime.awaitPageReadPermission();
    if (this.navigationPublication && !ownsPublication) {
      await this.navigationPublication;
      const published = this.activeTarget;
      if (!published) throw new Error("BROWSER_TARGET_INVALID");
      return published;
    }
    const current = this.activeTarget;
    if (!current) throw new Error("BROWSER_TARGET_INVALID");
    if (loaderId === current.loaderId) return current;
    try {
      requireGptWebPolicyForUrl(url);
    } catch (error) {
      await this.parkActiveTarget();
      throw error;
    }
    const next = this.targets.advanceDocument(current.targetRef, loaderId);
    this.activeTarget = next;
    const promise = this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(next, {
      claimOrigin: gptWebClaimOriginForUrl(url),
    }));
    await promise;
    return next;
  }

}
