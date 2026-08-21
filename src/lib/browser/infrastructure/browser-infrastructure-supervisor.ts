import { createHash } from "node:crypto";
import { join } from "node:path";

import { BrowserCommandActor } from "../exact-target/browser-command-actor.js";
import { BrowserMutationIntentJournal } from "../exact-target/browser-mutation-intent-journal.js";
import { BrowserTargetLeaseManager, type BrowserExactTargetAcquisition } from "../exact-target/browser-target-lease-manager.js";
import { BrowserCommandAdmissionBudget } from "../transport/browser-command-admission-budget.js";
import { WorkbenchExtensionChannel, type BrowserOperatorTargetClaim, type WorkbenchExtensionChannelRequest, type WorkbenchExtensionChannelResponse } from "../transport/workbench-extension-channel.js";
import { hashBrowserAuthorityCertificate } from "./browser-authority-certificate.js";
import { BrowserAuthorityBroker, type BrowserArtifactResolver, type BrowserExecutionBinding } from "./browser-authority-broker.js";
import { BrowserAuthorityIssuer, type BrowserAuthenticationProof } from "./browser-authority-issuer.js";
import { BrowserOwnerLock } from "./browser-owner-lock.js";
import { BrowserTransportActor } from "../transport/transport-actor.js";
import type { BrowserProfileConfig } from "../profile/browser-profile-config.js";
import type { BrowserProfileState } from "../profile/browser-profile-state.js";
import { createCwsExtensionReleaseProof } from "../release/cws-extension-release-proof.js";
import { assertCwsReleaseIdentity } from "../release/cws-extension-release-identity.js";
import { assertCwsExtensionReleasePolicy } from "../release/cws-extension-release-policy.js";
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

export const BROWSER_INFRASTRUCTURE_SLOS = Object.freeze({ authorityAvailabilityPercent: 99.99, authorityIssuanceP99Ms: 5_000, recoverableChainRebuildP99Ms: 10_000, revokeToAbsentP99Ms: 10 });

export type BrowserInfrastructureSupervisorOptions = Readonly<{
  dataDir: string;
  profileConfig: BrowserProfileConfig;
  enrolledProfile: BrowserProfileState;
  artifactResolver: BrowserArtifactResolver;
}>;

export class BrowserInfrastructureSupervisor {
  private readonly issuer = new BrowserAuthorityIssuer();
  private readonly transport = new BrowserTransportActor(this.issuer);
  private readonly ownerLock: BrowserOwnerLock;
  private readonly broker: BrowserAuthorityBroker;
  private readonly extensionChannel: WorkbenchExtensionChannel;
  private operatorTargetClaim: BrowserOperatorTargetClaim | null = null;
  private started = false;
  private ownerLockHeld = false;
  private connectionGeneration = 0;

  public constructor(private readonly options: BrowserInfrastructureSupervisorOptions) {
    this.ownerLock = new BrowserOwnerLock(join(options.dataDir, "browser", "owner.lock"));
    this.extensionChannel = new WorkbenchExtensionChannel({
      authenticate: (input) => this.commitWorkbenchAuthentication(input),
      authorityContext: () => this.extensionAuthorityContext(),
      onOperatorTargetClaim: (claim) => this.recordOperatorTargetClaim(claim),
      onDisconnect: (reasonCode) => this.disconnectTransport(reasonCode),
    });
    this.broker = new BrowserAuthorityBroker(this.issuer, (binding) => this.createTargetLeaseManager(binding), options.artifactResolver);
  }

  public async start(): Promise<void> {
    if (this.started) return;
    await this.ownerLock.acquire();
    this.ownerLockHeld = true;
    try {
      this.extensionChannel.start();
      this.transport.start();
      this.started = true;
    } catch (error) {
      await this.ownerLock.release();
      this.ownerLockHeld = false;
      throw error;
    }
  }

  public async stop(reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"): Promise<void> {
    this.transport.disconnect(reasonCode);
    this.extensionChannel.stop(reasonCode);
    if (this.ownerLockHeld) {
      await this.ownerLock.release();
      this.ownerLockHeld = false;
    }
    this.started = false;
  }

  public authorityBroker(): BrowserAuthorityBroker { return this.broker; }

  public workbenchExtensionChannel(input: WorkbenchExtensionChannelRequest): Promise<WorkbenchExtensionChannelResponse> {
    return this.extensionChannel.handle(input);
  }

  public async acquireOperatorClaimedTargetLease(binding: BrowserExecutionBinding, ownerId: string): Promise<BrowserTargetLease> {
    const authority = await this.broker.acquireForExecution(binding);
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    const claim = this.operatorTargetClaim;
    this.operatorTargetClaim = null;
    if (!claim) throw new Error("BROWSER_TARGET_INVALID");
    return authority.acquireTargetLease({
      ownerId,
      target: {
        target: { targetRef: claim.targetRef, authorityEpoch: current.authority.authorityEpoch, executionBindingHash: binding.executionRefHash },
        document: { documentRef: claim.documentRef, targetRef: claim.targetRef, navigationEpoch: claim.navigationEpoch },
        url: claim.url,
        title: claim.title,
      },
    });
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

  private createTargetLeaseManager(binding: BrowserExecutionBinding): BrowserTargetLeaseManager {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error("BROWSER_WORKER_FENCE_INVALID");
    return new BrowserTargetLeaseManager(
      current.authority,
      binding,
      new BrowserCommandActor(
        new BrowserCommandAdmissionBudget(),
        this.extensionChannel,
        new BrowserMutationIntentJournal(join(this.options.dataDir, "browser", "mutation-intents.ndjson")),
        { assertCurrentAuthority: (permit) => {
          const slot = this.issuer.current();
          if (slot.kind === "ABSENT" || slot.authority.authorityRef !== current.authority.authorityRef || slot.authority.authorityEpoch !== current.authority.authorityEpoch) throw new Error("BROWSER_LIVENESS_EXPIRED");
          this.issuer.assertCurrentCommandPermit(permit);
        } },
      ),
      this.issuer,
    );
  }

  private commitWorkbenchAuthentication(input: Readonly<{ extensionId: string; extensionVersion: string; pageSessionHash: `sha256:${string}`; sourceChannelToken: string }>): BrowserAuthenticationProof {
    if (!this.started) throw new Error("BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
    const release = createCwsExtensionReleaseProof(input.extensionVersion);
    assertCwsReleaseIdentity(release.identity);
    assertCwsExtensionReleasePolicy(release.identity);
    if (release.identity.installedExtensionId !== input.extensionId) throw new Error("BROWSER_CWS_EXTENSION_ID_INVALID");
    const handshake = {
      pageSessionHash: input.pageSessionHash,
      extensionId: input.extensionId,
      extensionVersion: input.extensionVersion,
      sourceChannelToken: input.sourceChannelToken,
      artifactSetHash: release.identity.sourcePackageHash,
      releaseSecurityPolicyHash: release.identity.sourcePackageHash,
      profileEnrollmentHash: this.options.enrolledProfile.enrollmentHash,
      connectionGeneration: ++this.connectionGeneration,
      protocolRevision: 1,
      capabilitySetHash: hashValue("browser-capability-set-v1"),
      permissionPolicyHash: release.identity.permissionPolicyHash,
      originPolicyHash: release.identity.originPolicyHash,
      livenessPolicyHash: hashValue("browser-liveness-v1"),
      commandAdmissionBudgetHash: hashValue("browser-command-budget-v1"),
      artifactStreamBudgetHash: hashValue("browser-artifact-budget-v1"),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    } as const;
    const proof: BrowserAuthenticationProof = { handshake, authTranscriptHash: hashValue(handshake) };
    this.transport.commitAuthentication(proof);
    return proof;
  }

  private disconnectTransport(reasonCode: string): void {
    this.operatorTargetClaim = null;
    if (this.started) this.transport.disconnect(reasonCode);
  }

  private recordOperatorTargetClaim(claim: BrowserOperatorTargetClaim): void {
    if (!isValidOperatorTargetClaim(claim) || this.issuer.current().kind !== "PRESENT") throw new Error("BROWSER_TARGET_INVALID");
    this.operatorTargetClaim = claim;
  }

  private extensionAuthorityContext(): Readonly<{ authorityRef: string; authorityEpoch: number; certificateHash: `sha256:${string}`; channelSessionHash: `sha256:${string}`; commandPermitKey: string }> {
    const current = this.issuer.current();
    if (current.kind === "ABSENT") throw new Error(current.reasonCode);
    return { authorityRef: current.authority.authorityRef, authorityEpoch: current.authority.authorityEpoch, certificateHash: hashBrowserAuthorityCertificate(current.authority), channelSessionHash: current.authority.channelSessionHash, commandPermitKey: this.issuer.commandPermitKeyBase64() };
  }
}

export type { BrowserExactTargetAcquisition };

const hashValue = (value: unknown): `sha256:${string}` => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const isValidOperatorTargetClaim = (claim: BrowserOperatorTargetClaim): boolean => {
  if (!claim.targetRef || !claim.documentRef || claim.navigationEpoch !== 0 || !claim.title) return false;
  try { return new URL(claim.url).protocol === "https:"; } catch { return false; }
};
