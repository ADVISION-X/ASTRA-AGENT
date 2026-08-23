import { readXuanxueAiProductionCloudTerminalStatus } from "./xuanxue-ai-production-cloud-client.js";
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
}>;

export const attestXuanxueAiProductionProviderRun = async (input: {
  readonly dataDir: string;
  readonly candidateHash: `sha256:${string}`;
  readonly terminalJobIds: readonly string[];
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
  if (statuses.some((status, index) => status.job_id !== terminalJobIds[index]
    || status.terminal_status !== "completed" || !status.terminal_receipt)) {
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
  });
  await session.close();
  return attestation;
};
