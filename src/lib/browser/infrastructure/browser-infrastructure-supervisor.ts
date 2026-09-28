import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import { BrowserMutationStore } from "../exact-target/browser-mutation-store.js";
import { BrowserSessionWorkspace, type SessionWorkspaceBindingV6 } from "../exact-target/browser-session-workspace.js";
import { requireGptWebClaimOrigin } from "../exact-target/browser-site-policy-registry.js";
import type {
  BrowserTargetLease,
  BrowserTargetLeaseWait,
} from "../exact-target/browser-target-lease.js";
import { BrowserTargetLeaseManager, type BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import type { UnpackedExtensionReleaseIdentity } from "../release/unpacked-extension-release-identity.js";
import type { BrowserAuthorityTargetClaim, BrowserAuthorityTargetRevoke } from
  "../transport/browser-authority-frame-payload.js";
import { BrowserAuthorityWebSocket, type BrowserAuthorityWebSocketOptions } from
  "../transport/browser-authority-websocket.js";
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
import { BrowserInfrastructureEvidence } from "./browser-infrastructure-evidence.js";
import { BrowserLaneCoordinator } from "./browser-lane-coordinator.js";
import { BrowserOwnerLock } from "./browser-owner-lock.js";
import { BrowserRuntimeLogEmitter } from "./browser-runtime-log-emitter.js";

export type BrowserHealthComponent = "browserInfrastructure" | "browserAuthority";
export type BrowserHealthSnapshot = Readonly<Record<BrowserHealthComponent, Readonly<{ ok: boolean; reasonCode?: string }>>>;

export type BrowserInfrastructureSupervisorOptions = Readonly<{
  dataDir: string;
  sourceFingerprint: string;
  profileConfig: BrowserProfileConfig;
  enrolledProfile: BrowserProfileState;
  releaseIdentity: UnpackedExtensionReleaseIdentity;
  runtimeLogger: RuntimeLogger;
  restoreBrowserHostVisibility?: (() => Promise<void>) | undefined;
}>;

export const shouldRestoreBrowserHostVisibility = (input: Readonly<{
  authorityWasPresent: boolean;
  reasonCode: string;
  transportEvent?: string | undefined;
  started: boolean;
}>): boolean => input.authorityWasPresent
  && input.reasonCode === "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"
  && ["peer_close", "tcp_close", "tcp_error"].includes(input.transportEvent ?? "")
  && input.started;

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
  public readonly evidence: BrowserInfrastructureEvidence;

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
      onTargetRevoke: (input) => this.onTargetRevoke(input),
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
      () => this.broker, this.websocket, this.issuer, this.state,
    );
    this.evidence = new BrowserInfrastructureEvidence(this.lane, this.state);
  }

  private onTargetClaim(input: BrowserAuthorityTargetClaim): void {
    requireGptWebClaimOrigin(input.claimOrigin);
    const initialClaim = this.broker.currentOperatorTargetStatus() === "absent";
    if (initialClaim && !this.state.pendingJobBoundTargetAcquisition) throw new Error("BROWSER_TARGET_INVALID");
    if (initialClaim && this.state.pendingJobBoundTargetAcquisition?.jobRefHash !== input.jobRefHash) {
      throw new Error("BROWSER_TARGET_INVALID");
    }
    const mutations = this.state.mutationState;
    if (!mutations) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    mutations.assertRuntimeTaskProvenance();
    this.establishClaimBoundWorkspace();
    this.broker.registerOperatorTargetClaim({ authorityEpoch: currentAuthorityEpoch(this.issuer), ...input });
    this.lane.observeCurrentTargetClaim(input);
    if (initialClaim) this.lane.resolvePending("acquire", input.jobRefHash);
  }

  private onTargetRevoke(input: BrowserAuthorityTargetRevoke): void {
    if (input.releaseOutcome) {
      const pending = this.state.pendingJobBoundTargetAcquisition;
      if (!pending || pending.action !== "release" || pending.jobRefHash !== input.jobRefHash) {
        throw new Error("BROWSER_TARGET_INVALID");
      }
      const currentJob = this.broker.currentOperatorTargetJobRefHash();
      if (currentJob !== null && currentJob !== input.jobRefHash) throw new Error("BROWSER_TARGET_INVALID");
      if (input.targetRef !== null) {
        this.broker.revokeOperatorTargetClaim({ targetRef: input.targetRef,
          jobRefHash: input.jobRefHash });
      } else if (currentJob === input.jobRefHash) {
        this.broker.revokeOperatorTargetClaim();
      }
      if (this.broker.currentOperatorTargetJobRefHash() === input.jobRefHash) {
        throw new Error("BROWSER_TARGET_RELEASE_FENCE_MISMATCH");
      }
      this.lane.resolvePending("release", input.jobRefHash);
      return;
    }
    if (input.targetRef !== null) this.broker.revokeOperatorTargetClaim({
      targetRef: input.targetRef, jobRefHash: input.jobRefHash,
      documentRef: input.documentRef,
    });
  }

  private onDiagnostic(reasonCode: string, refs: Readonly<Record<string, string>>): void {
    if (refs.runtimeEventType === "job-bound-target-acquisition") this.lane.rejectPending(reasonCode, refs);
    if ((refs.runtimeEventType === "debugger-detach" || refs.runtimeEventType === "tab-remove")
      && refs.targetRef) {
      this.websocket.rejectTargetCommands(refs.targetRef, reasonCode, refs.nativeCauseCode);
    }
    emitInfrastructureFailure(this.options, this.state, reasonCode,
      refs.runtimeEventType ?? "extension-diagnostic", refs.nativeCauseCode);
  }

  private onRevoked(reasonCode: string, refs?: Readonly<Record<string, string>>): void {
    const restoreBrowserHost = shouldRestoreBrowserHostVisibility({
      authorityWasPresent: this.issuer.current().kind === "PRESENT",
      reasonCode,
      transportEvent: refs?.transportEvent,
      started: this.state.started,
    });
    const extensionFailure = refs?.diagnosticSource === "extension-frame"
      || refs?.diagnosticSource === "extension-runtime";
    this.lane.rejectPending(reasonCode);
    this.disconnectTransport(normalizeBrowserDisconnectReason(reasonCode));
    emitInfrastructureFailure(this.options, this.state, reasonCode,
      extensionFailure ? "extension-runtime" : "authority-revoked");
    if (restoreBrowserHost) void this.restoreBrowserHostVisibility();
  }

  private async restoreBrowserHostVisibility(): Promise<void> {
    try {
      await this.options.restoreBrowserHostVisibility?.();
    } catch {
      emitInfrastructureFailure(
        this.options, this.state, "BROWSER_HOST_UNAVAILABLE", "browser-host-restore",
      );
    }
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

  public endpoints(): Readonly<{
    broker: BrowserAuthorityBroker;
    websocket: BrowserAuthorityWebSocket;
  }> { return Object.freeze({ broker: this.broker, websocket: this.websocket }); }
  public bindExecutionArtifacts(input: Readonly<{
    binding: BrowserExecutionArtifactBinding;
    artifacts: readonly BrowserExecutionArtifact[];
  }>): Promise<BrowserExecutionArtifactLease> { return this.broker.bindExecutionArtifacts(input); }
  /** The extension's own pairing poll is the one place that decides whether to re-pair; answering it
   * truthfully needs the same hard heartbeat-tolerance fact the three existing assertLive() call sites
   * already use before dispatching, not a new idle-timeout or diagnostic-frame heuristic. */
  public readOperatorPairingState(): Readonly<{ authority: "present" | "absent"; pairingSecret: string | null }> {
    if (this.issuer.current().kind === "PRESENT") {
      try { this.websocket.assertLive(); } catch (revoked) { void revoked; }
    }
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
    wait: BrowserTargetLeaseWait,
  ): Promise<BrowserTargetLease> { return this.lane.acquire(binding, ownerId, wait); }

  public releaseJobBoundTarget(
    jobId: string,
    releaseAuthority: import("../exact-target/browser-target-lease.js").BrowserTargetReleaseAuthority,
    signal: AbortSignal,
  ): Promise<void> {
    return this.lane.releaseJobBoundTarget(jobId, releaseAuthority, signal);
  }

  public verifyRuntimeTaskProvenance(earliestTaskCreatedAt: string | null): void {
    const mutations = this.state.mutationState;
    if (!mutations) throw new Error("BROWSER_MUTATION_STATE_UNAVAILABLE");
    mutations.verifyRuntimeTaskProvenance(earliestTaskCreatedAt);
  }
  public purgeBrowserJob(jobId: string): void { this.lane.purgeJob(jobId); }
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
