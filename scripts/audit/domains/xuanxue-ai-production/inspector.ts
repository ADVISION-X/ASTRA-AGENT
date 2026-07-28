import { existsSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import {
  executedChecksForPlan,
  type InspectorContext,
  type InspectorFinding,
  type InspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const authorityPaths = [
  ".github/instructions/agent-rules/modules/module-xuanxue-ai-production.instructions.md",
  "docs/法案辅助文件/GrassEye 玄学 AI 生产工厂施工图.md",
  "scripts/audit/domains/xuanxue-ai-production/manifest.json",
] as const;

const schemaPath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.schema.ts";
const profilePath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.profile.ts";
const storePath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.store.ts";
const schedulerPath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.scheduler.ts";
const cloudContractPath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.ts";
const cloudCredentialPath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-credential.ts";
const cloudWorkerPath =
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts";
const acceptancePath =
  "scripts/acceptance/xuanxue-ai-production.acceptance.ts";

const pluginPaths = [
  "src/plugins/xuanxue-ai-production/index.ts",
  schemaPath,
  profilePath,
  storePath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.runtime.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-feed.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production.flow.ts",
  schedulerPath,
  cloudContractPath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-client.ts",
  cloudCredentialPath,
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-enrollment.ts",
  "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-staging.ts",
  cloudWorkerPath,
  "src/lib/local-runtime/workbench-xuanxue-ai-production-support.ts",
  "scripts/startup/xuanxue-ai-production-cloud-enroll.ts",
  acceptancePath,
] as const;

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
      "xuanxue-ai-production-v1",
      "bazi_ai_full_analysis",
      "bazi_report_followup",
      "qimen_professional_answer",
      "qimen_report_followup",
      "hehun_ai_analysis",
      "hehun_report_followup",
      "naming_bazi_analysis_and_naming",
      "naming_from_existing_bazi_report",
      "manual_accuracy_challenge",
      "payment_screenshot_observation",
      "public_knowledge_article_pipeline",
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
      "requestHash",
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
      "resumeRecoverableOrders",
      "scheduled",
      "waiting",
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
  const acceptance = source(
    context,
    findings,
    durabilityLaw,
    acceptancePath,
  );
  if (!acceptance) return;
  requireValues(findings, {
    lawId: durabilityLaw,
    checkId: "xuanxue-ai-production/acceptance",
    filePath: acceptancePath,
    messagePrefix: "Production acceptance must prove",
    values: sourceValues([acceptance]),
    required: [
      "maxActive",
      "the eleventh order must remain outside the ten-order production window",
      "providerContinuationRef",
      "resumeRecoverableOrders",
      "ORDER_IDENTITY_CONFLICT",
      "a seeded base response must not be submitted to GPT again",
      "payment_screenshot_observation",
      "public_knowledge_article_pipeline",
    ],
  });
};

export const inspectDomain = async (
  context: InspectorContext,
): Promise<InspectorOutput> => {
  const laws: Laws = {
    boundary: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-001-V1",
    ),
    durability: selectLawId(
      context.planEntry.lawIds,
      "GRASSEYE-XUANXUE-AI-PRODUCTION-002-V1",
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
