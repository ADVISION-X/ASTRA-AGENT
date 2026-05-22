import { SyntaxKind, type ObjectLiteralExpression } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";

const requiredTopLevelFields = ["traceId", "level", "modeVisibility", "eventType", "owner"] as const;
const failurePayloadFields = ["failureClass", "stageName", "retryable", "terminal", "recoveryPolicy"] as const;
const authorizedHelperNames = [
  "createRuntimeEvent",
  "logFacebookMiningFlow",
  "logFacebookNavigationDebug",
  "createStageLogger",
] as const;

const hasProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): boolean =>
  objectLiteral.getProperties().some((property) => {
    if (property.getKind() === SyntaxKind.SpreadAssignment) return false;
    return "getName" in property && property.getName() === propertyName;
  });

const getObjectProperty = (objectLiteral: ObjectLiteralExpression, propertyName: string): ObjectLiteralExpression | null => {
  const property = objectLiteral.getProperty(propertyName);
  if (!property?.asKind(SyntaxKind.PropertyAssignment)) return null;
  return property.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializerIfKind(SyntaxKind.ObjectLiteralExpression) ?? null;
};

const isEmitCall = (text: string): boolean => /\.emit$/u.test(text) || /(?:logger|runtimeLogger)\.emit$/u.test(text);

export const collectRuntimeLogEmitContractFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
  emitCallCount: number;
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  let emitCallCount = 0;

  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/") || !/\.(?:ts|tsx)$/u.test(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const expressionText = call.getExpression().getText();
      const firstArg = call.getArguments()[0]?.asKind(SyntaxKind.ObjectLiteralExpression);
      if (!firstArg || !isEmitCall(expressionText)) continue;
      emitCallCount += 1;
      const missing = requiredTopLevelFields.filter((field) => !hasProperty(firstArg, field));
      if (missing.length > 0) {
        findings.push({
          checkId: "runtime-log-spine/emit-trace-contract",
          lawId: RuntimeLogSpineLaw.TRACE_CONTRACT,
          file: repoPath,
          line: call.getStartLineNumber(),
          severity: "fatal",
          message: "RuntimeLogger.emit is missing required trace contract fields",
          hint: `Add ${missing.join(", ")}, or use an authorized stage logger/event factory.`,
        });
      }
      const statusText = firstArg.getProperty("status")?.asKind(SyntaxKind.PropertyAssignment)?.getInitializer()?.getText() ?? "";
      if (!/"(?:failed|review_required|skipped)"/u.test(statusText)) continue;
      const payload = getObjectProperty(firstArg, "payload");
      const missingFailureFields = failurePayloadFields.filter((field) => !payload || !hasProperty(payload, field));
      if (missingFailureFields.length > 0) {
        findings.push({
          checkId: "runtime-log-spine/emit-failure-contract",
          lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
          file: repoPath,
          line: call.getStartLineNumber(),
          severity: "fatal",
          message: "failure event is missing failureClass contract",
          hint: `Use RuntimeFailureClass enum and include ${missingFailureFields.join(", ")}.`,
        });
      }
    }
  }

  for (const helperName of authorizedHelperNames) {
    if (context.project.getSourceFiles().some((sourceFile) => sourceFile.getText().includes(helperName))) continue;
    findings.push({
      checkId: "runtime-log-spine/authorized-helper-present",
      lawId: RuntimeLogSpineLaw.TRACE_CONTRACT,
      file: "src/lib/runtime-logs/index.ts",
      line: 1,
      severity: "fatal",
      message: `authorized runtime log helper ${helperName} is missing`,
      hint: "Keep trace contract expansion inside authorized helpers instead of freehand emit calls.",
    });
  }
  return { findings, inspectedFiles: inspectedFiles.sort(), emitCallCount };
};
