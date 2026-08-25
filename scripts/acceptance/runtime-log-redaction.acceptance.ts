import assert from "node:assert/strict";

import { redactRuntimeLogRecord, redactUrlForLog } from "../../src/lib/runtime-logs/redaction-contract.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const redacted = redactRuntimeLogRecord({
  cookie: "c_user=123",
  authorization: "Bearer abc.def",
  nested: {
    api_key: "secret-key",
    signedUrl: "https://example.com/video.mp4?signature=secret&expires=999",
    image: "data:image/png;base64,abcdef",
  },
});

assert.equal(redacted.cookie, "[REDACTED]");
assert.equal(redacted.authorization, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).api_key, "[REDACTED]");
assert.equal((redacted.nested as Record<string, unknown>).signedUrl, "https://example.com/video.mp4");
assert.equal((redacted.nested as Record<string, unknown>).image, "[REDACTED]");
assert.equal(redactUrlForLog("https://example.com/path?token=x#frag"), "https://example.com/path");

process.stdout.write("[ACCEPTANCE] runtime-log-redaction PASS\n");
emitQualityProofObservation({ lawId: "LAW-RUNTIME-LOG-SPINE-001-V3", evidenceMode: "exam.golden", locator: "acceptance:runtime-log:redaction", observedValue: "cookie authorization API key image and URL secrets redacted" });
