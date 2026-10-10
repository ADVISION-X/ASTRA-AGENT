import { randomUUID } from "node:crypto";
import { executionFailure, failureCode } from "../../execution-failure.js";

import { agentRouteCapabilityManifest } from "./catalog.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";
import { productionControlContractVersion } from "./control-contract-dependency.js";
import {
  RuntimeAttestationReceiptSchema,
  ClaimBatchReceiptSchema,
  WorkerSessionCredentialSchema,
  parseJsonEnvelope,
  type DeviceCredential,
  type RuntimeAttestationReceipt,
  type WorkerSessionCredential,
} from "./transport-protocol.js";
import { runtimeTransportFailure, typedRuntimeTransportFailure } from "./transport-failure.js";

const parseCloudResponse = async (response: Response): Promise<unknown> => {
  let raw: unknown;
  try {
    raw = await response.json();
  } catch (cause) {
    throw runtimeTransportFailure("AI_PRODUCTION_HTTP_ENVELOPE_INVALID", response.status, cause);
  }
  try {
    return parseJsonEnvelope(raw, response.status);
  } catch (error) {
    throw typedRuntimeTransportFailure(error)
      ?? runtimeTransportFailure("AI_PRODUCTION_HTTP_ENVELOPE_INVALID", response.status, error);
  }
};
export interface ProductionRuntimeState {
  readonly agent_attested_in_flight: number;
  readonly browser_action_in_flight: 0 | 1;
  readonly browser_authority_state: "present" | "absent";
  readonly browser_target_state: "claimed" | "absent";
  readonly browser_lane_state: "idle" | "busy" | "blocked";
  readonly drain_state: "open" | "draining";
  readonly ledger_reconciled: boolean;
}

const OpenResponseSchema = WorkerSessionCredentialSchema.transform((value) => value);
const CLOUD_REQUEST_TIMEOUT_MS = 30_000;
const CLAIM_ATTESTATION_MIN_VALIDITY_MS = CLOUD_REQUEST_TIMEOUT_MS + 5_000;

export class ProductionWorkerSession {
  private credential: WorkerSessionCredential | null = null;
  private attestation: RuntimeAttestationReceipt | null = null;
  private sequence = 0;
  private activeHeartbeat: Promise<RuntimeAttestationReceipt> | null = null;
  private sessionAuthorityTail: Promise<void> = Promise.resolve();

  public constructor(
    public readonly device: DeviceCredential,
    private readonly runtimeState: () => ProductionRuntimeState,
    private readonly agentBuildHash: ProductionHash,
    private readonly cloudMutationsAllowed: () => boolean,
    public readonly workerInstanceId = `worker_${randomUUID()}`,
    public readonly sessionOpenRequestId = `aipsopen_${randomUUID()}`,
  ) {}

  public get workerSessionId(): string {
    if (!this.credential) throw new Error("PRODUCTION_SESSION_NOT_OPEN");
    return this.credential.worker_session_id;
  }

  public get workerSessionEpoch(): number {
    if (!this.credential) throw new Error("PRODUCTION_SESSION_NOT_OPEN");
    return this.credential.worker_session_epoch;
  }

  public get buildHash(): ProductionHash { return this.agentBuildHash; }

  public get controlContractVersion(): number { return productionControlContractVersion; }

  public get latestAttestation(): RuntimeAttestationReceipt {
    if (!this.attestation) throw new Error("PRODUCTION_ATTESTATION_MISSING");
    return this.attestation;
  }

  public async open(): Promise<void> {
    if (this.credential) return;
    const data = await this.deviceRequest("/internal/ai-production/v6/sessions/open", {
      schema_version: "xuanxue-ai-worker-session-open.v6",
      request_id: this.sessionOpenRequestId,
      environment_id: "production",
      origin: this.device.origin,
      device_id: this.device.device_id,
      device_epoch: this.device.device_epoch,
      worker_instance_id: this.workerInstanceId,
      agent_build_hash: this.agentBuildHash,
      control_contract_version: productionControlContractVersion,
    });
    const response = data as { session?: Record<string, unknown>; session_credential?: unknown };
    const credential = OpenResponseSchema.parse(response.session_credential);
    if (response.session?.device_id !== this.device.device_id
      || response.session.worker_session_id !== credential.worker_session_id
      || response.session.worker_session_epoch !== credential.worker_session_epoch
      || response.session.control_contract_version !== productionControlContractVersion
      || !Number.isSafeInteger(response.session.attestation_seq)
      || (response.session.attestation_seq as number) < 0) {
      throw executionFailure("failed", "PRODUCTION_SESSION_BINDING_INVALID");
    }
    this.sequence = response.session.attestation_seq as number;
    this.credential = credential;
    this.attestation = null;
  }

  private async resynchronizeHeartbeatSession(): Promise<void> {
    const previous = this.credential;
    this.credential = null;
    this.attestation = null;
    await this.open();
    if (previous && (this.credential!.worker_session_id !== previous.worker_session_id
      || this.credential!.worker_session_epoch !== previous.worker_session_epoch)) {
      this.credential = null;
      throw executionFailure("failed", "PRODUCTION_SESSION_BINDING_INVALID");
    }
  }

  public async heartbeat(): Promise<RuntimeAttestationReceipt> {
    this.activeHeartbeat ??= this.runSessionAuthorityTurn(() => this.performHeartbeat())
      .finally(() => { this.activeHeartbeat = null; });
    return this.activeHeartbeat;
  }

  private async runSessionAuthorityTurn<T>(operation: () => Promise<T>): Promise<T> {
    const predecessor = this.sessionAuthorityTail;
    let release: (() => void) | undefined;
    this.sessionAuthorityTail = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    try { return await operation(); } finally { release!(); }
  }

  private async performHeartbeat(): Promise<RuntimeAttestationReceipt> {
    await this.open();
    const state = this.runtimeState();
    const next = this.sequence + 1;
    try {
      const data = await this.request(`/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/heartbeat`, {
        method: "POST",
        body: JSON.stringify({
          schema_version: "xuanxue-ai-worker-runtime-attestation.v6",
          request_id: `aipattreq_${randomUUID()}`,
          attestation_seq: next,
          worker_session_id: this.workerSessionId,
          worker_session_epoch: this.workerSessionEpoch,
          agent_attested_in_flight: state.agent_attested_in_flight,
          browser_action_capacity_total: 1,
          browser_action_in_flight: state.browser_action_in_flight,
          browser_authority_state: state.browser_authority_state,
          browser_target_state: state.browser_target_state,
          browser_lane_state: state.browser_lane_state,
          drain_state: state.drain_state,
          ledger_reconciled: state.ledger_reconciled,
          capability_manifest: agentRouteCapabilityManifest,
        }),
      }) as { attestation_receipt?: unknown; session_credential?: unknown };
      const receipt = RuntimeAttestationReceiptSchema.parse(data.attestation_receipt);
      const credential = WorkerSessionCredentialSchema.parse(data.session_credential);
      if (receipt.worker_session_id !== this.workerSessionId || receipt.attestation_seq !== next
        || credential.worker_session_id !== this.workerSessionId
        || credential.token_generation <= this.credential!.token_generation) {
        throw executionFailure("failed", "PRODUCTION_ATTESTATION_BINDING_INVALID");
      }
      this.credential = credential;
      this.attestation = receipt;
      this.sequence = next;
      return receipt;
    } catch (error) {
      if (failureCode(error) === "RUNTIME_LOG_SINK_WRITE_FAILED") throw error;
      await this.resynchronizeHeartbeatSession();
      throw error;
    }
  }

  public async ensureFreshAttestation(): Promise<RuntimeAttestationReceipt> {
    if (this.activeHeartbeat) return this.activeHeartbeat;
    return this.runSessionAuthorityTurn(() => this.freshAttestationInTurn());
  }

  private async freshAttestationInTurn(minValidityMs = 10_000): Promise<RuntimeAttestationReceipt> {
    return !this.attestation || Date.parse(this.attestation.expires_at) - Date.now() < minValidityMs
      ? this.performHeartbeat()
      : this.attestation;
  }

  public async requestClaim(
    requestId: string,
    requestedLimit: number,
    forceCurrentAttestation = false,
    sourceEvidence: readonly import("./source-readback-contract.js").SourceAttemptHandoff[] = [],
    deliveryCandidates: readonly Readonly<{ job_id: string; attempt_id: string;
      candidate_hash: `sha256:${string}` }>[] = [],
  ): Promise<unknown> {
    return this.runSessionAuthorityTurn(async () => {
      const attestation = forceCurrentAttestation
        ? await this.performHeartbeat()
        : await this.freshAttestationInTurn(CLAIM_ATTESTATION_MIN_VALIDITY_MS);
      const claimRequest = {
        schema_version: "xuanxue-ai-claim-request.v6",
        control_protocol_version: "xuanxue-ai-production-v6",
        request_id: requestId,
        worker_session_id: this.workerSessionId,
        worker_session_epoch: this.workerSessionEpoch,
        requested_new_limit: requestedLimit,
        runtime_attestation_receipt_hash: attestation.receipt_hash,
        source_evidence: sourceEvidence,
        delivery_candidates: deliveryCandidates,
      } as const;
      const receipt = ClaimBatchReceiptSchema.parse(await this.request(
        "/internal/ai-production/v6/jobs/claim", {
        method: "POST",
        body: JSON.stringify(claimRequest),
      }));
      if (receipt.request_payload_hash !== hashCanonical(claimRequest)) {
        throw executionFailure("failed", "V6_CLAIM_RECEIPT_MISMATCH");
      }
      return receipt;
    });
  }

  public async authorizationHeaders(extra: Readonly<Record<string, string>> = {}): Promise<Record<string, string>> {
    await this.open();
    return {
      origin: this.device.origin,
      "x-ai-agent-origin": this.device.origin,
      authorization: `Bearer ${this.credential!.token}`,
      ...extra,
    };
  }

  public async request(pathname: string, init: RequestInit): Promise<unknown> {
    await this.open();
    const headers = { ...(await this.authorizationHeaders({ "content-type": "application/json" })),
      ...(init.headers ?? {}) };
    // Recheck after all queued authentication work, immediately before physical fetch.
    if (pathname === "/internal/ai-production/v6/jobs/claim"
      && this.runtimeState().drain_state === "draining") {
      throw executionFailure("failed", "PRODUCTION_CLAIM_STOPPED");
    }
    const method = (init.method ?? "GET").toUpperCase();
    const existingSessionClose = method === "POST" && init.body === "{}" && this.credential !== null
      && pathname === `/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/close`;
    if (!["GET", "HEAD"].includes(method) && !existingSessionClose) this.assertCloudMutationAllowed();
    let response: Response;
    try {
      response = await fetch(`${this.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
        ...init, headers, signal: init.signal ?? AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE", { cause });
    }
    return parseCloudResponse(response);
  }

  public async close(): Promise<void> {
    if (!this.credential) return;
    await this.request(`/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/close`, {
      method: "POST", body: "{}",
    });
    this.credential = null;
    this.attestation = null;
  }

  private assertCloudMutationAllowed(): void {
    if (!this.cloudMutationsAllowed()) throw executionFailure("failed", "RUNTIME_LOG_SINK_WRITE_FAILED");
  }

  private async deviceRequest(pathname: string, body: Record<string, unknown>): Promise<unknown> {
    this.assertCloudMutationAllowed();
    let response: Response;
    try {
      response = await fetch(`${this.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.device.credential}`,
          origin: this.device.origin,
          "x-ai-agent-origin": this.device.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      throw executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE", { cause });
    }
    return parseCloudResponse(response);
  }
}
