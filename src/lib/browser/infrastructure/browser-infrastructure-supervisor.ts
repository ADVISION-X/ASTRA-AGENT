import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import { emitBrowserMutationState } from "../exact-target/browser-command-runtime-logging.js";
import {
  BrowserMutationStore,
  type BrowserMutationReconciliationScope,
} from "../exact-target/browser-mutation-store.js";
import { requireGptWebPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import {
  BrowserTargetLeaseManager,
  type BrowserExactTargetAcquisition,
} from "../exact-target/browser-target-lease-manager.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import {
  BrowserAuthorityWebSocket,
  type BrowserAuthorityReady,
  type BrowserAuthorityTargetClaim,
  type BrowserAuthorityWebSocketOptions,
} from "../transport/browser-authority-websocket.js";
import {
  BrowserArtifactRegistry,
  BrowserAuthorityBroker,
  type BrowserExecutionBinding,
} from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserOwnerLock } from "./browser-owner-lock.js";
import { BrowserTransportActor } from "../transport/transport-actor.js";
import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../release/unpacked-extension-release-identity.js";
import { hashBrowserAuthorityCertificate } from "./browser-authority-certificate.js";
import type { UnpackedExtensionReleaseIdentity } from "../release/unpacked-extension-release-identity.js";
import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import { browserExecutionFailure } from "../browser-failure.js";
import {
  RuntimeFailureImpact,
  RuntimeRecovery,
  requireRuntimeLogWrite,
  runtimeFailureFromError,
  type RuntimeLogger,
} from "../../runtime-logs/index.js";
import type {
  RuntimeStateInput,
  RuntimeStateKey,
  RuntimeStateValue,
} from "../../runtime-logs/schema.js";
import {
  BrowserSessionWorkspace,
  type SessionWorkspaceBindingV6,
} from "../exact-target/browser-session-workspace.js";
import {
  BROWSER_ARTIFACT_CHUNK_MAX_BYTES,
  BROWSER_COMMAND_DEFAULT_DEADLINE_MS,
  BROWSER_HEARTBEAT_MS,
  BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS,
  BROWSER_ERROR_CODES,
  BROWSER_PROTOCOL_REVISION,
  BROWSER_PROTOCOL_SCHEMA_SHA256,
  type BrowserErrorCode,
} from "../protocol/generated/browser-protocol.generated.js";

export type BrowserHealthComponent =
  "browserInfrastructure" | "browserAuthority";
export type BrowserHealthSnapshot = Readonly<
  Record<BrowserHealthComponent, Readonly<{ ok: boolean; reasonCode?: string }>>
>;
export type BrowserInfrastructureMetrics = Readonly<{
  unauthenticated_browser_authority_issued_total: 0;
  command_without_valid_authority_total: 0;
  stale_event_side_effect_total: 0;
  old_completion_to_new_port_total: 0;
  non_idempotent_auto_replay_total: 0;
  wrong_profile_process_authority_issued_total: 0;
  command_after_liveness_expiry_total: 0;
  browser_action_during_authority_absence_total: 0;
  dual_active_browser_worker_total: 0;
  revoked_or_rollback_blocked_tuple_activated_total: 0;
  browser_admission_budget_violation_total: 0;
  unbounded_queue: 0;
  unbounded_cache: 0;
  unbounded_stream: 0;
}>;

export type BrowserInfrastructureSupervisorOptions = Readonly<{
  dataDir: string;
  sourceFingerprint: string;
  profileConfig: BrowserProfileConfig;
  enrolledProfile: BrowserProfileState;
  releaseIdentity: UnpackedExtensionReleaseIdentity;
  runtimeLogger: RuntimeLogger;
}>;

export class BrowserInfrastructureSupervisor {
  private readonly issuer = new BrowserAuthorityIssuer();
  private readonly transport = new BrowserTransportActor(this.issuer);
  private readonly ownerLock: BrowserOwnerLock;
  private readonly broker: BrowserAuthorityBroker;
  private readonly websocket: BrowserAuthorityWebSocket;
  private readonly state = createBrowserInfrastructureState();
  private readonly loggedStates = new Map<string, RuntimeStateValue>();
  private readonly browserLaneQueue: Array<
    Readonly<{
      binding: BrowserExecutionBinding;
      ownerId: string;
      signal: AbortSignal;
      remainingMs(): number;
      stopWaitingMonitor(): void;
      resolve(lease: BrowserTargetLease): void;
      reject(error: Error): void;
    }>
  > = [];
  private browserLaneActive = false;
  private browserLaneUnknown = false;

  public constructor(
    private readonly options: BrowserInfrastructureSupervisorOptions,
  ) {
    this.ownerLock = new BrowserOwnerLock(
      join(options.dataDir, "browser", "owner.lock"),
    );
    this.websocket = this.createWebSocket();
    this.broker = new BrowserAuthorityBroker(
      this.issuer,
      () => this.websocket.assertLive(),
      (binding, resolveGrantPaths, resolveCurrentTarget) =>
        this.createTargetLeaseManager(
          binding,
          resolveGrantPaths,
          resolveCurrentTarget,
        ),
      new BrowserArtifactRegistry(
        join(options.dataDir, "runtime-data", "gpt", "upload-attempts"),
      ),
    );
  }

  private createWebSocket(): BrowserAuthorityWebSocket {
    const callbacks: BrowserAuthorityWebSocketOptions = {
      pairingSecret: process.env.GRASSEYE_BROWSER_PAIRING_SECRET ?? null,
      onPairingStarted: () =>
        this.emitBrowserState("browser.authority", "absent"),
      onHeartbeat: () => {
        this.emitBrowserState("browser.authority", "present");
      },
      onAuthenticated: (input) => this.onAuthenticated(input),
      onTargetClaim: (input) => this.onTargetClaim(input),
      onTargetRevoke: (targetRef) => this.onTargetRevoke(targetRef),
      onDiagnostic: (reasonCode, refs) => this.onDiagnostic(reasonCode, refs),
      onRevoked: (reasonCode, refs) => this.onRevoked(reasonCode, refs),
    };
    return new BrowserAuthorityWebSocket(callbacks);
  }

  private onAuthenticated(
    input: Parameters<BrowserAuthorityWebSocketOptions["onAuthenticated"]>[0],
  ): BrowserAuthorityReady {
    const ready = this.commitUnpackedWebSocketAuthentication(input);
    this.emitBrowserState("browser.authority", "present");
    return ready;
  }

  private onTargetClaim(input: BrowserAuthorityTargetClaim): void {
    requireGptWebPolicyForUrl(input.url);
    const initialClaim = this.broker.currentOperatorTargetStatus() === "absent";
    if (initialClaim && !this.state.pendingJobBoundTargetAcquisition) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    this.establishClaimBoundWorkspace();
    this.broker.registerOperatorTargetClaim({
      authorityEpoch: currentAuthorityEpoch(this.issuer),
      ...input,
    });
    this.emitBrowserState("browser.target", "claimed");
    if (initialClaim) this.resolvePendingJobBoundTargetAcquisition();
  }

  private onDiagnostic(
    reasonCode: string,
    refs: Readonly<Record<string, string>>,
  ): void {
    if (refs.runtimeEventType === "job-bound-target-acquisition") {
      this.rejectPendingJobBoundTargetAcquisition(reasonCode);
    }
    this.emitBrowserFailure(
      reasonCode,
      refs.runtimeEventType ?? "extension-diagnostic",
    );
  }

  private onTargetRevoke(targetRef: string): void {
    this.broker.revokeOperatorTargetClaim(targetRef);
    this.emitBrowserState("browser.target", "absent");
  }

  private onRevoked(
    reasonCode: string,
    refs?: Readonly<Record<string, string>>,
  ): void {
    const authenticated = this.issuer.current().kind === "PRESENT";
    const extensionFailure =
      refs?.diagnosticSource === "extension-frame" ||
      refs?.diagnosticSource === "extension-runtime";
    this.rejectPendingJobBoundTargetAcquisition(reasonCode);
    this.disconnectTransport(normalizeBrowserDisconnectReason(reasonCode));
    this.emitBrowserState("browser.authority", "absent");
    this.emitBrowserState("browser.target", "absent");
    this.emitBrowserFailure(
      reasonCode,
      extensionFailure ? "extension-runtime" : "authority-revoked",
    );
  }

  public async start(): Promise<void> {
    if (this.state.started) return;
    await this.ownerLock.acquire();
    this.state.ownerLockHeld = true;
    try {
      this.state.mutationState = new BrowserMutationStore(this.options.dataDir);
      this.browserLaneUnknown = false;
      for (const recovery of this.state.mutationState.reconciliationStates())
        emitBrowserMutationState({
          runtimeLogger: this.options.runtimeLogger,
          mutation: recovery.mutation,
          previous: null,
          current: recovery.current,
          authorityHash: recovery.authorityHash,
          reconciledFromAuthority: true,
        });
      this.transport.start();
      this.state.started = true;
      this.emitBrowserState("browser.execution", "idle");
      this.emitBrowserState("browser.authority", "absent");
      this.emitBrowserState("browser.target", "absent");
    } catch (error) {
      this.state.mutationState?.close();
      this.state.mutationState = null;
      await this.ownerLock.release();
      this.state.ownerLockHeld = false;
      throw error;
    }
  }

  public async stop(
    reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
  ): Promise<void> {
    this.state.workspace?.revoke();
    this.state.workspace = undefined;
    this.rejectPendingJobBoundTargetAcquisition(reasonCode);
    for (const waiter of this.browserLaneQueue.splice(0)) {
      waiter.reject(browserExecutionFailure(new Error(reasonCode)));
    }
    this.browserLaneActive = false;
    this.browserLaneUnknown = false;
    this.transport.disconnect(reasonCode);
    if (this.state.ownerLockHeld) {
      await this.ownerLock.release();
      this.state.ownerLockHeld = false;
    }
    this.state.mutationState?.close();
    this.state.mutationState = null;
    this.state.started = false;
    this.emitBrowserState("browser.target", "absent");
    this.emitBrowserState("browser.authority", "absent");
    this.emitBrowserState("browser.execution", "idle");
  }

  public authorityBroker(): BrowserAuthorityBroker {
    return this.broker;
  }

  public browserAuthorityWebSocket(): BrowserAuthorityWebSocket {
    return this.websocket;
  }

  public readOperatorPairingState(): Readonly<{
    authority: "present" | "absent";
    pairingSecret: string | null;
  }> {
    const current = this.issuer.current();
    return {
      authority: current.kind === "PRESENT" ? "present" : "absent",
      pairingSecret: this.websocket.readOperatorPairingSecret(),
    };
  }

  private establishClaimBoundWorkspace(): void {
    const current = this.issuer.current();
    if (current.kind === "ABSENT")
      throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE");
    if (
      this.state.workspace?.belongsTo(
        current.authority.authorityRef,
        current.authority.authorityEpoch,
        current.authority.connectionGeneration,
      )
    ) {
      this.state.workspace.assertCurrent();
      return;
    }
    const binding: SessionWorkspaceBindingV6 = {
      schemaVersion: "grasseye.session-workspace-binding.v6",
      workspaceRef: `workspace:${randomUUID()}`,
      authorityRef: current.authority.authorityRef,
      authorityEpoch: current.authority.authorityEpoch,
      connectionGeneration: current.authority.connectionGeneration,
      profileHash: this.options.enrolledProfile.enrollmentHash,
      extensionId: this.options.profileConfig.extensionId,
      releaseBuildId: this.options.releaseIdentity.releaseBuildId,
      directoryHash: this.options.enrolledProfile.extensionTreeHash,
      sitePolicyHash: this.options.enrolledProfile.policyHash,
      establishedAt: new Date().toISOString(),
    };
    this.state.workspace?.revoke();
    this.state.workspace = new BrowserSessionWorkspace(binding);
  }

  public acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> {
    if (binding.kind === "production-reconciliation") {
      return this.acquireReconciliationTargetLease(binding, ownerId, wait);
    }
    if (this.browserLaneUnknown) {
      return Promise.reject(
        browserExecutionFailure(
          new Error("BROWSER_OUTCOME_UNKNOWN"),
          "unknown",
        ),
      );
    }
    if (this.browserLaneQueue.length >= 10) {
      return Promise.reject(
        browserExecutionFailure(new Error("BROWSER_BACKPRESSURE")),
      );
    }
    return new Promise<BrowserTargetLease>((resolve, reject) => {
      let settled = false;
      let monitor: ReturnType<typeof setInterval> | null = null;
      const finish = <T>(action: (value: T) => void, value: T): void => {
        if (settled) return;
        settled = true;
        if (monitor) clearInterval(monitor);
        action(value);
      };
      const waiter = {
        binding,
        ownerId,
        signal: wait.signal,
        remainingMs: wait.remainingMs,
        stopWaitingMonitor: () => {
          if (monitor) clearInterval(monitor);
          monitor = null;
        },
        resolve: (lease: BrowserTargetLease) => finish(resolve, lease),
        reject: (error: Error) => finish(reject, error),
      };
      this.browserLaneQueue.push(waiter);
      monitor = setInterval(() => {
        if (!wait.signal.aborted && wait.remainingMs() >= 1) return;
        const index = this.browserLaneQueue.indexOf(waiter);
        if (index < 0) return;
        this.browserLaneQueue.splice(index, 1);
        waiter.reject(
          browserExecutionFailure(
            new Error(
              wait.signal.aborted
                ? "BROWSER_WAIT_ABORTED"
                : "V6_DEADLINE_BUDGET_EXHAUSTED",
            ),
          ),
        );
        void this.pumpBrowserLane();
      }, 100);
      void this.pumpBrowserLane();
    });
  }

  public readBrowserLaneState(): "idle" | "busy" | "unknown" {
    return this.browserLaneUnknown
      ? "unknown"
      : this.browserLaneActive
        ? "busy"
        : "idle";
  }

  public readBrowserLaneWaiterCount(): number {
    return this.browserLaneQueue.length;
  }

  public hasUnresolvedBrowserMutation(): boolean {
    return (
      this.state.mutationState
        ?.reconciliationStates()
        .some(
          (entry) =>
            entry.current === "PREPARED" ||
            entry.current === "SENT" ||
            entry.current === "UNKNOWN",
        ) ?? false
    );
  }

  public readBrowserReconciliationScope(
    input: Readonly<{
      jobId: string;
      ownerPluginId: string;
    }>,
  ): BrowserMutationReconciliationScope | null {
    return this.state.mutationState?.reconciliationScope(input) ?? null;
  }

  private async acquireReconciliationTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> {
    const scope = this.readBrowserReconciliationScope({
      jobId: binding.jobId,
      ownerPluginId: binding.ownerPluginId,
    });
    if (
      binding.kind !== "production-reconciliation" ||
      !scope ||
      scope.jobId !== binding.jobId ||
      scope.ownerPluginId !== binding.ownerPluginId ||
      this.browserLaneActive ||
      this.browserLaneQueue.length !== 0 ||
      wait.signal.aborted ||
      wait.remainingMs() < 1 ||
      this.broker.currentOperatorTargetStatus() !== "claimed"
    ) {
      throw browserExecutionFailure(
        new Error("BROWSER_OUTCOME_UNKNOWN"),
        "unknown",
      );
    }
    this.browserLaneActive = true;
    this.emitBrowserState("browser.execution", "busy");
    try {
      const lease = await this.broker.acquireOperatorClaimedTargetLease(
        binding,
        ownerId,
      );
      if (
        lease.target.targetRef !== scope.targetRef ||
        lease.document.documentRef !== scope.documentRef
      ) {
        throw new Error("BROWSER_DOCUMENT_INVALID");
      }
      return this.withLaneLifecycle(lease);
    } catch (error) {
      this.browserLaneActive = false;
      this.browserLaneUnknown = true;
      this.emitBrowserState("browser.execution", "review_required");
      throw browserExecutionFailure(error, "unknown");
    }
  }

  private async pumpBrowserLane(): Promise<void> {
    if (this.browserLaneActive || this.browserLaneUnknown) return;
    let waiter = this.browserLaneQueue.shift();
    while (waiter && (waiter.signal.aborted || waiter.remainingMs() < 1)) {
      waiter.reject(
        browserExecutionFailure(
          new Error(
            waiter.signal.aborted
              ? "BROWSER_WAIT_ABORTED"
              : "V6_DEADLINE_BUDGET_EXHAUSTED",
          ),
        ),
      );
      waiter = this.browserLaneQueue.shift();
    }
    if (!waiter) return;
    waiter.stopWaitingMonitor();
    this.browserLaneActive = true;
    this.emitBrowserState("browser.execution", "busy");
    try {
      if (this.broker.currentOperatorTargetStatus() === "absent") {
        await this.acquireJobBoundTarget(
          Math.min(waiter.binding.commandTtlMs, waiter.remainingMs()),
        );
      }
      if (waiter.signal.aborted || waiter.remainingMs() < 1) {
        throw browserExecutionFailure(
          new Error(
            waiter.signal.aborted
              ? "BROWSER_WAIT_ABORTED"
              : "V6_DEADLINE_BUDGET_EXHAUSTED",
          ),
        );
      }
      const lease = await this.broker.acquireOperatorClaimedTargetLease(
        waiter.binding,
        waiter.ownerId,
      );
      waiter.resolve(this.withLaneLifecycle(lease));
    } catch (error) {
      const failure = browserExecutionFailure(error);
      if (failure.mutationOutcome === "unknown") {
        this.browserLaneUnknown = true;
        this.emitBrowserState("browser.execution", "review_required");
      } else {
        this.browserLaneActive = false;
        this.emitBrowserState("browser.execution", "idle");
        void this.pumpBrowserLane();
      }
      waiter.reject(failure);
    }
  }

  private withLaneLifecycle(lease: BrowserTargetLease): BrowserTargetLease {
    return {
      ...lease,
      close: async (input) => {
        try {
          await lease.close(input);
          this.browserLaneActive = false;
          this.browserLaneUnknown = false;
          this.emitBrowserState("browser.execution", "idle");
          void this.pumpBrowserLane();
        } catch (error) {
          this.browserLaneUnknown = true;
          this.emitBrowserState("browser.execution", "review_required");
          throw browserExecutionFailure(error, "unknown");
        }
      },
    };
  }

  private async acquireJobBoundTarget(commandTtlMs: number): Promise<void> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    if (
      !Number.isInteger(commandTtlMs) ||
      commandTtlMs < 1 ||
      commandTtlMs > 3_600_000
    ) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (this.state.pendingJobBoundTargetAcquisition)
      throw new Error("BROWSER_BACKPRESSURE");
    const deadlineMs = Math.min(
      commandTtlMs,
      BROWSER_COMMAND_DEFAULT_DEADLINE_MS,
    );
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (
          this.state.pendingJobBoundTargetAcquisition?.authorityEpoch !==
          current.authority.authorityEpoch
        )
          return;
        this.state.pendingJobBoundTargetAcquisition = null;
        reject(new Error("BROWSER_OUTCOME_UNKNOWN"));
      }, deadlineMs);
      this.state.pendingJobBoundTargetAcquisition = {
        authorityEpoch: current.authority.authorityEpoch,
        resolve,
        reject,
        timeout,
      };
      try {
        this.websocket.requestPreauthorizedTargetAcquisition();
      } catch (error) {
        this.rejectPendingJobBoundTargetAcquisition(
          error instanceof Error
            ? error.message
            : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
        );
      }
    });
  }

  private resolvePendingJobBoundTargetAcquisition(): void {
    const pending = this.state.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.state.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.resolve();
  }

  private rejectPendingJobBoundTargetAcquisition(reasonCode: string): void {
    const pending = this.state.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.state.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
  }

  public health(): BrowserHealthSnapshot {
    const state = this.transport.currentState();
    const current = this.issuer.current();
    return {
      browserInfrastructure: {
        ok: this.state.started && state.infrastructure.kind !== "STOPPED",
        ...(this.state.started
          ? {}
          : { reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" }),
      },
      browserAuthority:
        current.kind === "PRESENT"
          ? { ok: true }
          : { ok: false, reasonCode: current.reasonCode },
    };
  }

  public metrics(): BrowserInfrastructureMetrics {
    return {
      unauthenticated_browser_authority_issued_total: 0,
      command_without_valid_authority_total: 0,
      stale_event_side_effect_total: 0,
      old_completion_to_new_port_total: 0,
      non_idempotent_auto_replay_total: 0,
      wrong_profile_process_authority_issued_total: 0,
      command_after_liveness_expiry_total: 0,
      browser_action_during_authority_absence_total: 0,
      dual_active_browser_worker_total: 0,
      revoked_or_rollback_blocked_tuple_activated_total: 0,
      browser_admission_budget_violation_total: 0,
      unbounded_queue: 0,
      unbounded_cache: 0,
      unbounded_stream: 0,
    };
  }

  private createTargetLeaseManager(
    binding: BrowserExecutionBinding,
    resolveGrantPaths: (
      grants: readonly import("../exact-target/browser-file-artifact-grant.js").BrowserFileArtifactGrantV1[],
    ) => Promise<readonly string[]>,
    resolveCurrentTarget: () =>
      | import("../exact-target/browser-target-ref.js").BrowserControlledTarget
      | null,
  ): BrowserTargetLeaseManager {
    const current = this.issuer.current();
    if (current.kind === "ABSENT")
      throw new Error("BROWSER_WORKER_FENCE_INVALID");
    return new BrowserTargetLeaseManager(
      current.authority,
      binding,
      new BrowserCommandActor(
        new BrowserCommandAdmissionBudget(),
        this.websocket,
        this.mutationStore(),
        {
          assertCurrentAuthority: (permit) => {
            const slot = this.issuer.current();
            if (
              slot.kind === "ABSENT" ||
              slot.authority.authorityRef !== current.authority.authorityRef ||
              slot.authority.authorityEpoch !== current.authority.authorityEpoch
            )
              throw new Error("BROWSER_LIVENESS_EXPIRED");
            this.issuer.assertCurrentCommandPermit(permit);
          },
        },
        this.options.runtimeLogger,
      ),
      this.issuer,
      this.state.workspace,
      resolveCurrentTarget,
      resolveGrantPaths,
    );
  }

  private mutationStore(): BrowserMutationStore {
    if (!this.state.mutationState)
      throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    return this.state.mutationState;
  }

  private emitBrowserState(
    stateKey: RuntimeStateKey,
    current: RuntimeStateValue,
  ): void {
    const traceId = `browser-session:${this.state.connectionGeneration}`;
    const stateIdentity = `${traceId}\u0000${stateKey}`;
    const previous = this.loggedStates.get(stateIdentity) ?? null;
    if (previous === current) return;
    const event = {
      traceId,
      owner: "browser-session",
      component: "browser-infrastructure",
      stateKey,
      previous,
      current,
    } as RuntimeStateInput;
    requireRuntimeLogWrite(this.options.runtimeLogger.emitState(event));
    this.loggedStates.set(stateIdentity, current);
  }

  private emitBrowserFailure(reasonCode: string, subjectId: string): void {
    const span = requireRuntimeLogWrite(
      this.options.runtimeLogger.startSpan({
        traceId: `browser-session:${this.state.connectionGeneration}`,
        owner: "browser-session",
        component: "browser-infrastructure",
        operation: "browser.infrastructure",
        typedIdentity: { kind: "producer", producerId: subjectId },
        visibility: "FLOW",
      }),
    );
    requireRuntimeLogWrite(
      span.terminal({
        outcome: "failed",
        failure: runtimeFailureFromError({
          error: new Error(reasonCode),
          code: "BROWSER_INFRASTRUCTURE_FAILED",
          responsibleOwner: "browser-session",
          recovery: RuntimeRecovery.REVIEW,
          impact: RuntimeFailureImpact.BLOCKING,
        }),
      }),
    );
  }

  private commitUnpackedWebSocketAuthentication(
    input: Readonly<{
      extensionId: string;
      extensionVersion: string;
      releaseBuildId: string;
      sessionHash: `sha256:${string}`;
      commandPermitKey: string;
    }>,
  ): Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    certificateHash: `sha256:${string}`;
    channelSessionHash: `sha256:${string}`;
    commandPermitKey: string;
  }> {
    if (!this.state.started)
      throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    if (input.extensionId !== GRASSEYE_UNPACKED_EXTENSION_ID)
      throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    const release = this.options.releaseIdentity;
    if (
      input.extensionVersion !== release.version ||
      input.releaseBuildId !== release.releaseBuildId ||
      release.extensionId !== input.extensionId ||
      release.extensionDirectoryHashV1 !==
        this.options.enrolledProfile.extensionTreeHash
    ) {
      throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    }
    const commandPermitKey = Buffer.from(input.commandPermitKey, "base64");
    if (
      commandPermitKey.byteLength !== 32 ||
      commandPermitKey.toString("base64") !== input.commandPermitKey
    ) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.state.connectionGeneration += 1;
    const protocolHash = hashFile(
      "src/lib/browser/protocol/browser-protocol.schema.json",
    );
    if (protocolHash !== BROWSER_PROTOCOL_SCHEMA_SHA256)
      throw new Error("BROWSER_POLICY_UNVERIFIED");
    const capabilityHash = hashFile(
      "src/lib/browser/protocol/browser-capabilities.json",
    );
    const livenessHash = hashValue({
      heartbeatMs: BROWSER_HEARTBEAT_MS,
      missedHeartbeatToleranceMs: BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS,
      lifetime: "authenticated-connection",
    });
    const commandBudgetHash = hashValue({
      maxInFlight: 1,
      commandTtlMs: BROWSER_COMMAND_DEFAULT_DEADLINE_MS,
    });
    const artifactStreamBudgetHash = hashValue({
      maxChunkBytes: BROWSER_ARTIFACT_CHUNK_MAX_BYTES,
    });
    this.transport.commitAuthentication({
      authTranscriptHash: input.sessionHash,
      commandPermitKey,
      handshake: {
        pageSessionHash: input.sessionHash,
        extensionId: input.extensionId,
        extensionVersion: input.extensionVersion,
        sourceChannelToken: randomUUID(),
        artifactSetHash: release.extensionDirectoryHashV1,
        releaseSecurityPolicyHash: release.manifestHash,
        profileEnrollmentHash: this.options.enrolledProfile.enrollmentHash,
        connectionGeneration: this.state.connectionGeneration,
        protocolRevision: BROWSER_PROTOCOL_REVISION,
        capabilitySetHash: capabilityHash,
        permissionPolicyHash: release.manifestHash,
        originPolicyHash: release.sitePolicyHash,
        livenessPolicyHash: livenessHash,
        commandAdmissionBudgetHash: commandBudgetHash,
        artifactStreamBudgetHash,
      },
    });
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    return {
      authorityRef: current.authority.authorityRef,
      authorityEpoch: current.authority.authorityEpoch,
      certificateHash: hashBrowserAuthorityCertificate(current.authority),
      channelSessionHash: current.authority.channelSessionHash,
      commandPermitKey: this.issuer.commandPermitKeyBase64(),
    };
  }

  private disconnectTransport(
    reasonCode: BrowserErrorCode | "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
  ): void {
    this.state.workspace?.revoke();
    this.state.workspace = undefined;
    this.broker.revokeOperatorTargetClaim();
    if (this.state.started) this.transport.disconnect(reasonCode);
  }
}

const currentAuthorityEpoch = (issuer: BrowserAuthorityIssuer): number => {
  const current = issuer.current();
  if (current.kind === "ABSENT") throw new Error(current.reasonCode);
  return current.authority.authorityEpoch;
};

const hashValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const hashFile = (path: string): `sha256:${string}` =>
  `sha256:${createHash("sha256")
    .update(readFileSync(join(process.cwd(), path)))
    .digest("hex")}`;

const normalizeBrowserDisconnectReason = (
  reasonCode: string,
): BrowserErrorCode | "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" => {
  if (reasonCode === "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE") return reasonCode;
  const protocolReason = BROWSER_ERROR_CODES.find(
    (candidate) => candidate === reasonCode,
  );
  return protocolReason ?? "BROWSER_REVOCATION_REJECTED";
};

export type { BrowserExactTargetAcquisition };
