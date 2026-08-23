import { randomUUID } from "node:crypto";
import {
  RuntimeAttestationReceiptV6Schema,
  WorkerSessionCredentialV6Schema,
  type RuntimeAttestationReceiptV6,
  type WorkerSessionCredentialV6,
} from "./generated/xuanxue-ai-production-v6.validator.js";
import {
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import { XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6 } from "./xuanxue-ai-production-product-contracts.js";

interface JsonEnvelope<T> {
  readonly ok?: boolean;
  readonly data?: T;
  readonly error?: { readonly code?: string; readonly message?: string };
}

export type XuanxueAiProductionRuntimeStateV6 = Readonly<{
  businessInFlight: number;
  browserActionInFlight: 0 | 1;
  browserAuthorityState: "present" | "absent";
  browserTargetState: "claimed" | "absent";
  browserLaneState: "idle" | "busy" | "blocked";
  drainState: "open" | "draining";
  ledgerReconciled: boolean;
}>;

type OpenSessionResponse = Readonly<{
  session: Readonly<{
    worker_session_id: string;
    worker_session_epoch: number;
    environment_id: string;
    origin: string;
    device_id: string;
    device_epoch: number;
    agent_build_hash: `sha256:${string}`;
    control_contract_manifest_hash: `sha256:${string}`;
  }>;
  session_credential: unknown;
}>;

type HeartbeatResponse = Readonly<{
  attestation_receipt: unknown;
  session_credential: unknown;
}>;

const baseUrl = (credential: XuanxueAiProductionCloudCredential): string =>
  credential.server_base_url.replace(/\/+$/u, "");

export class XuanxueAiProductionWorkerSessionV6 {
  private sessionCredential: WorkerSessionCredentialV6 | null = null;
  private attestationReceipt: RuntimeAttestationReceiptV6 | null = null;
  private attestationSeq = 0;
  private heartbeatRequestId: string | null = null;
  private activeHeartbeat: Promise<RuntimeAttestationReceiptV6> | null = null;
  private ledgerReconciled = false;

  public constructor(
    public readonly device: XuanxueAiProductionCloudCredential,
    private readonly runtimeState: () => Promise<XuanxueAiProductionRuntimeStateV6>,
    private readonly workerInstanceId = `worker_${randomUUID()}`,
  ) {}

  public get workerSessionId(): string {
    if (!this.sessionCredential) throw new Error("XUANXUE_AI_PRODUCTION_SESSION_NOT_OPEN");
    return this.sessionCredential.worker_session_id;
  }

  public get workerSessionEpoch(): number {
    if (!this.sessionCredential) throw new Error("XUANXUE_AI_PRODUCTION_SESSION_NOT_OPEN");
    return this.sessionCredential.worker_session_epoch;
  }

  public get latestAttestation(): RuntimeAttestationReceiptV6 {
    if (!this.attestationReceipt) throw new Error("XUANXUE_AI_PRODUCTION_ATTESTATION_MISSING");
    return this.attestationReceipt;
  }

  public markLedgerReconciled(): void {
    this.ledgerReconciled = true;
  }

  public async open(): Promise<void> {
    if (this.sessionCredential) return;
    const requestId = `aipsopen_${randomUUID()}`;
    const response = await this.deviceRequest<OpenSessionResponse>(
      "/internal/ai-production/v6/sessions/open",
      {
        schema_version: "xuanxue-ai-worker-session-open.v6",
        request_id: requestId,
        environment_id: this.device.environment_id,
        origin: this.device.origin,
        device_id: this.device.device_id,
        device_epoch: this.device.device_epoch,
        worker_instance_id: this.workerInstanceId,
        agent_build_hash: this.device.agent_build_hash,
        control_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
      },
    );
    const sessionCredential = WorkerSessionCredentialV6Schema.parse(response.session_credential);
    const session = response.session;
    if (session.worker_session_id !== sessionCredential.worker_session_id
      || session.worker_session_epoch !== sessionCredential.worker_session_epoch
      || session.environment_id !== this.device.environment_id
      || session.origin !== this.device.origin
      || session.device_id !== this.device.device_id
      || session.device_epoch !== this.device.device_epoch
      || session.agent_build_hash !== this.device.agent_build_hash
      || session.control_contract_manifest_hash !== XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH) {
      throw new Error("XUANXUE_AI_PRODUCTION_SESSION_BINDING_INVALID");
    }
    this.sessionCredential = sessionCredential;
  }

  public async heartbeat(): Promise<RuntimeAttestationReceiptV6> {
    this.activeHeartbeat ??= this.performHeartbeat().finally(() => { this.activeHeartbeat = null; });
    return this.activeHeartbeat;
  }

  private async performHeartbeat(): Promise<RuntimeAttestationReceiptV6> {
    await this.open();
    const state = await this.runtimeState();
    const nextSeq = this.attestationSeq + 1;
    const requestId = this.heartbeatRequestId ?? `aipattreq_${randomUUID()}`;
    this.heartbeatRequestId = requestId;
    const response = await this.sessionRequest<HeartbeatResponse>(
      `/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/heartbeat`,
      {
        method: "POST",
        body: JSON.stringify({
          schema_version: "xuanxue-ai-worker-runtime-attestation.v6",
          request_id: requestId,
          attestation_seq: nextSeq,
          worker_session_id: this.workerSessionId,
          worker_session_epoch: this.workerSessionEpoch,
          agent_build_hash: this.device.agent_build_hash,
          control_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
          product_contract_hashes: XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6,
          business_capacity_total: 10,
          business_in_flight: state.businessInFlight,
          browser_action_capacity_total: 1,
          browser_action_in_flight: state.browserActionInFlight,
          browser_authority_state: state.browserAuthorityState,
          browser_target_state: state.browserTargetState,
          browser_lane_state: state.browserLaneState,
          drain_state: state.drainState,
          ledger_reconciled: this.ledgerReconciled && state.ledgerReconciled,
        }),
      },
    );
    const receipt = RuntimeAttestationReceiptV6Schema.parse(response.attestation_receipt);
    const rotatedCredential = WorkerSessionCredentialV6Schema.parse(response.session_credential);
    if (receipt.worker_session_id !== this.workerSessionId
      || receipt.worker_session_epoch !== this.workerSessionEpoch
      || receipt.attestation_seq !== nextSeq
      || rotatedCredential.worker_session_id !== this.workerSessionId
      || rotatedCredential.worker_session_epoch !== this.workerSessionEpoch
      || rotatedCredential.token_generation <= this.sessionCredential!.token_generation
      || Date.parse(receipt.expires_at) - Date.parse(receipt.issued_at) > 45_000
      || Date.parse(rotatedCredential.expires_at) - Date.parse(rotatedCredential.issued_at) > 180_000) {
      throw new Error("XUANXUE_AI_PRODUCTION_ATTESTATION_BINDING_INVALID");
    }
    // The session credential exists only in this process field. It is never
    // passed to persistence, logs, the SQLite outbox, or a returned DTO.
    this.sessionCredential = rotatedCredential;
    this.attestationReceipt = receipt;
    this.attestationSeq = nextSeq;
    this.heartbeatRequestId = null;
    return receipt;
  }

  public async ensureFreshAttestation(): Promise<RuntimeAttestationReceiptV6> {
    const current = this.attestationReceipt;
    if (!current || Date.parse(current.expires_at) - Date.now() < 10_000) {
      return this.heartbeat();
    }
    return current;
  }

  public async request<T>(pathname: string, init: RequestInit): Promise<T> {
    await this.open();
    return this.sessionRequest<T>(pathname, init);
  }

  public async authorizationHeaders(
    extra: Readonly<Record<string, string>> = {},
  ): Promise<Record<string, string>> {
    await this.open();
    return {
      origin: this.device.origin,
      authorization: `Bearer ${this.sessionCredential!.token}`,
      ...extra,
    };
  }

  public async close(): Promise<void> {
    if (!this.sessionCredential) return;
    await this.sessionRequest(
      `/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/close`,
      { method: "POST", body: "{}" },
    );
    this.sessionCredential = null;
    this.attestationReceipt = null;
  }

  private async deviceRequest<T>(pathname: string, body: Record<string, unknown>): Promise<T> {
    return this.fetchJson<T>(pathname, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.device.credential}`,
        origin: this.device.origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  private async sessionRequest<T>(pathname: string, init: RequestInit): Promise<T> {
    const credential = this.sessionCredential;
    if (!credential) throw new Error("XUANXUE_AI_PRODUCTION_SESSION_NOT_OPEN");
    return this.fetchJson<T>(pathname, {
      ...init,
      headers: {
        origin: this.device.origin,
        authorization: `Bearer ${credential.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  private async fetchJson<T>(pathname: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${baseUrl(this.device)}${pathname}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    const body = await response.json() as JsonEnvelope<T>;
    if (!response.ok || body.ok !== true || body.data === undefined) {
      throw new Error(`XUANXUE_AI_PRODUCTION_CLOUD_API_FAILED:${body.error?.code ?? response.status}:${body.error?.message ?? "unknown"}`);
    }
    return body.data;
  }
}
