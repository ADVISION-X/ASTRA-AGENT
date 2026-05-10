import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";

const RETIRED_MAP_LAW_ID = "GRASSEYE-CODE-PURITY-MAP-RETIREMENT-001-V1";

const FORBIDDEN_ACTIVE_PATHS = [
  "src/map-plugins",
  "scripts/audit/domains/map-plugin-package",
  ".github/instructions/cursor-rules/modules/module-map-plugin-package.instructions.md",
  "docs/法案辅助文件/GrassEye 地图插件包治理施工图.md",
  "docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md",
  "docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图_FINAL.md",
  "docs/法案辅助文件/GrassEye Route Plan 肌肉记忆施工图.md",
] as const;

const FORBIDDEN_IDENTIFIER_TOKENS = [
  "routePlanId",
  "selectedMapId",
  "taskTemplateId",
  "activationId",
  "activationSnapshotRef",
  "routeLabel",
  "map-layer",
  "map-plugin-package",
  "mapPackage",
  "operationalMap",
  "routePlanBoundMap",
  "genericDiagnosticMap",
  "MapAuthoring",
  "MapPlugin",
  "activeMapRegistry",
] as const;

const FORBIDDEN_GENERATED_TEXT_MATCHES = [
  {
    relativePath: "scripts/audit/generated/ci-full-summary.generated.json",
    token: "map-layer",
    message: "Generated CI summary must not include retired owner map-layer.",
    recommendedAction: "Rebuild CI-FULL generated artifacts after deleting the map-layer owner step.",
  },
  {
    relativePath: "scripts/audit/generated/audit-plan.generated.json",
    token: "map-plugin-package",
    message: "Generated audit plan must not include retired owner map-plugin-package.",
    recommendedAction: "Rebuild audit-plan.generated.json after deleting the map-plugin-package audit domain.",
  },
  {
    relativePath: "scripts/audit/generated/enforcement-matrix.generated.json",
    token: "module-map-plugin-package.instructions.md",
    message: "Generated enforcement matrix must not route to the retired map law file.",
    recommendedAction: "Rebuild the enforcement matrix after removing module-map-plugin-package from active law routing.",
  },
  {
    relativePath: "scripts/audit/generated/enforcement-matrix.generated.yaml",
    token: "module-map-plugin-package.instructions.md",
    message: "Generated enforcement matrix YAML must not route to the retired map law file.",
    recommendedAction: "Rebuild the enforcement matrix YAML after removing module-map-plugin-package from active law routing.",
  },
  {
    relativePath: "scripts/audit/generated/law-registry.generated.json",
    token: "module-map-plugin-package.instructions.md",
    message: "Generated law registry must not include the retired map law file.",
    recommendedAction: "Rebuild law-registry.generated.json after deleting module-map-plugin-package from active law sources.",
  },
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

const findLineNumberForToken = (text: string, token: string): number => {
  const lineIndex = text.split(/\r?\n/u).findIndex((line) => line.includes(token));
  return lineIndex >= 0 ? lineIndex + 1 : 1;
};

const inspectForbiddenGeneratedArtifacts = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const entry of FORBIDDEN_GENERATED_TEXT_MATCHES) {
    const absolutePath = pathFromRepoRoot(entry.relativePath);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    const text = await readTextFile(absolutePath);
    if (!text.includes(entry.token)) {
      continue;
    }

    findings.push(createRetiredMapFinding({
      file: entry.relativePath,
      line: findLineNumberForToken(text, entry.token),
      message: entry.message,
      detail: entry.token,
      recommendedAction: entry.recommendedAction,
    }));
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
  const findings = [
    ...(await inspectForbiddenActivePaths()),
    ...(await inspectForbiddenGeneratedArtifacts()),
  ];

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