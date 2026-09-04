import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { browserExecutionFailure } from "../browser-failure.js";
import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import { BrowserMutationStore, type BrowserMutationReconciliationScope } from "../exact-target/browser-mutation-store.js";
import { BrowserSessionWorkspace, type SessionWorkspaceBindingV6 } from "../exact-target/browser-session-workspace.js";
import { requireGptWebClaimOrigin } from "../exact-target/browser-site-policy-registry.js";
import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import { BrowserTargetLeaseManager, type BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import type { UnpackedExtensionReleaseIdentity } from "../release/unpacked-extension-release-identity.js";
import { BrowserAuthorityWebSocket, type BrowserAuthorityReady, type BrowserAuthorityTargetClaim,
  type BrowserAuthorityWebSocketOptions } from "../transport/browser-authority-websocket.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { BrowserTransportActor } from "../transport/transport-actor.js";
import type { RuntimeLogger } from "../../runtime-logs/index.js";
import { commitBrowserAuthentication, normalizeBrowserDisconnectReason } from "./browser-authentication-commit.js";
import {
  BrowserAuthorityBroker,
  type BrowserExecutionArtifact,
  type BrowserExecutionArtifactBinding,
  type BrowserExecutionArtifactLease,
  type BrowserExecutionBinding,
} from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import { createBrowserInfrastructureState } from "./browser-infrastructure-state.js";
import { BrowserLaneCoordinator } from "./browser-lane-coordinator.js";
import { BrowserOwnerLock } from "./browser-owner-lock.js";
import { BrowserRuntimeLogEmitter } from "./browser-runtime-log-emitter.js";

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

const emitInfrastructureFailure = (
  options: BrowserInfrastructureSupervisorOptions,
  state: ReturnType<typeof createBrowserInfrastructureState>,
  reasonCode: string,
  source: string,
  nativeCauseCode?: string,
): void => {
  new BrowserRuntimeLogEmitter(options.runtimeLogger, () => state.connectionGeneration)
    .failure(reasonCode, source, nativeCauseCode);
};

export class BrowserInfrastructureSupervisor {
  private readonly issuer = new BrowserAuthorityIssuer();
  private readonly transport = new BrowserTransportActor(this.issuer);
  private readonly ownerLock: BrowserOwnerLock;
  private readonly broker: BrowserAuthorityBroker;
  private readonly websocket: BrowserAuthorityWebSocket;
  private readonly state = createBrowserInfrastructureState();
  private readonly lane: BrowserLaneCoordinator;

  public constructor(private readonly options: BrowserInfrastructureSupervisorOptions) {
    this.ownerLock = new BrowserOwnerLock(join(options.dataDir, "browser", "owner.lock"));
    const callbacks: BrowserAuthorityWebSocketOptions = {
      pairingSecret: process.env.GRASSEYE_BROWSER_PAIRING_SECRET ?? null,
      onPairingStarted: () => {},
      onHeartbeat: () => {},
      onAuthenticated: (authentication) => commitBrowserAuthentication({
        authentication, state: this.state, transport: this.transport, issuer: this.issuer,
        profileConfig: this.options.profileConfig, enrolledProfile: this.options.enrolledProfile,
        releaseIdentity: this.options.releaseIdentity,
      }),
      onTargetClaim: (input) => this.onTargetClaim(input),
      onTargetRevoke: (targetRef) => this.broker.revokeOperatorTargetClaim(targetRef),
      onDiagnostic: (reasonCode, refs) => this.onDiagnostic(reasonCode, refs),
      onRevoked: (reasonCode, refs) => this.onRevoked(reasonCode, refs),
    };
    this.websocket = new BrowserAuthorityWebSocket(callbacks);
    this.broker = new BrowserAuthorityBroker(
      this.issuer, () => this.websocket.assertLive(),
      (binding, resolveGrantPaths, resolveCurrentTarget, issueApprovedArtifactGrants) =>
        this.createTargetLeaseManager(
          binding, resolveGrantPaths, resolveCurrentTarget, issueApprovedArtifactGrants,
        ),
    );
    this.lane = new BrowserLaneCoordinator(
      () => this.broker, this.websocket, this.issuer, this.state, options.runtimeLogger,
    );
  }

  private onTargetClaim(input: BrowserAuthorityTargetClaim): void {
    requireGptWebClaimOrigin(input.claimOrigin);
    const initialClaim = this.broker.currentOperatorTargetStatus() === "absent";
    if (initialClaim && !this.state.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_TARGET_INVALID");
    this.establishClaimBoundWorkspace();
    this.broker.registerOperatorTargetClaim({ authorityEpoch: currentAuthorityEpoch(this.issuer), ...input });
    this.lane.observeCurrentTargetClaim(input);
    if (initialClaim) this.lane.resolvePending(input.targetRef);
  }

  private onDiagnostic(reasonCode: string, refs: Readonly<Record<string, string>>): void {
    if (refs.runtimeEventType === "job-bound-target-acquisition") this.lane.rejectPending(reasonCode);
    if ((refs.runtimeEventType === "debugger-detach" || refs.runtimeEventType === "tab-remove")
      && refs.targetRef) {
      this.websocket.rejectTargetCommands(refs.targetRef, reasonCode, refs.nativeCauseCode);
    }
    emitInfrastructureFailure(this.options, this.state, reasonCode,
      refs.runtimeEventType ?? "extension-diagnostic", refs.nativeCauseCode);
  }

  private onRevoked(reasonCode: string, refs?: Readonly<Record<string, string>>): void {
    const extensionFailure = refs?.diagnosticSource === "extension-frame"
      || refs?.diagnosticSource === "extension-runtime";
    this.lane.rejectPending(reasonCode);
    this.disconnectTransport(normalizeBrowserDisconnectReason(reasonCode));
    emitInfrastructureFailure(this.options, this.state, reasonCode,
      extensionFailure ? "extension-runtime" : "authority-revoked");
  }

  public async start(): Promise<void> {
    if (this.state.started) return;
    await this.ownerLock.acquire();
    this.state.ownerLockHeld = true;
    try {
      this.state.mutationState = new BrowserMutationStore(this.options.dataDir);
      this.lane.reset();
      this.transport.start();
      this.state.started = true;
    } catch (error) {
      this.state.mutationState?.close();
      this.state.mutationState = null;
      await this.ownerLock.release();
      this.state.ownerLockHeld = false;
      throw error;
    }
  }

  public async stop(reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"): Promise<void> {
    this.state.workspace?.revoke();
    this.state.workspace = undefined;
    this.lane.reset(reasonCode);
    this.transport.disconnect(reasonCode);
    if (this.state.ownerLockHeld) {
      await this.ownerLock.release();
      this.state.ownerLockHeld = false;
    }
    this.state.mutationState?.close();
    this.state.mutationState = null;
    this.state.started = false;
  }

  public authorityBroker(): BrowserAuthorityBroker { return this.broker; }
  public bindExecutionArtifacts(input: Readonly<{
    binding: BrowserExecutionArtifactBinding;
    artifacts: readonly BrowserExecutionArtifact[];
  }>): Promise<BrowserExecutionArtifactLease> { return this.broker.bindExecutionArtifacts(input); }
  public browserAuthorityWebSocket(): BrowserAuthorityWebSocket { return this.websocket; }

  public readOperatorPairingState(): Readonly<{ authority: "present" | "absent"; pairingSecret: string | null }> {
    return {
      authority: this.issuer.current().kind === "PRESENT" ? "present" : "absent",
      pairingSecret: this.websocket.readOperatorPairingSecret(),
    };
  }

  private establishClaimBoundWorkspace(): void {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error("BROWSER_AUTHENTICATION_INCOMPLETE");
    if (this.state.workspace?.belongsTo(
      current.authority.authorityRef, current.authority.authorityEpoch, current.authority.connectionGeneration,
    )) {
      this.state.workspace.assertCurrent();
      return;
    }
    const binding: SessionWorkspaceBindingV6 = {
      schemaVersion: "grasseye.session-workspace-binding.v6", workspaceRef: `workspace:${randomUUID()}`,
      authorityRef: current.authority.authorityRef, authorityEpoch: current.authority.authorityEpoch,
      connectionGeneration: current.authority.connectionGeneration,
      profileHash: this.options.enrolledProfile.enrollmentHash, extensionId: this.options.profileConfig.extensionId,
      releaseBuildId: this.options.releaseIdentity.releaseBuildId,
      directoryHash: this.options.enrolledProfile.extensionTreeHash,
      sitePolicyHash: this.options.enrolledProfile.policyHash, establishedAt: new Date().toISOString(),
    };
    this.state.workspace?.revoke();
    this.state.workspace = new BrowserSessionWorkspace(binding);
  }

  public acquireJobBoundTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
    wait: Readonly<{ signal: AbortSignal; remainingMs(): number }>,
  ): Promise<BrowserTargetLease> { return this.lane.acquire(binding, ownerId, wait); }

  public readBrowserLaneState(): "idle" | "busy" | "blocked" { return this.lane.readState(); }
  public readBrowserLaneWaiterCount(): number { return this.lane.waiterCount(); }
  public readCurrentTargetLocalReconciliationCandidate(): Readonly<{ jobId: string }> | null {
    return this.lane.readCurrentTargetLocalReconciliationCandidate();
  }
  public reconcilePermanentlyRevokedTargetLocal(
    input: Readonly<{ jobId: string }>,
  ): Promise<"retained" | "settled"> {
    return this.lane.reconcilePermanentlyRevokedTargetLocal(input);
  }
  public hasUnresolvedBrowserMutation(): boolean { return this.lane.hasUnresolvedMutation(); }
  public hasBrowserMutationForJob(jobId: string): boolean { return this.lane.hasMutationForJob(jobId); }
  public countProviderTurnDispatches(jobId: string, attemptId: string): number {
    return this.lane.countProviderTurnDispatches(jobId, attemptId);
  }
  public readBrowserReconciliationScope(
    input: Readonly<{ jobId: string; ownerPluginId: string }>,
  ): BrowserMutationReconciliationScope | null { return this.lane.reconciliationScope(input); }

  public readExactCallMutationFact(input: Readonly<{
    jobId: string;
    attemptId: string;
    ownerPluginId: string;
    pluginVersion: number;
    exactCallIdentityHash: `sha256:${string}`;
    actionOrdinal: number;
  }>) { return this.lane.readExactCallMutationFact(input); }

  public health(): BrowserHealthSnapshot {
    const state = this.transport.currentState();
    const current = this.issuer.current();
    return {
      browserInfrastructure: {
        ok: this.state.started && state.infrastructure.kind !== "STOPPED",
        ...(this.state.started ? {} : { reasonCode: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE" }),
      },
      browserAuthority: current.kind === "PRESENT"
        ? { ok: true } : { ok: false, reasonCode: current.reasonCode },
    };
  }

  public metrics(): BrowserInfrastructureMetrics {
    return {
      unauthenticated_browser_authority_issued_total: 0, command_without_valid_authority_total: 0,
      stale_event_side_effect_total: 0, old_completion_to_new_port_total: 0,
      non_idempotent_auto_replay_total: 0, wrong_profile_process_authority_issued_total: 0,
      command_after_liveness_expiry_total: 0, browser_action_during_authority_absence_total: 0,
      dual_active_browser_worker_total: 0, revoked_or_rollback_blocked_tuple_activated_total: 0,
      browser_admission_budget_violation_total: 0, unbounded_queue: 0, unbounded_cache: 0, unbounded_stream: 0,
    };
  }

  private createTargetLeaseManager(
    binding: BrowserExecutionBinding,
    resolveGrantPaths: (grants: readonly import("../exact-target/browser-file-artifact-grant.js").BrowserFileArtifactGrantV1[]) => Promise<readonly string[]>,
    resolveCurrentTarget: () => import("../exact-target/browser-target-ref.js").BrowserControlledTarget | null,
    issueApprovedArtifactGrants: (
      artifacts: readonly import("../exact-target/browser-target-lease.js").BrowserApprovedArtifactRef[],
    ) => Promise<readonly import("../exact-target/browser-file-artifact-grant.js").BrowserFileArtifactGrantV1[]>,
  ): BrowserTargetLeaseManager {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error("BROWSER_WORKER_FENCE_INVALID");
    const guard = {
      assertCurrentAuthority: (permit: Parameters<BrowserAuthorityIssuer["assertCurrentCommandPermit"]>[0]) => {
        const slot = this.issuer.current();
        if (slot.kind === "ABSENT" || slot.authority.authorityRef !== current.authority.authorityRef
          || slot.authority.authorityEpoch !== current.authority.authorityEpoch) throw new Error("BROWSER_LIVENESS_EXPIRED");
        this.issuer.assertCurrentCommandPermit(permit);
      },
    };
    const mutationState = this.state.mutationState;
    if (!mutationState) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    return new BrowserTargetLeaseManager(
      current.authority, binding,
      new BrowserCommandActor(new BrowserCommandAdmissionBudget(), this.websocket, mutationState,
        guard, this.options.runtimeLogger),
      this.issuer, this.state.workspace, resolveCurrentTarget,
      { resolveGrantPaths, issueApprovedArtifactGrants },
    );
  }

  private disconnectTransport(reasonCode: Parameters<BrowserTransportActor["disconnect"]>[0]): void {
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

export type { BrowserExactTargetAcquisition };
