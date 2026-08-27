import assert from "node:assert/strict";

import { redactRuntimeLogRecord, redactUrlForLog } from "../../src/lib/runtime-logs/index.js";
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

process.stdout.write("[ACCEPTANCE] runtime-log-redaction PASS\n");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-RUNTIME-LOG-SPINE-002-V4", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:runtime-log:redaction", observedValue: "cookie authorization API key image and full URL content redacted before sinks" });
