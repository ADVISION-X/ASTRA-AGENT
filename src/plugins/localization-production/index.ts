import { combineEvidence, parsePluginJsonObject, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { parseProductResult, parseRouteResult } from "../product-result-contract.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "generic_ai", profileRef: "localization-production:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

const instructionByAction = {
  report_translation: "联合 source_content、target_locale、terminology 与 locale_policy，把中文报告翻译为目标地区玄学读者自然且专业的表达；保留结构、事实、数据、古典原文边界和风险强度，不重新排盘或分析。只返回合法 JSON，不要代码围栏。",
  article_translation: "联合 source_content、target_locale、terminology 与 locale_policy，把中文公开文章翻译为目标地区自然且专业的表达；保留标题层级、链接、引文边界和 SEO 语义，不执行发布。只返回合法 JSON，不要代码围栏。",
} as const;

const textParameter = (parameters: Readonly<Record<string, unknown>>, key: string): string => {
  const value = parameters[key];
  if (typeof value !== "string" || !value) throw new Error(`LOCALIZATION_PARAMETER_REQUIRED:${key}`);
  return value;
};

export const localizationProductionPlugin: ProductPlugin = {
  pluginId: "localization-production",
  pluginVersion: 6,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  parseResult: parseProductResult,
  accepts: [
    { productId: "localization_report_translation", actionId: "report_translation" },
    { productId: "localization_report_translation", actionId: "accuracy_challenge" },
    { productId: "localization_report_translation", actionId: "quality_reflection" },
    { productId: "localization_article_translation", actionId: "article_translation" },
    { productId: "localization_article_translation", actionId: "accuracy_challenge" },
    { productId: "localization_article_translation", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id === "accuracy_challenge"
      || task.action_id === "quality_reflection";
    if (review) {
      const turn = await context.runTurn({
        step_id: task.action_id,
        instruction: "复核冻结的 subject_result 与 review_context，只返回 website-agent-review-output.v1 的合法 JSON（decision、issues 及完整 issue 字段），不替网站作裁决。",
        material_roles: ["subject_result", "review_context"],
        gpt_flow: freshGptTurnFlow,
        provider,
      });
      return context.complete({ payload: parseRouteResult(task, turn.raw_text), evidence_refs: combineEvidence(turn) });
    }
    const action = task.action_id as keyof typeof instructionByAction;
    const identity = ` 输出必须符合 terminal-localization-model-output.v1：schema_version、action_id=${task.product_id}、source_resource_id=${textParameter(task.parameters, "source_resource_id")}、source_version=${textParameter(task.parameters, "source_version")}、source_sha256=${textParameter(task.parameters, "source_sha256")}、target_locale=${textParameter(task.parameters, "target_locale")}、localized_structured_payload。`;
    const materials = ["source_content", "terminology", "locale_policy", "render_policy"] as const;
    const candidateA = await context.runTurn({
      step_id: `${action}:candidate_a`, instruction: `${instructionByAction[action]}${identity}`,
      material_roles: materials, gpt_flow: freshGptTurnFlow, provider,
    });
    const candidateB = await context.runTurn({
      step_id: `${action}:candidate_b`, instruction: `${instructionByAction[action]}${identity}`,
      material_roles: materials, gpt_flow: freshGptTurnFlow, provider,
    });
    parseRouteResult(task, candidateA.raw_text);
    parseRouteResult(task, candidateB.raw_text);
    const reviewTurn = await context.runTurn({
      step_id: `${action}:private_review`,
      instruction: `你是隔离审校者，不得生成第三份译文。逐项比较两个候选与任务冻结的术语、保护字段、结构、事实和风险强度。候选A哈希=${candidateA.raw_hash}，候选B哈希=${candidateB.raw_hash}。候选A=${candidateA.raw_text}\n候选B=${candidateB.raw_text}\n只返回精确 JSON：{"decision":"approve|reject","candidate_a_hash":"sha256:...","candidate_b_hash":"sha256:...","issues":["..."]}。任一候选都不安全时必须 reject。`,
      material_roles: materials, gpt_flow: freshGptTurnFlow, provider,
    });
    const reviewOutput = parsePluginJsonObject(reviewTurn.raw_text, "LOCALIZATION_PRIVATE_REVIEW");
    const reviewKeys = Object.keys(reviewOutput).sort();
    if (JSON.stringify(reviewKeys) !== JSON.stringify(["candidate_a_hash", "candidate_b_hash", "decision", "issues"])
      || reviewOutput.decision !== "approve"
      || reviewOutput.candidate_a_hash !== candidateA.raw_hash
      || reviewOutput.candidate_b_hash !== candidateB.raw_hash
      || !Array.isArray(reviewOutput.issues)
      || reviewOutput.issues.some((issue) => typeof issue !== "string" || !issue.trim())) {
      throw new Error("LOCALIZATION_PRIVATE_REVIEW_REJECTED");
    }
    const selectorTurn = await context.runTurn({
      step_id: `${action}:private_selector`,
      instruction: `你是非生成式 selector，只能在 A/B 中选择一份已经通过结构校验的候选，不得改写或合成。候选A哈希=${candidateA.raw_hash}，候选B哈希=${candidateB.raw_hash}，审校证据哈希=${reviewTurn.raw_hash}。候选A=${candidateA.raw_text}\n候选B=${candidateB.raw_text}\n审校证据=${reviewTurn.raw_text}\n只返回精确 JSON：{"selected_candidate":"A|B","candidate_a_hash":"sha256:...","candidate_b_hash":"sha256:...","review_hash":"sha256:..."}。`,
      material_roles: [], gpt_flow: freshGptTurnFlow, provider,
    });
    const selection = parsePluginJsonObject(selectorTurn.raw_text, "LOCALIZATION_PRIVATE_SELECTOR");
    if (JSON.stringify(Object.keys(selection).sort()) !== JSON.stringify(["candidate_a_hash", "candidate_b_hash", "review_hash", "selected_candidate"])
      || (selection.selected_candidate !== "A" && selection.selected_candidate !== "B")
      || selection.candidate_a_hash !== candidateA.raw_hash
      || selection.candidate_b_hash !== candidateB.raw_hash
      || selection.review_hash !== reviewTurn.raw_hash) {
      throw new Error("LOCALIZATION_PRIVATE_SELECTOR_INVALID");
    }
    const selected = selection.selected_candidate === "A" ? candidateA : candidateB;
    return context.complete({
      payload: parseRouteResult(task, selected.raw_text),
      evidence_refs: combineEvidence(candidateA, candidateB, reviewTurn, selectorTurn),
    });
  },
};
