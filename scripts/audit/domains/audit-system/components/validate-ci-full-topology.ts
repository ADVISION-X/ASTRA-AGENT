import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createAuditSystemFinding, createAuditSystemPhase } from "./audit-system-component-support.js";
import type { AuditSystemInspectionContext, AuditSystemInspectionResult } from "./audit-system-ts-morph-support.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "./audit-system-ts-morph-support.js";
import { CI_FULL_LAYER_EXECUTION, CI_FULL_LAYER_ORDER, getCiFullOwnersByLayer } from "../../../core/ci-full-check-ownership.js";
import { ABILITY_GROUP_SAFE_MAX_CONCURRENCY, CODE_PURITY_TIMEOUT_MS, OWNER_STEP_TIMEOUT_MS, QUICK_STEP_TIMEOUT_MS } from "../../../core/ci-full-timeouts.js";

type CiTopologyFinding = ReturnType<typeof createAuditSystemFinding>;

type CiStageExecutionMode = "serial" | "bounded";

type CiStageShape = {
  label: string;
  executionMode: CiStageExecutionMode | "";
  maxConcurrency?: number;
  steps: CiStepShape[];
  line: number;
};

type CiStepShape = {
  label: string;
  args: string[];
  timeoutMs: number;
  mutatesProduction: boolean;
};

const CI_FULL_PATH = "scripts/audit/ci-full.ts";
const QUICK_STEP_CHECK_IDS = new Set(["audit-build", "typecheck", "type-safety", "security-privacy"]);
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

const resolveNumericConstant = (sourceFile: SourceFile, name: string): number | undefined => {
  const initializer = sourceFile.getVariableDeclaration(name)?.getInitializer();
  if (!Node.isNumericLiteral(initializer)) {
    return undefined;
  }
  return Number(initializer.getLiteralText().replaceAll("_", ""));
};

const getNumericProperty = (sourceFile: SourceFile, objectLiteral: ObjectLiteralExpression, propertyName: string): number | undefined => {
  const initializer = getPropertyInitializer(objectLiteral, propertyName);
  if (Node.isNumericLiteral(initializer)) {
    return Number(initializer.getLiteralText().replaceAll("_", ""));
  }
  if (Node.isIdentifier(initializer)) {
    return resolveNumericConstant(sourceFile, initializer.getText());
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

const hasCallExpressionNamed = (sourceFile: SourceFile, callName: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === callName;
  });

const getCiStagesDeclaration = (sourceFile: SourceFile) => {
  return sourceFile.getVariableDeclaration("CI_STAGES");
};

const buildMatrixStages = (sourceFile: SourceFile): CiStageShape[] => {
  const stageLine = getNodeLine(getCiStagesDeclaration(sourceFile) ?? sourceFile);

  return CI_FULL_LAYER_ORDER.map((label) => ({
    label,
    executionMode: CI_FULL_LAYER_EXECUTION[label].executionMode,
    ...(CI_FULL_LAYER_EXECUTION[label].executionMode === "bounded"
      ? { maxConcurrency: CI_FULL_LAYER_EXECUTION[label].maxConcurrency }
      : {}),
    line: stageLine,
    steps: getCiFullOwnersByLayer(label).map((owner) => ({
      label: owner.checkId,
      args: owner.args,
      timeoutMs: owner.timeoutMs,
      mutatesProduction: false,
    })),
  }));
};

const collectCiStages = (sourceFile: SourceFile): CiStageShape[] => {
  const initializer = getCiStagesDeclaration(sourceFile)?.getInitializer();
  if (!Node.isArrayLiteralExpression(initializer)) {
    if (Node.isCallExpression(initializer)) {
      const expression = initializer.getExpression();
      if (Node.isPropertyAccessExpression(expression)
        && expression.getExpression().getText() === "CI_FULL_LAYER_ORDER"
        && expression.getName() === "map"
        && hasCallExpressionNamed(sourceFile, "getCiFullOwnership")
        && hasCallExpressionNamed(sourceFile, "getCiFullOwnersByLayer")) {
        return buildMatrixStages(sourceFile);
      }
    }

    return [];
  }

  return initializer.getElements().filter(Node.isObjectLiteralExpression).map((stageObject) => {
    const maxConcurrency = getNumericProperty(sourceFile, stageObject, "maxConcurrency");
    return {
      label: getStringProperty(stageObject, "label") ?? "",
      executionMode: (getStringProperty(stageObject, "executionMode") ?? "") as CiStageExecutionMode | "",
      ...(maxConcurrency === undefined ? {} : { maxConcurrency }),
      line: getNodeLine(stageObject),
      steps: getObjectArrayProperty(stageObject, "steps").map((stepObject) => ({
        label: getStringProperty(stepObject, "label") ?? "",
        args: getStringArrayProperty(stepObject, "args"),
        timeoutMs: getNumericProperty(sourceFile, stepObject, "timeoutMs") ?? 0,
        mutatesProduction: getBooleanProperty(stepObject, "mutatesProduction") ?? false,
      })),
    };
  });
};

const hasSpawnImport = (sourceFile: SourceFile): boolean => {
  const childProcessImport = sourceFile.getImportDeclarations().find((declaration) => declaration.getModuleSpecifierValue() === "node:child_process");
  const importedNames = childProcessImport?.getNamedImports().map((specifier) => specifier.getName()) ?? [];
  return importedNames.includes("spawn");
};

const hasUnboundedStagePromiseAll = (sourceFile: SourceFile): boolean => {
  return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!(Node.isPropertyAccessExpression(expression)
      && expression.getExpression().getText() === "Promise"
      && expression.getName() === "all")) {
      return false;
    }

    const [firstArgument] = callExpression.getArguments();
    if (!Node.isCallExpression(firstArgument)) {
      return false;
    }

    const argumentExpression = firstArgument.getExpression();
    return Node.isPropertyAccessExpression(argumentExpression)
      && argumentExpression.getName() === "map"
      && argumentExpression.getExpression().getText() === "stage.steps";
  });
};

const hasRequiredLayerOrder = (stages: CiStageShape[]): boolean => {
  return stages[0]?.label === "foundation-layer"
    && stages[1]?.label === "map-layer"
    && stages[2]?.label === "ability-group-layer";
};

const hasFoundationFirstCodePurity = (stages: CiStageShape[]): boolean => {
  const foundation = stages.find((stage) => stage.label === "foundation-layer");
  return foundation?.executionMode === "serial"
    && foundation.steps[0]?.args.join(" ") === "run audit:build"
    && foundation.steps[1]?.args.join(" ") === "run audit:code-purity";
};

const hasMapSecond = (stages: CiStageShape[]): boolean => {
  const mapLayer = stages.find((stage) => stage.label === "map-layer");
  return mapLayer?.executionMode === "serial" && mapLayer.steps.length === 1 && mapLayer.steps[0]?.args.join(" ") === "run audit:map-plugin-package";
};

const hasAbilityGroupLayer = (stages: CiStageShape[]): boolean => {
  const abilityLayer = stages.find((stage) => stage.label === "ability-group-layer");
  const actual = new Set(abilityLayer?.steps.map((step) => step.args.join(" ")) ?? []);
  const isMemorySafeExecution = abilityLayer?.executionMode === "serial"
    || (abilityLayer?.executionMode === "bounded"
      && typeof abilityLayer.maxConcurrency === "number"
      && abilityLayer.maxConcurrency >= 1
      && abilityLayer.maxConcurrency <= ABILITY_GROUP_SAFE_MAX_CONCURRENCY);

  return Boolean(isMemorySafeExecution)
    && abilityLayer?.steps.length === REQUIRED_ABILITY_GROUP_SCRIPTS.length
    && REQUIRED_ABILITY_GROUP_SCRIPTS.every((script) => actual.has(script));
};

const collectMatrixWiringFindings = (sourceFile: SourceFile, relativePath: string): CiTopologyFinding[] => {
  const initializer = getCiStagesDeclaration(sourceFile)?.getInitializer();
  if (!Node.isCallExpression(initializer)) {
    return [createTopologyFinding({
      relativePath,
      line: getNodeLine(getCiStagesDeclaration(sourceFile) ?? sourceFile),
      message: "CI full must derive CI_STAGES from CI_FULL_LAYER_ORDER.map and getCiFullOwnersByLayer.",
    })];
  }

  const expression = initializer.getExpression();
  if (!Node.isPropertyAccessExpression(expression)
    || expression.getExpression().getText() !== "CI_FULL_LAYER_ORDER"
    || expression.getName() !== "map"
    || !hasCallExpressionNamed(sourceFile, "getCiFullOwnership")
    || !hasCallExpressionNamed(sourceFile, "getCiFullOwnersByLayer")) {
    return [createTopologyFinding({
      relativePath,
      line: getNodeLine(initializer),
      message: "CI full must derive CI_STAGES from CI_FULL_LAYER_ORDER.map, getCiFullOwnersByLayer, and getCiFullOwnership.",
    })];
  }

  return [];
};

const collectClosureWiringFindings = (sourceFile: SourceFile, relativePath: string): CiTopologyFinding[] => {
  const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  const summaryWriteLine = callExpressions.find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "writeCiFullSummary";
  })?.getStartLineNumber();

  const closureCallLine = callExpressions.find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "runCiFullClosure";
  })?.getStartLineNumber();

  if (summaryWriteLine !== undefined && closureCallLine !== undefined && closureCallLine > summaryWriteLine) {
    return [];
  }

  return [createTopologyFinding({
    relativePath,
    line: summaryWriteLine ?? closureCallLine ?? 1,
    message: "CI full must write the summary before invoking the closure validator.",
  })];
};

const isolatesMutatingAuditStage = (stages: CiStageShape[]): boolean => {
  return stages.every((stage) => {
    if (stage.executionMode === "serial") {
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

const createTopologyFinding = (input: { relativePath: string; line: number; message: string }): CiTopologyFinding =>
  createAuditSystemFinding({
    file: input.relativePath,
    line: input.line,
    severity: "error",
    message: input.message,
  });

const collectRuntimeShapeFindings = (sourceFile: SourceFile, relativePath: string): CiTopologyFinding[] =>
  hasSpawnImport(sourceFile) && !hasUnboundedStagePromiseAll(sourceFile)
    ? []
    : [createTopologyFinding({
      relativePath,
      line: 1,
      message: "CI full must use async spawn-based stages and must not launch stage.steps through unbounded Promise.all.",
    })];

const collectLayerOrderFindings = (stages: CiStageShape[], relativePath: string): CiTopologyFinding[] => {
  const findings: CiTopologyFinding[] = [];
  if (!hasRequiredLayerOrder(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[0]?.line ?? 1, message: "CI full must run foundation-layer first, map-layer second, and ability-group-layer third." }));
  }
  if (!hasFoundationFirstCodePurity(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[0]?.line ?? 1, message: "CI full foundation-layer must run audit:build before audit:code-purity so code-purity does not rebuild the audit universe." }));
  }
  if (!hasMapSecond(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[1]?.line ?? 1, message: "CI full map-layer must run audit:map-plugin-package before ability groups." }));
  }
  if (!hasAbilityGroupLayer(stages)) {
    findings.push(createTopologyFinding({ relativePath, line: stages[2]?.line ?? 1, message: "CI full ability-group-layer must contain exactly the 14 active ability-group audit scripts and execute them with serial or bounded concurrency <= 2." }));
  }
  return findings;
};

const collectStageGraphFindings = (stages: CiStageShape[], relativePath: string): CiTopologyFinding[] => {
  const findings: CiTopologyFinding[] = [];
  if (!isolatesMutatingAuditStage(stages)) {
    findings.push(createTopologyFinding({
      relativePath,
      line: stages.find((stage) => stage.executionMode !== "serial" && stage.steps.some((step) => step.mutatesProduction))?.line ?? 1,
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

const getExpectedTimeoutMs = (checkId: string): number => {
  if (checkId === "code-purity") {
    return CODE_PURITY_TIMEOUT_MS;
  }

  return QUICK_STEP_CHECK_IDS.has(checkId) ? QUICK_STEP_TIMEOUT_MS : OWNER_STEP_TIMEOUT_MS;
};

const collectTimeoutFindings = (stages: CiStageShape[], relativePath: string): CiTopologyFinding[] => {
  const findings: CiTopologyFinding[] = [];

  for (const stage of stages) {
    for (const step of stage.steps) {
      if (step.timeoutMs === getExpectedTimeoutMs(step.label)) {
        continue;
      }

      findings.push(createTopologyFinding({
        relativePath,
        line: stage.line,
        message: `CI full step ${step.label} must retain its governed timeout budget.`,
      }));
    }
  }

  return findings;
};

const collectResourceGuardFindings = (sourceFile: SourceFile, relativePath: string): CiTopologyFinding[] => {
  const text = sourceFile.getFullText();
  const hasConcurrencyGuard = text.includes("GRASSEYE_CI_FULL_MAX_CONCURRENCY") && text.includes("ABILITY_GROUP_SAFE_MAX_CONCURRENCY");
  const hasRssGuard = text.includes("GRASSEYE_CI_MAX_RSS_MB") && text.includes("CI_RESOURCE_LIMIT_EXCEEDED");
  if (hasConcurrencyGuard && hasRssGuard) {
    return [];
  }
  return [createTopologyFinding({
    relativePath,
    line: 1,
    message: "CI full must expose bounded-concurrency and rss resource guards for memory-safe execution.",
  })];
};

const createTopologyPhases = (findings: CiTopologyFinding[]) => [
  createAuditSystemPhase(
    "ci-full-topology",
    findings.length === 0 ? "PASS" : "SCRIPT OVERREACH",
    findings.length === 0,
    findings.length === 0
      ? "CI full runs matrix-derived foundation, map, and ability-group stages, then writes and closes summary evidence."
      : "CI full has layer order, timeout, closure order, script graph, redundant coverage, or mutation-isolation drift.",
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
    ...collectMatrixWiringFindings(sourceFile, relativePath),
    ...collectClosureWiringFindings(sourceFile, relativePath),
    ...collectLayerOrderFindings(stages, relativePath),
    ...collectStageGraphFindings(stages, relativePath),
    ...collectTimeoutFindings(stages, relativePath),
    ...collectResourceGuardFindings(sourceFile, relativePath),
  ];

  return {
    findings,
    phases: createTopologyPhases(findings),
  };
};
