import { executionFailure } from "../../lib/execution-failure.js";
import { isPendingExactEvidence } from "./evidence-fact.js";
import type { GptChildCapabilityIntent } from "./contract.js";
import type { ProductGptFactQuery } from "./product-api.js";
import type { GptExactCallFactsWithBrowserBinding } from "./production-call-facts.js";

export const readTaskExactGptCallFacts = async (input: Readonly<{
  query: ProductGptFactQuery;
  currentAttemptId: string;
  attemptIds: readonly string[];
  intentForAttempt(call: ProductGptFactQuery, attemptId: string): GptChildCapabilityIntent;
  readIntentFacts(intent: GptChildCapabilityIntent): Promise<GptExactCallFactsWithBrowserBinding>;
}>): Promise<GptExactCallFactsWithBrowserBinding> => {
  const { lookupKind = "current_attempt", ...call } = input.query;
  if (lookupKind === "current_attempt") {
    return input.readIntentFacts(input.intentForAttempt(call, input.currentAttemptId));
  }
  if (call.child !== "submit_exact_gpt_turn_once"
    && call.child !== "fork_exact_gpt_conversation_at_checkpoint") {
    throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_CHILD_INVALID");
  }
  const currentFacts = await input.readIntentFacts(input.intentForAttempt(call, input.currentAttemptId));
  if (currentFacts.mutation || currentFacts.evidence) {
    throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_CURRENT_ATTEMPT_PRESENT");
  }
  const candidates: GptExactCallFactsWithBrowserBinding[] = [];
  for (const attemptId of input.attemptIds) {
    if (attemptId === input.currentAttemptId) continue;
    const facts = await input.readIntentFacts(input.intentForAttempt(call, attemptId));
    if (isPendingExactEvidence(facts.evidence)) {
      throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_PENDING");
    }
    if (facts.mutation || facts.evidence) candidates.push(facts);
  }
  if (candidates.length > 1) {
    throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_AMBIGUOUS");
  }
  return candidates[0] ?? currentFacts;
};
