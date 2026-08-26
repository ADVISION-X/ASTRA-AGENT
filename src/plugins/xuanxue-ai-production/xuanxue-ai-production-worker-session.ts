import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  RuntimeAttestationReceiptV6Schema,
  WorkerSessionCredentialV6Schema,
  type RuntimeAttestationReceiptV6,
  type WorkerSessionCredentialV6,
} from "./xuanxue-ai-production-runtime-protocol.js";
import {
  type XuanxueAiProductionCloudCredential,
} from "./xuanxue-ai-production-cloud-contract.js";
import { parseXuanxueAiProductionJsonEnvelope } from "./xuanxue-ai-production-json-envelope.js";

const hashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const OpenSessionResponseSchema = z.object({
  session: z.object({
    worker_session_id: z.string().min(1),
    worker_session_epoch: z.number().int().positive(),
    environment_id: z.string().min(1),
    origin: z.string().url(),
    device_id: z.string().min(1),
    device_epoch: z.number().int().positive(),
    worker_instance_id: z.string().min(1),
    agent_build_hash: hashSchema,
    control_contract_manifest_hash: hashSchema,
    status: z.enum(["opening", "online", "claim_blocked", "claim_eligible", "draining", "superseded", "closed"]),
    token_generation: z.number().int().positive(),
    current_token_expires_at: z.string().datetime(),
    attestation_seq: z.number().int().nonnegative(),
    latest_attestation_receipt_hash: hashSchema.nullable(),
    latest_attestation_expires_at: z.string().datetime().nullable(),
    normalized_capabilities: z.record(z.unknown()),
    last_authenticated_activity_at: z.string().datetime(),
  }).strict(),
  session_credential: z.unknown(),
}).strict();
const HeartbeatResponseSchema = z.object({
  attestation_receipt: z.unknown(),
  session_credential: z.unknown(),
}).strict();

export type XuanxueAiProductionRuntimeStateV6 = Readonly<{
  businessInFlight: number;
  browserActionInFlight: 0 | 1;
  browserAuthorityState: "present" | "absent";
  browserTargetState: "claimed" | "absent";
  browserLaneState: "idle" | "busy" | "blocked";
  drainState: "open" | "draining";
  ledgerReconciled: boolean;
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
    private readonly agentBuildHash: `sha256:${string}`,
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
    const response = OpenSessionResponseSchema.parse(await this.deviceRequest(
      "/internal/ai-production/v6/sessions/open",
      {
        schema_version: "xuanxue-ai-worker-session-open.v6",
        request_id: requestId,
        environment_id: this.device.environment_id,
        origin: this.device.origin,
        device_id: this.device.device_id,
        device_epoch: this.device.device_epoch,
        worker_instance_id: this.workerInstanceId,
        agent_build_hash: this.agentBuildHash,
        control_manifest_hash: this.device.control_manifest_hash,
      },
    ));
    const sessionCredential = WorkerSessionCredentialV6Schema.parse(response.session_credential);
    const session = response.session;
    if (session.worker_session_id !== sessionCredential.worker_session_id
      || session.worker_session_epoch !== sessionCredential.worker_session_epoch
      || session.environment_id !== this.device.environment_id
      || session.origin !== this.device.origin
      || session.device_id !== this.device.device_id
      || session.device_epoch !== this.device.device_epoch
      || session.agent_build_hash !== this.agentBuildHash
      || session.control_contract_manifest_hash !== this.device.control_manifest_hash) {
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
    const response = HeartbeatResponseSchema.parse(await this.sessionRequest(
      `/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/heartbeat`,
      {
        method: "POST",
        body: JSON.stringify({
          schema_version: "xuanxue-ai-worker-runtime-attestation.v6",
          request_id: requestId,
          attestation_seq: nextSeq,
          worker_session_id: this.workerSessionId,
          worker_session_epoch: this.workerSessionEpoch,
          control_manifest_hash: this.device.control_manifest_hash,
          product_bundle_hash: this.device.product_bundle_hash,
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
    ));
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

  public async request(pathname: string, init: RequestInit): Promise<unknown> {
    await this.open();
    return this.sessionRequest(pathname, init);
  }

  public async authorizationHeaders(
    extra: Readonly<Record<string, string>> = {},
  ): Promise<Record<string, string>> {
    await this.open();
    return {
      origin: this.device.origin,
      "x-ai-agent-origin": this.device.origin,
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

  private async deviceRequest(pathname: string, body: Record<string, unknown>): Promise<unknown> {
    return this.fetchJson(pathname, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.device.credential}`,
        origin: this.device.origin,
        "x-ai-agent-origin": this.device.origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  private async sessionRequest(pathname: string, init: RequestInit): Promise<unknown> {
    const credential = this.sessionCredential;
    if (!credential) throw new Error("XUANXUE_AI_PRODUCTION_SESSION_NOT_OPEN");
    return this.fetchJson(pathname, {
      ...init,
      headers: {
        origin: this.device.origin,
        "x-ai-agent-origin": this.device.origin,
        authorization: `Bearer ${credential.token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  private async fetchJson(pathname: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(`${baseUrl(this.device)}${pathname}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    const body = parseXuanxueAiProductionJsonEnvelope(await response.json() as unknown);
    if (!response.ok || body.ok !== true || body.data === undefined) {
      throw new Error(`XUANXUE_AI_PRODUCTION_CLOUD_API_FAILED:${body.error?.code ?? response.status}:${body.error?.message ?? "unknown"}`);
    }
    return body.data;
  }
}
