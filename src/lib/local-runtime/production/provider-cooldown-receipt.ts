import { executionFailure } from "../../execution-failure.js";
import { hashCanonical, type ProductionHash } from "./contracts.js";

export type ProviderCooldownReceipt = Readonly<{
  schema_version: "xuanxue-ai-provider-cooldown-receipt.v7";
  request_id: string;
  incident_request_id: string;
  payload_hash: ProductionHash;
  device_id: string;
  dialog_hash: ProductionHash;
  observation_hash: ProductionHash;
  level: number;
  current_n: number;
  baseline_n: number;
  server_now: string;
  cooldown_until: string;
  clearance: "pending_unknown" | "confirmed_absent" | "not_cleared";
  claim_gate_open: boolean;
  cohort_total: number;
  cohort_admitted: number;
  cohort_user_terminated: number;
  cohort_pending: number;
  cohort_effect_recovery: number;
  cohort_unsent_resume: number;
  cohort_unclassified: number;
  receipt_hash: ProductionHash;
}>;

export type ProviderCooldownReceiptExpectation = Readonly<{
  requestId: string;
  incidentRequestId: string;
  payloadHash: ProductionHash;
  deviceId?: string;
  dialogHash: ProductionHash;
  observationHash: ProductionHash;
}>;

const HASH = /^sha256:[a-f0-9]{64}$/u;
const RECEIPT_KEYS = [
  "schema_version", "request_id", "incident_request_id", "payload_hash", "device_id",
  "dialog_hash", "observation_hash", "level",
  "current_n", "baseline_n", "server_now", "cooldown_until", "clearance",
  "claim_gate_open", "cohort_total", "cohort_admitted", "cohort_user_terminated",
  "cohort_pending", "cohort_effect_recovery", "cohort_unsent_resume",
  "cohort_unclassified", "receipt_hash",
].sort();

const exactReceiptIdentity = (
  row: Record<string, unknown>, expected: ProviderCooldownReceiptExpectation,
): boolean => row.schema_version === "xuanxue-ai-provider-cooldown-receipt.v7"
  && row.request_id === expected.requestId
  && row.incident_request_id === expected.incidentRequestId
  && row.payload_hash === expected.payloadHash
  && (expected.deviceId === undefined || row.device_id === expected.deviceId)
  && row.dialog_hash === expected.dialogHash
  && row.observation_hash === expected.observationHash;

const validCooldownState = (row: Record<string, unknown>): boolean =>
  Number.isInteger(row.level) && Number(row.level) >= 1 && Number(row.level) <= 6
  && Number.isInteger(row.current_n) && Number(row.current_n) >= 1
  && Number.isInteger(row.baseline_n) && Number(row.baseline_n) >= Number(row.current_n)
  && typeof row.server_now === "string" && Number.isFinite(Date.parse(row.server_now))
  && typeof row.cooldown_until === "string" && Number.isFinite(Date.parse(row.cooldown_until))
  && ["pending_unknown", "confirmed_absent", "not_cleared"].includes(String(row.clearance))
  && typeof row.claim_gate_open === "boolean";

const validCohortCounts = (row: Record<string, unknown>): boolean => {
  const counts = [row.cohort_total, row.cohort_admitted, row.cohort_user_terminated,
    row.cohort_pending, row.cohort_effect_recovery, row.cohort_unsent_resume,
    row.cohort_unclassified];
  return counts.every((count) => Number.isInteger(count) && Number(count) >= 0)
    && Number(row.cohort_admitted) + Number(row.cohort_user_terminated)
      + Number(row.cohort_pending) === Number(row.cohort_total)
    && Number(row.cohort_effect_recovery) + Number(row.cohort_unsent_resume)
      + Number(row.cohort_unclassified) === Number(row.cohort_pending);
};

export const parseProviderCooldownReceipt = (
  value: unknown,
  expected: ProviderCooldownReceiptExpectation,
): ProviderCooldownReceipt => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "PROVIDER_COOLDOWN_RECEIPT_INVALID");
  }
  const row = value as Record<string, unknown>;
  const receiptHash = row.receipt_hash;
  const actualKeys = Object.keys(row).sort();
  const core = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "receipt_hash"));
  if (actualKeys.length !== RECEIPT_KEYS.length
    || actualKeys.some((key, index) => key !== RECEIPT_KEYS[index])
    || !exactReceiptIdentity(row, expected)
    || !validCooldownState(row)
    || !validCohortCounts(row)
    || typeof receiptHash !== "string" || !HASH.test(receiptHash)
    || receiptHash !== hashCanonical(core)) {
    throw executionFailure("failed", "PROVIDER_COOLDOWN_RECEIPT_INVALID");
  }
  return Object.freeze({ ...row }) as ProviderCooldownReceipt;
};
