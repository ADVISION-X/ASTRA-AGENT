import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createId } from "../../local-runtime/ids.js";
import { RuntimeLogEventType, type RuntimeLogger } from "../../runtime-logs/index.js";
import { runLoggedBrowserValueAction } from "../current-chrome-browser-action-logging.js";
import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserGeometrySnapshot,
  BrowserOpenReusePolicy,
  BrowserOpenResult,
  BrowserTargetSession,
} from "../browser-controller.js";
import type { BrowserWireTargetDescriptor } from "../chrome-extension/protocol.js";
import { BrowserNativeTransportServer } from "./browser-native-transport-server.js";
import { BrowserTerminalError, type BrowserMutationClass } from "./browser-command-contract.js";
import { toBrowserEvaluationExpression } from "./browser-evaluation-contract.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";
import { BrowserTargetRegistry } from "./browser-target-registry.js";

type TargetedWireCommand = Exclude<import("../chrome-extension/protocol.js").BrowserWireCommand, { kind: "acquire_target" }>;
type WithoutTab<T> = T extends { tabId: number } ? Omit<T, "tabId"> : never;
type SessionWireCommand = WithoutTab<TargetedWireCommand>;

const hostOf = (value: string): string => {
  try { return new URL(value).host || "local-file"; } catch { return "unknown"; }
};

const sameRequestedUrl = (requested: string, observed: string): boolean => {
  try {
    const a = new URL(requested); const b = new URL(observed);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch { return requested === observed; }
};

const isRecoverableTargetLoss = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:DEVTOOLS_ATTACHMENT_CONFLICT:.*No tab with given id|TARGET_NOT_FOUND:.*No tab with given id|TRANSPORT_DISCONNECTED:Detached while handling command|TRANSPORT_DISCONNECTED:Native host disconnected|TRANSPORT_DISCONNECTED:controller transport closed)/iu
    .test(message);
};

export class BrowserCommandRuntime {
  readonly registry: BrowserTargetRegistry;
  readonly transport: BrowserNativeTransportServer;
  private readonly targetSessions = new Set<ExactBrowserTargetSession>();
  private readonly targetSessionsByOwner = new Map<string, ExactBrowserTargetSession>();
  private executionAbortSignal: AbortSignal | null = null;

  constructor(
    controllerSessionId: string,
    socketPath: string,
    private readonly screenshotDir: string,
    readonly runtimeLogger?: RuntimeLogger,
  ) {
    this.registry = new BrowserTargetRegistry(controllerSessionId);
    this.transport = new BrowserNativeTransportServer(
      socketPath,
      (event) => this.handleTransportLifecycle(event),
    );
    void this.transport.start().catch(() => undefined);
  }

  isReady(): boolean { return this.transport.isReady(); }
  targetCount(): number { return [...this.targetSessions].filter((value) => value.getTarget()?.lifecycle === "attached").length; }
  setExecutionAbortSignal(signal: AbortSignal | null): void { this.executionAbortSignal = signal; }
  createTargetSession(ownerId: string): BrowserTargetSession {
    if (!ownerId.trim()) throw new Error("Browser target session requires an owner id");
    const existing = this.targetSessionsByOwner.get(ownerId);
    if (existing) return existing;
    const session = new ExactBrowserTargetSession(this, ownerId);
    this.targetSessions.add(session);
    this.targetSessionsByOwner.set(ownerId, session);
    return session;
  }
  signal(input?: AbortSignal): AbortSignal | undefined { return input ?? this.executionAbortSignal ?? undefined; }
  async close(): Promise<void> {
    this.registry.invalidateAll();
    for (const session of this.targetSessions) session.invalidateTransport();
    await this.transport.close();
  }
  capturePath(actionId: string): string { return path.join(this.screenshotDir, `${actionId}.png`); }
  async writeCapture(filePath: string, data: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(data, "base64"), { mode: 0o600 });
  }
  logged<T>(input: {
    actionKind: string;
    beforeUrl: string;
    readAfterUrl: () => string;
    run: () => Promise<T>;
  }): Promise<T> {
    return runLoggedBrowserValueAction({
      ...(this.runtimeLogger ? { runtimeLogger: this.runtimeLogger } : {}),
      ...input,
      run: async () => input.run(),
    });
  }

  private handleTransportLifecycle(event: import("./browser-native-transport-server.js").BrowserTransportLifecycleEvent): void {
    if (event.stage === "disconnected") {
      this.registry.invalidateAll();
      for (const session of this.targetSessions) session.invalidateTransport();
    }
    this.runtimeLogger?.emit({
      traceId: `browser-transport-${event.generation}`,
      level: event.stage === "disconnected" ? "error" : "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      eventType: event.stage === "disconnected"
        ? RuntimeLogEventType.BROWSER_ACTION_FAILED
        : RuntimeLogEventType.BROWSER_ACTION_RESULT,
      owner: "browser-session",
      status: event.stage === "disconnected" ? "failed" : "success",
      reason: event.reason ?? `transport stage: ${event.stage}`,
      payload: {
        actionKind: "native_transport",
        transportStage: event.stage,
        connectionGeneration: event.generation,
      },
    });
  }
}

class ExactBrowserTargetSession implements BrowserTargetSession {
  private target: ControlledBrowserTarget | null = null;
  private releasedTargetRequest: {
    url: string;
    title: string;
    reusePolicy: BrowserOpenReusePolicy;
  } | null = null;
  constructor(private readonly runtime: BrowserCommandRuntime, readonly ownerId: string) {}
  getTarget(): ControlledBrowserTarget | null { return this.target ? { ...this.target } : null; }
  invalidateTransport(): void {
    this.target = null;
    this.releasedTargetRequest = null;
  }
  setExecutionAbortSignal(signal: AbortSignal | null): void { this.runtime.setExecutionAbortSignal(signal); }
  getHealth(): { ok: boolean; detail: string } { return { ok: this.runtime.isReady(), detail: this.runtime.isReady() ? `exact target ready for ${this.ownerId}` : "exact target transport disconnected" }; }
  getSessionState(): import("../browser-controller.js").BrowserStateSnapshot {
    return {
      browserMode: "real_chrome_persistent",
      browserProfileRef: "operator-authorized-local-profile",
      browserExecutablePath: null,
      profileStatus: "profile_ready",
      profileDirectory: "operator-authorized-local-profile",
      profileProvisioning: "operator_supplied",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "exact target bound through the fixed GrassEye extension",
      loginState: "unknown",
      loginRequiredReason: null,
      reviewRequiredReason: null,
      lastLoginCheckAt: new Date().toISOString(),
      open: this.target !== null,
      currentUrl: this.target?.url ?? "about:blank",
      currentTitle: this.target?.title ?? this.ownerId,
      browserExecutable: null,
      exactTargetCount: this.runtime.targetCount(),
      transportReady: this.runtime.isReady(),
    };
  }

  async open(input: Parameters<BrowserTargetSession["open"]>[0]): Promise<BrowserOpenResult> {
    const started = Date.now();
    const actionId = input.browserActionId ?? createId("browser-open");
    const signal = this.runtime.signal(input.abortSignal);
    const reusePolicy = input.reusePolicy ?? "reuse-exact-url";
    let descriptor: BrowserWireTargetDescriptor;
    let navigationMode: BrowserOpenResult["navigationMode"];
    if (!this.target) {
      let observedUrl = input.url;
      descriptor = await this.runtime.logged({
        actionKind: "acquire_target",
        beforeUrl: "about:blank",
        readAfterUrl: () => observedUrl,
        run: async () => {
          const response = await this.runtime.transport.command<BrowserWireTargetDescriptor>({
            command: {
              kind: "acquire_target",
              url: input.url,
              reusePolicy,
              excludedTabIds: this.runtime.registry.occupiedTabIds(),
            },
            mutationClass: "idempotent_mutation",
            ...(signal ? { abortSignal: signal } : {}),
            timeoutMs: 30_000,
          });
          observedUrl = response.result.url;
          return response.result;
        },
      });
      this.target = this.runtime.registry.register(this.ownerId, descriptor, new URL(input.url).origin);
      this.releasedTargetRequest = null;
      navigationMode = "acquired_exact_target";
    } else {
      const entry = this.runtime.registry.resolve(this.target.targetRef, this.target.documentRef);
      this.runtime.registry.assertNavigationOrigin(this.target.targetRef, input.url);
      try {
        descriptor = (await this.loggedTransportCommand<BrowserWireTargetDescriptor>({
          command: { kind: "navigate_target", tabId: entry.descriptor.tabId, url: input.url },
          expectedLoaderId: entry.descriptor.loaderId,
          mutationClass: "idempotent_mutation",
          ...(signal ? { abortSignal: signal } : {}),
          timeoutMs: 30_000,
        }, entry.descriptor.url)).result;
      } catch (error) {
        if (!isRecoverableTargetLoss(error)) throw error;
        this.forgetTargetForRecovery();
        return this.open(input);
      }
      this.target = this.runtime.registry.updateDocument(this.target.targetRef, descriptor);
      this.releasedTargetRequest = null;
      navigationMode = "navigated_exact_target";
    }
    return {
      ...this.action(actionId, `opened ${input.url} on exact target`, started),
      actionKind: "open",
      requestedHost: hostOf(input.url),
      reusePolicy,
      navigationMode,
      observedUrlMatchesRequest: sameRequestedUrl(input.url, descriptor.url),
    };
  }

  async evaluate<T>(input: Parameters<BrowserTargetSession["evaluate"]>[0]): Promise<T> {
    return (await this.command<T>({
      kind: "evaluate_target",
      expression: toBrowserEvaluationExpression(input.script),
    }, "observation", input.abortSignal, input.timeoutMs)).result;
  }

  async click(input: Parameters<BrowserTargetSession["click"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({ kind: "click_target", x: input.point.x, y: input.point.y, button: input.button ?? "left", clickCount: input.clickCount ?? 1 }, "non_idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-click"), `clicked ${input.targetLabel} on exact target`, started);
  }
  async clickLocatedDomElement(input: Parameters<BrowserTargetSession["clickLocatedDomElement"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({
      kind: "click_dom_target",
      selector: input.element.selector,
      identity: input.element.identity,
      ...(input.expectedText ? { expectedText: input.expectedText } : {}),
    }, "non_idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-dom-click"), `atomically revalidated and clicked ${input.targetLabel} on exact target`, started);
  }
  async fillLocatedDomElement(input: Parameters<NonNullable<BrowserTargetSession["fillLocatedDomElement"]>>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({
      kind: "fill_dom_target",
      selector: input.element.selector,
      identity: input.element.identity,
      approvedText: input.approvedText,
      clearBeforeType: input.clearBeforeType,
    }, "non_idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-dom-fill"), `atomically revalidated and filled ${input.targetLabel} on exact target`, started);
  }
  async move(input: Parameters<NonNullable<BrowserTargetSession["move"]>>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({ kind: "move_target", x: input.point.x, y: input.point.y }, "idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-move"), `moved within ${input.targetLabel} on exact target`, started);
  }
  async scroll(input: Parameters<BrowserTargetSession["scroll"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now(); const geometry = await this.getGeometrySnapshot(input.abortSignal);
    await this.command({ kind: "scroll_target", x: input.anchorPoint?.x ?? geometry.viewportWidth / 2, y: input.anchorPoint?.y ?? geometry.viewportHeight / 2, deltaX: input.deltaX, deltaY: input.deltaY }, "idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-scroll"), `scrolled ${input.targetLabel} on exact target`, started);
  }
  async textInput(input: Parameters<BrowserTargetSession["textInput"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({ kind: "text_target", action: input.action, ...(input.text != null ? { text: input.text } : {}), ...(input.key != null ? { key: input.key } : {}) }, "non_idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-text"), `sent text action to ${input.targetLabel} on exact target`, started);
  }
  async setFileInputFiles(input: Parameters<BrowserTargetSession["setFileInputFiles"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({ kind: "set_file_input_files", selector: input.elementRef.selector, filePath: input.filePath }, "non_idempotent_mutation", input.abortSignal, 30_000);
    return this.action(createId("browser-file-input"), input.description, started);
  }
  async screenshotRegion(input: Parameters<BrowserTargetSession["screenshotRegion"]>[0]): Promise<BrowserCaptureResult> {
    const started = Date.now(); const actionId = createId("browser-capture");
    const result = (await this.command<{ data: string }>({ kind: "screenshot_target" }, "observation", input.abortSignal, 30_000)).result;
    const filePath = this.runtime.capturePath(actionId); await this.runtime.writeCapture(filePath, result.data);
    const target = this.requireTarget(); const descriptor = this.runtime.registry.resolve(target.targetRef, target.documentRef).descriptor;
    return {
      browserActionId: actionId, pageUrl: descriptor.url, pageTitle: descriptor.title,
      regionLabel: input.regionLabel, regionType: "viewport", width: descriptor.viewportWidth,
      height: descriptor.viewportHeight, viewportWidth: descriptor.viewportWidth, viewportHeight: descriptor.viewportHeight,
      ...(input.contentLines ? { contentLines: input.contentLines } : {}), sourceFilePath: filePath,
      createdAt: new Date(started).toISOString(), targetRef: target.targetRef, documentRef: target.documentRef,
    };
  }
  async getGeometrySnapshot(abortSignal?: AbortSignal): Promise<BrowserGeometrySnapshot> {
    const target = await this.ensureTarget(); const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    const signal = this.runtime.signal(abortSignal);
    let descriptor: BrowserWireTargetDescriptor;
    try {
      descriptor = (await this.loggedTransportCommand<BrowserWireTargetDescriptor>({ command: { kind: "inspect_target", tabId: entry.descriptor.tabId }, expectedLoaderId: entry.descriptor.loaderId, mutationClass: "observation", ...(signal ? { abortSignal: signal } : {}) }, entry.descriptor.url)).result;
    } catch (error) {
      if (isRecoverableTargetLoss(error)) this.forgetTargetForRecovery();
      throw error;
    }
    this.target = this.runtime.registry.updateDocument(target.targetRef, descriptor);
    return { windowX: 0, windowY: 0, viewportWidth: descriptor.viewportWidth, viewportHeight: descriptor.viewportHeight, screenshotWidth: Math.round(descriptor.viewportWidth * descriptor.deviceScaleFactor), screenshotHeight: Math.round(descriptor.viewportHeight * descriptor.deviceScaleFactor), scaleFactor: descriptor.deviceScaleFactor, currentUrl: descriptor.url, pageTitle: descriptor.title, visibleContentBounds: { x: 0, y: 0, width: descriptor.viewportWidth, height: descriptor.viewportHeight }, capturedAt: new Date().toISOString(), targetRef: this.target.targetRef, documentRef: this.target.documentRef };
  }
  async wait(durationMs: number, abortSignal?: AbortSignal): Promise<BrowserActionResult> {
    const signal = this.runtime.signal(abortSignal); const started = Date.now();
    await this.runtime.logged({ actionKind: "wait", beforeUrl: this.target?.url ?? "about:blank", readAfterUrl: () => this.target?.url ?? "about:blank", run: () => new Promise<void>((resolve, reject) => { const timer = setTimeout(resolve, durationMs); const abort = () => { clearTimeout(timer); reject(signal?.reason instanceof Error ? signal.reason : new Error("browser wait aborted")); }; signal?.addEventListener("abort", abort, { once: true }); }) });
    return this.action(createId("browser-wait"), `waited ${durationMs}ms for exact target`, started);
  }
  async releaseTargetForOperator(input: { reason: string }): Promise<BrowserActionResult> {
    const started = Date.now();
    const target = this.requireTarget();
    const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    this.releasedTargetRequest = {
      url: entry.descriptor.url,
      title: entry.descriptor.title || this.ownerId,
      reusePolicy: "reuse-exact-url",
    };
    try {
      await this.loggedTransportCommand({
        command: { kind: "release_target", tabId: entry.descriptor.tabId },
        expectedLoaderId: entry.descriptor.loaderId,
        mutationClass: "idempotent_mutation",
        timeoutMs: 10_000,
      }, entry.descriptor.url);
      return this.action(createId("browser-release-target"), input.reason, started);
    } finally {
      this.runtime.registry.release(target.targetRef);
      this.target = null;
    }
  }
  async closeTarget(input: Parameters<BrowserTargetSession["closeTarget"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now(); const target = this.requireTarget(); const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    const signal = this.runtime.signal(input.abortSignal);
    await this.loggedTransportCommand({ command: { kind: "close_target", tabId: entry.descriptor.tabId }, expectedLoaderId: entry.descriptor.loaderId, mutationClass: "non_idempotent_mutation", ...(signal ? { abortSignal: signal } : {}) }, entry.descriptor.url);
    const result = this.action(createId("browser-close-target"), input.reason, started); this.runtime.registry.close(target.targetRef); this.target = null; return result;
  }
  async close(): Promise<BrowserActionResult> {
    return this.closeTarget({ reason: `closed exact target session ${this.ownerId}` });
  }
  private requireTarget(): ControlledBrowserTarget {
    if (!this.target) throw new BrowserTerminalError("TARGET_NOT_FOUND", `owner ${this.ownerId} has not acquired a target`);
    return this.target;
  }
  private async ensureTarget(): Promise<ControlledBrowserTarget> {
    if (this.target) return this.target;
    if (!this.releasedTargetRequest) return this.requireTarget();
    const request = this.releasedTargetRequest;
    await this.open(request);
    return this.requireTarget();
  }
  private async command<T>(command: SessionWireCommand, mutationClass: BrowserMutationClass, abortSignal?: AbortSignal, timeoutMs?: number) {
    const target = await this.ensureTarget(); const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    const signal = this.runtime.signal(abortSignal);
    let response: { result: T };
    try {
      response = await this.loggedTransportCommand<T>({ command: { ...command, tabId: entry.descriptor.tabId } as import("../chrome-extension/protocol.js").BrowserWireCommand, expectedLoaderId: entry.descriptor.loaderId, mutationClass, ...(signal ? { abortSignal: signal } : {}), ...(timeoutMs ? { timeoutMs } : {}) }, entry.descriptor.url);
    } catch (error) {
      if (isRecoverableTargetLoss(error)) this.forgetTargetForRecovery();
      throw error;
    }
    try {
      if (command.kind !== "evaluate_target" && command.kind !== "screenshot_target") {
        this.target = this.runtime.registry.updateDocument(target.targetRef, response.result as BrowserWireTargetDescriptor);
      } else {
        let inspected: { result: BrowserWireTargetDescriptor };
        try {
          inspected = await this.loggedTransportCommand<BrowserWireTargetDescriptor>({
            command: { kind: "inspect_target", tabId: entry.descriptor.tabId },
            expectedLoaderId: entry.descriptor.loaderId,
            mutationClass: "observation",
            ...(signal ? { abortSignal: signal } : {}),
          }, entry.descriptor.url);
        } catch (error) {
          if (isRecoverableTargetLoss(error)) this.forgetTargetForRecovery();
          throw error;
        }
        this.target = this.runtime.registry.updateDocument(target.targetRef, inspected.result);
      }
    } catch (error) {
      if (mutationClass === "non_idempotent_mutation") {
        throw new BrowserTerminalError(
          "OUTCOME_UNKNOWN",
          error instanceof Error ? error.message : String(error),
          mutationClass,
        );
      }
      throw error;
    }
    return response;
  }
  private forgetTargetForRecovery(): void {
    if (!this.target) return;
    this.runtime.registry.close(this.target.targetRef);
    this.target = null;
    this.releasedTargetRequest = null;
  }
  private async loggedTransportCommand<T>(
    input: Parameters<BrowserNativeTransportServer["command"]>[0],
    beforeUrl: string,
  ) {
    let afterUrl = beforeUrl;
    return this.runtime.logged({
      actionKind: input.command.kind,
      beforeUrl,
      readAfterUrl: () => afterUrl,
      run: async () => {
        const response = await this.runtime.transport.command<T>(input);
        const result = response.result as { url?: unknown };
        if (typeof result?.url === "string") afterUrl = result.url;
        return response;
      },
    });
  }
  private action(actionId: string, message: string, startedAtMs: number): BrowserActionResult {
    const target = this.requireTarget(); const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    return { browserActionId: actionId, ok: true, message, createdAt: new Date().toISOString(), targetRef: target.targetRef, documentRef: target.documentRef, observedUrl: entry.descriptor.url, startedAt: new Date(startedAtMs).toISOString(), durationMs: Date.now() - startedAtMs };
  }
}
