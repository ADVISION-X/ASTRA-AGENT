import type {
  ProviderRateLimitClearance,
  ProviderRateLimitControlPort,
  ProviderRateLimitIncidentHandle,
  ProviderRateLimitIncidentInput,
} from "../../../capabilities/gpt/index.js";
import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import {
  parseProviderCooldownReceipt,
  type ProviderCooldownReceiptExpectation,
} from "./provider-cooldown-receipt.js";
import type { ProductionRuntimeStore } from "./store.js";
import type { ProductionWorkerSession } from "./worker-session.js";

export class ProviderRateLimitControl implements ProviderRateLimitControlPort {
  private submitGateOpen: boolean;

  public constructor(
    private readonly store: ProductionRuntimeStore,
    private readonly session: ProductionWorkerSession,
  ) {
    this.submitGateOpen = !store.hasProviderCooldownHistory();
  }

  public assertProviderSubmitAllowed(): void {
    if (this.store.hasUndeliveredProviderCooldown() || !this.submitGateOpen) {
      throw executionFailure("failed", "PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
    }
  }

  public canRequestClaimAuthority(): boolean {
    return !this.store.hasUndeliveredProviderCooldown();
  }

  public observeWebsiteAuthority(input: Readonly<{
    serverNow: string;
    reasonCodes: readonly string[];
  }>): void {
    const cooldownActive = input.reasonCodes.includes("PROVIDER_RATE_LIMIT_COOLDOWN_ACTIVE");
    if (!this.store.hasProviderCooldownHistory()) {
      this.submitGateOpen = !cooldownActive;
      return;
    }
    const latestIncidentServerNow = this.store.latestProviderCooldownServerNow();
    if (latestIncidentServerNow === null) return;
    if (latestIncidentServerNow
      && Date.parse(input.serverNow) < Date.parse(latestIncidentServerNow)) return;
    this.submitGateOpen = this.store.latestProviderCooldownClearance() === "confirmed_absent"
      && !cooldownActive;
  }

  public pendingIncidents(): readonly ProviderRateLimitIncidentInput[] {
    return Object.freeze(this.store.pendingProviderCooldownIncidentBodies().map((body) => {
      const input = {
        jobId: body.job_id,
        attemptId: body.attempt_id,
        resultRevision: body.result_revision,
        deviceId: this.session.device.device_id,
        leaseVersion: body.lease_version,
        fenceHash: body.fence_hash,
        capabilityManifestHash: body.capability_manifest_hash,
        dialogHash: body.dialog_hash,
        observationHash: body.observation_hash,
        targetRefHash: body.target_ref_hash,
        documentRefHash: body.document_ref_hash,
        sessionKey: body.gpt_session_key,
        observedAt: body.observed_at,
      };
      const hashes = [input.fenceHash, input.capabilityManifestHash,
        input.dialogHash, input.observationHash,
        input.targetRefHash, input.documentRefHash];
      if (typeof input.jobId !== "string" || !input.jobId
        || typeof input.attemptId !== "string" || !input.attemptId
        || !Number.isInteger(input.resultRevision) || Number(input.resultRevision) < 0
        || !Number.isInteger(input.leaseVersion) || Number(input.leaseVersion) < 1
        || typeof input.sessionKey !== "string" || !input.sessionKey
        || typeof input.observedAt !== "string" || !Number.isFinite(Date.parse(input.observedAt))
        || hashes.some((hash) => typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash))) {
        throw executionFailure("failed", "PROVIDER_COOLDOWN_INTENT_INVALID");
      }
      return Object.freeze(input) as ProviderRateLimitIncidentInput;
    }));
  }

  public async reconcilePendingIntents(): Promise<void> {
    for (const requestId of this.store.pendingProviderCooldownRequestIds()) {
      await this.store.deliverOutbox(requestId, async (write) => {
        const body = JSON.parse(Buffer.from(write.body).toString("utf8")) as Record<string, unknown>;
        const incidentRequestId = body.incident_request_id;
        if (typeof incidentRequestId !== "string" || !incidentRequestId) {
          throw executionFailure("failed", "PROVIDER_COOLDOWN_INTENT_INVALID");
        }
        return parseProviderCooldownReceipt(await this.session.request(write.path, {
          method: write.method,
          headers: write.headers,
          body: Buffer.from(write.body),
        }), {
          requestId,
          incidentRequestId,
          payloadHash: hashCanonical(body),
          deviceId: this.session.device.device_id,
          dialogHash: body.dialog_hash as ProductionHash,
          observationHash: body.observation_hash as ProductionHash,
          targetRefHash: body.target_ref_hash as ProductionHash,
          documentRefHash: body.document_ref_hash as ProductionHash,
        });
      });
    }
  }

  public async beginIncident(
    input: ProviderRateLimitIncidentInput,
  ): Promise<ProviderRateLimitIncidentHandle> {
    const incidentRequestId = `aipcooldown_${hashCanonical({
      job_id: input.jobId,
      attempt_id: input.attemptId,
      result_revision: input.resultRevision,
      dialog_hash: input.dialogHash,
      observation_hash: input.observationHash,
    }).slice(7, 47)}`;
    const incident = this.notice(input, incidentRequestId, incidentRequestId, {
      clearance: "pending_unknown",
      acknowledgementReceiptHash: null,
      acknowledgedAt: null,
    });
    this.store.enqueue(incident.write);
    this.submitGateOpen = false;
    return Object.freeze({
      incidentRequestId,
      deliver: async (clearance: ProviderRateLimitClearance): Promise<void> => {
        const clearanceRequestId = clearance.clearance === "confirmed_absent"
          ? `${incidentRequestId}_clearance` : `${incidentRequestId}_not_cleared`;
        const cleared = this.notice(input, incidentRequestId, clearanceRequestId, clearance);
        this.store.enqueue(cleared.write);
        await this.deliver(incident);
        await this.deliver(cleared);
      },
    });
  }

  private notice(
    input: ProviderRateLimitIncidentInput,
    incidentRequestId: string,
    requestId: string,
    clearance: Readonly<{
      clearance: "pending_unknown" | "confirmed_absent" | "not_cleared";
      acknowledgementReceiptHash: ProductionHash | null;
      acknowledgedAt: string | null;
    }>,
  ) {
    const payload = {
      incident_request_id: incidentRequestId,
      phase: clearance.clearance === "pending_unknown" ? "incident" : "clearance",
      job_id: input.jobId,
      worker_session_id: this.session.workerSessionId,
      worker_session_epoch: this.session.workerSessionEpoch,
      worker_instance_id: this.session.workerInstanceId,
      session_open_request_id: this.session.sessionOpenRequestId,
      attempt_id: input.attemptId,
      result_revision: input.resultRevision,
      lease_version: input.leaseVersion,
      fence_hash: input.fenceHash,
      capability_manifest_hash: input.capabilityManifestHash,
      dialog_hash: input.dialogHash,
      observation_hash: input.observationHash,
      target_ref_hash: input.targetRefHash,
      document_ref_hash: input.documentRefHash,
      gpt_session_key: input.sessionKey,
      observed_at: input.observedAt,
      clearance: clearance.clearance,
      acknowledgement_receipt_hash: clearance.acknowledgementReceiptHash,
      acknowledged_at: clearance.acknowledgedAt,
    } as const;
    const businessPayloadHash = hashCanonical(payload);
    const request = {
      schema_version: "xuanxue-ai-provider-cooldown-notice.v6",
      control_protocol_version: "xuanxue-ai-production-v6",
      request_id: requestId,
      idempotency_key: requestId,
      payload_hash: businessPayloadHash,
      ...payload,
    } as const;
    const payloadHash = hashCanonical(request);
    const body = JSON.stringify(request);
    return Object.freeze({
      requestId,
      incidentRequestId,
      payloadHash,
      deviceId: input.deviceId,
      dialogHash: input.dialogHash,
      observationHash: input.observationHash,
      targetRefHash: input.targetRefHash,
      documentRefHash: input.documentRefHash,
      write: Object.freeze({
        idempotency_key: requestId,
        kind: "provider_cooldown" as const,
        path: `/internal/ai-production/v6/jobs/${encodeURIComponent(input.jobId)}/provider-cooldown`,
        method: "POST" as const,
        headers: Object.freeze({ "x-ai-execution-fence-hash": input.fenceHash }),
        body,
      }),
    });
  }

  private async deliver(notice: ReturnType<ProviderRateLimitControl["notice"]>): Promise<void> {
    await this.store.deliverOutbox(notice.requestId, async (write) => parseProviderCooldownReceipt(
      await this.session.request(write.path, {
        method: write.method,
        headers: write.headers,
        body: Buffer.from(write.body),
      }),
      notice satisfies ProviderCooldownReceiptExpectation,
    ));
  }
}
