import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createId } from "../../local-runtime/ids.js";
import { RuntimeLogEventType, type RuntimeLogger } from "../../runtime-logs/index.js";
import type { AuthenticatedBrowserAuthority } from "../authority/browser-authority-certificate.js";
import type { BrowserProfileEnrollment } from "../profile/browser-profile-enrollment.js";
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
import { issueBrowserFileArtifactGrant } from "./browser-file-artifact-grant.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";
import { BrowserTargetRegistry } from "./browser-target-registry.js";

type TargetedWireCommand = Exclude<import("../chrome-extension/protocol.js").BrowserWireCommand, { kind: "acquire_target" }>;
type WithoutTab<T> = T extends { tabId: number } ? Omit<T, "tabId"> : never;
type SessionWireCommand = WithoutTab<TargetedWireCommand>;

type AuthorityBinding = Readonly<{
  authorityId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  certificateHash: string;
}>;

const authorityBindingOf = (authority: AuthenticatedBrowserAuthority): AuthorityBinding => Object.freeze({
  authorityId: authority.certificate.authorityId,
  connectionGeneration: authority.certificate.connectionGeneration,
  nativePortEpoch: authority.certificate.nativePortEpoch,
  certificateHash: authority.certificate.certificateHash,
});

const hostOf = (value: string): string => {
  try { return new URL(value).host || "local"; } catch { return "unknown"; }
};

const sameRequestedUrl = (requested: string, observed: string): boolean => {
  try {
    const a = new URL(requested); const b = new URL(observed);
    return a.origin === b.origin && a.pathname === b.pathname;
  } catch { return requested === observed; }
};

const isRecoverableTargetLoss = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:DEVTOOLS_ATTACHMENT_CONFLICT:.*No tab with given id|TARGET_NOT_FOUND:.*No tab with given id)/iu
    .test(message);
};

export class BrowserCommandRuntime {
  readonly registry: BrowserTargetRegistry;
  readonly transport: BrowserNativeTransportServer;
  private readonly targetSessions = new Set<ExactBrowserTargetSession>();
  private readonly targetSessionsByOwner = new Map<string, ExactBrowserTargetSession>();
  private executionAbortSignal: AbortSignal | null = null;

  private constructor(
    controllerSessionId: string,
    socketPath: string,
    private readonly screenshotDir: string,
    readonly profileEnrollment: BrowserProfileEnrollment,
    private readonly approvedFileRoots: readonly string[],
    readonly runtimeLogger?: RuntimeLogger,
  ) {
    this.registry = new BrowserTargetRegistry(controllerSessionId);
    this.transport = new BrowserNativeTransportServer(
      controllerSessionId,
      socketPath,
      profileEnrollment.profileEnrollmentId,
      (event) => this.handleTransportLifecycle(event),
    );
  }

  static async create(input: Readonly<{
    controllerSessionId: string;
    socketPath: string;
    screenshotDir: string;
    profileEnrollment: BrowserProfileEnrollment;
    approvedFileRoots: readonly string[];
    runtimeLogger?: RuntimeLogger;
    authorityTimeoutMs?: number;
  }>): Promise<BrowserCommandRuntime> {
    const runtime = new BrowserCommandRuntime(
      input.controllerSessionId,
      input.socketPath,
      input.screenshotDir,
      input.profileEnrollment,
      input.approvedFileRoots,
      input.runtimeLogger,
    );
    await runtime.transport.waitForAuthority(input.authorityTimeoutMs ?? 30_000);
    return runtime;
  }

  targetCount(): number {
    return [...this.targetSessions].filter((value) => value.getTarget()?.lifecycle === "attached").length;
  }

  authoritySnapshot() { return this.transport.authoritySnapshot(); }

  setExecutionAbortSignal(signal: AbortSignal | null): void {
    this.executionAbortSignal = signal;
  }

  createTargetSession(ownerId: string): BrowserTargetSession {
    if (!ownerId.trim()) throw new Error("Browser target session requires an owner id");
    this.transport.requireAuthority();
    const existing = this.targetSessionsByOwner.get(ownerId);
    if (existing) {
      existing.assertAuthority();
      return existing;
    }
    const binding = authorityBindingOf(this.transport.requireAuthority());
    const session = new ExactBrowserTargetSession(this, ownerId, binding);
    this.targetSessions.add(session);
    this.targetSessionsByOwner.set(ownerId, session);
    return session;
  }

  assertAuthority(binding: AuthorityBinding): void {
    const current = this.transport.requireAuthority().certificate;
    if (
      current.authorityId !== binding.authorityId
      || current.certificateHash !== binding.certificateHash
      || current.connectionGeneration !== binding.connectionGeneration
      || current.nativePortEpoch !== binding.nativePortEpoch
    ) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        "browser target lease belongs to a retired authenticated authority",
      );
    }
  }

  signal(input?: AbortSignal): AbortSignal | undefined {
    return input ?? this.executionAbortSignal ?? undefined;
  }

  async close(): Promise<void> {
    this.registry.invalidateAll();
    for (const session of this.targetSessions) session.invalidateAuthority();
    await this.transport.close();
  }

  capturePath(actionId: string): string {
    return path.join(this.screenshotDir, `${actionId}.png`);
  }

  async writeCapture(filePath: string, data: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(data, "base64"), { mode: 0o600 });
  }

  async issueFileGrant(filePath: string) {
    return issueBrowserFileArtifactGrant({
      filePath,
      approvedRoots: this.approvedFileRoots,
    });
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
    if (event.stage === "authority_revoked" || event.stage === "disconnected") {
      this.registry.invalidateAll();
      for (const session of this.targetSessions) session.invalidateAuthority();
    }
    const failed = event.stage === "authority_revoked" || event.stage === "disconnected";
    this.runtimeLogger?.emit({
      traceId: `browser-authority-${event.generation}`,
      level: failed ? "error" : "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      eventType: failed
        ? RuntimeLogEventType.BROWSER_ACTION_FAILED
        : RuntimeLogEventType.BROWSER_ACTION_RESULT,
      owner: "browser-authority",
      status: failed ? "failed" : "success",
      reason: event.reason ?? `browser authority stage: ${event.stage}`,
      payload: {
        actionKind: "browser_authority_lifecycle",
        authorityStage: event.stage,
        connectionGeneration: event.generation,
      },
    });
  }
}

class ExactBrowserTargetSession implements BrowserTargetSession {
  private target: ControlledBrowserTarget | null = null;
  private valid = true;
  private releasedTargetRequest: {
    url: string;
    title: string;
    reusePolicy: BrowserOpenReusePolicy;
  } | null = null;

  constructor(
    private readonly runtime: BrowserCommandRuntime,
    readonly ownerId: string,
    private readonly authorityBinding: AuthorityBinding,
  ) {}

  assertAuthority(): void {
    if (!this.valid) {
      throw new BrowserTerminalError(
        "TRANSPORT_DISCONNECTED",
        `browser target lease for ${this.ownerId} has been revoked`,
      );
    }
    this.runtime.assertAuthority(this.authorityBinding);
  }

  getTarget(): ControlledBrowserTarget | null {
    try {
      this.assertAuthority();
      return this.target ? { ...this.target } : null;
    } catch {
      return null;
    }
  }

  invalidateAuthority(): void {
    this.valid = false;
    this.target = null;
    this.releasedTargetRequest = null;
  }

  setExecutionAbortSignal(signal: AbortSignal | null): void {
    this.assertAuthority();
    this.runtime.setExecutionAbortSignal(signal);
  }

  getHealth(): { ok: boolean; detail: string } {
    try {
      this.assertAuthority();
      return { ok: true, detail: `authenticated exact target authority present for ${this.ownerId}` };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : "browser authority absent" };
    }
  }

  getSessionState(): import("../browser-controller.js").BrowserStateSnapshot {
    this.assertAuthority();
    const profile = this.runtime.profileEnrollment;
    return {
      browserMode: "real_chrome_persistent",
      browserProfileRef: profile.profileRef,
      browserExecutablePath: profile.chromeExecutablePath,
      profileStatus: "profile_ready",
      profileDirectory: profile.profileDirectory,
      profileProvisioning: "operator_supplied",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: `authenticated profile enrollment ${profile.profileEnrollmentId}`,
      loginState: "unknown",
      loginRequiredReason: null,
      reviewRequiredReason: null,
      lastLoginCheckAt: new Date().toISOString(),
      open: this.target !== null,
      currentUrl: this.target?.url ?? "about:blank",
      currentTitle: this.target?.title ?? this.ownerId,
      browserExecutable: profile.chromeExecutablePath,
      exactTargetCount: this.runtime.targetCount(),
    };
  }

  async open(input: Parameters<BrowserTargetSession["open"]>[0]): Promise<BrowserOpenResult> {
    this.assertAuthority();
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
          this.assertAuthority();
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
    const started = Date.now();
    const geometry = await this.getGeometrySnapshot(input.abortSignal);
    await this.command({
      kind: "scroll_target",
      x: input.anchorPoint?.x ?? geometry.viewportWidth / 2,
      y: input.anchorPoint?.y ?? geometry.viewportHeight / 2,
      deltaX: input.deltaX,
      deltaY: input.deltaY,
    }, "idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-scroll"), `scrolled ${input.targetLabel} on exact target`, started);
  }

  async textInput(input: Parameters<BrowserTargetSession["textInput"]>[0]): Promise<BrowserActionResult> {
    const started = Date.now();
    await this.command({
      kind: "text_target",
      action: input.action,
      ...(input.text != null ? { text: input.text } : {}),
      ...(input.key != null ? { key: input.key } : {}),
    }, "non_idempotent_mutation", input.abortSignal);
    return this.action(createId("browser-text"), `sent text action to ${input.targetLabel} on exact target`, started);
  }

  async setFileInputFiles(input: Parameters<BrowserTargetSession["setFileInputFiles"]>[0]): Promise<BrowserActionResult> {
    this.assertAuthority();
    const started = Date.now();
    const grant = await this.runtime.issueFileGrant(input.filePath);
    this.assertAuthority();
    await this.command({
      kind: "set_file_input_files",
      selector: input.elementRef.selector,
      fileGrant: {
        grantId: grant.grantId,
        resolvedPath: grant.resolvedPath,
        size: grant.size,
        sha256: grant.sha256,
      },
    }, "non_idempotent_mutation", input.abortSignal, 30_000);
    return this.action(createId("browser-file-input"), input.description, started);
  }

  async screenshotRegion(input: Parameters<BrowserTargetSession["screenshotRegion"]>[0]): Promise<BrowserCaptureResult> {
    const started = Date.now();
    const actionId = createId("browser-capture");
    const result = (await this.command<{ data: string }>({ kind: "screenshot_target" }, "observation", input.abortSignal, 30_000)).result;
    const filePath = this.runtime.capturePath(actionId);
    await this.runtime.writeCapture(filePath, result.data);
    const target = this.requireTarget();
    const descriptor = this.runtime.registry.resolve(target.targetRef, target.documentRef).descriptor;
    return {
      browserActionId: actionId,
      pageUrl: descriptor.url,
      pageTitle: descriptor.title,
      regionLabel: input.regionLabel,
      regionType: "viewport",
      width: descriptor.viewportWidth,
      height: descriptor.viewportHeight,
      viewportWidth: descriptor.viewportWidth,
      viewportHeight: descriptor.viewportHeight,
      ...(input.contentLines ? { contentLines: input.contentLines } : {}),
      sourceFilePath: filePath,
      createdAt: new Date(started).toISOString(),
      targetRef: target.targetRef,
      documentRef: target.documentRef,
    };
  }

  async getGeometrySnapshot(abortSignal?: AbortSignal): Promise<BrowserGeometrySnapshot> {
    const target = await this.ensureTarget();
    const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    const signal = this.runtime.signal(abortSignal);
    let descriptor: BrowserWireTargetDescriptor;
    try {
      descriptor = (await this.loggedTransportCommand<BrowserWireTargetDescriptor>({
        command: { kind: "inspect_target", tabId: entry.descriptor.tabId },
        expectedLoaderId: entry.descriptor.loaderId,
        mutationClass: "observation",
        ...(signal ? { abortSignal: signal } : {}),
      }, entry.descriptor.url)).result;
    } catch (error) {
      if (isRecoverableTargetLoss(error)) this.forgetTargetForRecovery();
      throw error;
    }
    this.target = this.runtime.registry.updateDocument(target.targetRef, descriptor);
    return {
      windowX: 0,
      windowY: 0,
      viewportWidth: descriptor.viewportWidth,
      viewportHeight: descriptor.viewportHeight,
      screenshotWidth: Math.round(descriptor.viewportWidth * descriptor.deviceScaleFactor),
      screenshotHeight: Math.round(descriptor.viewportHeight * descriptor.deviceScaleFactor),
      scaleFactor: descriptor.deviceScaleFactor,
      currentUrl: descriptor.url,
      pageTitle: descriptor.title,
      visibleContentBounds: { x: 0, y: 0, width: descriptor.viewportWidth, height: descriptor.viewportHeight },
      capturedAt: new Date().toISOString(),
      targetRef: this.target.targetRef,
      documentRef: this.target.documentRef,
    };
  }

  async wait(durationMs: number, abortSignal?: AbortSignal): Promise<BrowserActionResult> {
    this.assertAuthority();
    const signal = this.runtime.signal(abortSignal);
    const started = Date.now();
    await this.runtime.logged({
      actionKind: "wait",
      beforeUrl: this.target?.url ?? "about:blank",
      readAfterUrl: () => this.target?.url ?? "about:blank",
      run: () => new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, durationMs);
        const abort = () => {
          clearTimeout(timer);
          reject(signal?.reason instanceof Error ? signal.reason : new Error("browser wait aborted"));
        };
        signal?.addEventListener("abort", abort, { once: true });
      }),
    });
    this.assertAuthority();
    return this.action(createId("browser-wait"), `waited ${durationMs}ms for exact target`, started);
  }

  async releaseTargetForOperator(input: { reason: string }): Promise<BrowserActionResult> {
    this.assertAuthority();
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
    const started = Date.now();
    const target = this.requireTarget();
    const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    const signal = this.runtime.signal(input.abortSignal);
    await this.loggedTransportCommand({
      command: { kind: "close_target", tabId: entry.descriptor.tabId },
      expectedLoaderId: entry.descriptor.loaderId,
      mutationClass: "non_idempotent_mutation",
      ...(signal ? { abortSignal: signal } : {}),
    }, entry.descriptor.url);
    const result = this.action(createId("browser-close-target"), input.reason, started);
    this.runtime.registry.close(target.targetRef);
    this.target = null;
    return result;
  }

  async close(): Promise<BrowserActionResult> {
    return this.closeTarget({ reason: `closed exact target lease ${this.ownerId}` });
  }

  private requireTarget(): ControlledBrowserTarget {
    this.assertAuthority();
    if (!this.target) throw new BrowserTerminalError("TARGET_NOT_FOUND", `owner ${this.ownerId} has not acquired a target`);
    return this.target;
  }

  private async ensureTarget(): Promise<ControlledBrowserTarget> {
    this.assertAuthority();
    if (this.target) return this.target;
    if (!this.releasedTargetRequest) return this.requireTarget();
    const request = this.releasedTargetRequest;
    await this.open(request);
    return this.requireTarget();
  }

  private async command<T>(
    command: SessionWireCommand,
    mutationClass: BrowserMutationClass,
    abortSignal?: AbortSignal,
    timeoutMs?: number,
  ) {
    this.assertAuthority();
    const target = await this.ensureTarget();
    const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    const signal = this.runtime.signal(abortSignal);
    let response: { result: T };
    try {
      response = await this.loggedTransportCommand<T>({
        command: { ...command, tabId: entry.descriptor.tabId } as import("../chrome-extension/protocol.js").BrowserWireCommand,
        expectedLoaderId: entry.descriptor.loaderId,
        mutationClass,
        ...(signal ? { abortSignal: signal } : {}),
        ...(timeoutMs ? { timeoutMs } : {}),
      }, entry.descriptor.url);
    } catch (error) {
      if (isRecoverableTargetLoss(error)) this.forgetTargetForRecovery();
      throw error;
    }
    this.assertAuthority();
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
    this.assertAuthority();
    if (!this.target) return;
    this.runtime.registry.close(this.target.targetRef);
    this.target = null;
    this.releasedTargetRequest = null;
  }

  private async loggedTransportCommand<T>(
    input: Parameters<BrowserNativeTransportServer["command"]>[0],
    beforeUrl: string,
  ) {
    this.assertAuthority();
    let afterUrl = beforeUrl;
    return this.runtime.logged({
      actionKind: input.command.kind,
      beforeUrl,
      readAfterUrl: () => afterUrl,
      run: async () => {
        this.assertAuthority();
        const response = await this.runtime.transport.command<T>(input);
        this.assertAuthority();
        const result = response.result as { url?: unknown };
        if (typeof result?.url === "string") afterUrl = result.url;
        return response;
      },
    });
  }

  private action(actionId: string, message: string, startedAtMs: number): BrowserActionResult {
    const target = this.requireTarget();
    const entry = this.runtime.registry.resolve(target.targetRef, target.documentRef);
    return {
      browserActionId: actionId,
      ok: true,
      message,
      createdAt: new Date().toISOString(),
      targetRef: target.targetRef,
      documentRef: target.documentRef,
      observedUrl: entry.descriptor.url,
      startedAt: new Date(startedAtMs).toISOString(),
      durationMs: Date.now() - startedAtMs,
    };
  }
}
