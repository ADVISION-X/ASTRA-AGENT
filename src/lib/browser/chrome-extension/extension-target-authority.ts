import type { BrowserTargetReleaseAuthority } from "../exact-target/browser-target-lease.js";
import type { BrowserGovernedCommand } from "../exact-target/browser-command-actor.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { BROWSER_COMMAND_DEFAULT_DEADLINE_MS } from "../protocol/generated/browser-protocol.generated.js";
import { GPT_WEB_START_URL, gptWebClaimOriginForUrl, requireCanonicalGptConversationUrl, requireGptWebPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import type { RegisteredExtensionCommand } from "./command-registry.js";
import { executeRegisteredExtensionCommand } from "./extension-command-runtime.js";
import { ExtensionCreatedTarget, type TargetFailureReporter } from "./extension-created-target.js";
import { releaseJobBoundTarget } from "./extension-target-release.js";
import { preflightTargetAcquisition, type TargetAcquisitionMode } from "./extension-target-acquisition.js";
import { ExtensionInteractionReadiness } from "./extension-interaction-readiness.js";
import { executeRegisteredDomIntent } from "./dom-intent-runtime.js";
import { ExtensionExactTargetRegistry, type ExtensionExactTarget } from "./exact-target-runtime.js";
import { ExtensionTargetLoss } from "./extension-target-loss.js";
import { type ExtensionMainFrame, exactAssistantReadLoaderId } from "./extension-target-observation.js";
import type { ExtensionChromeApi, ExtensionDebugTarget } from "./extension-runtime-types.js";
import { ChatGptPageAccessGate } from "./chatgpt-page-access-gate.js";
import { knownGptRateLimitAbsentEnvelope, knownGptRateLimitBlockerReceipt, observeKnownGptRateLimitDialog, unrecognizedGptDialogReceipt } from "./gpt-rate-limit-dialog.js";
import { browserMutationTerminalFactShapeValid } from "../exact-target/browser-observation-receipt.js";
import { hashBrowserExtensionText } from "./websocket-actor-crypto.js";
type TargetFrameSender = (kind: "TARGET_CLAIM" | "TARGET_REVOKE", body: Record<string, unknown>) => Promise<void>;

export class ExtensionTargetAuthority {
  private readonly targets = new ExtensionExactTargetRegistry();
  private readonly debuggerRuntime: ExtensionDebuggerRuntime;
  private activeTarget: ExtensionExactTarget | null = null;
  private readonly createdTarget: ExtensionCreatedTarget;
  private readonly interactionReadiness: ExtensionInteractionReadiness;
  private readonly pageAccessGate = new ChatGptPageAccessGate();
  private readonly targetLoss: ExtensionTargetLoss;
  private navigationPublication: Promise<void> | null = null;
  public constructor(private readonly chromeApi: ExtensionChromeApi, private readonly send: TargetFrameSender,
    reportTargetFailure: TargetFailureReporter, private readonly awaitOldCommandHandlers: () => Promise<void>) {
    this.debuggerRuntime = new ExtensionDebuggerRuntime(chromeApi); this.debuggerRuntime.requireLogicalPageAccessCycles();
    this.interactionReadiness = new ExtensionInteractionReadiness(this.debuggerRuntime,
      (targetRef, documentRef) => this.targets.resolve(targetRef, documentRef),
      () => ({ target: this.activeTarget, loaderId: this.activeTarget?.loaderId ?? null }));
    this.createdTarget = new ExtensionCreatedTarget(this.debuggerRuntime, reportTargetFailure, this.interactionReadiness);
    this.targetLoss = new ExtensionTargetLoss({ debuggerRuntime: this.debuggerRuntime, targets: this.targets,
      createdTarget: this.createdTarget, reportTargetFailure, readActiveTabId: () => this.activeTarget?.tabId ?? null,
      clearActiveTarget: () => this.clearActiveTarget(), sendRevoke: body => this.send("TARGET_REVOKE", body) });
  }
  public start(): void {
    this.chromeApi.debugger.onDetach.addListener((target, reason) => {
      void this.targetLoss.consumeDebuggerDetach(target.tabId, reason, this.targets.findByTabId(target.tabId));
    });
    this.chromeApi.debugger.onEvent.addListener((target, method) => {
      if (method === "Page.frameNavigated" && target.tabId === this.activeTarget?.tabId) void this.consumeFrameNavigationAfterBarrier(target.tabId);
    });
    this.chromeApi.tabs.onUpdated.addListener(tabId => this.createdTarget.onTabUpdated(tabId));
    this.chromeApi.tabs.onActivated.addListener(info => this.interactionReadiness.recordActiveTab(info.windowId, info.tabId));
    this.chromeApi.tabs.onRemoved?.addListener(tabId => {
      void this.targetLoss.consumeTabRemoval(tabId, this.targets.findByTabId(tabId));
    });
  }
  private clearActiveTarget(): void { this.activeTarget = null; this.navigationPublication = null; }
  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget { return this.targets.resolve(targetRef, documentRef); }
  private async consumeFrameNavigationAfterBarrier(tabId: number): Promise<void> {
    await this.debuggerRuntime.withLogicalPageAccess(() => this.pageAccessGate.enter(), async () => {
      const current = this.activeTarget;
      if (!current || current.tabId !== tabId || this.navigationPublication) return;
      const assertCurrent = (): void => {
        if (this.activeTarget !== current) throw new Error("BROWSER_DOCUMENT_INVALID");
        this.targets.resolve(current.targetRef, current.documentRef);
      };
      try {
        const frame = await this.createdTarget.completeNavigation({ id: current.chromeTargetId, tabId, attached: true,
          type: "page", title: "", url: "" }, Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS, assertCurrent);
        assertCurrent(); await this.publishMainFrameNavigation(frame.url, frame.loaderId);
      } catch (error) {
        if (this.activeTarget === current) {
          this.clearActiveTarget();
          await this.send("TARGET_REVOKE", { targetRef: current.targetRef, documentRef: current.documentRef, jobRefHash: current.jobRefHash });
        }
        throw error;
      }
    });
  }
  public async acquireJobBoundChatGptTarget(targetMode: TargetAcquisitionMode, jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string, assertInput: () => void = () => undefined, deadlineAt = Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS): Promise<void> {
    const assertCurrent = (): void => { assertInput(); if (Date.now() >= deadlineAt) throw new Error("BROWSER_TARGET_ACQUISITION_TIMEOUT"); };
    await this.debuggerRuntime.withLogicalPageAccess(() => this.pageAccessGate.enter(), () => this.debuggerRuntime.withProviderInputGuard(
      { started: false, physicalInputCount: 0, mutationKind: "target-acquisition" }, assertCurrent,
      () => this.acquireJobBoundChatGptTargetCycle(targetMode, jobRefHash, parentConversationUrl, assertCurrent, deadlineAt)));
  }
  private async acquireJobBoundChatGptTargetCycle(targetMode: TargetAcquisitionMode, jobRefHash: `sha256:${string}`,
    parentConversationUrl: string | undefined, assertCurrent: () => void, deadlineAt: number): Promise<void> {
    assertCurrent();
    const preflight = await preflightTargetAcquisition({ targetMode, jobRefHash, parentConversationUrl,
      createdTarget: this.createdTarget, targets: this.targets, activeTarget: this.activeTarget });
    assertCurrent();
    const bound = await this.qualifyBoundTarget(preflight.bound, targetMode, assertCurrent);
    const candidate: ExtensionDebugTarget = bound ? { tabId: bound.tabId, id: bound.chromeTargetId, attached: true, type: "page", title: "", url: "" }
      : await this.createdTarget.createProductionCandidate(deadlineAt, assertCurrent);
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    try {
      const frame = await this.qualifyCandidateNavigation(candidate, bound, targetMode, preflight.continuationUrl, assertCurrent, deadlineAt);
      assertCurrent();
      const target = bound ? frame.loaderId === bound.loaderId ? bound : this.targets.advanceDocument(bound.targetRef, frame.loaderId)
        : this.targets.claimOperatorTarget(candidate.tabId, jobRefHash, frame.loaderId, candidate.id);
      await this.claimActiveTarget(target, frame.url, assertCurrent);
    } catch (error) {
      if (!bound) {
        try { await this.discardJobOwnedTarget(candidate); } catch (cleanupError) { throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED"); }
      }
      throw error;
    }
  }
  private async qualifyCandidateNavigation(candidate: ExtensionDebugTarget, bound: ExtensionExactTarget | null,
    targetMode: TargetAcquisitionMode, continuationUrl: string | undefined, assertCurrent: () => void,
    deadlineAt: number): Promise<ExtensionMainFrame> {
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    try { await this.debuggerRuntime.attach(candidate.tabId); } catch (error) { throw new Error("BROWSER_DEVTOOLS_CONFLICT", { cause: error }); }
    assertCurrent(); await this.debuggerRuntime.send(candidate.tabId, "Page.enable");
    if (bound && (await this.debuggerRuntime.readTab(bound.tabId)).active !== true) { assertCurrent(); await this.debuggerRuntime.activateTab(bound.tabId); }
    const reset = bound !== null && targetMode === "fresh";
    const frame = await this.createdTarget.completeNavigation(candidate, deadlineAt, assertCurrent,
      reset ? GPT_WEB_START_URL : bound ? undefined : continuationUrl, reset);
    if (bound && continuationUrl !== undefined && requireCanonicalGptConversationUrl(frame.url) !== continuationUrl) throw new Error("BROWSER_POSTCONDITION_FAILED");
    return frame;
  }
  private async qualifyBoundTarget(bound: ExtensionExactTarget | null, targetMode: TargetAcquisitionMode,
    assertCurrent: () => void): Promise<ExtensionExactTarget | null> {
    if (!bound) return null;
    const live = await this.debuggerRuntime.readTargets(); assertCurrent();
    if (live.some(target => target.tabId === bound.tabId && target.id === bound.chromeTargetId)) return bound;
    this.targets.invalidateTab(bound.tabId);
    if (targetMode === "bound-observation") throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    return null;
  }
  public async releaseJobBoundChatGptTarget(jobRefHash: `sha256:${string}`, releaseAuthority: BrowserTargetReleaseAuthority,
    onReleased: () => Promise<void>): Promise<void> {
    await releaseJobBoundTarget({ targets: this.targets, debuggerRuntime: this.debuggerRuntime, createdTarget: this.createdTarget,
      readActiveJobRefHash: () => this.activeTarget?.jobRefHash ?? null,
      awaitOldCommandHandlers: async () => {
        await this.awaitOldCommandHandlers();
        if (releaseAuthority === "website-admin-deletion" && this.activeTarget?.jobRefHash === jobRefHash) await this.parkActiveTarget();
      }, sendRevoke: async body => { await onReleased(); await this.send("TARGET_REVOKE", body); } }, jobRefHash);
  }
  public async releaseActiveTarget(notifyWorkbench = true): Promise<void> {
    await this.createdTarget.rejectPendingCreatedTarget("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    await this.debuggerRuntime.awaitPageReadPermission();
    const target = this.activeTarget;
    if (!target) return;
    this.clearActiveTarget();
    if (notifyWorkbench) {
      this.targets.remove(target.targetRef); await this.debuggerRuntime.detach(target.tabId);
      await this.send("TARGET_REVOKE", { targetRef: target.targetRef, jobRefHash: target.jobRefHash, documentRef: target.documentRef });
    }
  }
  public async parkActiveTarget(): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const target = this.activeTarget;
    if (!target || !target.loaderId) throw new Error("BROWSER_TARGET_INVALID");
    this.clearActiveTarget(); await this.send("TARGET_REVOKE", { targetRef: target.targetRef, jobRefHash: target.jobRefHash, documentRef: target.documentRef });
  }
  public async retireInvalidCommandTarget(body: Readonly<Record<string, unknown>>, permit: BrowserCommandPermit, intentKind: string | null): Promise<void> {
    const fact = body.mutationReceipt;
    const cause = browserMutationTerminalFactShapeValid(fact) ? fact.terminalReceipt.nativeCauseCode ?? fact.terminalReceipt.failureCode : body.errorCode;
    if (!["BROWSER_DOCUMENT_INVALID", "BROWSER_ORIGIN_REJECTED", "BROWSER_TARGET_INVALID"].includes(String(cause))
      && !(body.errorCode === "BROWSER_POSTCONDITION_FAILED" && intentKind === "selectExactGptConversation")) return;
    let failed: ExtensionExactTarget;
    try { failed = this.targets.resolve(permit.targetRef, permit.documentRef); } catch { return; }
    const jobRefHash = await hashBrowserExtensionText(permit.jobId);
    await this.debuggerRuntime.awaitPageReadPermission();
    const current = this.activeTarget;
    if (!current || current.jobRefHash !== jobRefHash || Object.entries({ targetRef: failed.targetRef, documentRef: failed.documentRef,
      jobRefHash: failed.jobRefHash, chromeTargetId: failed.chromeTargetId, tabId: failed.tabId })
      .some(([key, value]) => current[key as keyof ExtensionExactTarget] !== value)) return;
    this.targets.resolve(current.targetRef, current.documentRef); this.clearActiveTarget();
    await this.send("TARGET_REVOKE", { targetRef: current.targetRef, documentRef: current.documentRef, jobRefHash: current.jobRefHash });
  }
  public async executeRegisteredCommand(command: BrowserGovernedCommand, target: ExtensionExactTarget,
    mutationClass: RegisteredExtensionCommand["mutationClass"], exactCallIdentityHash: `sha256:${string}`,
    assertCommandActive: () => void = () => undefined, commandDeadlineAt?: number): Promise<unknown> {
    const ack = command.kind === "dom-intent" && command.intent.kind === "acknowledgeKnownGptRateLimit";
    const transient = command.kind === "wait" ? command.transientDomConfirmationStage : undefined;
    return this.debuggerRuntime.withLogicalPageAccess(ack ? async () => undefined : transient === undefined ? () => this.pageAccessGate.enter()
      : () => this.pageAccessGate.awaitTransientDomConfirmationStage(transient),
      () => this.executeRegisteredCommandCycle(command, target, mutationClass, exactCallIdentityHash, assertCommandActive, commandDeadlineAt),
      ack ? "rate-limit-ack" : "ordinary");
  }
  private async executeRegisteredCommandCycle(command: BrowserGovernedCommand, target: ExtensionExactTarget,
    mutationClass: RegisteredExtensionCommand["mutationClass"], exactCallIdentityHash: `sha256:${string}`,
    assertCommandActive: () => void, deadlineAt?: number): Promise<unknown> {
    const execute = async (assertReadback: () => void = assertCommandActive): Promise<unknown> => {
      const assertCurrent = (): void => { assertReadback(); if (deadlineAt !== undefined && Date.now() >= deadlineAt) throw new Error("BROWSER_COMMAND_PERMIT_EXPIRED"); };
      assertCommandActive();
      if (!(command.kind === "dom-intent" && ["acknowledgeKnownGptRateLimit", "readKnownGptRateLimitClearance"].includes(command.intent.kind))) {
        const preflight = await observeKnownGptRateLimitDialog(this.debuggerRuntime, target, exactCallIdentityHash); assertCommandActive();
        if (preflight.state === "exact_present") return knownGptRateLimitBlockerReceipt(preflight);
        if (preflight.state === "mismatch") return unrecognizedGptDialogReceipt(preflight);
        return knownGptRateLimitAbsentEnvelope(preflight, await this.executeRegisteredCommandBody(command, target, exactCallIdentityHash, assertCurrent, deadlineAt));
      }
      return this.executeRegisteredCommandBody(command, target, exactCallIdentityHash, assertCurrent, deadlineAt);
    };
    if (mutationClass === "mutation") return this.interactionReadiness.executeMutation(target, execute, assertCommandActive,
      command.kind === "dom-intent" ? command.intent.kind : command.kind);
    if (mutationClass === "observation") return this.interactionReadiness.executeObservation(target, execute, assertCommandActive);
    return execute();
  }
  private async executeRegisteredCommandBody(command: BrowserGovernedCommand, target: ExtensionExactTarget,
    exactCallIdentityHash: `sha256:${string}`, assertCommandActive: () => void, deadlineAt?: number): Promise<unknown> {
    const assertCurrent = (): void => { assertCommandActive(); this.targets.resolve(target.targetRef, target.documentRef); };
    if (command.kind !== "dom-intent") return executeRegisteredExtensionCommand(this.debuggerRuntime, target, command,
      { assertCurrent, parkTarget: () => this.parkActiveTarget() });
    if (command.intent.kind === "selectExactGptConversation") return this.executeConversationSelection(target,
      command.intent.canonicalConversationUrl, assertCommandActive, deadlineAt ?? Date.now() + BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    const loader = exactAssistantReadLoaderId(command.intent.kind, target, this.activeTarget, this.activeTarget?.loaderId ?? null);
    if (command.intent.kind === "readExactAssistantTurn" && !loader) throw new Error("BROWSER_DOCUMENT_INVALID");
    const result = await executeRegisteredDomIntent(this.debuggerRuntime, target, command.intent, assertCurrent, loader, deadlineAt, exactCallIdentityHash);
    assertCurrent(); return result;
  }
  private async executeConversationSelection(target: ExtensionExactTarget, url: string, assertCommandActive: () => void,
    deadlineAt: number): Promise<Record<string, unknown>> {
    const expected = requireCanonicalGptConversationUrl(url);
    if (this.navigationPublication) throw new Error("BROWSER_TARGET_INVALID");
    const assertCurrent = (): void => {
      assertCommandActive(); const current = this.targets.resolve(target.targetRef, target.documentRef);
      if (this.activeTarget !== current || current.chromeTargetId !== target.chromeTargetId || current.loaderId !== target.loaderId) throw new Error("BROWSER_DOCUMENT_INVALID");
    };
    assertCurrent();
    let finish!: () => void;
    const publication = new Promise<void>(resolve => { finish = resolve; }); this.navigationPublication = publication;
    try {
      const frame = await this.createdTarget.completeNavigation({ tabId: target.tabId, id: target.chromeTargetId,
        attached: true, type: "page", title: "", url: "" }, deadlineAt, assertCurrent, expected, false, target.loaderId);
      assertCurrent(); const fresh = await this.publishMainFrameNavigation(frame.url, frame.loaderId);
      return { targetRef: fresh.targetRef, documentRef: fresh.documentRef, navigationEpoch: fresh.navigationEpoch };
    } finally { finish(); if (this.navigationPublication === publication) this.navigationPublication = null; }
  }
  private async publishMainFrameNavigation(url: string, loaderId: string): Promise<ExtensionExactTarget> {
    const current = this.activeTarget;
    if (!current) throw new Error("BROWSER_TARGET_INVALID");
    try { requireGptWebPolicyForUrl(url); } catch (error) { await this.parkActiveTarget(); throw error; }
    if (loaderId === current.loaderId) return current;
    const next = this.targets.advanceDocument(current.targetRef, loaderId); await this.claimActiveTarget(next, url); return next;
  }
  private async claimActiveTarget(target: ExtensionExactTarget, url: string, assertCurrent: () => void = () => undefined): Promise<void> {
    assertCurrent(); this.activeTarget = target;
    await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, { claimOrigin: gptWebClaimOriginForUrl(url) }));
  }
  private async discardJobOwnedTarget(candidate: ExtensionDebugTarget): Promise<void> {
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    const errors: unknown[] = [];
    if (this.activeTarget?.tabId === candidate.tabId) await this.releaseActiveTarget().catch(error => { errors.push(error); });
    else await this.debuggerRuntime.detach(candidate.tabId).catch(error => { errors.push(error); });
    await this.createdTarget.removeExactCandidate(candidate).catch(error => { errors.push(error); });
    if (errors.length) throw new AggregateError(errors, "BROWSER_TARGET_CLEANUP_FAILED");
  }
}
