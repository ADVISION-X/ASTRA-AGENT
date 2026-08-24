import { createHash } from "node:crypto";
import { readXuanxueAiProductionCloudTerminalStatus } from "./xuanxue-ai-production-cloud-client.js";
import type { XuanxueAiProductionCloudTerminalStatus } from "./xuanxue-ai-production-cloud-client-contract.js";
import { readXuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-credential.js";
import { XuanxueAiProductionWorkerSessionV6, type XuanxueAiProductionRuntimeStateV6 } from "./xuanxue-ai-production-worker-session.js";

export type XuanxueAiProductionCloudRunAttestation = Readonly<{
  deviceId: string;
  deviceEpoch: number;
  workerSessionId: string;
  workerSessionEpoch: number;
  candidateHash: `sha256:${string}`;
  runtimeAttestationReceiptHash: `sha256:${string}`;
  heartbeatAt: string;
  terminalJobIds: readonly string[];
  terminalReceiptHashes: Readonly<Record<string, `sha256:${string}`>>;
}>;

export type XuanxueAiProductionPredecessorRuntimeIdentity = Readonly<{
  deviceId: string;
  deviceEpoch: number;
  workerSessionId: string;
  workerSessionEpoch: number;
  runtimeAttestationReceiptHash: `sha256:${string}`;
}>;

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
};
const hashReceipt = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

export const validateXuanxueTerminalReadbackReceipts = (
  statuses: readonly XuanxueAiProductionCloudTerminalStatus[],
  terminalJobIds: readonly string[],
  predecessor: XuanxueAiProductionPredecessorRuntimeIdentity,
): Readonly<Record<string, `sha256:${string}`>> => {
  const terminalReceiptHashes: Record<string, `sha256:${string}`> = {};
  const invalid = statuses.length !== terminalJobIds.length || statuses.some((status, index) => {
    const receipt = status.terminal_receipt;
    const valid = status.job_id === terminalJobIds[index]
      && status.terminal_status === "completed" && receipt
      && exactKeys(receipt, ["schema_version","job_id","terminal_status","payload_hash","first_terminal","device_id","device_epoch","worker_session_id","worker_session_epoch","runtime_attestation_receipt_hash"])
      && receipt.schema_version === "xuanxue-ai-terminal-receipt.v6"
      && receipt.job_id === status.job_id && receipt.terminal_status === "completed"
      && receipt.payload_hash === status.terminal_payload_hash
      && typeof receipt.first_terminal === "boolean"
      && receipt.device_id === predecessor.deviceId
      && receipt.device_epoch === predecessor.deviceEpoch
      && receipt.worker_session_id === predecessor.workerSessionId
      && receipt.worker_session_epoch === predecessor.workerSessionEpoch
      && receipt.runtime_attestation_receipt_hash === predecessor.runtimeAttestationReceiptHash;
    if (valid) terminalReceiptHashes[status.job_id] = hashReceipt(receipt);
    return !valid;
  });
  if (invalid || JSON.stringify(Object.keys(terminalReceiptHashes)) !== JSON.stringify(terminalJobIds)) {
    throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_TERMINAL_ATTESTATION_INVALID");
  }
  return Object.freeze(terminalReceiptHashes);
};

export const attestXuanxueAiProductionProviderRun = async (input: {
  readonly dataDir: string;
  readonly candidateHash: `sha256:${string}`;
  readonly terminalJobIds: readonly string[];
  readonly predecessor: XuanxueAiProductionPredecessorRuntimeIdentity;
  readonly readRuntimeState?: () => Promise<XuanxueAiProductionRuntimeStateV6>;
}): Promise<XuanxueAiProductionCloudRunAttestation> => {
  const terminalJobIds = [...input.terminalJobIds].sort();
  if (terminalJobIds.length === 0 || new Set(terminalJobIds).size !== terminalJobIds.length) {
    throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_ATTESTATION_JOB_SET_INVALID");
  }
  if (!input.readRuntimeState) throw new Error("XUANXUE_AI_PRODUCTION_RUNTIME_STATE_REQUIRED");
  const credential = await readXuanxueAiProductionCloudCredential(input.dataDir);
  if (credential.agent_build_hash !== input.candidateHash) throw new Error("XUANXUE_AI_PRODUCTION_CANDIDATE_HASH_MISMATCH");
  const session = new XuanxueAiProductionWorkerSessionV6(credential, input.readRuntimeState);
  await session.open();
  session.markLedgerReconciled();
  const receipt = await session.heartbeat();
  const statuses = await Promise.all(terminalJobIds.map((jobId) => readXuanxueAiProductionCloudTerminalStatus(session, jobId)));
  let terminalReceiptHashes: Readonly<Record<string, `sha256:${string}`>>;
  try { terminalReceiptHashes = validateXuanxueTerminalReadbackReceipts(statuses, terminalJobIds, input.predecessor); }
  catch {
    await session.close().catch(() => undefined);
    throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_TERMINAL_ATTESTATION_INVALID");
  }
  const attestation = Object.freeze({
    deviceId: credential.device_id,
    deviceEpoch: credential.device_epoch,
    workerSessionId: session.workerSessionId,
    workerSessionEpoch: session.workerSessionEpoch,
    candidateHash: input.candidateHash,
    runtimeAttestationReceiptHash: receipt.receipt_hash as `sha256:${string}`,
    heartbeatAt: receipt.issued_at,
    terminalJobIds: Object.freeze(terminalJobIds),
    terminalReceiptHashes,
  });
  await session.close();
  return attestation;
};
