import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { hashCanonical, sha256 } from "../../src/lib/local-runtime/production/contracts.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import { task } from "./agent-production-runtime-fixtures.js";

/** A received payload plus a rejected new payload keeps the original Website receipt. */
export const verifyPayloadSlotConflict = async (
  store: ProductionRuntimeStore, providerEffectHash: `sha256:${string}`,
): Promise<void> => {
  const partial = task({ jobId: "job:payload-only-source",
    productId: "payment_screenshot_observation", actionId: "observe" });
  store.acceptTask(partial, "attempt:payload-only");
  const partialAttemptHash = hashCanonical({ attempt_id: "attempt:payload-only" }).slice(7, 23);
  const emptyOutbox = store.readResultOutboxHistoryEvidence(partial.job_id, "attempt:payload-only");
  store.enqueue({ idempotency_key: "aipresult_payload_only", kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_payload/airesult_${partialAttemptHash}_result_payload_payload`,
    method: "PUT", headers: {}, body: Buffer.from("{\"answer\":1}") });
  const payloadOnly = store.readResultOutboxHistoryEvidence(partial.job_id, "attempt:payload-only");
  assert.equal(payloadOnly.rowCount, 1);
  assert.equal(payloadOnly.candidateCount, 0,
    "partial payload upload must preserve history without claiming a complete result");
  assert.notEqual(payloadOnly.historyHash, emptyOutbox.historyHash);
  store.enqueue({ idempotency_key: "aipresult_envelope_ready", kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_envelope/airesult_${partialAttemptHash}_result_envelope_envelope`,
    method: "PUT", headers: {}, body: Buffer.from("{\"answer\":1}") });
  assert.equal(store.readResultOutboxHistoryEvidence(partial.job_id, "attempt:payload-only").candidateCount, 1,
    "a complete result envelope must block source handoff");
  const oldPayloadBody = Buffer.from("{\"answer\":2}");
  const oldPayloadHash = sha256(oldPayloadBody);
  const oldPayloadRequest = `aipresult_${hashCanonical({ job_id: partial.job_id,
    attempt_id: "attempt:payload-only", role: "result_payload",
    content_hash: oldPayloadHash }).slice(7, 47)}`;
  const oldArtifactId = `airesult_${partial.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${partialAttemptHash}_result_payload_${oldPayloadHash.slice(-16)}`;
  const oldPayloadReceipt = { role: "result_payload", receipt_hash: providerEffectHash,
    sha256: oldPayloadHash, artifact_id: oldArtifactId, object_ref: "object:old-payload",
    media_type: "application/json", byte_length: oldPayloadBody.byteLength };
  store.enqueue({ idempotency_key: oldPayloadRequest, kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_payload/${encodeURIComponent(oldArtifactId)}`,
    method: "PUT", headers: { "x-ai-content-sha256": oldPayloadHash },
    body: oldPayloadBody });
  assert.equal(store.hydrateRemoteOutboxReceipts(partial.job_id, [{
    request_id: oldPayloadRequest, write_kind: "artifact",
    payload_hash: sha256(oldPayloadBody), response_json: oldPayloadReceipt,
  }]), 1);
  assert.deepEqual(await store.deliverOutbox(oldPayloadRequest, async () => {
    throw new Error("OLD_PAYLOAD_MUST_NOT_BE_UPLOADED_AGAIN");
  }), oldPayloadReceipt,
  "a prior session's exact Website receipt must settle the original payload Outbox intent");
  const changedPayloadBody = Buffer.from("{\"answer\":3}");
  const changedPayloadHash = sha256(changedPayloadBody);
  const changedPayloadRequest = `aipresult_${hashCanonical({ job_id: partial.job_id,
    attempt_id: "attempt:payload-only", role: "result_payload",
    content_hash: changedPayloadHash }).slice(7, 47)}`;
  const changedArtifactId = `airesult_${partial.job_id.replace(/[^A-Za-z0-9_-]/gu, "_").slice(-64)}_${partialAttemptHash}_result_payload_${changedPayloadHash.slice(-16)}`;
  store.enqueue({ idempotency_key: changedPayloadRequest, kind: "artifact",
    path: `/internal/ai-production/v6/jobs/${encodeURIComponent(partial.job_id)}/artifacts/result_payload/${encodeURIComponent(changedArtifactId)}`,
    method: "PUT", headers: { "x-ai-content-sha256": changedPayloadHash },
    body: changedPayloadBody });
  await assert.rejects(store.deliverOutbox(changedPayloadRequest, async () => {
    throw runtimeTransportFailure("AI_PRODUCTION_RESULT_OBJECT_CONFLICT", 409);
  }), /AI_PRODUCTION_RESULT_OBJECT_CONFLICT/u);
  assert.deepEqual(store.readResultPayloadSlotConflict(partial.job_id, "attempt:payload-only"), {
    old_request_id: oldPayloadRequest, old_payload_hash: oldPayloadHash,
    old_receipt_hash: providerEffectHash, new_request_id: changedPayloadRequest,
    new_payload_hash: changedPayloadHash,
  },
    "an exact old receipt plus different rejected bytes must open the zero-submit source path");
};
