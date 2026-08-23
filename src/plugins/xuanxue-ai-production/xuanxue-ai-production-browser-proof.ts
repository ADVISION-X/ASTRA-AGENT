export type AgentRuntimeReceiptV6 = Readonly<{
  schema_version: "xuanxue-agent-runtime-receipt.v6";
  environment_id: string;
  device_id: string;
  device_epoch: number;
  worker_session_id: string;
  worker_session_epoch: number;
  runtime_attestation_receipt_hash: `sha256:${string}`;
  browser_authority_state: "present" | "absent";
  browser_target_state: "claimed" | "absent";
  browser_lane_state: "idle" | "busy" | "blocked";
  created_at: string;
}>;

const hash = /^sha256:[a-f0-9]{64}$/u;

export const createAgentRuntimeReceiptV6 = (
  input: Omit<AgentRuntimeReceiptV6, "schema_version" | "created_at"> & { readonly createdAt?: string },
): AgentRuntimeReceiptV6 => {
  if (!input.environment_id || !input.device_id || input.device_epoch < 1
    || !input.worker_session_id || input.worker_session_epoch < 1
    || !hash.test(input.runtime_attestation_receipt_hash)
    || (input.browser_authority_state !== "present" && input.browser_authority_state !== "absent")
    || (input.browser_target_state !== "claimed" && input.browser_target_state !== "absent")
    || !["idle", "busy", "blocked"].includes(input.browser_lane_state)) {
    throw new Error("XUANXUE_RUNTIME_RECEIPT_V6_IDENTITY_INVALID");
  }
  return Object.freeze({
    schema_version: "xuanxue-agent-runtime-receipt.v6",
    environment_id: input.environment_id,
    device_id: input.device_id,
    device_epoch: input.device_epoch,
    worker_session_id: input.worker_session_id,
    worker_session_epoch: input.worker_session_epoch,
    runtime_attestation_receipt_hash: input.runtime_attestation_receipt_hash,
    browser_authority_state: input.browser_authority_state,
    browser_target_state: input.browser_target_state,
    browser_lane_state: input.browser_lane_state,
    created_at: input.createdAt ?? new Date().toISOString(),
  });
};
