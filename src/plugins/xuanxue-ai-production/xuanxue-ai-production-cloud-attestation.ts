import {
  heartbeatXuanxueAiProductionDevice,
  readXuanxueAiProductionCloudTerminalStatus,
  type XuanxueAiProductionCloudDeviceAttestation,
  type XuanxueAiProductionCloudTerminalStatus,
} from "./xuanxue-ai-production-cloud-client.js";
import { readXuanxueAiProductionCloudCredential } from "./xuanxue-ai-production-cloud-credential.js";
import {
  XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
} from "./xuanxue-ai-production-localization-contract.js";

export type XuanxueAiProductionCloudRunAttestation = Readonly<{
  deviceId: string;
  candidateHash: `sha256:${string}`;
  heartbeatAt: string;
  terminalJobIds: readonly string[];
}>;

export const validateXuanxueAiProductionCloudRunAttestation = (input: {
  readonly credentialDeviceId: string;
  readonly candidateHash: `sha256:${string}`;
  readonly terminalJobIds: readonly string[];
  readonly device: XuanxueAiProductionCloudDeviceAttestation;
  readonly statuses: readonly XuanxueAiProductionCloudTerminalStatus[];
  readonly nowMs: number;
}): XuanxueAiProductionCloudRunAttestation => {
  if (
    input.device.device_id !== input.credentialDeviceId
    || input.device.status !== "active"
    || input.device.max_in_flight !== 10
    || input.device.agent_build_fingerprint !== input.candidateHash
    || input.device.contract_manifest_hash !== XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH
    || Object.entries(XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS).some(
      ([productId, hash]) => input.device.supported_product_contracts[productId] !== hash,
    )
  ) throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_DEVICE_ATTESTATION_INVALID");
  const heartbeatAt = input.device.last_heartbeat_at;
  const heartbeatAtMs = heartbeatAt ? Date.parse(heartbeatAt) : Number.NaN;
  if (!Number.isFinite(heartbeatAtMs) || Math.abs(input.nowMs - heartbeatAtMs) > 60_000) {
    throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_ATTESTATION_STALE");
  }
  if (input.statuses.some((status, index) => (
    status.job_id !== input.terminalJobIds[index] || status.status !== "completed"
  )) || input.statuses.length !== input.terminalJobIds.length) {
    throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_TERMINAL_ATTESTATION_INVALID");
  }
  return Object.freeze({
    deviceId: input.device.device_id,
    candidateHash: input.candidateHash,
    heartbeatAt: heartbeatAt!,
    terminalJobIds: Object.freeze([...input.terminalJobIds]),
  });
};

export const attestXuanxueAiProductionProviderRun = async (input: {
  readonly dataDir: string;
  readonly candidateHash: `sha256:${string}`;
  readonly terminalJobIds: readonly string[];
  readonly nowMs?: number;
}): Promise<XuanxueAiProductionCloudRunAttestation> => {
  const terminalJobIds = [...input.terminalJobIds].sort();
  if (
    terminalJobIds.length === 0
    || new Set(terminalJobIds).size !== terminalJobIds.length
  ) throw new Error("XUANXUE_AI_PRODUCTION_CLOUD_ATTESTATION_JOB_SET_INVALID");
  const credential = await readXuanxueAiProductionCloudCredential(input.dataDir);
  const device = await heartbeatXuanxueAiProductionDevice(
    credential,
    input.candidateHash,
  );
  const statuses = await Promise.all(terminalJobIds.map(
    (jobId) => readXuanxueAiProductionCloudTerminalStatus(credential, jobId),
  ));
  return validateXuanxueAiProductionCloudRunAttestation({
    credentialDeviceId: credential.device_id,
    candidateHash: input.candidateHash,
    terminalJobIds,
    device,
    statuses,
    nowMs: input.nowMs ?? Date.now(),
  });
};
