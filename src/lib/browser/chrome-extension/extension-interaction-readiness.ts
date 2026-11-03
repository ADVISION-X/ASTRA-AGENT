import { GPT_WEB_START_URL, gptWebClaimOriginForUrl } from "../exact-target/browser-site-policy-registry.js";
import type { BrowserCommandPermit } from "../transport/command-permit.js";
import { ExtensionDebuggerRuntime, type ProviderInputState } from "./debugger-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { readExtensionMainFrame } from "./extension-target-observation.js";
import type { ExtensionTab } from "./extension-runtime-types.js";

type InteractionLease = Readonly<{
  tabId: number; targetRef: string; documentRef: string; chromeTargetId: string;
  generation: number; assertActivation(): void;
}>;
type ActiveTargetState = Readonly<{ target: ExtensionExactTarget | null; loaderId: string | null }>;

const interactionFailure = (code: string): Error =>
  new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: new Error(code) });
/** Publication qualifies one instant; this lease qualifies each physical interaction. */
export class ExtensionInteractionReadiness {
  private readonly activeTabsByWindow = new Map<number, Readonly<{ generation: number; tabId: number }>>();
  private navigationGeneration = 0;

  public constructor(
    private readonly debuggerRuntime: ExtensionDebuggerRuntime,
    private readonly resolveExactTarget: (targetRef: string, documentRef: string) => ExtensionExactTarget,
    private readonly readActiveTargetState: () => ActiveTargetState,
  ) {}

  public invalidateNavigation(): void { this.navigationGeneration += 1; }

  public async executeMutation(target: ExtensionExactTarget,
    execute: (assertReadback: () => void) => Promise<unknown>, assertInput: () => void,
    mutationKind: string, permit: BrowserCommandPermit): Promise<unknown> {
    const lease = await this.ensureInteractionReady(target, assertInput, permit);
    const state: ProviderInputState = { started: false, physicalInputCount: 0, mutationKind };
    if (permit.childCapabilityId === "submit_exact_gpt_turn_once" && permit.replayPolicy === "provider-effect-once"
      && target.expectedUrl === GPT_WEB_START_URL) target.pendingSubmit = { commandId: permit.commandId, state };
    const assertReadback = (): void => {
      if (!state.started) assertInput();
      this.assertInteractionReady(lease, state.started && target.pendingSubmit?.state === state);
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
    } finally {
      if (!state.started && target.pendingSubmit?.state === state) target.pendingSubmit = null;
    }
  }

  public async executeObservation(target: ExtensionExactTarget, execute: () => Promise<unknown>,
    assertInput: () => void, permit: BrowserCommandPermit): Promise<unknown> {
    const lease = await this.ensureInteractionReady(target, assertInput, permit);
    return this.debuggerRuntime.withPageReadGuard(
      () => { assertInput(); this.assertInteractionReady(lease); }, execute);
  }

  private async ensureInteractionReady(target: ExtensionExactTarget, assertInput: () => void,
    permit: BrowserCommandPermit): Promise<InteractionLease> {
    assertInput(); this.resolveExactTarget(target.targetRef, target.documentRef);
    const ack = permit.childCapabilityId === "acknowledge_known_gpt_rate_limit";
    const locator = permit.childCapabilityId === "get_submitted_gpt_conversation_url"
      && permit.replayPolicy === "observation-only" && target.pendingSubmit?.state.started === true;
    if (!ack && target.pendingSubmit?.state.started && target.pendingSubmit.commandId !== permit.commandId && !locator) {
      throw interactionFailure("BROWSER_DOCUMENT_INVALID");
    }
    let tab = await this.debuggerRuntime.readTab(target.tabId);
    if (Object.entries({ id: target.tabId, discarded: false }).some(([key, value]) => tab[key as keyof ExtensionTab] !== value)
      || !Number.isSafeInteger(tab.windowId)) {
      throw interactionFailure("BROWSER_TARGET_INVALID");
    }
    if (!tab.active) {
      await this.debuggerRuntime.withProviderInputGuard({ started: false, physicalInputCount: 0, mutationKind: "activation" },
        () => { assertInput(); this.resolveExactTarget(target.targetRef, target.documentRef); },
        () => this.debuggerRuntime.activateTab(target.tabId));
      tab = await this.debuggerRuntime.readTab(target.tabId);
    }
    const generation = this.navigationGeneration;
    const assertActivation = this.captureTabActivation(tab, target.tabId);
    const frame = await readExtensionMainFrame(this.debuggerRuntime, target.tabId);
    const active = this.readActiveTargetState();
    try { gptWebClaimOriginForUrl(frame.url); }
    catch (error) { throw new Error("BROWSER_TARGET_NOT_INTERACTIVE", { cause: error }); }
    const url = new URL(frame.url);
    const identityMatches = Object.entries({ targetRef: target.targetRef, documentRef: target.documentRef,
      tabId: target.tabId, loaderId: frame.loaderId }).every(([key, value]) => active.target?.[key as keyof ExtensionExactTarget] === value);
    if (!identityMatches || !target.expectedUrl || !ack && !locator && `${url.origin}${url.pathname}` !== target.expectedUrl) {
      throw interactionFailure("BROWSER_DOCUMENT_INVALID");
    }
    this.requireInteractiveTab(await this.debuggerRuntime.readTab(target.tabId), target);
    assertInput();
    const lease = Object.freeze({ tabId: target.tabId, targetRef: target.targetRef, documentRef: target.documentRef,
      chromeTargetId: target.chromeTargetId, generation, assertActivation });
    this.assertInteractionReady(lease);
    return lease;
  }

  private assertInteractionReady(lease: InteractionLease, submittedReadback = false): void {
    lease.assertActivation();
    const current = this.readActiveTargetState().target;
    if (!current || current.targetRef !== lease.targetRef || current.tabId !== lease.tabId
      || current.chromeTargetId !== lease.chromeTargetId
      || !submittedReadback && (current.documentRef !== lease.documentRef || this.navigationGeneration !== lease.generation)) {
      throw interactionFailure("BROWSER_DOCUMENT_INVALID");
    }
    this.resolveExactTarget(current.targetRef, submittedReadback ? current.documentRef : lease.documentRef);
  }

  public recordActiveTab(windowId: number, tabId: number): void {
    if (!Number.isSafeInteger(windowId) || !Number.isSafeInteger(tabId)) return;
    const prior = this.activeTabsByWindow.get(windowId);
    if (prior?.tabId !== tabId) this.activeTabsByWindow.set(windowId,
      Object.freeze({ tabId, generation: (prior?.generation ?? 0) + 1 }));
  }

  private requireInteractiveTab(tab: ExtensionTab, target: Pick<ExtensionExactTarget, "tabId">): number {
    if (tab.id !== target.tabId || !Number.isSafeInteger(tab.windowId) || tab.active !== true
      || tab.discarded !== false) throw interactionFailure("BROWSER_TARGET_INVALID");
    return tab.windowId as number;
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
}
