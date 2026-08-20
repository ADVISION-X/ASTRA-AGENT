import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  RuntimeLogEventType,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";
import type { AuthenticatedBrowserAuthority } from "../authority/browser-authority-certificate.js";
import type { BrowserProfileEnrollment } from "../profile/browser-profile-enrollment.js";
import { runLoggedBrowserValueAction } from "../current-chrome-browser-action-logging.js";
import type {
  BrowserActionResult,
  BrowserTargetSession,
} from "../browser-controller.js";
import { BrowserNativeTransportServer } from "./browser-native-transport-server.js";
import { BrowserTerminalError } from "./browser-command-contract.js";
import { issueBrowserFileArtifactGrant } from "./browser-file-artifact-grant.js";
import { ExactBrowserTargetSession } from "./exact-browser-target-session.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";
import { BrowserTargetRegistry } from "./browser-target-registry.js";

export type AuthorityBinding = Readonly<{
  authorityId: string;
  connectionGeneration: number;
  nativePortEpoch: number;
  certificateHash: string;
}>;

const authorityBindingOf = (
  authority: AuthenticatedBrowserAuthority,
): AuthorityBinding =>
  Object.freeze({
    authorityId: authority.certificate.authorityId,
    connectionGeneration: authority.certificate.connectionGeneration,
    nativePortEpoch: authority.certificate.nativePortEpoch,
    certificateHash: authority.certificate.certificateHash,
  });

export class BrowserCommandRuntime {
  readonly registry: BrowserTargetRegistry;
  readonly transport: BrowserNativeTransportServer;
  private readonly targetSessions = new Set<ExactBrowserTargetSession>();
  private readonly targetSessionsByOwner = new Map<
    string,
    ExactBrowserTargetSession
  >();
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

  static async create(
    input: Readonly<{
      controllerSessionId: string;
      socketPath: string;
      screenshotDir: string;
      profileEnrollment: BrowserProfileEnrollment;
      approvedFileRoots: readonly string[];
      runtimeLogger?: RuntimeLogger;
      authorityTimeoutMs?: number;
    }>,
  ): Promise<BrowserCommandRuntime> {
    const runtime = new BrowserCommandRuntime(
      input.controllerSessionId,
      input.socketPath,
      input.screenshotDir,
      input.profileEnrollment,
      input.approvedFileRoots,
      input.runtimeLogger,
    );
    await runtime.transport.waitForAuthority(
      input.authorityTimeoutMs ?? 30_000,
    );
    return runtime;
  }

  targetCount(): number {
    return [...this.targetSessions].filter(
      (value) => value.getTarget()?.lifecycle === "attached",
    ).length;
  }

  authoritySnapshot() {
    return this.transport.authoritySnapshot();
  }

  setExecutionAbortSignal(signal: AbortSignal | null): void {
    this.executionAbortSignal = signal;
  }

  createTargetSession(ownerId: string): BrowserTargetSession {
    if (!ownerId.trim())
      throw new Error("Browser target session requires an owner id");
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
      current.authorityId !== binding.authorityId ||
      current.certificateHash !== binding.certificateHash ||
      current.connectionGeneration !== binding.connectionGeneration ||
      current.nativePortEpoch !== binding.nativePortEpoch
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

  action(
    target: ControlledBrowserTarget,
    actionId: string,
    message: string,
    startedAtMs: number,
  ): BrowserActionResult {
    const entry = this.registry.resolve(target.targetRef, target.documentRef);
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

  private handleTransportLifecycle(
    event: import("./browser-native-transport-server.js").BrowserTransportLifecycleEvent,
  ): void {
    if (event.stage === "authority_revoked" || event.stage === "disconnected") {
      this.registry.invalidateAll();
      for (const session of this.targetSessions) session.invalidateAuthority();
    }
    const failed =
      event.stage === "authority_revoked" || event.stage === "disconnected";
    this.runtimeLogger?.emit({
      traceId: `browser-authority-${event.generation}`,
      level: failed ? "error" : "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      eventType: failed
        ? RuntimeLogEventType.BROWSER_ACTION_FAILED
        : RuntimeLogEventType.BROWSER_ACTION_RESULT,
      owner: "browser-session",
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
