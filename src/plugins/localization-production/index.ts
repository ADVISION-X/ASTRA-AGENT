import { combineEvidence, readProductSkill, type ProductPlugin } from "../../lib/local-runtime/production/plugin.js";
import { freshGptTurnFlow } from "./gpt-flow.js";

const skill = readProductSkill(import.meta.url);
const provider = { labelKey: "generic_ai", profileRef: "localization-production:gpt-5.6-sol-pro", modelDisplayName: "GPT-5.6 Sol", modelFamily: "gpt-5.6", reasoningTier: "pro_standard" } as const;

const instructionByAction = {
  report_translation: "把中文报告忠实翻译为目标 locale，保留结构、术语、数据和风险表述，不增删业务事实。只返回合法 JSON，不要代码围栏。",
  article_translation: "把中文公开文章忠实翻译为目标 locale，保留标题层级、链接、引文边界和 SEO 语义，不执行发布。只返回合法 JSON，不要代码围栏。",
  static_review_candidate: "独立审阅候选译文，只报告错译、漏译、术语、locale 表达和结构问题。",
  static_review_selector: "对给定候选与审阅证据作确定性选择，返回被选候选和逐项理由，不改写源文。",
} as const;

const textParameter = (parameters: Readonly<Record<string, unknown>>, key: string): string => {
  const value = parameters[key];
  if (typeof value !== "string" || !value) throw new Error(`LOCALIZATION_PARAMETER_REQUIRED:${key}`);
  return value;
};

const parseTranslation = (
  raw: string,
  parameters: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const normalized = raw.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  let value: unknown;
  try { value = JSON.parse(normalized) as unknown; } catch { throw new Error("LOCALIZATION_RESULT_JSON_INVALID"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("LOCALIZATION_RESULT_OBJECT_INVALID");
  const output = value as Record<string, unknown>;
  if (output.schema_version !== "terminal-localization-model-output.v1"
    || output.source_resource_id !== textParameter(parameters, "source_resource_id")
    || output.source_version !== textParameter(parameters, "source_version")
    || output.source_sha256 !== textParameter(parameters, "source_sha256")
    || output.target_locale !== textParameter(parameters, "target_locale")
    || !("localized_structured_payload" in output)) {
    throw new Error("LOCALIZATION_RESULT_IDENTITY_INVALID");
  }
  return Object.freeze(output);
};

export const localizationProductionPlugin: ProductPlugin = {
  pluginId: "localization-production",
  pluginVersion: 1,
  skillHash: skill.hash,
  checkpointSchemaVersion: 1,
  accepts: [
    { productId: "localization_report_translation", actionId: "report_translation" },
    { productId: "localization_report_translation", actionId: "accuracy_challenge" },
    { productId: "localization_report_translation", actionId: "quality_reflection" },
    { productId: "localization_article_translation", actionId: "article_translation" },
    { productId: "localization_article_translation", actionId: "accuracy_challenge" },
    { productId: "localization_article_translation", actionId: "quality_reflection" },
    { productId: "localization_static_review_candidate", actionId: "static_review_candidate" },
    { productId: "localization_static_review_candidate", actionId: "accuracy_challenge" },
    { productId: "localization_static_review_candidate", actionId: "quality_reflection" },
    { productId: "localization_static_review_selector", actionId: "static_review_selector" },
    { productId: "localization_static_review_selector", actionId: "accuracy_challenge" },
    { productId: "localization_static_review_selector", actionId: "quality_reflection" },
  ],
  async execute(task, context) {
    const review = task.action_id === "accuracy_challenge"
      || task.action_id === "quality_reflection";
    if (review) {
      const turn = await context.runTurn({
        step_id: task.action_id,
        instruction: "依据 review_policy 复核原本地化结果的忠实度、完整性、术语、locale 表达与结构；只返回可核验 finding，不替网站作裁决。",
        material_roles: ["subject_result", "review_context", "source_content", "terminology", "locale_policy"],
        gpt_flow: freshGptTurnFlow,
        provider,
      });
      return context.complete({ payload: { findings: turn.raw_text }, evidence_refs: combineEvidence(turn) });
    }
    const action = task.action_id as keyof typeof instructionByAction;
    const translation = action === "report_translation" || action === "article_translation";
    const identity = translation
      ? ` 输出必须符合 terminal-localization-model-output.v1：schema_version、source_resource_id=${textParameter(task.parameters, "source_resource_id")}、source_version=${textParameter(task.parameters, "source_version")}、source_sha256=${textParameter(task.parameters, "source_sha256")}、target_locale=${textParameter(task.parameters, "target_locale")}、localized_structured_payload。`
      : "";
    const turn = await context.runTurn({ step_id: action, instruction: `${instructionByAction[action]}${identity}`, material_roles: ["source_content", "candidate_translation", "review_evidence", "terminology", "locale_policy", "render_policy"], gpt_flow: freshGptTurnFlow, provider });
    return context.complete({
      payload: translation
        ? parseTranslation(turn.raw_text, task.parameters)
        : { action, review: turn.raw_text },
      evidence_refs: combineEvidence(turn),
    });
  },
};
