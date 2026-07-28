import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import {
  executedChecksForPlan,
  type InspectorContext,
  type InspectorFinding,
  type InspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const lawId = "GRASSEYE-XUANYUAN-001-V3";
const acceptancePath = "scripts/acceptance/xuanyuan.acceptance.ts";
const recoveryAcceptancePath =
  "scripts/acceptance/xuanyuan-recovery.acceptance-helper.ts";
const sourcePaths = [
  "src/plugins/xuanyuan/index.ts",
  "src/plugins/xuanyuan/xuanyuan.schema.ts",
  "src/plugins/xuanyuan/xuanyuan.flow.ts",
  "src/plugins/xuanyuan/xuanyuan.store.ts",
  "src/plugins/xuanyuan/xuanyuan.task.ts",
  "src/plugins/xuanyuan/xuanyuan.queue.ts",
  "src/plugins/xuanyuan/xuanyuan-queue-owner.ts",
  "src/plugins/xuanyuan/xuanyuan-task-identity.ts",
  "src/plugins/xuanyuan/xuanyuan.workbench.ts",
  "src/app/workbench-xuanyuan-routes.ts",
] as const;
const authorityPaths = [
  ".github/instructions/agent-rules/modules/module-xuanyuan.instructions.md",
  "docs/法案辅助文件/GrassEye Xuanyuan 受控本地执行施工图.md",
  "scripts/audit/domains/xuanyuan/manifest.json",
  acceptancePath,
  recoveryAcceptancePath,
  "package.json",
] as const;
const removedCloudPaths = [
  "src/plugins/xuanyuan/xuanyuan-cloud-client.ts",
  "src/plugins/xuanyuan/xuanyuan-cloud-contract.ts",
  "src/plugins/xuanyuan/xuanyuan-cloud-credential.ts",
  "src/plugins/xuanyuan/xuanyuan-cloud-enrollment.ts",
  "src/plugins/xuanyuan/xuanyuan-cloud-staging.ts",
  "src/plugins/xuanyuan/xuanyuan-cloud-worker.ts",
  "src/lib/local-runtime/workbench-xuanyuan-cloud-support.ts",
  "scripts/startup/xuanyuan-cloud-enroll.ts",
  "scripts/acceptance/xuanyuan-cloud-worker.acceptance.ts",
] as const;

const finding = (
  checkId: string,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({ checkId, lawId, filePath, message });

const values = (files: readonly SourceFile[]): Set<string> => new Set(
  files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier)
      .map((node) => node.getText()),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((node) => node.getLiteralText()),
  ]),
);

const loadSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
): SourceFile[] => sourcePaths.flatMap((filePath) => {
  const source = context.project.getSourceFile(resolveFromRepo(filePath));
  if (source) return [source];
  findings.push(finding(
    "xuanyuan/file-present",
    filePath,
    `${filePath} must exist.`,
  ));
  return [];
});

const inspectFileRegions = (findings: InspectorFinding[]): void => {
  for (const filePath of authorityPaths) {
    if (existsSync(resolveFromRepo(filePath))) continue;
    findings.push(finding(
      "xuanyuan/file-present",
      filePath,
      `${filePath} must exist.`,
    ));
  }
  for (const filePath of removedCloudPaths) {
    if (!existsSync(resolveFromRepo(filePath))) continue;
    findings.push(finding(
      "xuanyuan/removed-cloud-region",
      filePath,
      `${filePath} must remain deleted; cloud production belongs to xuanxue-ai-production.`,
    ));
  }
};

const requireValues = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    filePath: string;
    messagePrefix: string;
    sourceValues: ReadonlySet<string>;
    required: readonly string[];
  },
): void => {
  for (const required of input.required) {
    if (input.sourceValues.has(required)) continue;
    findings.push(finding(
      input.checkId,
      input.filePath,
      `${input.messagePrefix} ${required}.`,
    ));
  }
};

const inspectTaskContract = (
  findings: InspectorFinding[],
  sourceValues: ReadonlySet<string>,
): void => {
  requireValues(findings, {
    checkId: "xuanyuan/ast-contract",
    filePath: "src/plugins/xuanyuan/xuanyuan.flow.ts",
    messagePrefix: "Xuanyuan generic task contract must contain",
    sourceValues,
    required: [
      "XUANYUAN_JOB_ID",
      "createXuanyuanTaskCoordinator",
      "createXuanyuanTask",
      "XUANYUAN_REQUEST_IDENTITY_CONFLICT",
      "recovery_pending",
      "resume_exact_provider_conversation",
      "rawResponseText",
      "providerProof",
      "/api/xuanyuan/simulate",
      "/api/xuanyuan/status",
      "/api/xuanyuan/latest",
      "/api/xuanyuan/history",
    ],
  });
  requireValues(findings, {
    checkId: "xuanyuan/durable-recovery",
    filePath: "src/plugins/xuanyuan/xuanyuan.schema.ts",
    messagePrefix: "Xuanyuan durable recovery must contain",
    sourceValues,
    required: [
      "attemptCount",
      "lastFailureReason",
      "nextRetryAt",
      "recoverable",
      "executionId",
    ],
  });
};

const inspectProviderBoundary = (
  findings: InspectorFinding[],
  sources: readonly SourceFile[],
): void => {
  const forbiddenFragments = [
    "ai-input-gateway/providers",
    "lib/browser",
    "dom-automation",
    "openai",
    "gemini",
    "chatgpt",
  ];
  const pluginSources = sources.filter((candidate) =>
    candidate.getFilePath().includes("/src/plugins/xuanyuan/"));
  for (const source of pluginSources) {
    for (const declaration of source.getImportDeclarations()) {
      const specifier = declaration.getModuleSpecifierValue().toLowerCase();
      if (!forbiddenFragments.some((fragment) =>
        specifier.includes(fragment))) continue;
      findings.push(finding(
        "xuanyuan/forbidden-provider-import",
        source.getFilePath(),
        `Xuanyuan must not import ${specifier}.`,
      ));
    }
  }
};

const inspectAcceptance = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const acceptanceSources = [
    acceptancePath,
    recoveryAcceptancePath,
  ].flatMap((filePath) => {
    const source = context.project.getSourceFile(resolveFromRepo(filePath));
    return source ? [source] : [];
  });
  requireValues(findings, {
    checkId: "xuanyuan/acceptance",
    filePath: acceptancePath,
    messagePrefix: "Xuanyuan acceptance must execute",
    sourceValues: values(acceptanceSources),
    required: [
      "idempotentReplay",
      "recoveryPending",
      "resumedCoordinator",
      "automaticallyRecovered",
    ],
  });
};

const inspectPackageScripts = (findings: InspectorFinding[]): void => {
  const packageJson = JSON.parse(
    readFileSync(resolveFromRepo("package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };
  for (const name of ["acceptance:xuanyuan", "audit:xuanyuan"]) {
    if (packageJson.scripts?.[name]) continue;
    findings.push(finding(
      "xuanyuan/package-script",
      "package.json",
      `package.json must expose ${name}.`,
    ));
  }
  if (!packageJson.scripts?.["xuanyuan:cloud:enroll"]) return;
  findings.push(finding(
    "xuanyuan/removed-cloud-region",
    "package.json",
    "The former xuanyuan:cloud:enroll command must remain removed.",
  ));
};

export const inspectDomain = async (
  context: InspectorContext,
): Promise<InspectorOutput> => {
  const findings: InspectorFinding[] = [];
  const sources = loadSources(context, findings);
  inspectFileRegions(findings);
  inspectTaskContract(findings, values(sources));
  inspectProviderBoundary(findings, sources);
  inspectAcceptance(context, findings);
  inspectPackageScripts(findings);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...authorityPaths, ...sourcePaths, ...removedCloudPaths],
  };
};
