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
  knownGptRateLimitAbsentEnvelope,
  knownGptRateLimitBlockerReceipt,
  observeKnownGptRateLimitDialog,
  unrecognizedGptDialogReceipt,
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
  private readonly removedTabIds = new Set<number>();
  private readonly orphanCandidates = new Map<number, string | null>();
  private readonly orphanRetryTimers = new Map<number, ReturnType<typeof globalThis.setTimeout>>();
  private readonly orphanRetryCounts = new Map<number, number>();

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: TargetFrameSender,
    private readonly reportTargetFailure: TargetFailureReporter,
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
  }

  public start(): void {
    this.chromeApi.debugger.onDetach.addListener((target, reason) => {
      const known = this.targets.findByTabId(target.tabId);
      void this.consumeDebuggerDetachAfterBarrier(target.tabId, reason, known ?? null);
    });
    this.chromeApi.debugger.onEvent.addListener((target, method) => {
      if (method !== "Page.frameNavigated" || this.activeTarget?.tabId !== target.tabId) return;
      void this.consumeFrameNavigationAfterBarrier(target.tabId);
    });
    this.chromeApi.tabs.onUpdated.addListener((tabId) => {
      void this.createdTarget.consumeTabUpdateAfterBarrier(tabId);
      if (this.orphanCandidates.has(tabId)) void this.reconcileOrphanCandidate(tabId);
    });
    this.chromeApi.tabs.onActivated.addListener((activeInfo) => {
      this.interactionReadiness.recordActiveTab(activeInfo.windowId, activeInfo.tabId);
    });
    this.chromeApi.tabs.onRemoved?.addListener((tabId) => {
      const known = this.targets.findByTabId(tabId);
      void this.consumeTabRemovalAfterBarrier(tabId, known ?? null);
    });
  }

  private async consumeDebuggerDetachAfterBarrier(
    tabId: number,
    reason: Parameters<typeof debuggerDetachFailure>[0],
    eventTarget: ExtensionExactTarget | null,
  ): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const known = this.targets.findByTabId(tabId);
    if (!known || !eventTarget || known.chromeTargetId !== eventTarget.chromeTargetId
      || known.jobRefHash !== eventTarget.jobRefHash) return;
    const targets = await this.debuggerRuntime.readTargets();
    if (targets.some((target) => target.tabId === tabId
      && target.id === known.chromeTargetId && target.attached)) return;
    this.targets.invalidateTab(tabId);
    if (this.activeTarget?.tabId === tabId) {
      this.activeTarget = null;
      this.navigationPublication = null;
    }
    await this.publishTargetFailure({
      targetRef: known.targetRef, jobRefHash: known.jobRefHash,
      documentRef: known.documentRef,
      runtimeEventType: "debugger-detach", ...debuggerDetachFailure(reason),
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

  private async consumeTabRemovalAfterBarrier(
    tabId: number, eventTarget: ExtensionExactTarget | null,
  ): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    try {
      await this.debuggerRuntime.readTab(tabId);
      return;
    } catch {
      const targets = await this.debuggerRuntime.readTargets();
      if (targets.some((target) => target.tabId === tabId)) return;
    }
    this.removedTabIds.add(tabId);
    this.orphanCandidates.delete(tabId);
    this.clearOrphanRetry(tabId);
    this.createdTarget.markTabRemoved(tabId);
    const known = this.targets.findByTabId(tabId);
    if (!known || !eventTarget || known.chromeTargetId !== eventTarget.chromeTargetId
      || known.jobRefHash !== eventTarget.jobRefHash) return;
    this.targets.invalidateTab(tabId);
    if (this.activeTarget?.tabId === tabId) {
      this.activeTarget = null;
      this.navigationPublication = null;
    }
    await this.publishTargetFailure({
      targetRef: known.targetRef, jobRefHash: known.jobRefHash,
      documentRef: known.documentRef, runtimeEventType: "tab-remove",
      reasonCode: "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
    });
  }

  public resolve(targetRef: string, documentRef: string): ExtensionExactTarget {
    return this.targets.resolve(targetRef, documentRef);
  }

  private async publishTargetFailure(input: Parameters<TargetFailureReporter>[0] & Readonly<{
    jobRefHash: `sha256:${string}`; documentRef: string;
  }>): Promise<void> {
    await this.reportTargetFailure(input);
    await this.send("TARGET_REVOKE", { targetRef: input.targetRef,
      jobRefHash: input.jobRefHash, documentRef: input.documentRef });
  }

  public async acquireJobBoundChatGptTarget(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string,
    expectedTargetRef?: string,
  ): Promise<void> {
    return this.debuggerRuntime.withLogicalPageAccess(
      () => this.pageAccessGate.enter(),
      () => this.acquireJobBoundChatGptTargetCycle(
        targetMode, jobRefHash, parentConversationUrl, expectedTargetRef,
      ),
    );
  }

  private async acquireJobBoundChatGptTargetCycle(
    targetMode: "fresh" | "bound-observation" | "confirmed-readback" | "authorized-continuation",
    jobRefHash: `sha256:${string}`,
    parentConversationUrl?: string,
    expectedTargetRef?: string,
  ): Promise<void> {
    for (const tabId of this.orphanCandidates.keys()) {
      await this.reconcileOrphanCandidate(tabId);
    }
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
    if (expectedTargetRef && !bound) {
      throw new Error("BROWSER_OLD_TARGET_INSTANCE_UNAVAILABLE");
    }
    if (expectedTargetRef && bound?.targetRef !== expectedTargetRef) {
      throw new Error("BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED");
    }
    if (bound) return this.reacquireParkedTarget(
      bound.targetRef, targetMode === "fresh", continuationUrl,
    );
    if (targetMode === "bound-observation") throw new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT");
    const candidate = await this.createProductionCandidate();
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_INVALID");
    this.removedTabIds.delete(candidate.tabId);
    try {
      await this.debuggerRuntime.attach(candidate.tabId);
    } catch (error) {
      try { await this.removeExactCandidate(candidate); }
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
      const target = this.targets.claimOperatorTarget(
        candidate.tabId, jobRefHash, mainFrame.loaderId, candidate.id,
      );
      this.activeTarget = target;
      await this.send("TARGET_CLAIM", this.targets.describeOperatorClaim(target, {
        claimOrigin: gptWebClaimOriginForUrl(mainFrame.url),
      }));
    } catch (error) {
      try { await this.discardJobOwnedTarget(candidate); }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], "BROWSER_TARGET_CLEANUP_FAILED");
      }
      throw error;
    }
  }

  public async releaseJobBoundChatGptTarget(
    jobRefHash: `sha256:${string}`, targetRefs: readonly string[],
  ): Promise<void> {
    if (!/^sha256:[a-f0-9]{64}$/u.test(jobRefHash)) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    await this.awaitOldCommandHandlers();
    await this.debuggerRuntime.awaitPageReadPermission();
    if (this.createdTarget.isPending()
      || this.activeTarget?.jobRefHash === jobRefHash) {
      throw new Error("BROWSER_OLD_TARGET_RECONCILIATION_REQUIRED");
    }
    const bound = this.targets.findByJobRefHash(jobRefHash);
    if (bound && !targetRefs.includes(bound.targetRef)) {
      throw new Error("BROWSER_TARGET_PHYSICAL_ABSENCE_UNPROVEN");
    }
    if (targetRefs.length === 0) {
      await this.send("TARGET_REVOKE", {
        targetRef: null, jobRefHash, releaseOutcome: "absent", targetRefs: [],
      });
      return;
    }
    let allPhysicallyAbsent = true;
    for (const targetRef of targetRefs) {
      const match = /^target-tab-(\d+)$/u.exec(targetRef);
      const tabId = match ? Number(match[1]) : NaN;
      if (!Number.isSafeInteger(tabId) || tabId < 0) throw new Error("BROWSER_TARGET_INVALID");
      const current = this.targets.findByTabId(tabId);
      if (current && (current.jobRefHash !== jobRefHash || current.targetRef !== targetRef)) {
        // Chrome may reuse a v40 numeric tab id. This current claim belongs to
        // another job; only the old handler is retired, never the current tab.
        allPhysicallyAbsent = false;
        continue;
      }
      // A v40 numeric targetRef or lost registry is never sufficient ownership
      // evidence for tabs.remove: Chrome may already have reused the tab id.
      if (!current) { allPhysicallyAbsent = false; continue; }
      if (this.removedTabIds.has(tabId)) {
        this.targets.invalidateTab(tabId);
        allPhysicallyAbsent = false;
        continue;
      }
      const currentTargets = await this.debuggerRuntime.readTargets();
      if (!currentTargets.some((target) => target.tabId === tabId
        && target.id === current.chromeTargetId)) {
        this.targets.invalidateTab(tabId);
        allPhysicallyAbsent = false;
        continue;
      }
      let removed = false;
      try { await this.debuggerRuntime.removeTab(tabId); removed = true; }
      catch { allPhysicallyAbsent = false; }
      if (removed) {
        let tabStillPresent = true;
        try { await this.debuggerRuntime.readTab(tabId); }
        catch { tabStillPresent = false; }
        const targets = await this.debuggerRuntime.readTargets();
        if (!this.removedTabIds.has(tabId) || tabStillPresent
          || targets.some((target) => target.tabId === tabId)) {
          allPhysicallyAbsent = false;
        }
      }
      this.targets.invalidateTab(tabId);
      this.debuggerRuntime.forgetAttached(tabId);
    }
    await this.send("TARGET_REVOKE", {
      targetRef: targetRefs[0], jobRefHash,
      releaseOutcome: allPhysicallyAbsent ? "released" : "quiesced", targetRefs,
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
    if (notifyWorkbench) await this.send("TARGET_REVOKE", {
      targetRef: target.targetRef, jobRefHash: target.jobRefHash,
      documentRef: target.documentRef,
    });
  }

  public async parkActiveTarget(): Promise<void> {
    await this.debuggerRuntime.awaitPageReadPermission();
    const target = this.activeTarget;
    if (!target || !target.loaderId) throw new Error("BROWSER_TARGET_INVALID");
    this.activeTarget = null;
    this.navigationPublication = null;
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
    const execute = async (): Promise<unknown> => {
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
          command, target, exactCallIdentityHash, assertCommandActive, commandDeadlineAt,
        );
        return knownGptRateLimitAbsentEnvelope(preflight, result);
      }
      return this.executeRegisteredCommandBody(
        command, target, exactCallIdentityHash, assertCommandActive, commandDeadlineAt,
      );
    };

    if (mutationClass === "mutation") {
      return this.interactionReadiness.executeMutation(target, execute);
    }
    return mutationClass === "observation"
      ? this.interactionReadiness.executeObservation(target, execute)
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

  private async createProductionCandidate(): Promise<ExtensionDebugTarget> {
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
      const pending = this.createdTarget.waitForCreatedTarget(tabId, createdIdentity.id);
      void this.createdTarget.consumeTabUpdateAfterBarrier(tabId);
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

  private async removeExactCandidate(candidate: ExtensionDebugTarget): Promise<void> {
    if (candidate.tabId === undefined) throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    const current = await this.debuggerRuntime.readTargets();
    if (!current.some((target) => target.tabId === candidate.tabId && target.id === candidate.id)) {
      throw new Error("BROWSER_TARGET_CLEANUP_IDENTITY_MISMATCH");
    }
    await this.debuggerRuntime.removeTab(candidate.tabId);
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
    await this.removeExactCandidate(candidate).catch((error) => { cleanupErrors.push(error); });
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
