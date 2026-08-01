import { existsSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { executedChecksForPlan, type InspectorContext, type InspectorFinding, type InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  acceptancePath, acceptanceSupportPaths, authorityPaths,
  cloudContractPath, cloudCredentialPath, cloudWorkerPath,
  gatewayTitleHousekeepingPath, gatewayTitleStatePath, gatewayTitleWorkerPath,
  pluginPaths, profilePath, schedulerPath, schemaPath, storePath,
} from "./inspector-paths.js";

type Laws = {
  boundary: string;
  durability: string;
  cloud: string;
};

const finding = (
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({ lawId, checkId, filePath, message });

const source = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
): SourceFile | null => {
  const result = context.project.getSourceFile(resolveFromRepo(filePath));
  if (result) return result;
  findings.push(finding(
    lawId,
    "xuanxue-ai-production/source-present",
    filePath,
    `${filePath} must exist in the audit project.`,
  ));
  return null;
};

const sourceValues = (sources: readonly SourceFile[]): Set<string> => new Set(
  sources.flatMap((file) => {
    const literals = [
      ...file.getDescendantsOfKind(SyntaxKind.StringLiteral)
        .map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
        .map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral)
        .map((node) => node.getText()),
    ];
    return [
      ...file.getDescendantsOfKind(SyntaxKind.Identifier)
        .map((node) => node.getText()),
      ...file.getDescendantsOfKind(SyntaxKind.NumericLiteral)
        .map((node) => node.getText()),
      ...literals,
      ...literals.flatMap((literal) => semanticTokens(literal)),
    ];
  }),
);

const semanticTokens = (value: string): string[] => {
  const separators = new Set([
    " ", "\n", "\r", "\t", "(", ")", ",", ";", "'", '"', "`", ".", "=", "/",
  ]);
  const tokens: string[] = [];
  let current = "";
  for (const character of value) {
    if (!separators.has(character)) {
      current += character;
      continue;
    }
    if (current) tokens.push(current);
    current = "";
  }
  if (current) tokens.push(current);
  return tokens;
};

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
    findings.push(finding(
      input.lawId,
      input.checkId,
      input.filePath,
      `${input.messagePrefix} ${required}.`,
    ));
  }
};

const inspectAuthority = (
  findings: InspectorFinding[],
  boundaryLaw: string,
): void => {
  for (const filePath of authorityPaths) {
    if (existsSync(resolveFromRepo(filePath))) continue;
    findings.push(finding(
      boundaryLaw,
      "xuanxue-ai-production/source-present",
      filePath,
      `${filePath} must exist.`,
    ));
  }
};

const inspectContracts = (
  findings: InspectorFinding[],
  laws: Laws,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId: laws.boundary,
    checkId: "xuanxue-ai-production/whole-order-contract",
    filePath: schemaPath,
    messagePrefix: "Whole-order contract must contain",
    values,
    required: [
      "xuanxue-ai-production-v2",
      "bazi_ai_full_analysis",
      "bazi_report_followup",
      "qimen_professional_answer",
      "qimen_report_followup",
      "hehun_ai_analysis",
      "hehun_report_followup",
      "naming_bazi_analysis_and_naming",
      "naming_from_existing_bazi_report",
      "bazi_canonical_base_interpretation",
      "hehun_canonical_party_a_interpretation",
      "hehun_canonical_party_b_interpretation",
      "manual_accuracy_challenge",
      "payment_screenshot_observation",
      "public_knowledge_article_pipeline",
      "scheduled_quality_reflection",
      "article_image_generation",
      "generated_image",
    ],
  });
  requireValues(findings, {
    lawId: laws.boundary,
    checkId: "xuanxue-ai-production/fixed-profiles",
    filePath: profilePath,
    messagePrefix: "Fixed product profiles must contain",
    values,
    required: [
      "resolveXuanxueAiProductionProfile",
      "assertXuanxueAiOrderMatchesProfile",
      "dependsOn",
      "continuationFrom",
      "generatedInputsFrom",
      "party_a_interpretation",
      "party_b_interpretation",
      "final_compatibility",
      "seededStages",
      "continuationParent",
      "XUANXUE_AI_PRODUCTION_SEEDED_STAGE_PROOF_INVALID",
      "xuanxueAiPaidFollowupProfiles",
      "xuanxueAiReusableBaseConsumerProfiles",
      "xuanxueAiRequiredContinuationProfiles",
      "isXuanxueAiPaidFollowupProduct",
      "isXuanxueAiRequiredContinuationProduct",
      "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
      "XUANXUE_AI_PRODUCTION_CONVERSATION_CHAIN_INVALID",
    ],
  });
};

const inspectTitleHousekeepingDurability = (
  findings: InspectorFinding[],
  durabilityLaw: string,
  values: ReadonlySet<string>,
): void => requireValues(findings, {
  lawId: durabilityLaw,
  checkId: "xuanxue-ai-production/durable-title-housekeeping",
  filePath: gatewayTitleHousekeepingPath,
  messagePrefix: "Published parent-chat title debt must contain",
  values,
  required: ["WebChatTitleRenameState", "chatTitleRename", "response_captured", "drainWebChatTitleHousekeeping", "scheduleWebChatTitleHousekeeping", "runWebChatTitleHousekeepingNow"],
});

const inspectDurability = (
  findings: InspectorFinding[],
  durabilityLaw: string,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/durable-ledger",
    filePath: storePath,
    messagePrefix: "SQLite production ledger must contain",
    values,
    required: [
      "production_orders",
      "production_stages",
      "production_events",
      "journal_mode = WAL",
      "listRecoverableOrders",
      "listCloudRecoveryOrders",
      "repairCanonicalOutputHashState",
      "repairInvalidCompletedStageOutputs",
      "invalid_completed_stage_restarted",
      "canonical_sha256_prefix_verified_against_raw_response_bytes",
      "requestHash",
      "recoverMissingRequiredContinuationParents",
      "repairLegacyFollowupWrongChatExecutionStates",
      "followup_parent_binding_repaired",
      "followup_parent_wrong_chat_execution_retired",
      "followup-parent-binding-recovery",
      "trustedGeneratedFileCount",
      "replacedExecutionIds",
      "followup_parent_replay_requested",
      "production_parent_conversation_rebuilds",
      "parent_conversation_rebuild_started",
      "resetOrderForConversationGraphRebuild",
      "conversation_graph_rebuild_started",
      "replay_from_first_stage_in_one_new_conversation",
      "recordParentConversationRebuild",
      "stage_fresh_execution_restarted",
      "XUANXUE_AI_PRODUCTION_OUTPUT_PROVIDER_FAILURE_ANSWER",
      "migrateTerminalXuanxueAiProtocolV1Rows",
      "XUANXUE_AI_PRODUCTION_V1_ACTIVE_DRAIN_REQUIRED",
      "XUANXUE_AI_PRODUCTION_V1_HASH_MISMATCH",
      "v1_cloud_terminal_reconciled",
      "v1_terminal_status_restored",
      "supersededExecutionId",
      "a recoverable transport failure must retain one execution id so a captured turn can never be resubmitted",
      "a submitted turn interrupted by a second physical monitor tab must resume the same execution without another logical submission",
    ],
  });
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/bounded-coordinator",
    filePath: schedulerPath,
    messagePrefix: "Bounded production coordinator must contain",
    values,
    required: [
      "XuanxueAiProductionCoordinator",
      "DEFAULT_PRODUCTION_WINDOW",
      "availableCapacity",
      "scheduled",
      "waiting",
      "activeContinuationLanes",
      "webChatUrl",
      "exactUrl",
      "parentStage",
      "order_parent_lane_deferred",
      "rebuildContinuationParent",
      "XUANXUE_AI_PRODUCTION_PARENT_REPLAY_PAYLOAD_REQUIRED",
      "order_internal_defect_deferred",
    ],
  });
};

const inspectPluginBoundaries = (
  findings: InspectorFinding[],
  laws: Laws,
  sources: readonly SourceFile[],
): void => {
  const pluginSources = sources.filter((candidate) =>
    candidate.getFilePath().includes(
      "/src/plugins/xuanxue-ai-production/",
    ));
  for (const file of pluginSources) {
    if (file.getDescendantsOfKind(SyntaxKind.VoidExpression).length > 0) {
      findings.push(finding(
        laws.durability,
        "xuanxue-ai-production/no-untracked-background-work",
        file.getFilePath(),
        "Production plugin must not use void fire-and-forget work.",
      ));
    }
    for (const declaration of file.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue();
      const forbidden = [
        "ai-input-gateway/providers",
        "ai-input-gateway/runtime",
        "lib/browser",
        "/plugins/",
      ].some((fragment) => specifier.includes(fragment));
      if (!forbidden) continue;
      findings.push(finding(
        laws.boundary,
        "xuanxue-ai-production/forbidden-private-import",
        file.getFilePath(),
        `Production plugin must not import ${specifier}.`,
      ));
    }
  }
};

const inspectCloud = (
  findings: InspectorFinding[],
  cloudLaw: string,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId: cloudLaw,
    checkId: "xuanxue-ai-production/cloud-lease-binding",
    filePath: cloudContractPath,
    messagePrefix: "Outbound cloud protocol must contain",
    values,
    required: [
      "lease_token",
      "lease_version",
      "idempotency_key",
      "heartbeatXuanxueAiProductionJob",
      "downloadXuanxueAiProductionInput",
      "downloadXuanxueAiProductionParentReplayInput",
      "recoverXuanxueAiProductionJob",
      "continuation_parent_replay",
      "parentReplay",
    ],
  });
  requireValues(findings, {
    lawId: cloudLaw,
    checkId: "xuanxue-ai-production/cloud-capacity",
    filePath: cloudWorkerPath,
    messagePrefix: "Cloud claiming must be bounded by",
    values,
    required: [
      "available",
      "availableCapacity",
      "max_in_flight",
      "active",
      "reconcileDurableLocalOrders",
      "cancelCloudRecoveryOrder",
      "cloud_cancelled_order_settled",
    ],
  });
  requireValues(findings, {
    lawId: cloudLaw,
    checkId: "xuanxue-ai-production/credential-permissions",
    filePath: cloudCredentialPath,
    messagePrefix: "Local device credential enforcement must contain",
    values,
    required: [
      "XUANXUE_AI_PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID",
      "0o600",
    ],
  });
};

const inspectAcceptance = (
  context: InspectorContext,
  findings: InspectorFinding[],
  durabilityLaw: string,
): void => {
  const acceptance = [
    acceptancePath,
    ...acceptanceSupportPaths,
  ].flatMap((filePath) => {
    const result = source(
      context,
      findings,
      durabilityLaw,
      filePath,
    );
    return result ? [result] : [];
  });
  if (acceptance.length === 0) return;
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/acceptance",
    filePath: acceptancePath,
    messagePrefix: "Production acceptance must prove",
    values: sourceValues(acceptance),
    required: [
      "maxActive",
      "the eleventh order must remain outside the ten-order production window",
      "providerContinuationRef",
      "listCloudRecoveryOrders",
      "ORDER_IDENTITY_CONFLICT",
      "a byte-verified legacy hash prefix defect must resume without resubmitting the completed stage",
      "payment_screenshot_observation",
      "public_knowledge_article_pipeline",
      "a paid follow-up without an exact parent must never reach GPT",
      "orders sharing one parent GPT conversation must be serialized",
      "same-parent follow-ups must preserve FIFO order",
      "provider citation residue must discard the response and restart once",
      "restart must retire an invalid completed prefix and every downstream node",
      "a recoverable transport failure must retain one execution id so a captured turn can never be resubmitted",
      "a missing parent chat must replay the parent first, then ask the follow-up",
      "a cloud replay package must reconstruct an absent local parent before the follow-up",
      "a repaired legacy follow-up must continue in its exact parent chat",
      "one verified parent attachment must expand the frozen material file limit exactly once",
      "legacy wrong-chat attachment proof must be retired with a fresh execution id",
      "an already repaired follow-up must retire its legacy wrong-chat execution",
      "JSON field ordering and governance transport upgrades must not block exact legacy parent repair",
      "the paid question must continue the reusable Bazi base conversation",
      "question and naming must continue the exact reusable base chat",
      "naming must continue the immediately preceding question turn",
      "two reusable private bases and one relationship chat are independent",
      "every paid followup performs exactly one new AI call",
      "continuation_parent_replay",
      "a cloud-cancelled order must preserve completed evidence and leave restart reconciliation",
      "XUANXUE_AI_PRODUCTION_V1_ACTIVE_DRAIN_REQUIRED",
      "XUANXUE_AI_PRODUCTION_V1_HASH_MISMATCH",
      "article_image_generation",
      "scheduled_quality_reflection",
      "public-knowledge-redline-check",
    ],
  });
};

export const inspectDomain = async (
  context: InspectorContext,
): Promise<InspectorOutput> => {
  const laws: Laws = {
    boundary: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-001-V4",
    ),
    durability: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-002-V4",
    ),
    cloud: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-003-V1",
    ),
  };
  const findings: InspectorFinding[] = [];
  inspectAuthority(findings, laws.boundary);
  const sources = pluginPaths.flatMap((filePath) => {
    const result = source(context, findings, laws.boundary, filePath);
    return result ? [result] : [];
  });
  const values = sourceValues(sources);
  inspectContracts(findings, laws, values);
  inspectTitleHousekeepingDurability(findings, laws.durability, values);
  inspectDurability(findings, laws.durability, values);
  inspectPluginBoundaries(findings, laws, sources);
  inspectCloud(findings, laws.cloud, values);
  inspectAcceptance(context, findings, laws.durability);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...authorityPaths, ...pluginPaths],
  };
};
