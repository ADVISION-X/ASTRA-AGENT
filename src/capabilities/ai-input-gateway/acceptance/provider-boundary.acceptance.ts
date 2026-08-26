import assert from "node:assert/strict";
import { emitQualityProofObservation } from
  "../../../../scripts/audit/shared/proof-observation.js";

import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import { AiFeedInputSchema } from "../schema.js";
import {
  buildWebChatRawResponse,
  requireBrowser,
} from "../providers/web-chat-shared-support.js";

const governedBrowser = {} as BrowserTargetLease;
assert.equal(
  requireBrowser({ dataDir: "/tmp/provider-boundary-acceptance", browser: governedBrowser }),
  governedBrowser,
  "web-chat transport must use the injected governed BrowserTargetLease",
);
assert.throws(
  () => requireBrowser({ dataDir: "/tmp/provider-boundary-acceptance" }),
  /governed BrowserTargetLease/u,
  "web-chat transport must fail closed without an operator-authorized BrowserTargetLease",
);

for (const reason of [
  "provider requires login",
  "captcha security barrier",
  "two-factor verification",
  "identity mismatch",
]) {
  assert.equal(
    classifyWebChatFailure(new Error(reason), false),
    "review_required",
    `security barrier must require operator review: ${reason}`,
  );
}
assert.equal(
  classifyWebChatFailure(
    new Error("recovery_pending: GPT_WEB_EXECUTION_PROFILE_REASONING_NOT_READY"),
    false,
  ),
  "recovery_pending",
  "typed recovery_pending profile outcomes must never become terminal failed",
);
assert.equal(
  classifyWebChatFailure(
    new Error("review_required: GPT_WEB_EXECUTION_PROFILE_MODEL_AMBIGUOUS"),
    false,
  ),
  "review_required",
  "typed profile ambiguity must remain review_required",
);

for (const reason of [
  "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
  "BROWSER_LIVENESS_EXPIRED",
  "BROWSER_SESSION_WORKSPACE_REQUIRED",
  "BROWSER_TARGET_INVALID",
  "BROWSER_DOCUMENT_INVALID",
  "BROWSER_BACKPRESSURE",
  "BROWSER_AUTH_TRANSCRIPT_INVALID",
  "BROWSER_CAPABILITY_REJECTED",
]) {
  assert.equal(
    classifyWebChatFailure(new Error(reason), false),
    "recovery_pending",
    `browser authority discontinuity must preserve the production checkpoint: ${reason}`,
  );
}

const request = AiFeedInputSchema.parse({
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "system_acceptance",
    sourceProject: "grasseye",
    taskKind: "provider-boundary",
    sourceTaskId: "provider-boundary-acceptance",
  },
  promptPackageId: "provider-boundary-acceptance",
  promptContractId: "provider-boundary-acceptance",
  textPrompt: "Return the exact response bytes.",
  requestedBy: "acceptance-test",
});
const unboundedPrompt = "x".repeat(200_000);
assert.equal(AiFeedInputSchema.parse({ ...request, textPrompt: unboundedPrompt }).textPrompt.length,
  unboundedPrompt.length, "the provider contract must not impose a local prompt-capacity ceiling");
const exactRawResponse = "  exact provider response\nwith preserved spacing  ";
const response = buildWebChatRawResponse({
  request,
  runtimeName: "provider-boundary-acceptance",
  providerUrl: "https://chatgpt.com/",
  sourcePageUrlBeforeFeed: "https://example.com/source",
  extracted: {
    status: "success",
    message: "captured",
    pageUrl: "https://chatgpt.com/c/provider-boundary",
  },
  answerText: exactRawResponse,
});
assert.equal(response.rawText, exactRawResponse, "raw provider response bytes must remain exact");
assert.equal(response.transport, "web-chat");
assert.equal(response.webChatUrl, "https://chatgpt.com/c/provider-boundary");
process.stdout.write("[ACCEPTANCE] AI Input Gateway provider boundary PASS\n");
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-AI-INPUT-GATEWAY-001-V1", evidenceMode: "exam.golden", clauses: ["forbidden:2","summary"], locator: "acceptance:provider-boundary:unbounded-prompt-contract", observedValue: "provider request accepts a 200000-character prompt without a local capacity ceiling" });
emitQualityProofObservation({ passed: true, findings: [], lawId: "LAW-AI-INPUT-GATEWAY-006-V2", evidenceMode: "exam.golden", clauses: ["forbidden:0","summary"], locator: "acceptance:provider-boundary:bounded-judge", observedValue: "caller owns browser authority and provider returns exact response" });
