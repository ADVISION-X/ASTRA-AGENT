import type { BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";
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
import { releaseJobBoundTarget } from "./extension-target-release.js";
import { preflightTargetAcquisition } from "./extension-target-acquisition.js";
import { ExtensionInteractionReadiness } from "./extension-interaction-readiness.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import { ExtensionTargetLoss } from "./extension-target-loss.js";
import {
  exactAssistantReadLoaderId,
  readExtensionMainFrame,
} from "./extension-target-observation.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "./extension-runtime-types.js";
import { ChatGptPageAccessGate } from "./chatgpt-page-access-gate.js";
import {
  knownGptRateLimitAbsentEnvelope,
  knownGptRateLimitBlockerReceipt,
  observeKnownGptRateLimitDialog,
  unrecognizedGptDialogReceipt,
} from "./gpt-rate-limit-dialog.js";
type TargetFrameSender = (
  kind: "TARGET_CLAIM" | "TARGET_REVOKE",
  body: Record<string, unknown>,
) => Promise<void>;
/** The original failure stays authoritative; a failed Chrome-state probe is recorded as its cause. */
const keepOriginalError = (error: unknown, probeError: unknown): unknown => {
  if (error instanceof Error && error.cause === undefined) error.cause = probeError;
  return error;
};
export class ExtensionTargetAuthority {
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private activeTarget: ExtensionExactTarget | null = null;
  private readonly createdTarget: ExtensionCreatedTarget;
  private readonly interactionReadiness: ExtensionInteractionReadiness;
  private readonly pageAccessGate = new ChatGptPageAccessGate();
  private readonly targetLoss: ExtensionTargetLoss;
  private navigationPublication: Promise<void> | null = null;
  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: TargetFrameSender,
    reportTargetFailure: TargetFailureReporter,
    private readonly awaitOldCommandHandlers: () => Promise<void>,
  ) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi);
    this.debuggerRuntime.requireLogicalPageAccessCycles();
    this.createdTarget = new ExtensionCreatedTarget(this.debuggerRuntime, reportTargetFailure);
    this.interactionReadiness = new ExtensionInteractionReadiness(
      this.debuggerRuntime,
      (targetRef, documentRef) => this.targets.resolve(targetRef, documentRef),
      () => Object.freeze({ target: this.activeTarget, loaderId: this.activeTarget?.loaderId ?? null }),
    );
    this.targetLoss = new ExtensionTargetLoss({
      debuggerRuntime: this.debuggerRuntime, targets: this.targets,
      createdTarget: this.createdTarget, reportTargetFailure,
      readActiveTabId: () => this.activeTarget?.tabId ?? null,
      clearActiveTarget: () => this.clearActiveTarget(),
      sendRevoke: (body) => this.send("TARGET_REVOKE", body),
    });
  }
  public start(): void {
    this.chromeApi.debugger.onDetach.addListener((target, reason) => {
      const known = this.targets.findByTabId(target.tabId);
      void this.targetLoss.consumeDebuggerDetach(target.tabId, reason, known ?? null);
    });
    this.chromeApi.debugger.onEvent.addListener((target, method) => {
      if (method !== "Page.frameNavigated" || this.activeTarget?.tabId !== target.tabId) return;
      void this.consumeFrameNavigationAfterBarrier(target.tabId);
    });
    this.chromeApi.tabs.onUpdated.addListener((tabId) => {
      void this.createdTarget.onTabUpdated(tabId);
    });
    this.chromeApi.tabs.onActivated.addListener((activeInfo) => {
      this.interactionReadiness.recordActiveTab(activeInfo.windowId, activeInfo.tabId);
    });
    this.chromeApi.tabs.onRemoved?.addListener((tabId) => {
      const known = this.targets.findByTabId(tabId);
      void this.targetLoss.consumeTabRemoval(tabId, known ?? null);
    });
  }
  private clearActiveTarget(): void {
    this.activeTarget = null;
    this.navigationPublication = null;
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
  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    return this.targets.resolve(targetRef, documentRef);
  }
  public async acquireJobBoundChatGptTarget(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string,
    assertInput: () => void = () => undefined,
  ): Promise<void> {
    return this.debuggerRuntime.withLogicalPageAccess(
      () => this.pageAccessGate.enter(),
      () => this.debuggerRuntime.withProviderInputGuard(
        { started: false, physicalInputCount: 0, mutationKind: "target-acquisition" }, assertInput,
        () => this.acquireJobBoundChatGptTargetCycle(targetMode, jobRefHash, parentConversationUrl, assertInput),
      ),
    );
  }
  private async acquireJobBoundChatGptTargetCycle(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`,
    parentConversationUrl: string | undefined,
    assertInput: () => void,
  ): Promise<void> {
    const { continuationUrl, bound } = await preflightTargetAcquisition({
      targetMode, jobRefHash, parentConversationUrl,
      createdTarget: this.createdTarget, targets: this.targets, activeTarget: this.activeTarget,
    });
    if (bound && await this.reacquireParkedTarget(
      bound.targetRef, targetMode === "fresh", continuationUrl, assertInput,
    )) return;
    if (targetMode === "bound-observation") {
      throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    }
    const candidate = await this.createdTarget.createProductionCandidate();
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    await this.attachOrRemoveCandidate(candidate, candidate.tabId);
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
      assertInput();
      const target = this.targets.claimOperatorTarget(
        candidate.tabId, jobRefHash, mainFrame.loaderId, candidate.id,
      );
      await this.claimActiveTarget(target, mainFrame.url);
    } catch (error) {
      try { await this.discardJobOwnedTarget(candidate); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw error;
    }
  }
  /** Attach the debugger to the new candidate, or remove that exact candidate and report the conflict. */
  private async attachOrRemoveCandidate(
    candidate: ExtensionDebugTarget, tabId: number,
  ): Promise<void> {
    try {
      await this.debuggerRuntime.attach(tabId);
    } catch (error) {
      try { await this.createdTarget.removeExactCandidate(candidate); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw new Error("BROWSER_DEVTOOLS_CONFLICT", { cause: error });
    }
  }
  public async releaseJobBoundChatGptTarget(
    jobRefHash: `sha256:${string}`,
    releaseAuthority: BrowserTargetReleaseAuthority,
    onReleased: () => Promise<void>,
  ): Promise<void> {
    await releaseJobBoundTarget({
      targets: this.targets, debuggerRuntime: this.debuggerRuntime,
      createdTarget: this.createdTarget,
      readActiveJobRefHash: () => this.activeTarget?.jobRefHash ?? null,
      awaitOldCommandHandlers: async () => {
        await this.awaitOldCommandHandlers();
        if (releaseAuthority === "website-admin-deletion" && this.activeTarget?.jobRefHash === jobRefHash)
          await this.parkActiveTarget();
      },
      sendRevoke: async (body) => { await onReleased(); await this.send("TARGET_REVOKE", body); },
    }, jobRefHash);
  }
  public async releaseActiveTarget(notifyWorkbench = true): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    await this.createdTarget.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    const target = this.activeTarget;
    if (!target) return;
    this.clearActiveTarget();
    if (!notifyWorkbench) return;
    this.targets.remove(target.targetRef);
    await this.debuggerRuntime.detach(target.tabId);
    await this.send("TARGET_REVOKE", {
      targetRef: target.targetRef, jobRefHash: target.jobRefHash,
      documentRef: target.documentRef,
    });
  }
  public async parkActiveTarget(): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const target = this.activeTarget;
    if (!target || !target.loaderId) throw new Error("BROWSER_TARGET_INVALID");
    this.clearActiveTarget();
    await this.send("TARGET_REVOKE", { targetRef: target.targetRef,
      jobRefHash: target.jobRefHash, documentRef: target.documentRef });
  }
  public async executeRegisteredCommand(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
    mutationClass: RegisteredExtensionCommand["mutationClass"],
    exactCallIdentityHash: `sha256:${string}`,
    assertCommandActive: () => void = () => undefined,
    commandDeadlineAt?: number,
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
        command, target, mutationClass, exactCallIdentityHash,
        assertCommandActive, commandDeadlineAt,
      ),
      acknowledgeRateLimit ? "rate-limit-ack" : "ordinary",
    );
  }
  private async executeRegisteredCommandCycle(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
    mutationClass: RegisteredExtensionCommand["mutationClass"],
    exactCallIdentityHash: `sha256:${string}`,
    assertCommandActive: () => void,
    commandDeadlineAt?: number,
  ): Promise<unknown> {
    const execute = async (assertMutationReadback: () => void = assertCommandActive): Promise<unknown> => {
      const assertReadback = (): void => {
        assertMutationReadback();
        if (commandDeadlineAt !== undefined && Date.now() >= commandDeadlineAt) {
          throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED");
        }
      };
      assertCommandActive();
      if (!(command.kind === "dom-intent"
        && (command.intent.kind === "acknowledgeKnownGptRateLimit"
          || command.intent.kind === "readKnownGptRateLimitClearance"))) {
        const preflight = await observeKnownGptRateLimitDialog(
          this.debuggerRuntime, target, exactCallIdentityHash,
        );
        assertCommandActive();
        if (preflight.state === "exact_present") return knownGptRateLimitBlockerReceipt(preflight);
        if (preflight.state === "mismatch") return unrecognizedGptDialogReceipt(preflight);
        const result = await this.executeRegisteredCommandBody(
          command, target, exactCallIdentityHash, assertReadback, commandDeadlineAt,
        );
        return knownGptRateLimitAbsentEnvelope(preflight, result);
      }
      return this.executeRegisteredCommandBody(
        command, target, exactCallIdentityHash, assertReadback, commandDeadlineAt,
      );
    };
    if (mutationClass === "mutation") {
      return this.interactionReadiness.executeMutation(target, execute, assertCommandActive, command.kind === "dom-intent" ? command.intent.kind : command.kind);
    }
    return mutationClass === "observation"
      ? this.interactionReadiness.executeObservation(target, execute, assertCommandActive)
      : execute();
  }
  private async executeRegisteredCommandBody(
    command: BrowserGovernedCommand,
    target: ExtensionExactTarget,
    exactCallIdentityHash: `sha256:${string}`,
    assertCommandActive: () => void,
    commandDeadlineAt?: number,
  ): Promise<unknown> {
      if (command.kind === "dom-intent") {
        if (command.intent.kind === "selectExactGptConversation") {
          return this.executeConversationSelection(
            target, command.intent.canonicalConversationUrl, assertCommandActive,
          );
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
          expectedMainFrameLoaderId ?? undefined, commandDeadlineAt, exactCallIdentityHash,
        );
        assertCurrent();
        return result;
      }
      return executeRegisteredExtensionCommand(
        this.debuggerRuntime, target, command, {
        assertCurrent: () => {
          assertCommandActive();
          this.targets.resolve(target.targetRef, target.documentRef);
        },
        parkTarget: () => this.parkActiveTarget(),
      });
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
  private async reacquireParkedTarget(
    targetRef: string,
    resetToStart = false,
    continuationUrl: string | undefined,
    assertInput: () => void,
  ): Promise<boolean> {
    const parked = this.targets.read(targetRef);
    try {
      const live = await this.debuggerRuntime.readTargets();
      if (!live.some((item) => item.tabId === parked.tabId
        && item.id === parked.chromeTargetId)) {
        this.targets.invalidateTab(parked.tabId);
        return false;
      }
      await this.debuggerRuntime.attach(parked.tabId);
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
      if (resetToStart) mainFrame = await this.resetParkedTabToStart(parked);
      assertInput();
      const target = mainFrame.loaderId === parked.loaderId
        ? parked : this.targets.advanceDocument(targetRef, mainFrame.loaderId);
      await this.claimActiveTarget(target, mainFrame.url);
      return true;
    } catch (error) {
      this.activeTarget = null;
      try {
        const live = await this.debuggerRuntime.readTargets();
        if (!live.some((item) => item.tabId === parked.tabId
          && item.id === parked.chromeTargetId)) {
          this.targets.invalidateTab(parked.tabId);
          return false;
        }
      } catch (probeError) {
        throw keepOriginalError(error, probeError);
      }
      throw error;
    }
  }
  /** Navigate the parked Tab to the fixed start URL and require a fresh Document. */
  private async resetParkedTabToStart(parked: ExtensionExactTarget) {
    await this.debuggerRuntime.send(parked.tabId, "Page.navigate", { url: GPT_WEB_START_URL });
    await this.debuggerRuntime.awaitPageReadPermission();
    const mainFrame = await readExtensionMainFrame(this.debuggerRuntime, parked.tabId);
    if (mainFrame.loaderId === parked.loaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    return mainFrame;
  }
  private async discardJobOwnedTarget(candidate: ExtensionDebugTarget): Promise<void> {
    const tabId = candidate.tabId;
    if (tabId === undefined) throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    const cleanupErrors: unknown[] = [];
    if (this.activeTarget?.tabId === tabId) {
      await this.releaseActiveTarget().catch((error) => { cleanupErrors.push(error); });
    } else {
      await this.debuggerRuntime.detach(tabId).catch((error) => { cleanupErrors.push(error); });
    }
    await this.createdTarget.removeExactCandidate(candidate).catch((error) => { cleanupErrors.push(error); });
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "BROWSER_TARGET_CLEANUP_FAILED");
  }
  private async executeConversationSelection(
    target: ExtensionExactTarget,
    canonicalConversationUrl: string,
    assertCommandActive: () => void,
  ): Promise<Record<string, unknown>> {
    const expected = requireCanonicalGptConversationUrl(canonicalConversationUrl);
    assertCommandActive();
    this.targets.resolve(target.targetRef, target.documentRef);
    const currentFrame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    assertCommandActive();
    this.targets.resolve(target.targetRef, target.documentRef);
    requireGptWebPolicyForUrl(currentFrame.url);
    const current = new URL(currentFrame.url);
    if (`${current.origin}${current.pathname}` === expected) {
      const fresh = await this.publishMainFrameNavigation(currentFrame.url, currentFrame.loaderId);
      assertCommandActive();
      return { targetRef: fresh.targetRef,
        documentRef: fresh.documentRef, navigationEpoch: fresh.navigationEpoch };
    }
    if (this.navigationPublication) throw new Error("BROWSER_TARGET_INVALID");
    let releasePublication!: () => void;
    const publication = new Promise<void>((resolve) => { releasePublication = resolve; });
    this.navigationPublication = publication;
    try {
      const physicalTargets = await this.debuggerRuntime.readTargets();
      assertCommandActive();
      const currentTarget = this.targets.resolve(target.targetRef, target.documentRef);
      if (this.activeTarget?.targetRef !== target.targetRef
        || this.activeTarget.documentRef !== target.documentRef
        || this.activeTarget.chromeTargetId !== target.chromeTargetId
        || this.activeTarget.tabId !== target.tabId
        || currentTarget.loaderId !== target.loaderId
        || currentFrame.loaderId !== target.loaderId
        || !physicalTargets.some((candidate) => candidate.tabId === target.tabId
          && candidate.id === target.chromeTargetId && candidate.attached)) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
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
    await this.claimActiveTarget(next, url);
    return next;
  }
  private async claimActiveTarget(target: ExtensionExactTarget, url: string): Promise<void> {
    this.activeTarget = target;
    await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
      claimOrigin: gptWebClaimOriginForUrl(url),
    }));
  }
}
