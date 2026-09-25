import {
  ControlIntentSchema,
  type ControlIntent,
} from "./transport-protocol.js";
import {
  hashCanonical, WebsiteAgentResultSchema,
  type ProductionHash,
  type WebsiteAgentResult,
} from "./contracts.js";
import { ProductionWorkerSession } from "./worker-session.js";
import { executionFailure } from "../../execution-failure.js";
import { isSerializedTerminalFailureTransport } from "./store-foundation.js";
import type { SerializedTerminalFailure } from "./terminal-failure.js";

type RemoteProductionWriteKind =
  | "checkpoint" | "artifact" | "terminal" | "cancel" | "lease_release" | "renew"
  | "provider_cooldown";

const remoteProductionWriteKinds = new Set<RemoteProductionWriteKind>([
  "checkpoint", "artifact", "terminal", "cancel", "lease_release", "renew", "provider_cooldown",
]);

export type RemoteProductionWriteReceipt = Readonly<{
  request_id: string;
  write_kind: RemoteProductionWriteKind;
  payload_hash: ProductionHash;
  response_json: Record<string, unknown>;
}>;

export type RemoteAttemptFailure = SerializedTerminalFailure & Readonly<{
  from_status: string | null;
  to_status: string | null;
  attempt_id: string;
  lease_version: number;
}>;

type BaseBusinessAdmissionReceipt = Readonly<{
  schema_version: "xuanxue-ai-business-admission-receipt.v6";
  job_id: string;
  result_payload_hash: ProductionHash;
  consumer_ref: string;
  outcome: "completed";
  consumption_hash: ProductionHash;
  consumed_at: string;
}>;

export type BusinessAdmissionReceipt =
  | BaseBusinessAdmissionReceipt
  | Readonly<BaseBusinessAdmissionReceipt & {
    bazi_domain_admission_receipt_hash: ProductionHash;
    delivery_manifest_id: string;
    delivery_manifest_hash: ProductionHash;
  }>
  | Readonly<BaseBusinessAdmissionReceipt & { review_receipt_hash: ProductionHash }>;

export type RemoteProductionDeviceJobStatus = Readonly<{
  job_id: string;
  status: string;
  current_reason: Readonly<Record<string, unknown>> | null;
  attempt_failure: RemoteAttemptFailure | null;
  control_intent: ControlIntent;
  next_action_code: "ACTIVE_ATTEMPT" | "WAIT_NEW_ATTEMPT" | "CONSUME_CURRENT_RESULT";
  terminal_status: "completed" | null;
  terminal_payload_hash: ProductionHash | null;
  business_admission_receipt: BusinessAdmissionReceipt | null;
  business_consumer_error: string | null;
  accepted_attempt_count: number;
  write_receipts: readonly RemoteProductionWriteReceipt[];
  staged_result: WebsiteAgentResult | null;
  staged_artifact_receipts: readonly Readonly<{ role: string; receipt_hash: ProductionHash }>[];
}>;

const failureCoreKeys = [
  "browser_outcome", "cause", "child_capability_id", "child_proof_hash", "child_proof_ref", "code",
  "effect_scope", "evidence_hash", "evidence_ref", "mutation_outcome", "provider_effect_identity_hash",
  "settled_result_payload_hash", "stopped_empty_proof",
] as const;
const parseRemoteAttemptFailure = (value: unknown): RemoteAttemptFailure | null => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_DEVICE_ATTEMPT_FAILURE_INVALID");
  }
  const row = value as Record<string, unknown>;
  const expectedKeys = [...failureCoreKeys, "attempt_id", "from_status", "lease_version", "to_status"].sort();
  const core = Object.freeze(Object.fromEntries(failureCoreKeys.map((key) => [key, row[key]])));
  if (JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(expectedKeys)
    || !isSerializedTerminalFailureTransport(core)
    || typeof row.attempt_id !== "string" || row.attempt_id.length === 0
    || !Number.isSafeInteger(row.lease_version) || Number(row.lease_version) < 1
    || ![row.from_status, row.to_status].every((status) => status === null || typeof status === "string")) {
    throw executionFailure("failed", "V6_DEVICE_ATTEMPT_FAILURE_INVALID");
  }
  return Object.freeze({
    ...(core as SerializedTerminalFailure),
    from_status: row.from_status as string | null,
    to_status: row.to_status as string | null,
    attempt_id: row.attempt_id,
    lease_version: row.lease_version,
  }) as RemoteAttemptFailure;
};

const admissionBaseKeys = [
  "schema_version", "job_id", "result_payload_hash", "consumer_ref",
  "outcome", "consumption_hash", "consumed_at",
];
const admissionBaziKeys = [
  "bazi_domain_admission_receipt_hash", "delivery_manifest_id", "delivery_manifest_hash",
];
const admissionReviewKeys = ["review_receipt_hash"];
type BusinessAdmissionKind = "base" | "bazi" | "review";
const exactAdmissionKeys = (row: Record<string, unknown>, extra: readonly string[]): boolean =>
  JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...admissionBaseKeys, ...extra].sort());
const admissionKind = (row: Record<string, unknown>): BusinessAdmissionKind | null => {
  if (exactAdmissionKeys(row, [])) return "base";
  if (exactAdmissionKeys(row, admissionBaziKeys)) return "bazi";
  if (exactAdmissionKeys(row, admissionReviewKeys)) return "review";
  return null;
};
const productionHash = (value: unknown): value is ProductionHash =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
const admissionBaseValid = (
  row: Record<string, unknown>,
  jobId: string,
  expectedHash: ProductionHash,
): boolean => row.schema_version === "xuanxue-ai-business-admission-receipt.v6"
  && row.job_id === jobId && productionHash(row.result_payload_hash)
  && typeof row.consumer_ref === "string" && row.consumer_ref.length > 0
  && row.outcome === "completed" && row.consumption_hash === expectedHash
  && typeof row.consumed_at === "string" && Number.isFinite(Date.parse(row.consumed_at));
const admissionExtensionValid = (
  row: Record<string, unknown>,
  kind: BusinessAdmissionKind,
): boolean => kind === "base"
  || (kind === "bazi" && productionHash(row.bazi_domain_admission_receipt_hash)
    && typeof row.delivery_manifest_id === "string" && row.delivery_manifest_id.length > 0
    && productionHash(row.delivery_manifest_hash))
  || (kind === "review" && productionHash(row.review_receipt_hash));
const admissionHash = (
  row: Record<string, unknown>,
  kind: BusinessAdmissionKind,
): ProductionHash => hashCanonical({
  job_id: row.job_id,
  result_payload_hash: row.result_payload_hash,
  ...(kind === "bazi" ? {
    bazi_domain_admission_receipt_hash: row.bazi_domain_admission_receipt_hash,
    delivery_manifest_id: row.delivery_manifest_id,
    delivery_manifest_hash: row.delivery_manifest_hash,
  } : {}),
  ...(kind === "review" ? { review_receipt_hash: row.review_receipt_hash } : {}),
  consumer_ref: row.consumer_ref,
  outcome: row.outcome,
});
const freezeAdmission = (
  row: Record<string, unknown>,
  kind: BusinessAdmissionKind,
): BusinessAdmissionReceipt => Object.freeze({
  schema_version: "xuanxue-ai-business-admission-receipt.v6",
  job_id: row.job_id as string,
  result_payload_hash: row.result_payload_hash as ProductionHash,
  ...(kind === "bazi" ? {
    bazi_domain_admission_receipt_hash: row.bazi_domain_admission_receipt_hash as ProductionHash,
    delivery_manifest_id: row.delivery_manifest_id as string,
    delivery_manifest_hash: row.delivery_manifest_hash as ProductionHash,
  } : {}),
  ...(kind === "review" ? { review_receipt_hash: row.review_receipt_hash as ProductionHash } : {}),
  consumer_ref: row.consumer_ref as string,
  outcome: "completed",
  consumption_hash: row.consumption_hash as ProductionHash,
  consumed_at: row.consumed_at as string,
}) as BusinessAdmissionReceipt;

const parseBusinessAdmissionReceipt = (
  jobId: string,
  value: unknown,
): RemoteProductionDeviceJobStatus["business_admission_receipt"] => {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_RECEIPT_INVALID");
  }
  const row = value as Record<string, unknown>;
  const kind = admissionKind(row);
  if (!kind || !admissionBaseValid(row, jobId, admissionHash(row, kind))
    || !admissionExtensionValid(row, kind)) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_RECEIPT_INVALID");
  }
  return freezeAdmission(row, kind);
};

const parseRemoteWriteReceipt = (receipt: unknown): RemoteProductionWriteReceipt => {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const item = receipt as Record<string, unknown>;
  if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify([
    "payload_hash", "request_id", "response_json", "write_kind",
  ])
    || typeof item.request_id !== "string" || !item.request_id
    || typeof item.write_kind !== "string"
    || !remoteProductionWriteKinds.has(item.write_kind as RemoteProductionWriteKind)
    || typeof item.payload_hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(item.payload_hash)
    || !item.response_json || typeof item.response_json !== "object" || Array.isArray(item.response_json)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  return Object.freeze({
    request_id: item.request_id,
    write_kind: item.write_kind as RemoteProductionWriteKind,
    payload_hash: item.payload_hash as ProductionHash,
    response_json: item.response_json as Record<string, unknown>,
  });
};

const deviceStatusIdentityValid = (row: Record<string, unknown>, jobId: string): boolean =>
  row.schema_version === "xuanxue-ai-device-job-status.v6"
  && row.job_id === jobId && ["failed", "completed"].includes(row.status as string);

const deviceStatusAuthorityFieldsValid = (row: Record<string, unknown>): boolean =>
  [null, "completed"].includes(row.terminal_status as null | string)
  && (row.terminal_payload_hash === null || typeof row.terminal_payload_hash === "string")
  && (row.current_reason === null || (typeof row.current_reason === "object"
    && !Array.isArray(row.current_reason)))
  && (row.business_consumer_error === null || typeof row.business_consumer_error === "string")
  && ["ACTIVE_ATTEMPT", "WAIT_NEW_ATTEMPT", "CONSUME_CURRENT_RESULT"].includes(
    row.next_action_code as string,
  )
  && Array.isArray(row.write_receipts)
  && Array.isArray(row.staged_artifact_receipts);

const deviceStatusAttemptAuthorityValid = (row: Record<string, unknown>): boolean =>
  Number.isSafeInteger(row.accepted_attempt_count) && Number(row.accepted_attempt_count) >= 0;

const parseDeviceTerminalAuthority = (row: Record<string, unknown>): Readonly<{
  terminalStatus: "completed" | null;
  terminalPayloadHash: ProductionHash | null;
}> => {
  const terminalStatus = row.terminal_status as "completed" | null;
  const terminalPayloadHash = row.terminal_payload_hash as ProductionHash | null;
  if (terminalPayloadHash !== null && !/^sha256:[a-f0-9]{64}$/u.test(terminalPayloadHash)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID");
  }
  if ((terminalStatus === "completed") !== (terminalPayloadHash !== null)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID");
  }
  return { terminalStatus, terminalPayloadHash };
};

const assertBusinessAdmissionAuthority = (
  row: Record<string, unknown>,
  admission: RemoteProductionDeviceJobStatus["business_admission_receipt"],
  terminalStatus: "completed" | null,
): void => {
  if ((row.status === "completed") !== (admission !== null)
    || (admission !== null && terminalStatus !== "completed")) {
    throw executionFailure("failed", "V6_BUSINESS_ADMISSION_AUTHORITY_INVALID");
  }
};

const parseDeviceControlAuthority = (
  row: Record<string, unknown>,
  jobId: string,
): Readonly<{
  controlIntent: ControlIntent;
  currentReason: Readonly<Record<string, unknown>> | null;
}> => {
  const parsed = ControlIntentSchema.safeParse(row.control_intent);
  if (!parsed.success) throw executionFailure("failed", "V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID");
  const controlIntent = parsed.data;
  const currentReason = row.current_reason as Readonly<Record<string, unknown>> | null;
  if (controlIntent.job_id !== jobId) {
    throw executionFailure("failed", "V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID");
  }
  return { controlIntent, currentReason };
};

export async function readProductionDeviceJobStatus(
  session: Pick<ProductionWorkerSession, "request">,
  jobId: string,
): Promise<RemoteProductionDeviceJobStatus> {
  const value = await session.request(
    `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/device-status`,
    { method: "GET" },
  );
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const row = value as Record<string, unknown>;
  if (!deviceStatusIdentityValid(row, jobId) || !deviceStatusAuthorityFieldsValid(row)
    || !deviceStatusAttemptAuthorityValid(row)) {
    throw executionFailure("failed", "V6_DEVICE_JOB_STATUS_INVALID");
  }
  const { terminalStatus, terminalPayloadHash } = parseDeviceTerminalAuthority(row);
  const admission = parseBusinessAdmissionReceipt(jobId, row.business_admission_receipt);
  assertBusinessAdmissionAuthority(row, admission, terminalStatus);
  const { controlIntent, currentReason } = parseDeviceControlAuthority(row, jobId);
  const attemptFailure = parseRemoteAttemptFailure(row.attempt_failure);
  const staged = row.staged_result === null ? null
    : WebsiteAgentResultSchema.safeParse(row.staged_result);
  if (staged !== null && !staged.success) {
    throw executionFailure("failed", "V6_DEVICE_STAGED_RESULT_INVALID");
  }
  const stagedArtifactReceipts = (row.staged_artifact_receipts as unknown[]).map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw executionFailure("failed", "V6_DEVICE_STAGED_ARTIFACT_INVALID");
    }
    const artifact = value as Record<string, unknown>;
    if (!["result_payload", "result_envelope", "generated_image"].includes(String(artifact.role))
      || typeof artifact.receipt_hash !== "string"
      || !/^sha256:[a-f0-9]{64}$/u.test(artifact.receipt_hash)) {
      throw executionFailure("failed", "V6_DEVICE_STAGED_ARTIFACT_INVALID");
    }
    return Object.freeze({ role: artifact.role as string,
      receipt_hash: artifact.receipt_hash as ProductionHash });
  });
  if (staged !== null && admission === null && stagedArtifactReceipts.length < 2) {
    throw executionFailure("failed", "V6_DEVICE_STAGED_RESULT_AUTHORITY_INVALID");
  }
  return Object.freeze({
    job_id: jobId,
    status: row.status as string,
    current_reason: currentReason ? Object.freeze({ ...currentReason }) : null,
    attempt_failure: attemptFailure,
    control_intent: controlIntent,
    next_action_code: row.next_action_code as RemoteProductionDeviceJobStatus["next_action_code"],
    terminal_status: terminalStatus,
    terminal_payload_hash: terminalPayloadHash,
    business_admission_receipt: admission,
    business_consumer_error: row.business_consumer_error as string | null,
    accepted_attempt_count: row.accepted_attempt_count as number,
    write_receipts: Object.freeze((row.write_receipts as unknown[]).map(parseRemoteWriteReceipt)),
    staged_result: staged?.data ?? null,
    staged_artifact_receipts: Object.freeze(stagedArtifactReceipts),
  });
}
