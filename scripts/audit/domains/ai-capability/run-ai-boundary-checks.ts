import { SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { createFinding } from "../../core/result.js";
import { toRepoRelativePath } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";
import { hasIdentifier } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasImportModuleSpecifier } from "../_shared/ast-helpers.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";
import { hasForbiddenEscape } from "./forbidden-escape.js";

const { AI_ROOT, DISABLED_CHILD_GATEWAY_IDS, FORBIDDEN_IMPORT_SEGMENTS, REQUIRED_ADAPTER_TOKENS } = aiInspectionConstants;
const {
  getAiSources,
  getImportSpecifierText,
  getSourceOrThrow,
  hasDynamicImportOrRequire,
  hasForbiddenRecordAssertion,
  hasNewDateOutsideClock,
} = aiInspectionUtils;

const ACTION_OWNER_PREFIXES = [
  "src/capabilities/open/",
  "src/capabilities/screenshot/",
  "src/capabilities/mouse-click/",
  "src/capabilities/mouse-scroll/",
  "src/capabilities/geometry-guard/",
  "src/capabilities/page-state/",
  "src/capabilities/forensics-persistence/",
] as const;

const findAiSourceBoundaryViolations = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const sourceFile of getAiSources(project)) {
    findings.push(...inspectSingleAiSource(sourceFile));
  }
  return findings;
};

const inspectSingleAiSource = (sourceFile: SourceFile): Finding[] => {
  const repoPath = toRepoRelativePath(sourceFile.getFilePath());
  const findings: Finding[] = [];

  if (repoPath !== `${AI_ROOT}/runtime/ai-clock.ts` && hasNewDateOutsideClock(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-003-V1", file: repoPath, line: 1, severity: "fatal", message: "AI package must source time exclusively from ai-clock-port." }));
  }
  if (hasForbiddenEscape(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: repoPath, line: 1, severity: "fatal", message: "AI package contains forbidden type-escape or suppression syntax." }));
  }
  if (hasForbiddenRecordAssertion(sourceFile, repoPath)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: repoPath, line: 1, severity: "fatal", message: "Record<string, unknown> assertions are only allowed inside the dispatch failure envelope raw parser." }));
  }
  if (hasDynamicImportOrRequire(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-006-V1", file: repoPath, line: 1, severity: "fatal", message: "AI package must not use dynamic import or require." }));
  }
  if (FORBIDDEN_IMPORT_SEGMENTS.some((segment) => hasImportModuleSpecifier(sourceFile, segment))) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "AI capability boundary must not import platform-action or action-capability owners." }));
  }
  if (resolvesActionOwnerImport(sourceFile)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "AI capability boundary must not resolve imports into action-capability owners." }));
  }

  return findings;
};

const resolvesActionOwnerImport = (sourceFile: SourceFile): boolean => {
  return sourceFile.getImportDeclarations().some((importDeclaration) => {
    const resolved = importDeclaration.getModuleSpecifierSourceFile();
    if (!resolved) {
      return false;
    }
    const resolvedPath = toRepoRelativePath(resolved.getFilePath());
    return ACTION_OWNER_PREFIXES.some((prefix) => resolvedPath.startsWith(prefix));
  });
};

const findGatewayIsolationViolations = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const childId of DISABLED_CHILD_GATEWAY_IDS) {
    const source = getSourceOrThrow(project, `${AI_ROOT}/children/${childId}/implementation.ts`);
    if (!hasImportModuleSpecifier(source, "local-ai-gateway")) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-005B-V2", file: `${AI_ROOT}/children/${childId}/implementation.ts`, line: 1, severity: "fatal", message: "Internal/paid/future children must not import LocalAiGateway." }));
  }
  return findings;
};

const findAdapterBoundaryViolations = (project: Project): Finding[] => {
  const adapterSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`);
  const gatewaySource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-gateway.ts`);
  const outputSource = getSourceOrThrow(project, `${AI_ROOT}/runtime-adapters/local-ai-runtime-output.ts`);
  const findings: Finding[] = [];

  if (!hasImportModuleSpecifier(adapterSource, "local-ai-gateway")) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-AI-RUNTIME-001-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Local AI gateway access must stay isolated inside the local runtime adapter." }));
  }
  if (!hasAllAdapterTokens([adapterSource, gatewaySource, outputSource])) {
    findings.push(createFinding({ lawId: "GRASSEYE-LOCAL-AI-RUNTIME-002-V1", file: `${AI_ROOT}/runtime-adapters/local-ai-runtime-adapter.ts`, line: 1, severity: "fatal", message: "Local AI adapter must preserve protection and evidence tokens across adapter files." }));
  }

  return findings;
};

const hasAllAdapterTokens = (sources: SourceFile[]): boolean => {
  return REQUIRED_ADAPTER_TOKENS.every((token) => sources.some((source) => hasIdentifier(source, token) || hasImportModuleSpecifier(source, token) || hasCallExpression(source, token)));
};

const findExternalPrivateImportViolations = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const repoPath = toRepoRelativePath(sourceFile.getFilePath());
    if (repoPath.startsWith(`${AI_ROOT}/`) || repoPath.startsWith("scripts/audit/domains/ai-capability/")) {
      continue;
    }
    if (!importsAiPrivatePath(sourceFile)) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-001-V1", file: repoPath, line: 1, severity: "fatal", message: "External modules must not import AI children or runtime internals." }));
  }
  return findings;
};

const importsAiPrivatePath = (sourceFile: SourceFile): boolean => {
  return sourceFile.getImportDeclarations().some((importDeclaration) => {
    const specifier = getImportSpecifierText(importDeclaration);
    return specifier.includes("capabilities/ai/children/") || specifier.includes("capabilities/ai/runtime/");
  });
};

export function runAiBoundaryChecks(project: Project): Finding[] {
  return [
    ...findAiSourceBoundaryViolations(project),
    ...findGatewayIsolationViolations(project),
    ...findAdapterBoundaryViolations(project),
    ...findExternalPrivateImportViolations(project),
  ];
}