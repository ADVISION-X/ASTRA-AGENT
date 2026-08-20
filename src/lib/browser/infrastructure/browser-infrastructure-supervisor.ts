import { join } from "node:path";
import type { BrowserCommandPort } from "../exact-target/browser-command-actor.js";
import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import { BrowserMutationIntentJournal } from "../exact-target/browser-mutation-intent-journal.js";
import { BrowserTargetLeaseManager } from "../exact-target/browser-target-lease-manager.js";
import type { BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import { BrowserAuthorityBroker, type BrowserArtifactResolver, type BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "./browser-authority-issuer.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { BrowserTransportActor } from "../transport/transport-actor.js";
import { BrowserControllerHostCommandPort, createControllerToken, hashControllerToken } from "../transport/controller-host-command-port.js";
import type { BrowserOperatorTargetClaim } from "../transport/controller-host-command-port.js";
import type { BrowserExtensionAuthorityContext } from "../transport/controller-host-command-port.js";
import { hashBrowserAuthorityCertificate } from "./browser-authority-certificate.js";
import { BrowserOwnerLock } from "./browser-owner-lock.js";
import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import { BrowserProcessSupervisor } from "../profile/browser-process-supervisor.js";
import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";

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

export const BROWSER_INFRASTRUCTURE_SLOS = Object.freeze({
  authorityAvailabilityPercent: 99.99,
  authorityIssuanceP99Ms: 5_000,
  recoverableChainRebuildP99Ms: 10_000,
  revokeToAbsentP99Ms: 10,
});

export type BrowserInfrastructureSupervisorOptions = Readonly<{
  dataDir: string;
  profileConfig: BrowserProfileConfig;
  enrolledProfile: BrowserProfileState;
  /** Test owners may inject a deterministic port. Production owns the sole socket endpoint below. */
  commandPort?: BrowserCommandPort;
  artifactResolver: BrowserArtifactResolver;
  /** An unsigned or revoked release must expose only an unavailable Browser authority. */
  activationBlockedReasonCode?: string;
}>;

export class BrowserInfrastructureSupervisor {
  private readonly issuer = new BrowserAuthorityIssuer();
  private readonly transport = new BrowserTransportActor(this.issuer);
  private readonly ownerLock: BrowserOwnerLock;
  private readonly processSupervisor: BrowserProcessSupervisor;
  private readonly broker: BrowserAuthorityBroker;
  private readonly controllerToken = createControllerToken();
  private readonly controllerPort: BrowserCommandPort;
  private readonly ownedControllerPort: BrowserControllerHostCommandPort | null;
  private operatorTargetClaim: BrowserOperatorTargetClaim | null = null;
  private started = false;
  private ownerLockHeld = false;

  public constructor(private readonly options: BrowserInfrastructureSupervisorOptions) {
    this.ownerLock = new BrowserOwnerLock(join(options.dataDir, "browser", "owner.lock"));
    this.processSupervisor = new BrowserProcessSupervisor(options.profileConfig, options.enrolledProfile);
    const ownedControllerPort = options.commandPort ? null : new BrowserControllerHostCommandPort({
        socketPath: join(options.dataDir, "browser", "controller.sock"),
        controllerToken: this.controllerToken,
        authenticate: async (proof, sourceChannelToken) => this.commitTransportAuthentication(proof, sourceChannelToken),
        authorityContext: () => this.extensionAuthorityContext(),
        onOperatorTargetClaim: (claim) => this.recordOperatorTargetClaim(claim),
        onDisconnect: (reasonCode) => this.disconnectTransport(reasonCode),
      });
    this.ownedControllerPort = ownedControllerPort;
    this.controllerPort = options.commandPort ?? ownedControllerPort!;
    this.broker = new BrowserAuthorityBroker(
      this.issuer,
      (binding) => this.createTargetLeaseManager(binding),
      options.artifactResolver,
    );
  }

  public async start(): Promise<void> {
    if (this.started) return;
    if (this.options.activationBlockedReasonCode) {
      // No socket, Host or process attestation may start from an unsigned slot.
      this.issuer.revokeCurrent(this.options.activationBlockedReasonCode);
      this.started = true;
      return;
    }
    await this.ownerLock.acquire();
    this.ownerLockHeld = true;
    try {
      if (this.ownedControllerPort) {
        await this.ownerLock.removeProvenStaleSocket(join(this.options.dataDir, "browser", "controller.sock"));
      }
      await this.ownedControllerPort?.start();
      this.transport.start();
      this.started = true;
    } catch (error) {
      await this.ownerLock.release();
      this.ownerLockHeld = false;
      throw error;
    }
  }

  public async stop(reasonCode = "BROWSER_HOST_UNAVAILABLE"): Promise<void> {
    this.transport.disconnect(reasonCode);
    await this.ownedControllerPort?.close(reasonCode);
    this.processSupervisor.stop();
    if (this.ownerLockHeld) {
      await this.ownerLock.release();
      this.ownerLockHeld = false;
    }
    this.started = false;
  }

  public authorityBroker(): BrowserAuthorityBroker {
    return this.broker;
  }

  /**
   * A target exists only after the operator clicks the installed MV3 action.
   * The claim is consumed once, bound to the current certificate and never
   * reconstructed from a URL, active tab, or stored Chrome identity.
   */
  public async acquireOperatorClaimedTargetLease(
    binding: BrowserExecutionBinding,
    ownerId: string,
  ): Promise<BrowserTargetLease> {
    const authority = await this.broker.acquireForExecution(binding);
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    const claim = this.operatorTargetClaim;
    this.operatorTargetClaim = null;
    if (!claim) throw new Error("BROWSER_TARGET_INVALID");
    return authority.acquireTargetLease({
      ownerId,
      target: {
        target: {
          targetRef: claim.targetRef,
          authorityEpoch: current.authority.authorityEpoch,
          executionBindingHash: current.authority.executionBindingHash,
        },
        document: {
          documentRef: claim.documentRef,
          targetRef: claim.targetRef,
          navigationEpoch: claim.navigationEpoch,
        },
        url: claim.url,
        title: claim.title,
      },
    });
  }

  public health(): BrowserHealthSnapshot {
    const state = this.transport.currentState();
    const current = this.issuer.current();
    return {
      browserInfrastructure: this.options.activationBlockedReasonCode
        ? { ok: false, reasonCode: this.options.activationBlockedReasonCode }
        : { ok: this.started && state.infrastructure.kind !== "STOPPED", ...(this.started ? {} : { reasonCode: "BROWSER_HOST_UNAVAILABLE" }) },
      browserAuthority: current.kind === "PRESENT"
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

  private createTargetLeaseManager(binding: BrowserExecutionBinding): BrowserTargetLeaseManager {
    const current = this.issuer.current();
    if (current.kind === "ABSENT" || current.authority.executionBindingHash !== binding.executionRefHash) {
      throw new Error("BROWSER_WORKER_FENCE_INVALID");
    }
    return new BrowserTargetLeaseManager(
      current.authority,
      binding,
      new BrowserCommandActor(
        new BrowserCommandAdmissionBudget(),
        this.controllerPort,
        new BrowserMutationIntentJournal(join(this.options.dataDir, "browser", "mutation-intents.ndjson")),
        {
          assertCurrentAuthority: (permit) => {
            const slot = this.issuer.current();
            if (slot.kind === "ABSENT" || slot.authority.authorityRef !== current.authority.authorityRef || slot.authority.authorityEpoch !== current.authority.authorityEpoch) {
              throw new Error("BROWSER_LIVENESS_EXPIRED");
            }
            this.issuer.assertCurrentCommandPermit(permit);
          },
        },
      ),
      this.issuer,
    );
  }

  /** Only the supervisor may turn a Host/MV3 proof into an authority state transition. */
  private commitTransportAuthentication(proof: import("./browser-authority-issuer.js").BrowserAuthenticationProof, sourceChannelToken: string): void {
    if (this.options.activationBlockedReasonCode) throw new Error(this.options.activationBlockedReasonCode);
    if (!this.started || sourceChannelToken.length < 16) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    const process = this.processSupervisor.currentAttestation();
    if (!process) throw new Error("BROWSER_PROCESS_UNVERIFIED");
    if (
      proof.handshake.extensionId !== this.options.profileConfig.extensionId
      || proof.handshake.profileEnrollmentHash !== this.options.enrolledProfile.enrollmentHash
      || proof.handshake.processIncarnationHash !== process.processIncarnationHash
      || proof.handshake.controllerIncarnationHash !== hashControllerToken(this.controllerToken)
    ) {
      throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
    }
    this.transport.commitAuthentication(proof);
  }

  private disconnectTransport(reasonCode: string): void {
    this.operatorTargetClaim = null;
    if (!this.started) return;
    this.transport.disconnect(reasonCode);
  }

  private recordOperatorTargetClaim(claim: BrowserOperatorTargetClaim): void {
    if (!isValidOperatorTargetClaim(claim)) throw new Error("BROWSER_TARGET_INVALID");
    if (this.issuer.current().kind !== "PRESENT") throw new Error("BROWSER_HOST_UNAVAILABLE");
    this.operatorTargetClaim = claim;
  }

  private extensionAuthorityContext(): BrowserExtensionAuthorityContext {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    return {
      authorityRef: current.authority.authorityRef,
      authorityEpoch: current.authority.authorityEpoch,
      certificateHash: hashBrowserAuthorityCertificate(current.authority),
      activationTupleHash: current.authority.activationTupleHash,
      executionBindingHash: current.authority.executionBindingHash,
      commandPermitKey: this.issuer.commandPermitKeyBase64(),
    };
  }
}

export type { BrowserExactTargetAcquisition };

const isValidOperatorTargetClaim = (claim: BrowserOperatorTargetClaim): boolean => {
  if (!claim.targetRef || !claim.documentRef || claim.navigationEpoch !== 0 || !claim.title) return false;
  try {
    return new URL(claim.url).protocol === "https:";
  } catch {
    return false;
  }
};
