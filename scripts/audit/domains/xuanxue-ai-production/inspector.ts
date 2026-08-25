import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import {
  type InspectorContext,
  type InspectorEvaluation,
  type InspectorFinding,
  type SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { finalizeStaticInspection } from "../../shared/static-inspector-result.js";
import {
  cloudContractPath,
  cloudCredentialPath,
  cloudWorkerPath,
  pluginPaths,
  schedulerPath,
  schemaPath,
  schemaRefinementsPath,
  storedOrderQuarantinePath,
  storePath,
} from "./inspector-paths.js";
import { inspectXuanxueRecoveryDurability } from "./inspect-recovery-durability.js";
import { inspectXuanxueContracts } from "./inspect-contracts.js";
import {
  arrowReturnsNumber,
  workerEnforcesTenBusinessSlots,
  workerReconcilesChangedLocalVersions,
} from "./inspect-continuous-recovery.js";
import { inspectTransientLifecycleBehavior } from "./components/transient-material-lifecycle-inspector.js";
import { inspectXuanxueBoundary } from "./components/boundary-inspector.js";
import {
  collectXuanxueSourceValues,
  inspectXuanxueLocalIntervention,
} from "./components/local-intervention-inspector.js";
import {
  inspectSubmissionAdmissionBinding,
} from "./inspect-submission-admission.js";

type Laws = {
  boundary: string;
  durability: string;
  cloud: string;
  intervention: string;
  transient: string;
};

const finding = (
  lawId: string,
  checkId: string,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({
  lawId,
  clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
  checkId,
  filePath,
  message,
});

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

const inspectDurableLedger = (
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => requireValues(findings, {
  lawId,
  checkId: "xuanxue-ai-production/durable-ledger",
  filePath: storedOrderQuarantinePath,
  messagePrefix: "SQLite production ledger must contain",
  values,
  required: [
    "production_orders", "production_stages", "production_events",
    "journal_mode = WAL", "listRecoverableOrders", "listCloudRecoveryOrders",
    "quarantineInvalidStoredOrders", "stored_order_contract_quarantined",
    "XUANXUE_AI_PRODUCTION_STORED_ORDER_CONTRACT_INVALID",
    "quarantineInvalidCompletedStageOutputs", "invalid_completed_stage_quarantined",
    "requestHash", "trustedGeneratedFileCount",
    "preserve_invalid_output_and_require_operator_review",
    "stage_continuation_operator_recovery_required",
    "XUANXUE_AI_PRODUCTION_OUTPUT_PROVIDER_FAILURE_ANSWER", "supersededExecutionId",
    "providerTranscriptJsonl", "modelIdentityProof", "providerExecutionProfileProof",
    "conversationTitleProof",
    "xuanxueAiProductionLocalRecoveryVersion",
    "reconcileXuanxueAiProductionLocalNonterminalLedger",
    "reconcileLocalNonterminalLedger", "createdAt", "takeNextRunnableOrderId",
  ],
});

const inspectDurability = (
  findings: InspectorFinding[],
  durabilityLaw: string,
  values: ReadonlySet<string>,
  terminalMetaphysicsProfileValues: ReadonlySet<string>,
): void => {
  inspectDurableLedger(findings, durabilityLaw, values);
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/bounded-coordinator",
    filePath: schedulerPath,
    messagePrefix: "Bounded production coordinator must contain",
    values,
    required: [
      "XuanxueAiProductionCoordinator",
      "resolveXuanxueAiProductionWindow",
      "availableCapacity",
      "scheduled",
      "waiting",
      "activeContinuationLanes",
      "webChatUrl",
      "exactUrl",
      "parentStage",
      "order_parent_lane_deferred",
      "order_internal_defect_deferred",
    ],
  });
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/browser-outcome-resolution",
    filePath: "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts",
    messagePrefix: "Owning Plugin attachment outcome resolution must contain",
    values,
    required: [
      "resolveAttachmentMutations",
      "resolvePendingMutation",
      "assertNoPendingMutations",
      "positiveEvidenceRef",
      "negativeEvidenceRef",
      "TERMINAL_SUCCESS",
      "attachments_stable",
      "adjacent-states-excluded",
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

const inspectCloudLeaseBinding = (
  findings: InspectorFinding[], cloudLaw: string, values: ReadonlySet<string>,
): void => requireValues(findings, {
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
      "continuation_parent_replay",
      "frozen_subject",
      "conversation_scope_ref",
      "join_parents",
      "parentReplay",
    ],
  });

const inspectCloud = (
  context: InspectorContext,
  findings: InspectorFinding[],
  cloudLaw: string,
  values: ReadonlySet<string>,
): void => {
  inspectCloudLeaseBinding(findings, cloudLaw, values);
  const scheduler = source(context, findings, cloudLaw, schedulerPath);
  const worker = source(context, findings, cloudLaw, cloudWorkerPath);
  if (!arrowReturnsNumber(scheduler, "resolveXuanxueAiProductionWindow", 10)
    || !workerEnforcesTenBusinessSlots(worker)) {
    findings.push(finding(
      cloudLaw,
      "xuanxue-ai-production/exact-business-capacity",
      cloudWorkerPath,
      "Cloud Worker, local coordinator, and credential must enforce exactly ten business in-flight slots without collapsing Browser serialization into one business slot.",
    ));
  }
  if (!workerReconcilesChangedLocalVersions(worker)) {
    findings.push(finding(
      cloudLaw,
      "xuanxue-ai-production/continuous-local-ledger-reconciliation",
      cloudWorkerPath,
      "Every worker poll must execute local nonterminal ledger reconciliation and commit each changed attempt/status/checkpoint version only after the real reconciliation call.",
    ));
  }
  requireValues(findings, {
    lawId: cloudLaw,
    checkId: "xuanxue-ai-production/cloud-capacity",
    filePath: cloudWorkerPath,
    messagePrefix: "Cloud claiming must be bounded by",
    values,
    required: [
      "available",
      "availableCapacity",
      "active",
      "reconcileLocalNonterminalLedger",
      "cancelCloudRecoveryOrder",
      "cloud_cancelled_order_settled",
      "XUANXUE_AI_PRODUCTION_PROVIDER_INPUT_BLOCKED_BEFORE_SUBMISSION",
      "XuanxueAiProductionAttachmentCheckpointProof",
      "stage_attachment_upload_proof",
      "onAttachmentUploadCompleted",
      "XUANXUE_AI_PRODUCTION_ATTACHMENT_CHECKPOINT_DEFERRED",
      "isRecoverableCloudWorkerFailure",
      "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
      "BROWSER_LIVENESS_EXPIRED",
      "BROWSER_SESSION_WORKSPACE_REQUIRED",
      "BROWSER_SESSION_WORKSPACE_REVOKED",
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

const resolveLaws = (context: InspectorContext): Laws => ({
  boundary: selectLawId(context.planEntry.lawIds, "LAW-XUANXUE-AI-PRODUCTION-001-V9"),
  durability: selectLawId(context.planEntry.lawIds, "LAW-XUANXUE-AI-PRODUCTION-001-V9"),
  cloud: selectLawId(context.planEntry.lawIds, "LAW-XUANXUE-AI-PRODUCTION-001-V9"),
  intervention: selectLawId(context.planEntry.lawIds, "LAW-XUANXUE-AI-PRODUCTION-001-V9"),
  transient: selectLawId(context.planEntry.lawIds, "LAW-XUANXUE-AI-PRODUCTION-001-V9"),
});

const collectDomainSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  boundaryLaw: string,
): { sources: SourceFile[]; values: ReadonlySet<string> } => {
  const sources = pluginPaths
    .filter((filePath) => context.targetPaths.includes(filePath))
    .flatMap((filePath) => {
    const result = source(context, findings, boundaryLaw, filePath);
    return result ? [result] : [];
  });
  return { sources, values: collectXuanxueSourceValues(sources) };
};

const inspectTransientLifecycleContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  values: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    lawId,
    checkId: "xuanxue-ai-production/transient-material-lifecycle",
    filePath: cloudWorkerPath,
    messagePrefix: "Transient material lifecycle must contain",
    values,
    required: [
      "cloud-staging", "generated-inputs", "cleanXuanxueAiProductionCloudStaging",
      "cleanXuanxueAiProductionGeneratedInputs", "recovery_pending",
      "XUANXUE_AI_PRODUCTION_FAILURE_REPORT_DEFERRED",
      "reconcileXuanxueAiProductionGeneratedInputOrphans", "canRebuildDerivedInputs",
    ],
  });
  inspectTransientLifecycleBehavior(context, findings, lawId);
};

const inspectDomainPolicy = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: Laws,
  sources: SourceFile[],
  values: ReadonlySet<string>,
  terminalMetaphysicsProfileValues: ReadonlySet<string>,
): void => {
  inspectXuanxueBoundary(context, findings, laws.boundary);
  inspectXuanxueContracts(
    findings,
    laws.boundary,
    values,
    terminalMetaphysicsProfileValues,
  );
  inspectXuanxueRecoveryDurability(context, findings, laws.durability, values);
  inspectDurability(
    findings,
    laws.durability,
    values,
    terminalMetaphysicsProfileValues,
  );
  inspectPluginBoundaries(findings, laws, sources);
  inspectCloud(context, findings, laws.cloud, values);
  inspectXuanxueLocalIntervention({ context, findings, lawId: laws.intervention, values });
  inspectTransientLifecycleContract(context, findings, laws.transient, values);
  inspectSubmissionAdmissionBinding(context, findings, laws.durability);
};

const inspectDomainEvaluation = async (
  context: InspectorContext,
): Promise<InspectorEvaluation> => {
  const laws = resolveLaws(context);
  const findings: InspectorFinding[] = [];
  const { sources, values } = collectDomainSources(context, findings, laws.boundary);
  const terminalMetaphysicsProfileSources = [schemaPath, schemaRefinementsPath, "src/plugins/xuanxue-ai-production/xuanxue-ai-production-terminal-profile.ts", "src/plugins/xuanxue-ai-production/xuanxue-ai-production-stage-execution.ts", "src/plugins/xuanxue-ai-production/xuanxue-ai-production-provider-evidence.ts"]
    .map((filePath) => context.project.getSourceFile(resolveFromRepo(filePath)))
    .filter((file): file is SourceFile => file !== undefined);
  inspectDomainPolicy(context, findings, laws, sources, values, collectXuanxueSourceValues(terminalMetaphysicsProfileSources));
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (
  context: InspectorContext,
): Promise<SessionInspectorOutput> => {
  return finalizeStaticInspection(context, [{
    lawId: "LAW-XUANXUE-AI-PRODUCTION-001-V9", semanticDigest: "186dd6b33b13b8ad3c9d12450981265c3650a50d283404c5eb7083b1d91c1728",
  }], inspectDomainEvaluation);
};
