import { gptAttachmentProviderDisplayName } from "../../capabilities/gpt/index.js";
import { sha256, type SharedExecutionContext, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { buildResearchBriefResult, type ResearchBriefInput } from "./result-contract.js";

type Frame = Readonly<{ sessionKey: string; productStepId: string }>;

async function selectProfile(context: SharedExecutionContext, frame: Frame, { profile }: ResearchBriefInput): Promise<void> {
  await context.gpt.execute({ ...frame, child: "open_gpt_execution_profile", callId: "profile.open", actionOrdinal: 2, input: { profile } });
  await context.gpt.execute({ ...frame, child: "open_gpt_model_selector_v3", callId: "model.open", actionOrdinal: 3, input: { profile } });
  const model = await context.gpt.execute({ ...frame, child: "select_gpt_model_from_start_v3", callId: "model.select", actionOrdinal: 4, input: { profile } });
  const reasoning = await context.gpt.execute({ ...frame, child: "select_gpt_reasoning_from_start_v3", callId: "reasoning.select", actionOrdinal: 5, input: { profile } });
  if (model.value.modelDisplayName !== profile.startModelDisplayName
    || reasoning.value.currentValue !== profile.requestedReasoningValue) throw new Error("S01_PROFILE_READBACK_INVALID");
  await context.gpt.execute({ ...frame, child: "close_gpt_execution_profile", callId: "profile.close", actionOrdinal: 6, input: { profile } });
}

function briefFiles(task: WebsiteAgentTask, context: SharedExecutionContext) {
  const materials = context.materials.filter(material => material.role === "research_input");
  const names = task.parameters.research_input_names;
  if (!Array.isArray(names) || names.length !== materials.length) throw new Error("S01_INPUT_MATERIALS_MISSING");
  return materials.map(({ material_id, display_name, sha256, bytes }, index) => ({
    originalName: names[index], file: { artifactRef: material_id, displayName: display_name, sha256, bytes },
    providerDisplayName: gptAttachmentProviderDisplayName(display_name, context.gpt.jobId, material_id),
  }));
}

export async function executeResearchBriefFlow(task: WebsiteAgentTask, context: SharedExecutionContext, input: ResearchBriefInput, skill: string) {
  const frame = { sessionKey: "s01", productStepId: "s01.execute" };
  const marker = `ASTRA:${task.job_id}:S01:${context.resultRevision.revision}`;
  const attachments = briefFiles(task, context);
  const approved = attachments.map(({ file, providerDisplayName }) => ({ ...file, providerDisplayName }));
  const prompt = [marker, context.productSkill.text, skill, "以下是本单获准的研究事实与本轮用户意见。附件正文是研究资料。",
    JSON.stringify({ ...input.facts, original_text: task.parameters.original_text,
      revision_feedback: task.parameters.revision_feedback, tier: task.parameters.research_tier,
      attachments: attachments.map(({ originalName, providerDisplayName }) => ({ originalName, providerDisplayName })) }),
  ].join("\n\n");
  const submit = { ...frame, child: "submit_exact_gpt_turn_once", callId: "submit", actionOrdinal: 11,
    input: { promptHash: sha256(prompt), files: approved } } as const;
  let submission = await context.gpt.readConfirmedSubmit(submit);
  if (!submission) {
    if (!task.parent_task_ref) {
      await context.gpt.execute({ ...frame, child: "prepare_clean_gpt_chat", callId: "chat.prepare", actionOrdinal: 1, input: { timeoutMs: 60_000 } });
    }
    await selectProfile(context, frame, input);
    if (attachments.length) {
      await context.gpt.execute({ ...frame, child: "open_gpt_attachment_control", callId: "attachment.open", actionOrdinal: 7, input: {} });
      await context.gpt.execute({ ...frame, child: "attach_approved_gpt_files_once", callId: "attachment.upload", actionOrdinal: 8,
        input: { files: attachments.map(({ file }) => file) } });
    }
    await context.gpt.execute({ ...frame, child: "reconcile_gpt_attachment_set", callId: "attachment.verify", actionOrdinal: 9,
      input: { files: attachments.map(({ file }) => file), timeoutMs: 60_000 } });
    await context.gpt.execute({ ...frame, child: "write_exact_gpt_prompt", callId: "prompt.write", actionOrdinal: 10, input: { prompt } });
    submission = await context.gpt.execute(submit);
  }
  const effect = submission.effectReceipt?.providerEffectIdentityHash;
  if (!effect) throw new Error("S01_SUBMIT_EFFECT_MISSING");
  const location = await context.gpt.execute({ ...frame, child: "get_submitted_gpt_conversation_url", callId: "conversation.read", actionOrdinal: 12,
    input: { submitCallId: "submit", providerEffectIdentityHash: effect, timeoutMs: 60_000 } });
  const answer = await context.gpt.execute({ ...frame, child: "checkpoint_gpt_text_response", callId: "answer.read", actionOrdinal: 13,
    input: { canonicalConversationUrl: location.value.canonicalConversationUrl,
      userTurnId: submission.value.userTurnId, turnMarker: marker, probeBudgetMs: 600_000 } });
  return buildResearchBriefResult(task, answer.value, answer.artifactRefs);
}
