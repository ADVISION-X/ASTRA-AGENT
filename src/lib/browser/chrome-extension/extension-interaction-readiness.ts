import { requireGptWebPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { ExtensionDebuggerRuntime, type ProviderInputState } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { readExtensionMainFrame } from "./extension-target-observation.js";
import type { ExtensionTab } from "./extension-runtime-types.js";

type InteractionLease = Readonly<{
  tabId: number; targetRef: string; documentRef: string; assertActivation(): void;
}>;
type ActiveTargetState = Readonly<{ target: ExtensionExactTarget | null; loaderId: string | null }>;

const interactionFailure = (code: string): Error =>
  new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: new Error(code) });
/** Publication qualifies one instant; this lease qualifies each physical interaction. */
export class ExtensionInteractionReadiness {
  private readonly activeTabsByWindow = new Map<number, Readonly<{ generation: number; tabId: number }>>();

  public constructor(
    private readonly debuggerRuntime: ExtensionDebuggerRuntime,
    private readonly resolveExactTarget: (targetRef: string, documentRef: string) => ExtensionExactTarget,
    private readonly readActiveTargetState: () => ActiveTargetState,
  ) {}

  public recordActiveTab(windowId: number, tabId: number): void {
    if (!Number.isSafeInteger(windowId) || !Number.isSafeInteger(tabId)) return;
    const prior = this.activeTabsByWindow.get(windowId);
    if (prior?.tabId !== tabId) this.activeTabsByWindow.set(windowId,
      Object.freeze({ tabId, generation: (prior?.generation ?? 0) + 1 }));
  }

  public async executeMutation(
    target: ExtensionExactTarget,
    execute: (assertReadback: () => void) => Promise<unknown>,
    assertInput: () => void,
    mutationKind: string,
  ): Promise<unknown> {
    assertInput();
    const lease = await this.ensureInteractionReady(target, assertInput);
    const state: ProviderInputState = { started: false, physicalInputCount: 0, mutationKind };
    const assertReadback = (): void => {
      if (!state.started) assertInput();
      this.assertInteractionReady(lease);
    };
    try {
      return await this.debuggerRuntime.withProviderInputGuard(state,
        () => { assertInput(); this.assertInteractionReady(lease); },
        () => this.debuggerRuntime.withPageReadGuard(assertReadback, () => execute(assertReadback)));
    } catch (error) {
      await this.debuggerRuntime.awaitPageReadPermission();
      throw Object.assign(error instanceof Error ? error : new Error("BROWSER_CAPABILITY_REJECTED"), {
        browserInputStarted: state.started, browserPhysicalInputCount: state.physicalInputCount,
      });
    }
  }

  public async executeObservation(
    target: ExtensionExactTarget, execute: () => Promise<unknown>, assertInput: () => void,
  ): Promise<unknown> {
    const lease = await this.ensureInteractionReady(target, assertInput);
    return this.debuggerRuntime.withPageReadGuard(
      () => { assertInput(); this.assertInteractionReady(lease); }, execute);
  }

  private requireInteractiveTab(tab: ExtensionTab, target: Pick<ExtensionExactTarget, "tabId">): number {
    if (tab.id !== target.tabId || !Number.isSafeInteger(tab.windowId) || tab.active !== true
      || tab.discarded !== false) throw interactionFailure("BROWSER_TARGET_INVALID");
    return tab.windowId as number;
  }

  private async ensureInteractionReady(
    target: ExtensionExactTarget, assertInput: () => void,
  ): Promise<InteractionLease> {
    assertInput();
    this.resolveExactTarget(target.targetRef, target.documentRef);
    let tab = await this.debuggerRuntime.readTab(target.tabId);
    if (tab.id !== target.tabId || tab.discarded !== false
      || !Number.isSafeInteger(tab.windowId)) throw interactionFailure("BROWSER_TARGET_INVALID");
    assertInput();
    if (tab.active !== true) {
      const state: ProviderInputState = { started: false, physicalInputCount: 0, mutationKind: "activation" };
      await this.debuggerRuntime.withProviderInputGuard(state,
        () => { assertInput(); this.resolveExactTarget(target.targetRef, target.documentRef); },
        () => this.debuggerRuntime.activateTab(target.tabId));
      tab = await this.debuggerRuntime.readTab(target.tabId);
    }
    const assertActivation = this.captureTabActivation(tab, target.tabId);
    const frame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    const active = this.readActiveTargetState();
    if (active.target?.targetRef !== target.targetRef || active.target.documentRef !== target.documentRef
      || active.target.tabId !== target.tabId || active.loaderId === null
      || frame.loaderId !== active.loaderId) throw interactionFailure("BROWSER_DOCUMENT_INVALID");
    try { requireGptWebPolicyForUrl(frame.url); this.resolveExactTarget(target.targetRef, target.documentRef); }
    catch (error) { throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error }); }
    this.requireInteractiveTab(await this.debuggerRuntime.readTab(target.tabId), target);
    assertInput();
    const lease = Object.freeze({ tabId: target.tabId, targetRef: target.targetRef,
      documentRef: target.documentRef, assertActivation });
    this.assertInteractionReady(lease);
    return lease;
  }

  public captureTabActivation(tab: ExtensionTab, tabId: number): () => void {
    const windowId = this.requireInteractiveTab(tab, { tabId });
    if (!this.activeTabsByWindow.has(windowId)) this.recordActiveTab(windowId, tabId);
    const generation = this.activeTabsByWindow.get(windowId)!.generation;
    const assertActivation = (): void => {
      const activation = this.activeTabsByWindow.get(windowId);
      if (activation?.tabId !== tabId || activation.generation !== generation) throw interactionFailure("BROWSER_TARGET_INVALID");
    };
    assertActivation();
    return assertActivation;
  }
  private assertInteractionReady(lease: InteractionLease): void {
    lease.assertActivation();
    const current = this.readActiveTargetState().target;
    if (current?.targetRef !== lease.targetRef || current.documentRef !== lease.documentRef
      || current.tabId !== lease.tabId) throw interactionFailure("BROWSER_TARGET_INVALID");
    try { this.resolveExactTarget(lease.targetRef, lease.documentRef); }
    catch (error) { throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error }); }
  }
}
