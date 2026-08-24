import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getNestedObject, getPropertyInitializer, getStringLiteralProperty, hasProperty } from "./ast/ast-object-literal-reader.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

const requiredClasses = [
  "TRANSIENT_RETRYABLE",
  "SKIPPABLE_ROUND_FAILURE",
  "RECOVERABLE_BROWSER_DRIFT",
  "ACCOUNT_SECURITY_BLOCKER",
  "PLATFORM_RATE_LIMIT",
  "SCHEMA_CONTRACT_VIOLATION",
  "AI_PROVIDER_FAILURE",
  "AI_PARSE_FAILURE",
  "MEDIA_DOWNLOAD_FAILURE",
  "DOM_PROBE_FAILURE",
  "NAVIGATION_FAILURE",
  "ARTIFACT_FAILURE",
  "INTERNAL_BUG",
  "UNKNOWN",
] as const;

const failureContractTokens = ["failureClass", "stageName", "retryable", "terminal", "recoveryPolicy"] as const;

const isInspectableRepoPath = (repoPath: string): boolean => isRuntimeLogLawSourcePath(repoPath);

const collectRuntimeLogEmitObjectLiterals = (input: {
  sourceFile: SourceFile;
  repoPath: string;
}) => resolveCallsInSourceFile(input.sourceFile, input.repoPath)
  .filter((call) => call.kind === "runtime-log-emit")
  .map((call) => call.objectLiteralArg)
  .filter((objectLiteral): objectLiteral is NonNullable<typeof objectLiteral> => objectLiteral !== undefined);

const isFailureStatus = (status: string | null): boolean =>
  status !== null && ["failed", "review_required", "skipped"].includes(status);

const buildFailureClassContractHint = (input: {
  fromRegistry: boolean;
  missing: readonly string[];
}): string => `${input.fromRegistry ? "" : "Use RuntimeFailureClass enum. "}Include ${input.missing.join(", ")}.`;

const appendMissingFailureClassRegistryFindings = (
  findings: RuntimeLogSpineFinding[],
  failureClasses: SourceFile | undefined,
): void => {
  if (!failureClasses) {
    findings.push({
      checkId: "runtime-log-spine/failure-class-file",
      lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
      file: "src/lib/runtime-logs/failure-classes.ts",
      line: 1,
      severity: "fatal",
      message: "failure class registry is missing",
      hint: "Create RuntimeFailureClass with the standard classified failure constants.",
    });
    return;
  }

  const declaration = failureClasses.getVariableDeclaration("RuntimeFailureClass");
  const rawInitializer = declaration?.getInitializer();
  const initializer = Node.isAsExpression(rawInitializer) ? rawInitializer.getExpression() : rawInitializer;
  const availableClasses = new Set(Node.isObjectLiteralExpression(initializer)
    ? initializer.getProperties().flatMap((property) =>
      Node.isPropertyAssignment(property) ? [property.getName()] : [])
    : []);

  for (const className of requiredClasses) {
    if (availableClasses.has(className)) continue;
    findings.push({
      checkId: "runtime-log-spine/failure-class-registry",
      lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
      file: "src/lib/runtime-logs/failure-classes.ts",
      line: 1,
      severity: "fatal",
      message: `RuntimeFailureClass.${className} is missing`,
      hint: "Use the standard RuntimeFailureClass registry from the law before emitting failed/skipped/review_required events.",
    });
  }
};

const isRuntimeFailureClassReference = (node: import("ts-morph").Node | null): boolean => {
  if (!node || !Node.isPropertyAccessExpression(node)) return false;
  const receiver = node.getExpression();
  if (!Node.isIdentifier(receiver)) return false;
  const symbol = receiver.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return target?.getDeclarations().some((declaration) =>
    Node.isVariableDeclaration(declaration)
    && declaration.getName() === "RuntimeFailureClass"
    && getRepoSourcePath(declaration.getSourceFile()) === "src/lib/runtime-logs/failure-classes.ts") ?? false;
};

const appendFailureClassContractFindings = (
  findings: RuntimeLogSpineFinding[],
  context: InspectorContext,
  inspectedFiles: string[],
): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isInspectableRepoPath(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const objectLiteral of collectRuntimeLogEmitObjectLiterals({ sourceFile, repoPath })) {
      const status = getStringLiteralProperty(objectLiteral, "status");
      if (!isFailureStatus(status)) continue;
      const payload = getNestedObject(objectLiteral, "payload");
      const missing = failureContractTokens.filter((token) => !payload || !hasProperty(payload, token));
      if (missing.length === 0) continue;
      const failureClass = payload ? getPropertyInitializer(payload, "failureClass") : null;
      const fromRegistry = isRuntimeFailureClassReference(failureClass);
      findings.push({
        checkId: "runtime-log-spine/failure-class-contract",
        lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
        file: repoPath,
        line: objectLiteral.getStartLineNumber(),
        severity: "fatal",
        message: "failure status lacks RuntimeFailureClass enum contract",
        hint: buildFailureClassContractHint({ fromRegistry, missing }),
      });
    }
  }
};

export const collectFailureClassFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  failureWithoutClassCount: number;
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles = ["src/lib/runtime-logs/failure-classes.ts"];
  const failureClasses = context.project.getSourceFiles().find((sourceFile) =>
    getRepoSourcePath(sourceFile) === "src/lib/runtime-logs/failure-classes.ts");
  appendMissingFailureClassRegistryFindings(findings, failureClasses);
  appendFailureClassContractFindings(findings, context, inspectedFiles);

  return {
    findings,
    inspectedFiles: [...new Set(inspectedFiles)].sort(),
    failureWithoutClassCount: findings.length,
  };
};
