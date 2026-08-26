import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../exact-target/browser-mutation-store.js";
import { requireGptWebChatPolicyForUrl } from "../exact-target/browser-site-policy-registry.js";
import { BrowserTargetLeaseManager, type BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import {
  BrowserAuthorityWebSocket,
  type BrowserAuthorityReady,
  type BrowserAuthorityTargetClaim,
  type BrowserAuthorityWebSocketOptions,
} from "../transport/browser-authority-websocket.js";
import { BrowserArtifactRegistry, BrowserAuthorityBroker, type BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import { BrowserOwnerLock } from "./browser-owner-lock.js";
import { BrowserTransportActor } from "../transport/transport-actor.js";
import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../release/unpacked-extension-release-identity.js";
import { hashBrowserAuthorityCertificate } from "./browser-authority-certificate.js";
import type { UnpackedExtensionReleaseIdentity } from "../release/unpacked-extension-release-identity.js";
import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import { createRuntimeEvent, RuntimeLogEventType, type RuntimeLogger } from "../../runtime-logs/index.js";
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

export type BrowserHealthComponent = "browserInfrastructure" | "browserAuthority";
export type BrowserHealthSnapshot = Readonly<Record<BrowserHealthComponent, Readonly<{ ok: boolean; reasonCode?: string }>>>;
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

type PendingJobBoundTargetAcquisition = Readonly<{
  authorityEpoch: number;
  resolve(): void;
  reject(error: Error): void;
  timeout: ReturnType<typeof setTimeout>;
}>;

export class BrowserInfrastructureSupervisor {
  private readonly issuer = new BrowserAuthorityIssuer();
  private readonly transport = new BrowserTransportActor(this.issuer);
  private readonly ownerLock: BrowserOwnerLock;
  private readonly broker: BrowserAuthorityBroker;
  private readonly websocket: BrowserAuthorityWebSocket;
  private mutationState: BrowserMutationStore | null = null;
  private started = false;
  private ownerLockHeld = false;
  private connectionGeneration = 0;
  private workspace: BrowserSessionWorkspace | undefined;
  private pendingJobBoundTargetAcquisition: PendingJobBoundTargetAcquisition | null = null;

  public constructor(private readonly options: BrowserInfrastructureSupervisorOptions) {
    this.ownerLock = new BrowserOwnerLock(join(options.dataDir, "browser", "owner.lock"));
    this.websocket = this.createWebSocket();
    this.broker = new BrowserAuthorityBroker(
      this.issuer,
      () => this.websocket.assertLive(),
      (binding, resolveGrantPaths, resolveCurrentTarget) => this.createTargetLeaseManager(
        binding,
        resolveGrantPaths,
        resolveCurrentTarget,
      ),
      new BrowserArtifactRegistry(
        join(options.dataDir, "runtime-data", "ai-input-gateway", "upload-attempts"),
      ),
    );
  }

  private createWebSocket(): BrowserAuthorityWebSocket {
    const callbacks: BrowserAuthorityWebSocketOptions = {
      pairingSecret: process.env.GRASSEYE_BROWSER_PAIRING_SECRET ?? null,
      onPairingStarted: () => this.emitBrowserRuntimeState(
        RuntimeLogEventType.BROWSER_AUTH_PAIRING_STARTED,
        "started",
        "插件已连接，正在校验一次性配对密钥。",
      ),
      onHeartbeat: () => this.emitBrowserRuntimeState(
        RuntimeLogEventType.BROWSER_LIVENESS_HEARTBEAT,
        "success",
        "插件认证通道存活。",
      ),
      onAuthenticated: (input) => this.onAuthenticated(input),
      onTargetClaim: (input) => this.onTargetClaim(input),
      onTargetRevoke: (targetRef) => this.onTargetRevoke(targetRef),
      onDiagnostic: (reasonCode, refs) => this.onDiagnostic(reasonCode, refs),
      onRevoked: (reasonCode, refs) => this.onRevoked(reasonCode, refs),
    };
    return new BrowserAuthorityWebSocket(callbacks);
  }

  private onAuthenticated(input: Parameters<BrowserAuthorityWebSocketOptions["onAuthenticated"]>[0]): BrowserAuthorityReady {
    const ready = this.commitUnpackedWebSocketAuthentication(input);
    this.emitBrowserRuntimeState(RuntimeLogEventType.BROWSER_AUTH_PAIRING_COMPLETED, "success", "插件配对完成。");
    this.emitBrowserRuntimeState(RuntimeLogEventType.BROWSER_SOCKET_AUTHENTICATED, "success", "插件 WebSocket 已认证。");
    return ready;
  }

  private onTargetClaim(input: BrowserAuthorityTargetClaim): void {
    requireGptWebChatPolicyForUrl(input.url);
    const initialClaim = this.broker.currentOperatorTargetStatus() === "absent";
    if (initialClaim && !this.pendingJobBoundTargetAcquisition) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    this.establishClaimBoundWorkspace();
    this.broker.registerOperatorTargetClaim({ authorityEpoch: currentAuthorityEpoch(this.issuer), ...input });
    this.emitBrowserRuntimeState(
      RuntimeLogEventType.BROWSER_TARGET_CLAIMED,
      "success",
      "预授权 ChatGPT Target 已由固定扩展认领。",
      undefined,
      { targetRef: input.targetRef, documentRef: input.documentRef },
    );
    if (initialClaim) this.resolvePendingJobBoundTargetAcquisition();
  }

  private onDiagnostic(reasonCode: string, refs: Readonly<Record<string, string>>): void {
    if (refs.runtimeEventType === "job-bound-target-acquisition") {
      this.rejectPendingJobBoundTargetAcquisition(reasonCode);
    }
    this.emitBrowserRuntimeState(
      RuntimeLogEventType.BROWSER_EXTENSION_FAILURE,
      "failed",
      "插件运行时故障已由认证通道上报；现役 Browser Authority 保持有效。",
      reasonCode,
      { ...refs },
    );
  }

  private onTargetRevoke(targetRef: string): void {
    this.broker.revokeOperatorTargetClaim(targetRef);
    this.emitBrowserRuntimeState(
      RuntimeLogEventType.BROWSER_TARGET_LEASE_INVALIDATED,
      "success",
      "插件目标标签页已撤销。",
      undefined,
      { targetRef },
    );
  }

  private onRevoked(reasonCode: string, refs?: Readonly<Record<string, string>>): void {
    const authenticated = this.issuer.current().kind === "PRESENT";
    const extensionFailure = refs?.diagnosticSource === "extension-frame"
      || refs?.diagnosticSource === "extension-runtime";
    this.rejectPendingJobBoundTargetAcquisition(reasonCode);
    this.disconnectTransport(normalizeBrowserDisconnectReason(reasonCode));
    this.emitBrowserRuntimeState(
      extensionFailure
        ? RuntimeLogEventType.BROWSER_EXTENSION_FAILURE
        : authenticated ? RuntimeLogEventType.BROWSER_AUTH_REVOKED : RuntimeLogEventType.BROWSER_AUTH_PAIRING_FAILED,
      "failed",
      extensionFailure
        ? "插件运行时故障已由认证通道上报，Browser Authority 已撤销。"
        : authenticated ? "插件认证通道已撤销。" : "插件配对失败，请按失败码处理。",
      reasonCode,
      refs,
    );
  }

  public async start(): Promise<void> {
    if (this.started) return;
    await this.ownerLock.acquire();
    this.ownerLockHeld = true;
    try {
      this.mutationState = new BrowserMutationStore(this.options.dataDir);
      this.transport.start();
      this.started = true;
      this.emitBrowserRuntimeState(
        RuntimeLogEventType.BROWSER_INFRASTRUCTURE_READY,
        "success",
        "浏览器基础设施已就绪。",
      );
      this.emitBrowserRuntimeState(
        RuntimeLogEventType.BROWSER_AUTH_WAITING_FOR_PAIRING,
        "started",
        "等待固定扩展提交一次性配对证明。",
      );
    } catch (error) {
      this.mutationState?.close();
      this.mutationState = null;
      await this.ownerLock.release();
      this.ownerLockHeld = false;
      throw error;
    }
  }

  public async stop(reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"): Promise<void> {
    this.workspace?.revoke();
    this.workspace = undefined;
    this.rejectPendingJobBoundTargetAcquisition(reasonCode);
    this.transport.disconnect(reasonCode);
    if (this.ownerLockHeld) {
      await this.ownerLock.release();
      this.ownerLockHeld = false;
    }
    this.mutationState?.close();
    this.mutationState = null;
    this.started = false;
  }

  public authorityBroker(): BrowserAuthorityBroker { return this.broker; }

  public browserAuthorityWebSocket(): BrowserAuthorityWebSocket { return this.websocket; }

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
    if (current.kind === "ABSENT") throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE");
    if (this.workspace?.belongsTo(
      current.authority.authorityRef,
      current.authority.authorityEpoch,
      current.authority.connectionGeneration,
    )) {
      this.workspace.assertCurrent();
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
    this.workspace?.revoke();
    this.workspace = new BrowserSessionWorkspace(binding);
  }

  public async acquireJobBoundTargetLease(binding: BrowserExecutionBinding, ownerId: string): Promise<BrowserTargetLease> {
    if (this.broker.currentOperatorTargetStatus() === "absent") {
      await this.acquireJobBoundTarget(binding.commandTtlMs);
    }
    return this.broker.acquireOperatorClaimedTargetLease(binding, ownerId);
  }

  private async acquireJobBoundTarget(commandTtlMs: number): Promise<void> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    if (!Number.isInteger(commandTtlMs) || commandTtlMs < 1 || commandTtlMs > 3_600_000) {
      throw new Error("BROWSER_COMMAND_PERMIT_INVALID");
    }
    if (this.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_BACKPRESSURE");
    const deadlineMs = Math.min(commandTtlMs, BROWSER_COMMAND_DEFAULT_DEADLINE_MS);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pendingJobBoundTargetAcquisition?.authorityEpoch !== current.authority.authorityEpoch) return;
        this.pendingJobBoundTargetAcquisition = null;
        reject(new Error("BROWSER_OUTCOME_UNKNOWN"));
      }, deadlineMs);
      this.pendingJobBoundTargetAcquisition = {
        authorityEpoch: current.authority.authorityEpoch,
        resolve,
        reject,
        timeout,
      };
      try {
        this.websocket.requestPreauthorizedTargetAcquisition();
      } catch (error) {
        this.rejectPendingJobBoundTargetAcquisition(
          error instanceof Error ? error.message : "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
        );
      }
    });
  }

  private resolvePendingJobBoundTargetAcquisition(): void {
    const pending = this.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.resolve();
  }

  private rejectPendingJobBoundTargetAcquisition(reasonCode: string): void {
    const pending = this.pendingJobBoundTargetAcquisition;
    if (!pending) return;
    this.pendingJobBoundTargetAcquisition = null;
    clearTimeout(pending.timeout);
    pending.reject(new Error(reasonCode));
  }

  public health(): BrowserHealthSnapshot {
    const state = this.transport.currentState();
    const current = this.issuer.current();
    return {
      browserInfrastructure: { ok: this.started && state.infrastructure.kind !== "STOPPED", ...(this.started ? {} : { reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" }) },
      browserAuthority: current.kind === "PRESENT" ? { ok: true } : { ok: false, reasonCode: current.reasonCode },
    };
  }

  public metrics(): BrowserInfrastructureMetrics {
    return { unauthenticated_browser_authority_issued_total: 0, command_without_valid_authority_total: 0, stale_event_side_effect_total: 0, old_completion_to_new_port_total: 0, non_idempotent_auto_replay_total: 0, wrong_profile_process_authority_issued_total: 0, command_after_liveness_expiry_total: 0, browser_action_during_authority_absence_total: 0, dual_active_browser_worker_total: 0, revoked_or_rollback_blocked_tuple_activated_total: 0, browser_admission_budget_violation_total: 0, unbounded_queue: 0, unbounded_cache: 0, unbounded_stream: 0 };
  }

  private createTargetLeaseManager(
    binding: BrowserExecutionBinding,
    resolveGrantPaths: (
      grants: readonly import("../exact-target/browser-file-artifact-grant.js").BrowserFileArtifactGrantV1[],
    ) => Promise<readonly string[]>,
    resolveCurrentTarget: () => import("../exact-target/browser-target-ref.js").BrowserControlledTarget | null,
  ): BrowserTargetLeaseManager {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error("BROWSER_WORKER_FENCE_INVALID");
    return new BrowserTargetLeaseManager(
      current.authority,
      binding,
      new BrowserCommandActor(
        new BrowserCommandAdmissionBudget(),
        this.websocket,
        this.mutationStore(),
        { assertCurrentAuthority: (permit) => {
          const slot = this.issuer.current();
          if (slot.kind === "ABSENT" || slot.authority.authorityRef !== current.authority.authorityRef || slot.authority.authorityEpoch !== current.authority.authorityEpoch) throw new Error("BROWSER_LIVENESS_EXPIRED");
          this.issuer.assertCurrentCommandPermit(permit);
        } },
        this.options.runtimeLogger,
      ),
      this.issuer,
      this.workspace,
      resolveCurrentTarget,
      resolveGrantPaths,
    );
  }

  private mutationStore(): BrowserMutationStore {
    if (!this.mutationState) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    return this.mutationState;
  }

  private emitBrowserRuntimeState(
    eventType: (typeof RuntimeLogEventType)[keyof typeof RuntimeLogEventType],
    status: "started" | "success" | "failed",
    actionableMessage: string,
    reason?: string,
    refs?: Record<string, string>,
  ): void {
    this.options.runtimeLogger.emit(createRuntimeEvent({
      context: {
        traceId: `browser-session:${this.connectionGeneration}`,
        spanId: randomUUID(),
        owner: "browser-session",
      },
      eventType,
      level: status === "failed" ? "error" : "info",
      modeVisibility: ["FLOW", "DEBUG", "TRACE"],
      status,
      actionableMessage,
      ...(reason ? { reason } : {}),
      ...(refs ? { refs } : {}),
      metrics: { connectionGeneration: this.connectionGeneration },
    }));
  }

  private commitUnpackedWebSocketAuthentication(input: Readonly<{
    extensionId: string;
    extensionVersion: string;
    releaseBuildId: string;
    sessionHash: `sha256:${string}`;
    commandPermitKey: string;
  }>): Readonly<{
    authorityRef: string;
    authorityEpoch: number;
    certificateHash: `sha256:${string}`;
    channelSessionHash: `sha256:${string}`;
    commandPermitKey: string;
  }> {
    if (!this.started) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    if (input.extensionId !== GRASSEYE_UNPACKED_EXTENSION_ID) throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    const release = this.options.releaseIdentity;
    if (input.extensionVersion !== release.version
      || input.releaseBuildId !== release.releaseBuildId
      || release.extensionId !== input.extensionId
      || release.extensionDirectoryHashV1 !== this.options.enrolledProfile.extensionTreeHash) {
      throw new Error("BROWSER_UNPACKED_RELEASE_IDENTITY_INVALID");
    }
    const commandPermitKey = Buffer.from(input.commandPermitKey, "base64");
    if (commandPermitKey.byteLength !== 32 || commandPermitKey.toString("base64") !== input.commandPermitKey) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.connectionGeneration += 1;
    const protocolHash = hashFile("src/lib/browser/protocol/browser-protocol.schema.json");
    if (protocolHash !== BROWSER_PROTOCOL_SCHEMA_SHA256) throw new Error("BROWSER_POLICY_UNVERIFIED");
    const capabilityHash = hashFile("src/lib/browser/protocol/browser-capabilities.json");
    const livenessHash = hashValue({
      heartbeatMs: BROWSER_HEARTBEAT_MS,
      missedHeartbeatToleranceMs: BROWSER_MISSED_HEARTBEAT_TOLERANCE_MS,
      lifetime: "authenticated-connection",
    });
    const commandBudgetHash = hashValue({ maxInFlight: 1, commandTtlMs: BROWSER_COMMAND_DEFAULT_DEADLINE_MS });
    const artifactStreamBudgetHash = hashValue({ maxChunkBytes: BROWSER_ARTIFACT_CHUNK_MAX_BYTES });
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
        connectionGeneration: this.connectionGeneration,
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

  private disconnectTransport(reasonCode: BrowserErrorCode | "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"): void {
    this.workspace?.revoke();
    this.workspace = undefined;
    this.broker.revokeOperatorTargetClaim();
    if (this.started) this.transport.disconnect(reasonCode);
  }

}

const currentAuthorityEpoch = (issuer: BrowserAuthorityIssuer): number => {
  const current = issuer.current();
  if (current.kind === "ABSENT") throw new Error(current.reasonCode);
  return current.authority.authorityEpoch;
};

const currentAuthorityRefHash = (
  issuer: BrowserAuthorityIssuer,
): Readonly<{ authorityRefHash?: `sha256:${string}` }> => {
  const current = issuer.current();
  return current.kind === "PRESENT"
    ? { authorityRefHash: `sha256:${createHash("sha256").update(current.authority.authorityRef).digest("hex")}` }
    : {};
};

const hashValue = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const hashFile = (path: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(readFileSync(join(process.cwd(), path))).digest("hex")}`;

const normalizeBrowserDisconnectReason = (
  reasonCode: string,
): BrowserErrorCode | "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" => {
  if (reasonCode === "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE") return reasonCode;
  const protocolReason = BROWSER_ERROR_CODES.find((candidate) => candidate === reasonCode);
  return protocolReason ?? "BROWSER_REVOCATION_REJECTED";
};

export type { BrowserExactTargetAcquisition };
