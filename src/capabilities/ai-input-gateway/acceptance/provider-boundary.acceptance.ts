import assert from "node:assert/strict";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import { AiFeedInputSchema } from "../schema.js";
import {
  buildWebChatRawResponse,
  requireBrowser,
} from "../providers/web-chat-shared-support.js";

const governedBrowser = {} as BrowserController;
assert.equal(
  requireBrowser({ dataDir: "/tmp/provider-boundary-acceptance", browser: governedBrowser }),
  governedBrowser,
  "web-chat transport must use the injected governed BrowserController",
);
assert.throws(
  () => requireBrowser({ dataDir: "/tmp/provider-boundary-acceptance" }),
  /governed BrowserController/u,
  "web-chat transport must fail closed without an operator-authorized BrowserController",
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
