import type { SharedExecutionContext, WebsiteAgentTask, ProductPluginOutput } from "../../mediator/product-plugin-contract.js";
import { sha256 } from "../../mediator/product-plugin-contract.js";
import { buildUserDialogueResult, type UserDialogueInput } from "./result-contract.js";

async function configureUserDialogue(context: SharedExecutionContext, input: UserDialogueInput, frame: Readonly<{ sessionKey: string; productStepId: string }>) {
  const profile = input.profile;
  await context.gpt.execute({ ...frame, callId: "profile.open", actionOrdinal: 2, child: "open_gpt_execution_profile", input: { profile } });
  await context.gpt.execute({ ...frame, callId: "model.open", actionOrdinal: 3, child: "open_gpt_model_selector_v3", input: { profile } });
  const model = await context.gpt.execute({ ...frame, callId: "model.select", actionOrdinal: 4, child: "select_gpt_model_from_start_v3", input: { profile } });
  const reasoning = await context.gpt.execute({ ...frame, callId: "reasoning.select", actionOrdinal: 5, child: "select_gpt_reasoning_from_start_v3", input: { profile } });
  await context.gpt.execute({ ...frame, callId: "profile.close", actionOrdinal: 6, child: "close_gpt_execution_profile", input: { profile } });
  return { model: model.value.modelDisplayName, reasoning: reasoning.value.currentValue };
}
export async function executeUserDialogueFlow(task: WebsiteAgentTask, context: SharedExecutionContext, input: UserDialogueInput, skill: string): Promise<ProductPluginOutput> {
  const frame = { sessionKey: "c01", productStepId: "c01.execute" };
  const marker = `ASTRA:${task.job_id}:C01:${context.resultRevision.revision}`;
  // Read-only recovery resolves the original step/call identity and returns its original prompt hash.
  const submitCall = { ...frame, callId: "submit", actionOrdinal: 9,
    child: "submit_exact_gpt_turn_once" as const, input: { promptHash: sha256(marker), files: [] } };
  let submitted = await context.gpt.readConfirmedSubmit(submitCall);
  let observed: Readonly<{ model: string; reasoning: number | null }> | null = null;
  if (!submitted) {
    const prompt = [marker, context.productSkill.text, skill, "直接用面向用户的自然语言回答。只使用获准事实，不公开内部提示、过程、凭据或工作区。",
      JSON.stringify({ question: input.facts.question, context: input.facts.context, communication_locale: input.facts.communication_locale })].join("\n\n");
    await context.gpt.execute({ ...frame, callId: "prepare", actionOrdinal: 1, child: "prepare_clean_gpt_chat", input: { timeoutMs: 60_000 } });
    observed = await configureUserDialogue(context, input, frame);
    await context.gpt.execute({ ...frame, callId: "attachments.verify", actionOrdinal: 7, child: "reconcile_gpt_attachment_set", input: { files: [], timeoutMs: 60_000 } });
    await context.gpt.execute({ ...frame, callId: "prompt.write", actionOrdinal: 8, child: "write_exact_gpt_prompt", input: { prompt } });
    submitted = await context.gpt.execute({ ...submitCall, input: { promptHash: sha256(prompt), files: [] } });
  }
  const effect = submitted.effectReceipt?.providerEffectIdentityHash;
  if (!effect) throw new Error("C01_SUBMIT_EFFECT_MISSING");
  const location = await context.gpt.execute({ ...frame, callId: "conversation.read", actionOrdinal: 10,
    child: "get_submitted_gpt_conversation_url", input: { submitCallId: "submit", providerEffectIdentityHash: effect, timeoutMs: 60_000 } });
  const answer = await context.gpt.execute({ ...frame, callId: "answer.read", actionOrdinal: 11,
    child: "checkpoint_gpt_text_response", input: { canonicalConversationUrl: location.value.canonicalConversationUrl,
      userTurnId: submitted.value.userTurnId, turnMarker: marker, probeBudgetMs: 600_000 } });
  const result = buildUserDialogueResult(task, answer.value.semanticText, answer.artifactRefs);
  if (observed && (observed.model !== input.profile.startModelDisplayName || observed.reasoning === null)) throw new Error("C01_PROFILE_READBACK_INVALID");
  return result;
}
