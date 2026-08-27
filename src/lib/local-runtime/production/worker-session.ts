import { randomUUID } from "node:crypto";

import { agentPluginCapabilityManifest } from "./catalog.js";
import type { ProductionHash } from "./contracts.js";
import {
  RuntimeAttestationReceiptSchema,
  WorkerSessionCredentialSchema,
  parseJsonEnvelope,
  type DeviceCredential,
  type RuntimeAttestationReceipt,
  type WorkerSessionCredential,
} from "./transport-protocol.js";

export interface ProductionRuntimeState {
  readonly business_in_flight: number;
  readonly browser_action_in_flight: 0 | 1;
  readonly browser_authority_state: "present" | "absent";
  readonly browser_target_state: "claimed" | "absent";
  readonly browser_lane_state: "idle" | "busy" | "blocked";
  readonly drain_state: "open" | "draining";
  readonly ledger_reconciled: boolean;
}

const OpenResponseSchema = WorkerSessionCredentialSchema.transform((value) => value);

export class ProductionWorkerSession {
  private credential: WorkerSessionCredential | null = null;
  private attestation: RuntimeAttestationReceipt | null = null;
  private sequence = 0;
  private activeHeartbeat: Promise<RuntimeAttestationReceipt> | null = null;

  public constructor(
    public readonly device: DeviceCredential,
    private readonly runtimeState: () => Promise<ProductionRuntimeState>,
    private readonly agentBuildHash: ProductionHash,
    private readonly workerInstanceId = `worker_${randomUUID()}`,
  ) {}

  public get workerSessionId(): string {
    if (!this.credential) throw new Error("PRODUCTION_SESSION_NOT_OPEN");
    return this.credential.worker_session_id;
  }

  public get workerSessionEpoch(): number {
    if (!this.credential) throw new Error("PRODUCTION_SESSION_NOT_OPEN");
    return this.credential.worker_session_epoch;
  }

  public get latestAttestation(): RuntimeAttestationReceipt {
    if (!this.attestation) throw new Error("PRODUCTION_ATTESTATION_MISSING");
    return this.attestation;
  }

  public async open(): Promise<void> {
    if (this.credential) return;
    const data = await this.deviceRequest("/internal/ai-production/v6/sessions/open", {
      schema_version: "xuanxue-ai-worker-session-open.v6",
      request_id: `aipsopen_${randomUUID()}`,
      environment_id: "production",
      origin: this.device.origin,
      device_id: this.device.device_id,
      device_epoch: this.device.device_epoch,
      worker_instance_id: this.workerInstanceId,
      agent_build_hash: this.agentBuildHash,
      control_manifest_hash: this.device.control_manifest_hash,
    });
    const response = data as { session?: Record<string, unknown>; session_credential?: unknown };
    const credential = OpenResponseSchema.parse(response.session_credential);
    if (response.session?.device_id !== this.device.device_id
      || response.session.worker_session_id !== credential.worker_session_id
      || response.session.worker_session_epoch !== credential.worker_session_epoch) {
      throw new Error("PRODUCTION_SESSION_BINDING_INVALID");
    }
    this.credential = credential;
  }

  public async heartbeat(): Promise<RuntimeAttestationReceipt> {
    this.activeHeartbeat ??= this.performHeartbeat().finally(() => { this.activeHeartbeat = null; });
    return this.activeHeartbeat;
  }

  private async performHeartbeat(): Promise<RuntimeAttestationReceipt> {
    await this.open();
    const state = await this.runtimeState();
    const next = this.sequence + 1;
    const data = await this.request(`/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/heartbeat`, {
      method: "POST",
      body: JSON.stringify({
        schema_version: "xuanxue-ai-worker-runtime-attestation.v6",
        request_id: `aipattreq_${randomUUID()}`,
        attestation_seq: next,
        worker_session_id: this.workerSessionId,
        worker_session_epoch: this.workerSessionEpoch,
        control_manifest_hash: this.device.control_manifest_hash,
        business_capacity_total: 10,
        business_in_flight: state.business_in_flight,
        browser_action_capacity_total: 1,
        browser_action_in_flight: state.browser_action_in_flight,
        browser_authority_state: state.browser_authority_state,
        browser_target_state: state.browser_target_state,
        browser_lane_state: state.browser_lane_state,
        drain_state: state.drain_state,
        ledger_reconciled: state.ledger_reconciled,
        capability_manifest: agentPluginCapabilityManifest,
      }),
    }) as { attestation_receipt?: unknown; session_credential?: unknown };
    const receipt = RuntimeAttestationReceiptSchema.parse(data.attestation_receipt);
    const credential = WorkerSessionCredentialSchema.parse(data.session_credential);
    if (receipt.worker_session_id !== this.workerSessionId || receipt.attestation_seq !== next
      || credential.worker_session_id !== this.workerSessionId
      || credential.token_generation <= this.credential!.token_generation) {
      throw new Error("PRODUCTION_ATTESTATION_BINDING_INVALID");
    }
    this.credential = credential;
    this.attestation = receipt;
    this.sequence = next;
    return receipt;
  }

  public async ensureFreshAttestation(): Promise<RuntimeAttestationReceipt> {
    if (!this.attestation || Date.parse(this.attestation.expires_at) - Date.now() < 10_000) {
      return this.heartbeat();
    }
    return this.attestation;
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
    const response = await fetch(`${this.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
      ...init,
      headers: {
        ...(await this.authorizationHeaders({ "content-type": "application/json" })),
        ...(init.headers ?? {}),
      },
      signal: init.signal ?? AbortSignal.timeout(30_000),
    });
    const raw = await response.json() as unknown;
    if (!response.ok) {
      try { return parseJsonEnvelope(raw); } catch (error) { throw error; }
    }
    return parseJsonEnvelope(raw);
  }

  public async close(): Promise<void> {
    if (!this.credential) return;
    await this.request(`/internal/ai-production/v6/sessions/${encodeURIComponent(this.workerSessionId)}/close`, {
      method: "POST", body: "{}",
    });
    this.credential = null;
    this.attestation = null;
  }

  private async deviceRequest(pathname: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.device.server_base_url.replace(/\/+$/u, "")}${pathname}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.device.credential}`,
        origin: this.device.origin,
        "x-ai-agent-origin": this.device.origin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const raw = await response.json() as unknown;
    if (!response.ok) return parseJsonEnvelope(raw);
    return parseJsonEnvelope(raw);
  }
}
