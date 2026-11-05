import { sha256, productResultValidation as v, type ProductPluginOutput,
  type SharedExecutionContext, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import type { GptExecutionProfile } from "../../capabilities/gpt/index.js";

type WorkspaceInput = Readonly<{ facts: Readonly<Record<string, unknown>>; profile: GptExecutionProfile }>;
async function selectWorkspaceProfile(context: SharedExecutionContext, profile: GptExecutionProfile,
  frame: Readonly<{ sessionKey: string; productStepId: string }>): Promise<void> {
  await context.gpt.execute({ ...frame, callId: "profile.open", actionOrdinal: 2, child: "open_gpt_execution_profile", input: { profile } });
  await context.gpt.execute({ ...frame, callId: "model.open", actionOrdinal: 3, child: "open_gpt_model_selector_v3", input: { profile } });
  await context.gpt.execute({ ...frame, callId: "model.select", actionOrdinal: 4, child: "select_gpt_model_from_start_v3", input: { profile } });
  await context.gpt.execute({ ...frame, callId: "reasoning.select", actionOrdinal: 5, child: "select_gpt_reasoning_from_start_v3", input: { profile } });
  await context.gpt.execute({ ...frame, callId: "profile.close", actionOrdinal: 6, child: "close_gpt_execution_profile", input: { profile } });
}
export async function executeWorkspaceFlow(task: WebsiteAgentTask, context: SharedExecutionContext,
  input: WorkspaceInput): Promise<ProductPluginOutput> {
  const frame = { sessionKey: "workspace", productStepId: `workspace.${task.action_id}` };
  const marker = `ASTRA:${task.job_id}:workspace:${context.resultRevision.revision}`;
  const instruction = task.action_id === "prepare_workspace"
    ? "在指定账号以本单唯一marker精确查找真实目录。唯一同项目目录复用，确认未发起且无匹配才首次创建；创建未知不得再建，零/多匹配受阻。逐件将确认单和原件转存，实际核同版字节/hash及内容可读性，保存原件和逐件报告；未核实副本不得宣称可删除。此动作不开始S02。"
    : "只执行本单purpose和原资产授权：inspect仅核原同版文件、目录、原脚本报告与实际位置；repair_files只保留原稿内容并定位损坏文件，不重做研究；delete_expired/delete_closed仅对精确获准目录和对象清理，保留hold/未知/在途保护，删除后实际查原对象缺席。不改首次可领取期限，不接受新增研究。";
  // Read-only recovery resolves the original step/call identity and returns its original prompt hash.
  const submitCall = { ...frame, callId: "submit", actionOrdinal: 9,
    child: "submit_exact_gpt_turn_once" as const, input: { promptHash: sha256(marker), files: [] } };
  let submitted = await context.gpt.readConfirmedSubmit(submitCall);
  if (!submitted) {
    const workReads: unknown[] = [];
    const requests = input.facts.work_access_requests;
    if (Array.isArray(requests)) for (const request of requests) {
      if (!context.workAccess || !request || typeof request !== "object") throw new Error("WORKSPACE_ACCESS_REQUEST_INVALID");
      const materialId = Reflect.get(request, "material_id"), assetId = Reflect.get(request, "asset_id");
      if (typeof materialId !== "string" || assetId !== undefined && typeof assetId !== "string") throw new Error("WORKSPACE_ACCESS_REQUEST_INVALID");
      workReads.push(await context.workAccess(materialId, assetId));
    }
    const prompt = [marker, context.productSkill.text, instruction,
      "使用Work真实文件工具完成，保留完整工作说明，并用当前公布的机械字段记录实际目录、版本、读回、产物和权限事实；不编造目录、读取、哈希、文件、许可或删除事实。身份字段由程序锁定，凭证和读写URL不进入结果。",
      JSON.stringify({ task, facts: input.facts, work_reads: workReads, result_contract: context.routePolicy.result_contract })].join("\n\n");
    await context.gpt.execute({ ...frame, callId: "prepare", actionOrdinal: 1, child: "prepare_clean_gpt_work", input: { timeoutMs: 60_000 } });
    await selectWorkspaceProfile(context, input.profile, frame);
    await context.gpt.execute({ ...frame, callId: "attachments.verify", actionOrdinal: 7, child: "reconcile_gpt_attachment_set", input: { files: [], timeoutMs: 60_000 } });
    await context.gpt.execute({ ...frame, callId: "prompt.write", actionOrdinal: 8, child: "write_exact_gpt_prompt", input: { prompt } });
    submitted = await context.gpt.execute({ ...submitCall, input: { promptHash: sha256(prompt), files: [] } });
  }
  const effect = submitted.effectReceipt?.providerEffectIdentityHash;
  if (!effect) throw new Error("WORKSPACE_SUBMIT_EFFECT_MISSING");
  const location = await context.gpt.execute({ ...frame, callId: "conversation.read", actionOrdinal: 10,
    child: "get_submitted_gpt_conversation_url", input: { submitCallId: "submit", providerEffectIdentityHash: effect, timeoutMs: 60_000 } });
  const answer = await context.gpt.execute({ ...frame, callId: "answer.read", actionOrdinal: 11, child: "checkpoint_gpt_text_response",
    input: { canonicalConversationUrl: location.value.canonicalConversationUrl, userTurnId: submitted.value.userTurnId,
      turnMarker: marker, probeBudgetMs: 600_000 } });
  return v.settleMechanicalOutput(answer.artifactRefs,
    () => v.parseJsonObject(answer.value.semanticText, "WORKSPACE_RESULT", ["workspace", "decision", "body"]));
}
