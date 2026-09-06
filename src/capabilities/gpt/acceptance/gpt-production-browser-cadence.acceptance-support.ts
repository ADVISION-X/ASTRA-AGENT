import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ProductionGptBrowserLifecycle } from "../production-browser-lifecycle.js";
import {
  GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
  GptCrossConversationPollCadence,
  productionGptCrossConversationPollCadence,
} from "../provider-wait-cross-conversation-cadence.js";
import type {
  BrowserConfirmedProviderSourceReadbackAuthorization,
  BrowserExecutionBinding,
} from "../../../lib/browser/browser-authority-api.js";
import { createRuntimeLogger } from "../../../lib/runtime-logs/index.js";
import { typedExecutionFailure } from "../../../lib/execution-failure.js";
import { HASH_A, HASH_B, task } from "../../../../scripts/acceptance/agent-production-runtime-fixtures.js";

{
  const cadence = new GptCrossConversationPollCadence();
  assert.deepEqual(cadence.reserve(1_000), { kind: "reserved" });
  assert.deepEqual(cadence.reserve(1_001), {
    kind: "wait", durationMs: GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS - 1,
  });
  assert.deepEqual(cadence.reserve(31_000), { kind: "reserved" });
  assert.deepEqual(cadence.reserve(31_000), {
    kind: "wait", durationMs: GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
  }, "one synchronous winner must reserve the shared cross-conversation poll eligibility");
  const dispatchCadence = new GptCrossConversationPollCadence();
  assert.deepEqual(dispatchCadence.reserve(1_000), { kind: "reserved" });
  dispatchCadence.bindDispatch(1_100);
  assert.deepEqual(dispatchCadence.reserve(31_000), { kind: "wait", durationMs: 100 });
  assert.deepEqual(dispatchCadence.reserve(31_100), { kind: "reserved" },
    "eligibility must be measured from the actual navigate entry binding, not the provisional reservation");
}
