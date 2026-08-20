import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import type { RuntimeLogger } from "../../runtime-logs/index.js";
import type {
  BrowserAuthorityBroker,
  BrowserAuthorityStatus,
  BrowserExecutionBinding,
} from "../browser-authority-api.js";
import type { BrowserProfileEnrollment } from "../profile/browser-profile-enrollment.js";
import { ensureEnrolledBrowserProcess } from "../profile/browser-profile-process-attestation.js";
import { readBrowserManagedPolicyReadback } from "../profile/managed-policy-readback.js";
import {
  assertBrowserReleaseBinding,
  type VerifiedBrowserReleaseBinding,
} from "../release/browser-release-contract.js";
import { TransportActor } from "../transport/transport-actor.js";
import {
  BrowserAuthorityBrokerImpl,
  type BrowserExecutionFenceValidator,
} from "./browser-authority-broker.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export type BrowserAuthoritySubscription = () => void;

export type BrowserInfrastructureSupervisor = Readonly<{
  bootstrap(): Promise<BrowserAuthorityBroker>;
  currentStatus(): BrowserAuthorityStatus;
  subscribeAuthority(
    listener: (status: BrowserAuthorityStatus) => void,
  ): BrowserAuthoritySubscription;
  stop(): Promise<void>;
}>;

type SupervisorInput = Readonly<{
  dataDir: string;
  profileEnrollment: BrowserProfileEnrollment;
  release: VerifiedBrowserReleaseBinding;
  ownerLockHelperPath: string;
  approvedArtifactRoots: readonly string[];
  fenceValidator: BrowserExecutionFenceValidator;
  runtimeLogger: RuntimeLogger;
}>;

/**
 * This is the only V3 composition root for controller IPC, Chrome process
 * identity and authority issuance. It intentionally exposes no command or
 * target method: consumers receive the broker only after bootstrap.
 */
export class BrowserInfrastructureSupervisorImpl implements BrowserInfrastructureSupervisor {
  private readonly listeners = new Set<
    (status: BrowserAuthorityStatus) => void
  >();
  private actor: TransportActor | null = null;
  private broker: BrowserAuthorityBrokerImpl | null = null;
  private bootPromise: Promise<BrowserAuthorityBroker> | null = null;
  private stopped = false;

  constructor(private readonly input: SupervisorInput) {}

  async bootstrap(): Promise<BrowserAuthorityBroker> {
    if (this.stopped) throw new Error("BROWSER_INFRASTRUCTURE_STOPPED");
    if (this.broker) return this.broker;
    if (!this.bootPromise) this.bootPromise = this.bootstrapOnce();
    try {
      return await this.bootPromise;
    } finally {
      this.bootPromise = null;
    }
  }

  currentStatus(): BrowserAuthorityStatus {
    if (!this.actor) {
      return {
        kind: "UNAVAILABLE",
        reasonCode: this.stopped
          ? "BROWSER_INFRASTRUCTURE_STOPPED"
          : "BROWSER_INFRASTRUCTURE_NOT_BOOTSTRAPPED",
      };
    }
    return (
      this.broker?.currentStatus() ?? {
        kind: "UNAVAILABLE",
        reasonCode: "BROWSER_INFRASTRUCTURE_BOOTSTRAPPING",
      }
    );
  }

  subscribeAuthority(
    listener: (status: BrowserAuthorityStatus) => void,
  ): BrowserAuthoritySubscription {
    this.listeners.add(listener);
    listener(this.currentStatus());
    return () => this.listeners.delete(listener);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    const actor = this.actor;
    const broker = this.broker;
    this.actor = null;
    this.broker = null;
    broker?.invalidateAll();
    await actor?.stop();
    this.publish();
  }

  private async bootstrapOnce(): Promise<BrowserAuthorityBroker> {
    assertBrowserReleaseBinding(this.input.release);
    const chromeProcess = await ensureEnrolledBrowserProcess(
      this.input.profileEnrollment,
    );
    const managedPolicy = readBrowserManagedPolicyReadback({
      extensionId: this.input.release.activationTuple.extensionId,
      permissionPolicyHash:
        this.input.release.activationTuple.permissionPolicyHash,
      originPolicyHash: this.input.release.artifactSet.originPolicyHash,
      expectedExtensionTreeHash:
        this.input.release.activationTuple.extensionArtifactDigest,
    });
    const supervisorEpoch = Date.now();
    const controllerIncarnationHash = hash(
      `${process.pid}:${supervisorEpoch}:${randomUUID()}`,
    );
    let actor: TransportActor;
    actor = new TransportActor({
      dataDir: this.input.dataDir,
      socketPath: path.join(
        this.input.dataDir,
        "browser-runtime",
        "controller-v3.sock",
      ),
      ownerLockHelperPath: this.input.ownerLockHelperPath,
      supervisorEpoch,
      controllerIncarnationHash,
      profileEnrollmentHash: hash(
        this.input.profileEnrollment.profileEnrollmentId,
      ),
      chromeProcess,
      managedPolicy,
      release: this.input.release,
      expectedHostBinaryHash:
        this.input.release.artifactSet.nativeHostBinaryHash,
      runtimeLogger: this.input.runtimeLogger,
      acceptingConnections: (): boolean =>
        !this.stopped && this.actor === actor,
      onAuthoritySlotChanged: () => this.publish(),
      onDisconnected: () => this.publish(),
    });
    this.actor = actor;
    const broker = new BrowserAuthorityBrokerImpl({
      dataDir: this.input.dataDir,
      transport: actor,
      approvedArtifactRoots: this.input.approvedArtifactRoots,
      fenceValidator: this.input.fenceValidator,
    });
    this.broker = broker;
    try {
      await actor.start();
      this.publish();
      return broker;
    } catch (error) {
      this.actor = null;
      this.broker = null;
      await actor.stop().catch(() => undefined);
      this.publish();
      throw error;
    }
  }

  private publish(): void {
    const status = this.currentStatus();
    for (const listener of this.listeners) listener(status);
  }
}

export const createUnavailableBrowserAuthorityBroker = (
  reasonCode: string,
): BrowserAuthorityBroker => ({
  currentStatus: () => ({ kind: "UNAVAILABLE", reasonCode }),
  acquireForExecution: async (_binding: BrowserExecutionBinding) => {
    throw new Error(`BROWSER_INFRASTRUCTURE_UNAVAILABLE:${reasonCode}`);
  },
});
