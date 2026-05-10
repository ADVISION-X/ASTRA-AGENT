import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists } from "../../../core/filesystem.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";

const RETIRED_MAP_LAW_ID = "GRASSEYE-CODE-PURITY-MAP-RETIREMENT-001-V1";

const FORBIDDEN_ACTIVE_PATHS = [
  "src/map-plugins",
  "scripts/audit/domains/map-plugin-package",
  "docs/法案辅助文件/GrassEye 地图插件包治理施工图.md",
  "docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md",
  "docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图_FINAL.md",
] as const;

const FORBIDDEN_IDENTIFIER_TOKENS = [
  "routePlanId",
  "selectedMapId",
  "taskTemplateId",
  "routeLabel",
  "mapPackage",
  "operationalMap",
  "routePlanBoundMap",
  "genericDiagnosticMap",
  "MapAuthoring",
  "MapPlugin",
  "activeMapRegistry",
] as const;

const START_CHAIN_PATH_PREFIXES = [
  "src/app/",
  "src/lib/local-app-shell/",
  "src/lib/local-runtime/",
  "src/capabilities/orchestration/",
  "src/capabilities/ai/",
  "scripts/",
] as const;

const LEGACY_UI_TOKENS = [
  "TaskTemplateLauncher",
  "地图库",
  "任务模板",
  "选择地图",
  "地图工坊",
  "推荐地图",
  "可启动地图",
] as const;

const SKIPPED_PATH_PREFIXES = [
  "docs/archive/retired-map-system/",
  "docs/archive/",
  "docs/归档/",
  "src/map-plugins/",
  "scripts/audit/domains/map-plugin-package/",
] as const;

const isSkippedPath = (relativePath: string): boolean => SKIPPED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const isStartChainPath = (relativePath: string): boolean => START_CHAIN_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const createRetiredMapFinding = (input: {
  file: string;
  line: number;
  message: string;
  detail?: string;
  recommendedAction: string;
}): Finding => createFinding({
  lawId: RETIRED_MAP_LAW_ID,
  file: input.file,
  line: input.line,
  severity: "fatal",
  message: input.message,
  detail: input.detail,
  zombieKind: "retired-map-system-reference",
  recommendedAction: input.recommendedAction,
});

const inspectForbiddenActivePaths = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const relativePath of FORBIDDEN_ACTIVE_PATHS) {
    if (await fileExists(pathFromRepoRoot(relativePath))) {
      findings.push(createRetiredMapFinding({
        file: relativePath,
        line: 1,
        message: `Retired map-system path ${relativePath} must not exist in active source truth.`,
        recommendedAction: `DELETE ${relativePath}`,
      }));
    }
  }
  return findings;
};

const getNodeText = (node: Node): string | null => {
  if (Node.isIdentifier(node)) {
    return node.getText();
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return node.getLiteralText();
  }
  return null;
};

const inspectForbiddenTokensInSourceFile = (sourceFile: SourceFile, relativePath: string): Finding[] => {
  if (isSkippedPath(relativePath) || !isStartChainPath(relativePath)) {
    return [];
  }

  const findings: Finding[] = [];
  const seen = new Set<string>();
  const candidateNodes = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];

  for (const node of candidateNodes) {
    const text = getNodeText(node);
    if (!text) {
      continue;
    }

    const forbiddenToken = FORBIDDEN_IDENTIFIER_TOKENS.find((token) => text.includes(token));
    if (!forbiddenToken) {
      continue;
    }

    const findingKey = `${relativePath}:${node.getStartLineNumber()}:${forbiddenToken}`;
    if (seen.has(findingKey)) {
      continue;
    }
    seen.add(findingKey);

    findings.push(createRetiredMapFinding({
      file: relativePath,
      line: node.getStartLineNumber(),
      message: `Retired map-system token ${forbiddenToken} must not survive in the active start/runtime chain.`,
      detail: text,
      recommendedAction: `DELETE ${forbiddenToken} from ${relativePath} or migrate the behavior to PlatformRegistry, UserRequirementHistory, VisualMissionPromptContract, or MuscleMemoryCatalog.`,
    }));
  }

  return findings;
};

const inspectLegacyUiTokensInSourceFile = (sourceFile: SourceFile, relativePath: string): Finding[] => {
  if (!relativePath.startsWith("src/lib/local-app-shell/")) {
    return [];
  }

  const findings: Finding[] = [];
  const seen = new Set<string>();
  const candidateNodes = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.Identifier),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
  ];

  for (const node of candidateNodes) {
    const text = getNodeText(node);
    if (!text) {
      continue;
    }

    const forbiddenToken = LEGACY_UI_TOKENS.find((token) => text.includes(token));
    if (!forbiddenToken) {
      continue;
    }

    const findingKey = `${relativePath}:${node.getStartLineNumber()}:${forbiddenToken}`;
    if (seen.has(findingKey)) {
      continue;
    }
    seen.add(findingKey);

    findings.push(createRetiredMapFinding({
      file: relativePath,
      line: node.getStartLineNumber(),
      message: `Legacy map/task-template UI token ${forbiddenToken} must not survive in APP start surfaces.`,
      detail: text,
      recommendedAction: `Delete ${forbiddenToken} from the active APP shell and replace it with the UserRequirementLauncher flow.`,
    }));
  }

  return findings;
};

export const inspectRetiredMapSystem = async (relativePaths: string[], sourceFiles: Map<string, SourceFile>): Promise<Finding[]> => {
  const findings = await inspectForbiddenActivePaths();

  for (const relativePath of relativePaths) {
    const sourceFile = sourceFiles.get(relativePath);
    if (!sourceFile) {
      continue;
    }

    findings.push(...inspectForbiddenTokensInSourceFile(sourceFile, relativePath));
    findings.push(...inspectLegacyUiTokensInSourceFile(sourceFile, relativePath));
  }

  return findings;
};