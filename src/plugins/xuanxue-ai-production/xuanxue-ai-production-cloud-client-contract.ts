import type { ClaimBatchReceiptV6 } from "./generated/xuanxue-ai-production-v6.validator.js";
import type { XuanxueAiProductionCloudClaimedJob } from "./xuanxue-ai-production-cloud-contract.js";

export interface XuanxueAiProductionAttachmentCheckpointProof {
  readonly stage_id: string; readonly upload_attempt_id: string;
  readonly status: "skipped" | "attachments_stable" | "failed" | "review_required";
  readonly expected_count: number; readonly detected_count: number;
  readonly current_file_name: string | null;
  readonly staging_manifest_hash: `sha256:${string}` | null;
  readonly observed_at: string;
}

export interface XuanxueAiProductionCloudTerminalStatus {
  readonly schema_version: "xuanxue-ai-device-job-status.v6";
  readonly job_id: string; readonly status: string;
  readonly terminal_status: string | null;
  readonly terminal_payload_hash: `sha256:${string}` | null;
  readonly terminalized_at: string | null;
  readonly terminal_receipt: Readonly<Record<string, unknown>> | null;
}

export type XuanxueAiProductionClaimBatchResult = Readonly<{
  outcome: ClaimBatchReceiptV6["outcome"];
  jobs: readonly XuanxueAiProductionCloudClaimedJob[];
  reasonCodes: readonly string[]; nextClaimAfterMs: number;
  receipt: ClaimBatchReceiptV6;
}>;
