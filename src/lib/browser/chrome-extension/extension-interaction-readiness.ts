import { browserInteractionNativeCauseCode } from
  "../exact-target/browser-interaction-native-cause.js";
import { requireGptWebPolicyForUrl } from
  "../exact-target/browser-site-policy-registry.js";
import { ExtensionDebuggerRuntime, type ProviderInputState } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { readExtensionMainFrame } from "./extension-target-observation.js";
import type { ExtensionTab } from "./extension-runtime-types.js";

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

type ActiveTargetState = Readonly<{
  target: ExtensionExactTarget | null;
  loaderId: string | null;
}>;

type ResolveExactTarget = (targetRef: string, documentRef: string) => ExtensionExactTarget;

const interactionFailure = (causeCode: string): Error =>
  new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: new Error(causeCode) });

const interactionRejectedReceipt = (error: unknown): Readonly<Record<string, unknown>> =>
  Object.freeze({
    candidateCount: 0,
    identityRevalidated: false,
    mutationCount: 0,
    postconditionVerified: false,
    qualificationRejected: true,
    qualificationStage: "candidate-set",
    failureCode: "BROWSER_TARGET_NOT_INTERACTIVE",
    nativeCauseCode: browserInteractionNativeCauseCode(error),
  });

/** Browser-owned mutation gate; Chrome tab metadata never owns page Origin truth. */
export class ExtensionInteractionReadiness {
  private readonly activeTabsByWindow = new Map<number, ActiveTabGeneration>();

  public constructor(
    private readonly debuggerRuntime: ExtensionDebuggerRuntime,
    private readonly resolveExactTarget: ResolveExactTarget,
    private readonly readActiveTargetState: () => ActiveTargetState,
  ) {}

  public recordActiveTab(windowId: number, tabId: number): void {
    if (!Number.isSafeInteger(windowId) || !Number.isSafeInteger(tabId)) return;
    const current = this.activeTabsByWindow.get(windowId);
    if (current?.tabId === tabId) return;
    this.activeTabsByWindow.set(windowId, Object.freeze({
      generation: (current?.generation ?? 0) + 1,
      tabId,
    }));
  }

  public async executeMutation(
    target: ExtensionExactTarget,
    execute: () => Promise<unknown>,
  ): Promise<unknown> {
    let interactionLease: InteractionLease;
    try {
      interactionLease = await this.ensureInteractionReady(target);
    } catch (error) {
      return interactionRejectedReceipt(error);
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
        return interactionRejectedReceipt(error);
      }
      throw error;
    }
  }

  public async executeObservation(
    target: ExtensionExactTarget,
    execute: () => Promise<unknown>,
  ): Promise<unknown> {
    const interactionLease = await this.ensureInteractionReady(target);
    return this.debuggerRuntime.withPageReadGuard(
      () => this.assertInteractionReady(interactionLease),
      execute,
    );
  }

  private requireInteractiveTab(tab: ExtensionTab, target: ExtensionExactTarget): number {
    if (tab.id !== target.tabId || !Number.isSafeInteger(tab.windowId)
      || tab.active !== true || tab.discarded !== false || tab.status !== "complete") {
      throw interactionFailure("BROWSER_TARGET_INVALID");
    }
    return tab.windowId as number;
  }

  private async ensureInteractionReady(target: ExtensionExactTarget): Promise<InteractionLease> {
    this.resolveExactTarget(target.targetRef, target.documentRef);
    let tab = await this.debuggerRuntime.readTab(target.tabId);
    if (tab.id !== target.tabId || tab.discarded !== false || tab.status !== "complete"
      || !Number.isSafeInteger(tab.windowId)) {
      throw interactionFailure("BROWSER_TARGET_INVALID");
    }
    if (tab.active !== true) {
      await this.debuggerRuntime.activateTab(target.tabId);
      tab = await this.debuggerRuntime.readTab(target.tabId);
    }
    const windowId = this.requireInteractiveTab(tab, target);
    this.recordActiveTab(windowId, target.tabId);
    const activationGeneration = this.activeTabsByWindow.get(windowId)?.generation;
    if (activationGeneration === undefined) throw interactionFailure("BROWSER_TARGET_INVALID");

    const frame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    const activeState = this.readActiveTargetState();
    if (activeState.target?.targetRef !== target.targetRef
      || activeState.target.documentRef !== target.documentRef
      || activeState.target.tabId !== target.tabId
      || activeState.loaderId === null || frame.loaderId !== activeState.loaderId) {
      throw interactionFailure("BROWSER_DOCUMENT_INVALID");
    }
    try {
      requireGptWebPolicyForUrl(frame.url);
      this.resolveExactTarget(target.targetRef, target.documentRef);
    } catch (error) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error });
    }

    const finalTab = await this.debuggerRuntime.readTab(target.tabId);
    this.requireInteractiveTab(finalTab, target);
    const active = this.activeTabsByWindow.get(windowId);
    if (!active || active.tabId !== target.tabId || active.generation !== activationGeneration) {
      throw interactionFailure("BROWSER_TARGET_INVALID");
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
    const activeTarget = this.readActiveTargetState().target;
    if (!active || active.tabId !== lease.tabId || active.generation !== lease.generation
      || activeTarget?.targetRef !== lease.targetRef
      || activeTarget.documentRef !== lease.documentRef
      || activeTarget.tabId !== lease.tabId) {
      throw interactionFailure("BROWSER_TARGET_INVALID");
    }
    try {
      this.resolveExactTarget(lease.targetRef, lease.documentRef);
    } catch (error) {
      throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error });
    }
  }
}
