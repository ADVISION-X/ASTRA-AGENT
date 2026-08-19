import { existsSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import {
  type InspectorContext,
  type InspectorFinding,
  type InspectorOutput,
  type SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  acceptancePath,
  acceptanceSupportPaths,
  authorityPaths,
  cloudContractPath,
  cloudCredentialPath,
  cloudWorkerPath,
  gatewayConversationTitlePath,
  gatewayExecutionProfilePath,
  pluginPaths,
  profilePath,
  removedSecondChainPaths,
  schedulerPath,
  schemaPath,
  storePath,
} from "./inspector-paths.js";
import { inspectXuanxueRecoveryDurability } from "./inspect-recovery-durability.js";
import {
  collectXuanxueSourceValues,
  inspectXuanxueLocalIntervention,
} from "./components/local-intervention-inspector.js";

type Laws = {
  boundary: string;
  durability: string;
  cloud: string;
  intervention: string;
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

const sourceContainsDetachedProviderPreflightMarker = (
  sourceFile: SourceFile,
): boolean => {
  const markers = [
    "provider-input-preflight",
    "provider_input_preflight",
    "preflightApprovedWebChatFiles",
    "bytes_base64",
  ];
  const values = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => String(node.compilerNode.escapedText)),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle)
      .map((node) => node.getLiteralText()),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail)
      .map((node) => node.getLiteralText()),
  ];
  return markers.some((marker) => values.some((value) => value.indexOf(marker) >= 0));
};

const inspectRemovedSecondChain = (
  context: InspectorContext,
  findings: InspectorFinding[],
  boundaryLaw: string,
): void => {
  for (const filePath of removedSecondChainPaths) {
    if (!existsSync(resolveFromRepo(filePath))) continue;
    findings.push(finding(
      boundaryLaw,
      "xuanxue-ai-production/no-detached-provider-preflight",
      filePath,
      `${filePath} must remain physically deleted.`,
    ));
  }
  for (const filePath of [
    "src/app/workbench-xuanxue-ai-production-routes.ts",
    "src/app/workbench-api-boundary.ts",
    "src/app/create-workbench-server.ts",
    "src/capabilities/ai-input-gateway/contract.ts",
    "src/capabilities/ai-input-gateway/ability-group.ts",
    cloudContractPath,
  ]) {
    const file = resolveFromRepo(filePath);
    if (!existsSync(file)) continue;
    const sourceFile = context.project.getSourceFile(file);
    if (!sourceFile || !sourceContainsDetachedProviderPreflightMarker(sourceFile)) continue;
    findings.push(finding(
      boundaryLaw,
      "xuanxue-ai-production/no-detached-provider-preflight",
      filePath,
      `${filePath} must not retain the detached provider preflight chain.`,
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
      "xuanxue-ai-production-v4",
      "bazi_chart_interpretation",
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
      "localization_report_translation",
      "localization_article_translation",
      "localization_static_review_candidate",
      "localization_static_review_selector",
      "scheduled_quality_reflection",
      "candidate_a",
      "candidate_b",
      "selector_first",
      "selector_swap",
      "consistency",
      "article_image_generation",
      "chart_interpretation",
      "frozenSubject",
      "conversationScopeRef",
      "conversationParent",
      "joinParents",
      "forked_from_checkpoint",
      "same_conversation",
      "generated_image",
      "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION",
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
      "conversationParent",
      "joinParents",
      "XUANXUE_AI_PRODUCTION_FORK_PARENT_REQUIRED",
      "XUANXUE_AI_PRODUCTION_TYPED_JOIN_PARENT_MISMATCH",
      "XUANXUE_AI_PRODUCTION_HEHUN_THREE_CONTEXTS_REQUIRED",
      "XUANXUE_AI_PRODUCTION_SEEDED_STAGE_PROOF_INVALID",
      "xuanxueAiPaidFollowupProfiles",
      "xuanxueAiReusableBaseConsumerProfiles",
      "xuanxueAiRequiredContinuationProfiles",
      "isXuanxueAiPaidFollowupProduct",
      "isXuanxueAiRequiredContinuationProduct",
      "XUANXUE_AI_PRODUCTION_CONTINUATION_STAGE_INVALID",
      "XUANXUE_AI_PRODUCTION_CONVERSATION_CHAIN_INVALID",
      "localization_report_translation",
      "localization_article_translation",
      "localization_static_review_candidate",
      "localization_static_review_selector",
      "candidate_a",
      "candidate_b",
      "selector_first",
      "selector_swap",
      "consistency",
    ],
  });
  requireValues(findings, {
    lawId: laws.boundary,
    checkId: "xuanxue-ai-production/live-model-identity",
    filePath: gatewayExecutionProfilePath,
    messagePrefix: "Provider execution profile control must contain",
    values,
    required: [
      "enforceGptWebExecutionProfile",
      "provider_ui_observation",
      "providerExecutionProfileProof",
      "gpt-web-execution-profile.v1",
      "extra_high",
      "pro_standard",
      "pro_extended",
      "GPT-5.6 Sol",
      "assertStableWebChatDocument",
      "GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH",
    ],
  });
  requireValues(findings, {
    lawId: laws.boundary,
    checkId: "xuanxue-ai-production/conversation-title-finalization",
    filePath: gatewayConversationTitlePath,
    messagePrefix: "Provider title finalization must contain",
    values,
    required: [
      "finalizeGptWebConversationTitle",
      "runExclusivePatrol",
      "conversationTitleProof",
      "canonicalConversationUrl",
      "gpt-web-title-policy.v1",
      "title_finalization_pending",
    ],
  });
};

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
      "repairInvalidCompletedStageOutputs",
      "invalid_completed_stage_restarted",
      "requestHash",
      "recoverMissingRequiredContinuationParents",
      "trustedGeneratedFileCount",
      "followup_parent_replay_requested",
      "production_parent_conversation_rebuilds",
      "parent_conversation_rebuild_recorded",
      "resetOrderForConversationGraphRebuild",
      "conversation_graph_rebuild_started",
      "replay_from_first_stage_in_one_new_conversation",
      "recordParentConversationRebuild",
      "stage_fresh_execution_restarted",
      "XUANXUE_AI_PRODUCTION_OUTPUT_PROVIDER_FAILURE_ANSWER",
      "supersededExecutionId",
      "a recoverable transport failure must retain one execution id so a captured turn can never be resubmitted",
      "a submitted turn interrupted by a second physical monitor tab must resume the same execution without another logical submission",
      "hasProvenTerminalPreSubmitIdentityConflict",
      "a still-hydrating fresh root is a recoverable wait on the same execution id",
      "a stage may replace one proven foreign pre-submit identity only once",
      "a second identity conflict must recover on the replacement execution instead of minting restart:2",
      "XUANXUE_AI_PRODUCTION_LOCALIZATION_PROVIDER_EVIDENCE_MISSING",
      "providerTranscriptJsonl",
      "modelIdentityProof",
      "providerExecutionProfileProof",
      "conversationTitleProof",
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
    candidate.getFilePath().includes("/src/plugins/xuanxue-ai-production/"));
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
      "frozen_subject",
      "conversation_scope_ref",
      "join_parents",
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
      "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION",
      "attachment_upload_proof",
      "XuanxueAiProductionAttachmentCheckpointProof",
      "stage_attachment_upload_proof",
      "onAttachmentUploadCompleted",
      "XUANXUE_AI_PRODUCTION_ATTACHMENT_CHECKPOINT_DEFERRED",
    ],
  });
  requireValues(findings, {
    lawId: cloudLaw,
    checkId: "xuanxue-ai-production/credential-permissions",
    filePath: cloudCredentialPath,
    messagePrefix: "Local device credential enforcement must contain",
    values,
    required: ["XUANXUE_AI_PRODUCTION_CREDENTIAL_PERMISSIONS_INVALID", "0o600"],
  });
};

const inspectAcceptance = (
  context: InspectorContext,
  findings: InspectorFinding[],
  durabilityLaw: string,
): void => {
  const acceptance = [acceptancePath, ...acceptanceSupportPaths].flatMap((filePath) => {
    const result = source(context, findings, durabilityLaw, filePath);
    return result ? [result] : [];
  });
  if (acceptance.length === 0) return;
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/acceptance",
    filePath: acceptancePath,
    messagePrefix: "Production acceptance must prove",
    values: collectXuanxueSourceValues(acceptance),
    required: [
      "maxActive",
      "the eleventh order must remain outside the ten-order production window",
      "providerForkRef",
      "providerContinuationRef",
      "forked_from_checkpoint",
      "typed_participant_private_base",
      "bazi_chart_interpretation",
      "listCloudRecoveryOrders",
      "payment_screenshot_observation",
      "public_knowledge_article_pipeline",
      "a paid follow-up without an exact parent must never reach GPT",
      "orders sharing one parent GPT conversation must be serialized",
      "same-parent follow-ups must preserve FIFO order",
      "restart must retire an invalid completed prefix and every downstream node",
      "a recoverable transport failure must retain one execution id so a captured turn can never be resubmitted",
      "a missing parent chat must replay the parent first, then ask the follow-up",
      "a cloud replay package must reconstruct an absent local parent before the follow-up",
      "QUESTION_A_ONLY",
      "person:naming-aux-4",
      "continuation_parent_replay",
      "a cloud-cancelled order must preserve completed evidence and leave restart reconciliation",
      "article_image_generation",
      "scheduled_quality_reflection",
      "localization_report_translation",
      "localization_article_translation",
      "localization_static_review_candidate",
      "localization_static_review_selector",
      "candidate_a",
      "candidate_b",
      "selector_first",
      "selector_swap",
      "consistency",
      "providerTranscriptJsonl",
      "modelIdentityProof",
    ],
  });
};

const inspectDomainEvaluation = async (
  context: InspectorContext,
): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const laws: Laws = {
    boundary: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-001-V5",
    ),
    durability: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-002-V5",
    ),
    cloud: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-003-V2",
    ),
    intervention: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-004-V1",
    ),
  };
  const findings: InspectorFinding[] = [];
  inspectAuthority(findings, laws.boundary);
  inspectRemovedSecondChain(context, findings, laws.boundary);
  const sources = pluginPaths.flatMap((filePath) => {
    const result = source(context, findings, laws.boundary, filePath);
    return result ? [result] : [];
  });
  const acceptanceSources = [acceptancePath, ...acceptanceSupportPaths]
    .map((filePath) => context.project.getSourceFile(resolveFromRepo(filePath)))
    .filter((file): file is SourceFile => file !== undefined);
  const values = collectXuanxueSourceValues([...sources, ...acceptanceSources]);
  inspectContracts(findings, laws, values);
  inspectXuanxueRecoveryDurability(context, findings, laws.durability, values);
  inspectDurability(findings, laws.durability, values);
  inspectPluginBoundaries(findings, laws, sources);
  inspectCloud(findings, laws.cloud, values);
  inspectXuanxueLocalIntervention({
    context,
    findings,
    lawId: laws.intervention,
    values,
  });
  inspectAcceptance(context, findings, laws.durability);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...authorityPaths, ...pluginPaths],
  };
};

export const inspectDomain = async (
  context: InspectorContext,
): Promise<SessionInspectorOutput> => {
  if (!context.checks) {
    throw new Error("xuanxue-ai-production requires a runner-owned check session.");
  }
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
