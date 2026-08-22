import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  gatewayConversationTitlePath,
  gatewayExecutionProfilePath,
  profilePath,
  schemaPath,
} from "./inspector-paths.js";

const requireValues = (
  findings: InspectorFinding[],
  input: {
    lawId: string;
    checkId: string;
    filePath: string;
    messagePrefix: string;
    values: ReadonlySet<string>;
    required: readonly string[];
  },
): void => {
  for (const required of input.required) {
    if (input.values.has(required)) continue;
    findings.push(createFinding({
      lawId: input.lawId,
      clauseId: "apex-xuanxue-001-v3-cloud-pull-v5",
      checkId: input.checkId,
      filePath: input.filePath,
      message: `${input.messagePrefix} ${required}.`,
    }));
  }
};

const forbidValues = (
  findings: InspectorFinding[],
  input: {
    lawId: string;
    checkId: string;
    filePath: string;
    messagePrefix: string;
    values: ReadonlySet<string>;
    forbidden: readonly string[];
  },
): void => {
  for (const forbidden of input.forbidden) {
    if (!input.values.has(forbidden)) continue;
    findings.push(createFinding({
      lawId: input.lawId,
      clauseId: "apex-xuanxue-001-v3-cloud-pull-v5",
      checkId: input.checkId,
      filePath: input.filePath,
      message: `${input.messagePrefix} ${forbidden}.`,
    }));
  }
};

const inspectTerminalMetaphysicsProfile = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/terminal-metaphysics-profile",
    filePath: schemaPath,
    messagePrefix: "Terminal metaphysics profile contract must contain",
    values,
    required: [
      "xuanxueTerminalMetaphysicsProviderProfile", "GPT-5.6 Sol", "gpt-5.6",
      "pro_standard", "Pro", "isXuanxueTerminalMetaphysicsProduct",
      "isXuanxueTerminalMetaphysicsProfile",
      "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_REQUIRED",
      "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROFILE_MISMATCH",
      "XUANXUE_AI_PRODUCTION_GPT_5_6_SOL_PROVIDER_PROOF_MISMATCH",
    ],
  });
  forbidValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/no-retired-terminal-metaphysics-profile",
    filePath: schemaPath,
    messagePrefix: "Terminal metaphysics contract must not retain retired profile",
    values,
    forbidden: ["GPT-PRO", "pro_extended"],
  });
};

const inspectWholeOrderContract = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => requireValues(findings, {
  lawId,
  checkId: "xuanxue-ai-production/whole-order-contract",
  filePath: schemaPath,
  messagePrefix: "Whole-order contract must contain",
  values,
  required: [
    "xuanxue-ai-production-v5", "bazi_chart_interpretation", "bazi_ai_full_analysis",
    "bazi_report_followup", "qimen_professional_answer", "qimen_report_followup",
    "hehun_ai_analysis", "hehun_report_followup", "naming_bazi_analysis_and_naming",
    "naming_from_existing_bazi_report", "bazi_canonical_base_interpretation",
    "hehun_canonical_party_a_interpretation", "hehun_canonical_party_b_interpretation",
    "manual_accuracy_challenge", "payment_screenshot_observation", "public_knowledge_article_pipeline",
    "localization_report_translation", "localization_article_translation",
    "localization_static_review_candidate", "localization_static_review_selector",
    "scheduled_quality_reflection", "candidate_a", "candidate_b", "selector_first",
    "selector_swap", "consistency", "article_image_generation", "chart_interpretation",
    "frozenSubject", "conversationScopeRef", "conversationParent", "joinParents",
    "forked_from_checkpoint", "same_conversation", "generated_image",
    "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION",
  ],
});

const inspectFixedProfiles = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => requireValues(findings, {
  lawId,
  checkId: "xuanxue-ai-production/fixed-profiles",
  filePath: profilePath,
  messagePrefix: "Fixed product profiles must contain",
  values,
  required: [
    "resolveXuanxueAiProductionProfile", "assertXuanxueAiOrderMatchesProfile", "dependsOn",
    "continuationFrom", "generatedInputsFrom", "party_a_interpretation", "party_b_interpretation",
    "final_compatibility", "conversationParent", "joinParents",
    "XUANXUE_AI_PRODUCTION_FORK_PARENT_REQUIRED", "XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH",
    "XUANXUE_AI_PRODUCTION_HEHUN_THREE_CONTEXTS_REQUIRED",
    "xuanxueAiPaidFollowupProfiles", "xuanxueAiReusableBaseConsumerProfiles",
    "xuanxueAiRequiredContinuationProfiles", "isXuanxueAiPaidFollowupProduct",
    "isXuanxueAiRequiredContinuationProduct", "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
    "XUANXUE_AI_PRODUCTION_CONVERSATION_CHAIN_INVALID", "localization_report_translation",
    "localization_article_translation", "localization_static_review_candidate",
    "localization_static_review_selector", "candidate_a", "candidate_b", "selector_first",
    "selector_swap", "consistency",
  ],
});

const inspectProviderControls = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/live-model-identity",
    filePath: gatewayExecutionProfilePath,
    messagePrefix: "Provider execution profile control must contain",
    values,
    required: [
      "enforceGptWebExecutionProfile", "provider_ui_observation", "providerExecutionProfileProof",
      "gpt-web-execution-profile.v1", "extra_high", "pro_standard", "pro_extended", "GPT-5.6 Sol",
      "assertStableWebChatDocument", "GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH",
    ],
  });
  requireValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/conversation-title-finalization",
    filePath: gatewayConversationTitlePath,
    messagePrefix: "Provider title finalization must contain",
    values,
    required: [
      "finalizeGptWebConversationTitle", "runExclusivePatrol", "conversationTitleProof",
      "canonicalConversationUrl", "gpt-web-title-policy.v1", "title_finalization_pending",
    ],
  });
};

export const inspectXuanxueContracts = (
  findings: InspectorFinding[],
  boundaryLawId: string,
  values: ReadonlySet<string>,
  terminalMetaphysicsProfileValues: ReadonlySet<string>,
): void => {
  inspectWholeOrderContract(findings, boundaryLawId, values);
  inspectFixedProfiles(findings, boundaryLawId, values);
  inspectProviderControls(findings, boundaryLawId, values);
  inspectTerminalMetaphysicsProfile(
    findings,
    boundaryLawId,
    terminalMetaphysicsProfileValues,
  );
};
