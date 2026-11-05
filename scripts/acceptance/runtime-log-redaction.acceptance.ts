import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createRuntimeLogger,
  redactRuntimeLogRecord,
  redactUrlForLog,
  requireRuntimeLogWrite,
} from "../../src/lib/runtime-logs/index.js";
import { RuntimeAttestationReceiptSchema } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const redacted = redactRuntimeLogRecord({
  cookie: "c_user=123",
  authorization: "Bearer abc.def",
  nested: {
    api_key: "secret-key",
    signedUrl: "https://example.com/video.mp4?signature=secret&expires=999",
    image: "data:image/png;base64,abcdef",
    localRef: "/tmp/private.txt",
    fileRef: "file:///Users/private/runtime.log",
  },
});

assert.equal(redacted.cookie, "[REDACTED]");
assert.equal(redacted.authorization, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).api_key, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).signedUrl, "[REDACTED_UNSAFE]");
assert.equal((redacted.nested as Record<string, unknown>).image, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).localRef, "[REDACTED_UNSAFE]");
assert.equal((redacted.nested as Record<string, unknown>).fileRef, "[REDACTED_UNSAFE]");
assert.equal(redactUrlForLog("https://example.com/path?token=x#frag"), "https://example.com/[REDACTED_PATH]");
assert.deepEqual(
  redactRuntimeLogRecord({ reason_codes: ["NO_ELIGIBLE_JOB", "CAPACITY_ZERO"] }).reason_codes,
  ["NO_ELIGIBLE_JOB", "CAPACITY_ZERO"],
  "allowlisted machine reason codes must survive redaction unchanged",
);
const unsafeReason = "no work because private /tmp/job payload was unavailable";
assert.equal(RuntimeAttestationReceiptSchema.safeParse({
  schema_version: "xuanxue-ai-runtime-attestation-receipt.v6",
  receipt_id: "receipt:unsafe-reason", receipt_hash: `sha256:${"1".repeat(64)}`,
  worker_session_id: "worker:1", worker_session_epoch: 1, attestation_seq: 1,
  payload_hash: `sha256:${"2".repeat(64)}`, server_signature: `sha256:${"3".repeat(64)}`,
  issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 60_000).toISOString(),
  claim_eligible: false, reason_codes: [unsafeReason],
}).success, true, "transport must accept a bounded Website reason without applying the log schema");
assert.deepEqual(
  redactRuntimeLogRecord({ reason_codes: [unsafeReason] }).reason_codes,
  ["[REDACTED_UNSAFE]"],
  "unsafe Website reason text must be redacted only at the log projection boundary",
);
const logRoot = mkdtempSync(path.join(tmpdir(), "runtime-log-unsafe-reason-"));
try {
  const logger = createRuntimeLogger({
    producer: "runtime-log-unsafe-reason", owner: "production-runtime", component: "production-claim",
    terminalEnabled: false, fileSink: { directoryPath: logRoot },
  });
  const span = requireRuntimeLogWrite(logger.startSpan({
    traceId: "producer:runtime-log-unsafe-reason", owner: "production-runtime",
    component: "production-claim", operation: "cloud.claim",
    typedIdentity: { kind: "request", requestId: "claim:unsafe-reason" },
  }));
  const terminal = requireRuntimeLogWrite(span.terminal({
    outcome: "succeeded",
    claimDiagnostics: { outcome: "NO_ELIGIBLE_JOB", claimed_count: 0, reason_codes: [unsafeReason] },
  }));
  assert.deepEqual(terminal.claimDiagnostics?.reason_codes, ["[REDACTED_UNSAFE]"],
    "the real RuntimeLogger path must persist a schema-valid safe sentinel");
} finally {
  rmSync(logRoot, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE] runtime-log-redaction PASS\n");
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-002-V1", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:runtime-log:redaction", observedValue: "cookie authorization API key image and full URL content redacted before sinks" });
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-002-V1", evidenceMode: "exam.property", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:runtime-log:redaction-property-matrix", observedValue: "nested secret unsafe path data URL and query fragment variants reduced to safe projections" });
