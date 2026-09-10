import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import {
  GPT_CROSS_CONVERSATION_POLL_INTERVAL_MS,
  GptCrossConversationPollCadence,
} from "../provider-wait-cross-conversation-cadence.js";

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
