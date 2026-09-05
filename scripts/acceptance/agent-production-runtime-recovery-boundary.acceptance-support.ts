import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { downloadProductionMaterials } from "../../src/lib/local-runtime/production/cloud-client.js";
import { readProductionDeviceJobStatus } from
  "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { sha256 } from "../../src/lib/local-runtime/production/contracts.js";
import { typedRuntimeTransportFailure } from
  "../../src/lib/local-runtime/production/transport-failure.js";
import {
  HASH_A,
  HASH_B,
  claimTask,
  recoveryRemoteStatus as remoteStatus,
  task,
} from "./agent-production-runtime-fixtures.js";

const assertRemoteStatusProjection = async (): Promise<void> => {
  const parsed = await readProductionDeviceJobStatus({
    request: async () => remoteStatus(),
  }, "job:recovery-parser");
  assert.equal(parsed.accepted_attempt_count, 7);
  assert.equal("accepted_attempt_limit" in remoteStatus(), false,
    "the V13 Website fixture must not expose an accepted-attempt limit");
  assert.equal("accepted_attempt_limit" in parsed, false,
    "the AGENT consumes attempt count as a fact without importing Website retry policy");
  assert.equal("attempt_authority" in parsed, false,
    "the AGENT must not depend on an undeclared Website attempt projection");
  assert.equal(parsed.control_intent.intent, "none");
};

const assertMaterialIdentityReuse = async (): Promise<void> => {
  const materialIdentityTemporary = await mkdtemp(path.join(tmpdir(), "agent-material-identity-"));
  const materialIdentityFetch = globalThis.fetch;
  try {
    const materialBytes = Buffer.from("stable-material-bytes", "utf8");
    const materialJob = claimTask(task({
      jobId: "job:material-local-identity",
      productId: "payment_screenshot_observation",
      actionId: "observe",
      materialRefs: [{
        material_id: "material:local-identity", ordinal: 0, role: "payment_screenshot",
        display_name: "payment.png", object_ref: "object:payment", sha256: sha256(materialBytes),
        bytes: materialBytes.byteLength, media_type: "image/png", storage_class: "private_owner_scoped",
        owner_scope_hash: HASH_B, trust_class: "user_provided_data", may_issue_instruction: false,
      }],
      extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
    }));
    globalThis.fetch = (async () => new Response(materialBytes)) as typeof globalThis.fetch;
    const session = {
      device: { server_base_url: "https://website.example" },
      authorizationHeaders: async () => ({}),
    } as never;
    const first = await downloadProductionMaterials(session, materialJob, materialIdentityTemporary);
    const firstIdentity = await lstat(first[0]!.local_path);
    const second = await downloadProductionMaterials(session, materialJob, materialIdentityTemporary);
    const secondIdentity = await lstat(second[0]!.local_path);
    assert.deepEqual([secondIdentity.dev, secondIdentity.ino], [firstIdentity.dev, firstIdentity.ino],
      "an exact repeated material download must preserve the source inode for same-attempt alias recovery");
  } finally {
    globalThis.fetch = materialIdentityFetch;
    await rm(materialIdentityTemporary, { recursive: true, force: true });
  }
};

const assertMaterialTransportFailure = async (): Promise<void> => {
  const materialFailureTemporary = await mkdtemp(path.join(tmpdir(), "agent-material-failure-"));
  const originalMaterialFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      ok: false,
      error: { code: "AI_PRODUCTION_INPUT_OBJECT_READ_FAILED", message: "Input object is unavailable." },
    }), { status: 503, headers: { "content-type": "application/problem+json" } })) as typeof globalThis.fetch;
    const materialJob = claimTask(task({
      jobId: "job:material-remote-failure",
      productId: "payment_screenshot_observation",
      actionId: "observe",
      materialRefs: [{
        material_id: "material:remote-failure", ordinal: 0, role: "payment_screenshot",
        display_name: "payment.png", object_ref: "object:payment", sha256: HASH_A,
        bytes: 10, media_type: "image/png", storage_class: "private_owner_scoped",
        owner_scope_hash: HASH_B, trust_class: "user_provided_data", may_issue_instruction: false,
      }],
      extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
    }));
    await assert.rejects(downloadProductionMaterials({
      device: { server_base_url: "https://website.example" }, authorizationHeaders: async () => ({}),
    } as never, materialJob, materialFailureTemporary), (error: unknown) => {
      const failure = typedRuntimeTransportFailure(error);
      return failure?.code === "AI_PRODUCTION_INPUT_OBJECT_READ_FAILED" && failure.httpStatus === 503;
    }, "material download must preserve the Website problem code and HTTP status");
  } finally {
    globalThis.fetch = originalMaterialFetch;
    await rm(materialFailureTemporary, { recursive: true, force: true });
  }
};

const assertControlAndAdmissionProjection = async (): Promise<void> => {
  const revokedStatus = await readProductionDeviceJobStatus({
    request: async () => ({
      ...remoteStatus(),
      current_reason: { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" },
      control_intent: {
        schema_version: "xuanxue-ai-control-intent.v6",
        job_id: "job:recovery-parser",
        intent: "cancel_requested",
        control_epoch: 2,
        reason_code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED",
      },
    }),
  }, "job:recovery-parser");
  assert.equal(revokedStatus.control_intent.reason_code, "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => ({
      ...remoteStatus(),
      current_reason: { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" },
    }),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u,
  "a current reason without the matching control intent must never authorize local settlement");
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => ({ ...remoteStatus(), control_intent: null }),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u,
  "a malformed control projection must fail with a typed authority error");
  
  const admissionPending = await readProductionDeviceJobStatus({
    request: async () => ({
      ...remoteStatus(), status: "failed", terminal_status: "completed", terminal_payload_hash: HASH_A,
      current_reason: { code: "PUBLIC_KNOWLEDGE_ADMISSION_WRITE_FAILED" },
      business_consumer_error: "PUBLIC_KNOWLEDGE_ADMISSION_WRITE_FAILED",
    }),
  }, "job:recovery-parser");
  assert.equal(admissionPending.terminal_status, "completed");
  assert.equal(admissionPending.business_admission_receipt, null,
    "a staged terminal result without a Website admission receipt remains legally unfinished");
  
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => ({
      ...remoteStatus(), status: "completed", terminal_status: "completed", terminal_payload_hash: HASH_A,
    }),
  }, "job:recovery-parser"), /V6_BUSINESS_ADMISSION_AUTHORITY_INVALID/u,
  "Website completed without its business admission receipt must fail closed");
  
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => ({
      ...remoteStatus(), terminal_status: "completed", terminal_payload_hash: null,
    }),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_TERMINAL_AUTHORITY_INVALID/u,
  "a terminal result without its payload hash must fail closed");
  
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => ({ ...remoteStatus(), accepted_attempt_count: -1 }),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => ({ ...remoteStatus(), accepted_attempt_count: 1.5 }),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => remoteStatus([{
      request_id: "receipt:invalid", write_kind: "checkpoint", payload_hash: "not-a-hash", response_json: {},
    }]),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
  await assert.rejects(() => readProductionDeviceJobStatus({
    request: async () => remoteStatus([{
      request_id: "receipt:unknown-kind", write_kind: "unknown", payload_hash: HASH_A, response_json: {},
    }]),
  }, "job:recovery-parser"), /V6_DEVICE_JOB_STATUS_INVALID/u);
};

export const assertProductionRecoveryBoundaries = async (): Promise<void> => {
  await assertRemoteStatusProjection();
  await assertMaterialIdentityReuse();
  await assertMaterialTransportFailure();
  await assertControlAndAdmissionProjection();
};
