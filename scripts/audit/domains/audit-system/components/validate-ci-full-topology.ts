import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createAuditSystemFinding, createAuditSystemPhase } from "./audit-system-component-support.js";
import type { AuditSystemInspectionContext, AuditSystemInspectionResult } from "./audit-system-ts-morph-support.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "./audit-system-ts-morph-support.js";

type CiTopologyFinding = ReturnType<typeof createAuditSystemFinding>;

type CiStageShape = {
  label: string;
  parallel: boolean;
  steps: CiStepShape[];
  line: number;
};

type CiStepShape = {
  label: string;
  args: string[];
  mutatesProduction: boolean;
};

const CI_FULL_PATH = "scripts/audit/ci-full.ts";
const OWNER_AUDIT_TIMEOUT_MINIMUM_MS = 180_000;
const REQUIRED_ABILITY_GROUP_SCRIPTS = [
  "run audit:commander-console",
  "run audit:orchestration",
  "run audit:nerve-bus",
  "run audit:ai",
  "run audit:open",
  "run audit:screenshot",
  "run audit:visual-target",
  "run audit:geometry-guard",
  "run audit:mouse-click",
  "run audit:text-input-capability",
  "run audit:mouse-scroll",
  "run audit:post-action-verification",
  "run audit:forensics-persistence",
  "run audit:page-state",
] as const;

const getPropertyInitializer = (objectLiteral: ObjectLiteralExpression, propertyName: string) => {
  const property = objectLiteral.getProperty(propertyName);
  return Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
};

const getStringProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): string | undefined => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  return Node.isStringLiteral(initializer) ? initializer.getLiteralText() : undefined;
};

const getBooleanProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): boolean | undefined => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  if (initializer?.getKind() === SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer?.getKind() === SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
};

const getStringArrayProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): string[] => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  if (!Node.isArrayLiteralExpression(initializer)) {
    return [];
  }

  return initializer.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
};

const getObjectArrayProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): ObjectLiteralExpression[] => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  if (!Node.isArrayLiteralExpression(initializer)) {
    return [];
  }

  return initializer.getElements().filter(Node.isObjectLiteralExpression);
};

const getCiStagesDeclaration = (sourceFile: SourceFile) => {
  return sourceFile.getVariableDeclaration("CI_STAGES");
};

const collectCiStages = (sourceFile: SourceFile): CiStageShape[] => {
  const initializer = getCiStagesDeclaration(sourceFile)?.getInitializer();
  if (!Node.isArrayLiteralExpression(initializer)) {
    return [];
  }

  return initializer.getElements().filter(Node.isObjectLiteralExpression).map((stageObject) => ({
    label: getStringProperty(stageObject, "label") ?? "",
    parallel: getBooleanProperty(stageObject, "parallel") ?? false,
    line: getNodeLine(stageObject),
    steps: getObjectArrayProperty(stageObject, "steps").map((stepObject) => ({
      label: getStringProperty(stepObject, "label") ?? "",
      args: getStringArrayProperty(stepObject, "args"),
      mutatesProduction: getBooleanProperty(stepObject, "mutatesProduction") ?? false,
    })),
  }));
};

const hasSpawnImportWithoutSpawnSync = (sourceFile: SourceFile): boolean => {
  const childProcessImport = sourceFile.getImportDeclarations().find((declaration) => declaration.getModuleSpecifierValue() === "node:child_process");
  const importedNames = childProcessImport?.getNamedImports().map((specifier) => specifier.getName()) ?? [];
  return importedNames.includes("spawn") && !importedNames.includes("spawnSync");
};

const hasPromiseAllStageExecution = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "Promise"
      && expression.getName() === "all";
  });
};

const hasRequiredLayerOrder = (stages: CiStageShape[]): boolean => {
  return stages[0]?.label === "foundation-layer"
    && stages[1]?.label === "map-layer"
    && stages[2]?.label === "ability-group-layer";
};

const hasFoundationFirstCodePurity = (stages: CiStageShape[]): boolean => {
  const foundation = stages.find((stage) => stage.label === "foundation-layer");
  return foundation?.parallel === false && foundation.steps[0]?.args.join(" ") === "run audit:code-purity";
};

const hasMapSecond = (stages: CiStageShape[]): boolean => {
  const mapLayer = stages.find((stage) => stage.label === "map-layer");
  return mapLayer?.parallel === false && mapLayer.steps.length === 1 && mapLayer.steps[0]?.args.join(" ") === "run audit:map-plugin-package";
};

const hasAbilityGroupLayer = (stages: CiStageShape[]): boolean => {
  const abilityLayer = stages.find((stage) => stage.label === "ability-group-layer");
  const actual = new Set(abilityLayer?.steps.map((step) => step.args.join(" ")) ?? []);
  return abilityLayer?.parallel === true
    && abilityLayer.steps.length === REQUIRED_ABILITY_GROUP_SCRIPTS.length
    && REQUIRED_ABILITY_GROUP_SCRIPTS.every((script) => actual.has(script));
};

const isolatesMutatingAuditStage = (stages: CiStageShape[]): boolean => {
  return stages.every((stage) => {
    if (!stage.parallel) {
      return true;
    }
    return stage.steps.every((step) => !step.mutatesProduction);
  });
};

const hasRequiredScripts = (stages: CiStageShape[]): boolean => {
  const actual = new Set(stages.flatMap((stage) => stage.steps.map((step) => step.args.join(" "))));
  return ["run audit:code-purity", "run typecheck", "run audit:build", "run audit:map-plugin-package"].every((script) => actual.has(script))
    && REQUIRED_ABILITY_GROUP_SCRIPTS.every((script) => actual.has(script));
};

const avoidsRedundantCoverageScripts = (stages: CiStageShape[]): boolean => {
  const actual = new Set(stages.flatMap((stage) => stage.steps.map((step) => step.args.join(" "))));
  return !actual.has("run audit:coverage") && !actual.has("run audit:coverage:anti-fraud") && !actual.has("run audit");
};

const resolveNumericConstant = (sourceFile: SourceFile, name: string): number | undefined => {
  const initializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (!Node.isNumericLiteral(initializer)) {
    return undefined;
  }
  return Number(initializer.getLiteralText().replaceAll("_", ""));
};

const createTopologyFinding = (input: { relativePath: string; line: number; message: string }): CiTopologyFinding =>
  createAuditSystemFinding({
    file: input.relativePath,
    line: input.line,
    severity: "error",
    message: input.message,
  });

const collectRuntimeShapeFindings = (sourceFile: SourceFile, relativePath: string): CiTopologyFinding[] =>
  hasSpawnImportWithoutSpawnSync(sourceFile) && hasPromiseAllStageExecution(sourceFile)
    ? []
    : [createTopologyFinding({
      relativePath,
      line: 1,
      message: "CI full must use async spawn-based stages instead of serial spawnSync.",
    })];

const collectLayerOrderFindings = (stages: CiStageShape[], relativePath: string): CiTopologyFinding[] => {
  const findings: CiTopologyFinding[] = [];
  if (!hasRequiredLayerOrder(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[0]?.line ?? 1, message: "CI full must run foundation-layer first, map-layer second, and ability-group-layer third." }));
  }
  if (!hasFoundationFirstCodePurity(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[0]?.line ?? 1, message: "CI full foundation-layer must run audit:code-purity as the first gate." }));
  }
  if (!hasMapSecond(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[1]?.line ?? 1, message: "CI full map-layer must run audit:map-plugin-package before ability groups." }));
  }
  if (!hasAbilityGroupLayer(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[2]?.line ?? 1, message: "CI full ability-group-layer must contain exactly the 14 active ability-group audit scripts." }));
  }
  return findings;
};

const collectStageGraphFindings = (stages: CiStageShape[], relativePath: string): CiTopologyFinding[] => {
  const findings: CiTopologyFinding[] = [];
  if (!isolatesMutatingAuditStage(stages)) {
    findings.push(createTopologyFinding({
      relativePath,
      line: stages.find((stage) => stage.parallel && stage.steps.some((step) => step.mutatesProduction))?.line ?? 1,
      message: "CI full must isolate production-mutation audit steps in a serial stage.",
    }));
  }
  if (!hasRequiredScripts(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: 1, message: "CI full must keep code-purity, typecheck, audit:build, map, and 14 ability-group audits in the governed stage graph." }));
  }
  if (!avoidsRedundantCoverageScripts(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: 1, message: "CI full must not run redundant coverage scripts outside the owner audit law-compliance chain." }));
  }
  return findings;
};

const collectTimeoutFindings = (sourceFile: SourceFile, relativePath: string): CiTopologyFinding[] => {
  const ownerAuditTimeoutMs = resolveNumericConstant(sourceFile, "OWNER_STEP_TIMEOUT_MS");
  return ownerAuditTimeoutMs !== undefined && ownerAuditTimeoutMs >= OWNER_AUDIT_TIMEOUT_MINIMUM_MS
    ? []
    : [createTopologyFinding({ relativePath, line: 1, message: "CI full owner audit timeout must cover the default law-compliance audit budget." })];
};

const createTopologyPhases = (findings: CiTopologyFinding[]) => [
  createAuditSystemPhase(
    "ci-full-topology",
    findings.length === 0 ? "PASS" : "SCRIPT OVERREACH",
    findings.length === 0,
    findings.length === 0
      ? "CI full runs foundation first with code-purity as gate one, then map, then the 14 ability groups."
      : "CI full has layer order, timeout, script graph, redundant coverage, or mutation-isolation drift.",
  ),
];

export const validateCiFullTopology = async (
  _context: AuditSystemInspectionContext,
): Promise<AuditSystemInspectionResult> => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, CI_FULL_PATH);
  const relativePath = toRelativeSourcePath(sourceFile);
  const stages = collectCiStages(sourceFile);
  const findings = [
    ...collectRuntimeShapeFindings(sourceFile, relativePath),
    ...collectLayerOrderFindings(stages, relativePath),
    ...collectStageGraphFindings(stages, relativePath),
    ...collectTimeoutFindings(sourceFile, relativePath),
  ];

  return {
    findings,
    phases: createTopologyPhases(findings),
  };
};
