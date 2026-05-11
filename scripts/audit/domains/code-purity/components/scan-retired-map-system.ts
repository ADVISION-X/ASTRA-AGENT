import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import { retiredMapCodePurityTokens } from "./retired-map-code-purity-tokens.js";

const RETIRED_MAP_LAW_ID = "GRASSEYE-CODE-PURITY-MAP-RETIREMENT-001-V1";
const {
  RETIRED_ACTIVATION_ID_FIELD,
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_ACTIVE_MAP_REGISTRY_TOKEN,
  RETIRED_GENERIC_DIAGNOSTIC_MAP_TOKEN,
  RETIRED_MAP_AUTHORING_TOKEN,
  RETIRED_MAP_LAYER_OWNER,
  RETIRED_MAP_PACKAGE_TOKEN,
  RETIRED_MAP_PLUGIN_PACKAGE_AUDIT_DOMAIN,
  RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE,
  RETIRED_MAP_PLUGIN_PACKAGE_OWNER,
  RETIRED_MAP_PLUGIN_TOKEN,
  RETIRED_OPERATIONAL_MAP_TOKEN,
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_ROUTE_LABEL_FIELD,
  RETIRED_ROUTE_PLAN_BOUND_MAP_TOKEN,
  RETIRED_ROUTE_PLAN_ID_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_TASK_TEMPLATE_ID_FIELD,
} = retiredMapCodePurityTokens;

const FORBIDDEN_ACTIVE_PATHS = [
  "src/map-plugins",
  RETIRED_MAP_PLUGIN_PACKAGE_AUDIT_DOMAIN,
  [".github", "instructions", "cursor-rules", "modules", RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE].join("/"),
  "docs/法案辅助文件/GrassEye 地图插件包治理施工图.md",
  "docs/法案辅助文件/GrassEye Map Prompt Contract Governance 施工图.md",
  "docs/法案辅助文件/GrassEye Map Authoring Input Package 施工图_FINAL.md",
  "docs/法案辅助文件/GrassEye Route Plan 肌肉记忆施工图.md",
] as const;

const FORBIDDEN_IDENTIFIER_TOKENS = [
  RETIRED_ROUTE_PLAN_ID_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_TASK_TEMPLATE_ID_FIELD,
  RETIRED_ACTIVATION_ID_FIELD,
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_ROUTE_LABEL_FIELD,
  RETIRED_MAP_LAYER_OWNER,
  RETIRED_MAP_PLUGIN_PACKAGE_OWNER,
  RETIRED_MAP_PACKAGE_TOKEN,
  RETIRED_OPERATIONAL_MAP_TOKEN,
  RETIRED_ROUTE_PLAN_BOUND_MAP_TOKEN,
  RETIRED_GENERIC_DIAGNOSTIC_MAP_TOKEN,
  RETIRED_MAP_AUTHORING_TOKEN,
  RETIRED_MAP_PLUGIN_TOKEN,
  RETIRED_ACTIVE_MAP_REGISTRY_TOKEN,
] as const;

const FORBIDDEN_GENERATED_TEXT_MATCHES = [
  {
    relativePath: "scripts/audit/generated/ci-full-summary.generated.json",
    token: RETIRED_MAP_LAYER_OWNER,
    message: `Generated CI summary must not include retired owner ${RETIRED_MAP_LAYER_OWNER}.`,
    recommendedAction: `Rebuild CI-FULL generated artifacts after deleting the ${RETIRED_MAP_LAYER_OWNER} owner step.`,
  },
  {
    relativePath: "scripts/audit/generated/audit-plan.generated.json",
    token: RETIRED_MAP_PLUGIN_PACKAGE_OWNER,
    message: `Generated audit plan must not include retired owner ${RETIRED_MAP_PLUGIN_PACKAGE_OWNER}.`,
    recommendedAction: `Rebuild audit-plan.generated.json after deleting the ${RETIRED_MAP_PLUGIN_PACKAGE_OWNER} audit domain.`,
  },
  {
    relativePath: "scripts/audit/generated/enforcement-matrix.generated.json",
    token: RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE,
    message: "Generated enforcement matrix must not route to the retired map law file.",
    recommendedAction: `Rebuild the enforcement matrix after removing ${RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE} from active law routing.`,
  },
  {
    relativePath: "scripts/audit/generated/enforcement-matrix.generated.yaml",
    token: RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE,
    message: "Generated enforcement matrix YAML must not route to the retired map law file.",
    recommendedAction: `Rebuild the enforcement matrix YAML after removing ${RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE} from active law routing.`,
  },
  {
    relativePath: "scripts/audit/generated/law-registry.generated.json",
    token: RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE,
    message: "Generated law registry must not include the retired map law file.",
    recommendedAction: `Rebuild law-registry.generated.json after deleting ${RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE} from active law sources.`,
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
  "scripts/audit/generated/",
  "docs/archive/retired-map-system/",
  "docs/archive/",
  "docs/归档/",
  "src/map-plugins/",
  `${RETIRED_MAP_PLUGIN_PACKAGE_AUDIT_DOMAIN}/`,
] as const;

const AI_PROMPT_CONTRACT_PATH_PREFIX = "src/capabilities/ai/prompt-contracts/";
const PROMPT_CONTRACT_JSON_SUFFIX = ".prompt-contract.json";

const isSkippedPath = (relativePath: string): boolean => SKIPPED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const isStartChainPath = (relativePath: string): boolean => START_CHAIN_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasWholeToken = (text: string, token: string): boolean => new RegExp(`(^|[^A-Za-z0-9_])${escapeRegExp(token)}([^A-Za-z0-9_]|$)`).test(text);

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
  ...(input.detail ? { detail: input.detail } : {}),
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

const getPropertyAssignmentName = (node: Node): string | null => {
  if (!Node.isPropertyAssignment(node)) {
    return null;
  }
  return getNodeText(node.getNameNode());
};

const isGovernedPromptContractNegativeRule = (node: Node, relativePath: string): boolean => {
  if (!relativePath.startsWith(AI_PROMPT_CONTRACT_PATH_PREFIX) || !relativePath.endsWith(PROMPT_CONTRACT_JSON_SUFFIX)) {
    return false;
  }

  const propertyNames = node
    .getAncestors()
    .map(getPropertyAssignmentName)
    .filter((name): name is string => name !== null);

  if (propertyNames.includes("forbiddenOutputs")) {
    return true;
  }

  return propertyNames.includes("outputSchema") && propertyNames.includes("forbidden");
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

    const forbiddenToken = FORBIDDEN_IDENTIFIER_TOKENS.find((token) => hasWholeToken(text, token));
    if (!forbiddenToken) {
      continue;
    }
    if (isGovernedPromptContractNegativeRule(node, relativePath)) {
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