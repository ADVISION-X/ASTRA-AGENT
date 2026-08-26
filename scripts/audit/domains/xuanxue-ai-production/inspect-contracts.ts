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
    findings.push(createFinding({ evidenceMode: "static.ast",
      lawId: input.lawId,
      clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
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
    findings.push(createFinding({ evidenceMode: "static.ast",
      lawId: input.lawId,
      clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
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
      "pro_standard", "Pro",
      "isXuanxueTerminalMetaphysicsProfile",
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
    "xuanxue-ai-production-v6", "RuntimeAttestationReceiptV6",
    "ClaimBatchReceiptV6", "LEASE_GRANTED", "CloudExecutionGrantV6",
    "frozenSubject", "conversationScopeRef", "conversationParent", "joinParents",
    "forked_from_checkpoint", "same_conversation", "generated_image",
    "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION",
  ],
});

const inspectLocalOrderProfiles = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/local-order-profiles",
    filePath: profilePath,
    messagePrefix: "Immutable Cloud order profile consumer must contain",
    values,
    required: [
      "xuanxueLocalOrderNode", "resolveXuanxueAiProductionProfile",
      "assertXuanxueAiOrderMatchesProfile", "dependsOn", "continuationFrom",
      "generatedInputsFrom", "XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH",
      "XUANXUE_AI_PRODUCTION_LOCAL_ORDER_STAGE_CHAIN_INVALID",
    ],
  });
  forbidValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/no-fixed-profile-shadow",
    filePath: profilePath,
    messagePrefix: "Immutable Cloud order profile consumer must not retain",
    values,
    forbidden: [
      "xuanxueAiPaidFollowupProfiles", "xuanxueAiReusableBaseConsumerProfiles",
      "xuanxueAiRequiredContinuationProfiles", "isXuanxueAiPaidFollowupProduct",
      "isXuanxueAiRequiredContinuationProduct", "XUANXUE_AI_PRODUCTION_FORK_PARENT_REQUIRED",
      "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
      "XUANXUE_AI_PRODUCTION_CONVERSATION_CHAIN_INVALID",
      "XUANXUE_PRODUCT_EXECUTION_PROJECTION", "xuanxueProductExecutionContract",
    ],
  });
};

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
  inspectLocalOrderProfiles(findings, boundaryLawId, values);
  inspectProviderControls(findings, boundaryLawId, values);
  inspectTerminalMetaphysicsProfile(
    findings,
    boundaryLawId,
    terminalMetaphysicsProfileValues,
  );
};
