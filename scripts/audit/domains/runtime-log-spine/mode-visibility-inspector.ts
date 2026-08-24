import { Node, SyntaxKind, type ObjectLiteralExpression } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getArrayLiteralPropertyValues, getNestedObject, hasProperty } from "./ast/ast-object-literal-reader.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { isAuthorizedRuntimeLogHelperPath, isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

const heavyPayloadKeys = ["raw", "rawOutput", "prompt", "fullPrompt", "html", "bodyText", "dom", "selectorCandidates", "comments", "signature", "before", "after", "videoFacts", "uploadState", "browserState", "candidateValidation"] as const;

const hasInvalidModeVisibility = (input: {
  objectLiteral: Parameters<typeof hasProperty>[0];
  values: string[] | null;
}): boolean => !hasProperty(input.objectLiteral, "modeVisibility")
  || input.values === null
  || input.values.length === 0
  || input.values.some((value) => !["FLOW", "DEBUG", "TRACE"].includes(value));

const payloadHasHeavyKey = (payload: ObjectLiteralExpression | null): boolean => payload !== null
  && payload.getProperties().some((property) =>
    (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property))
    && heavyPayloadKeys.includes(property.getName() as (typeof heavyPayloadKeys)[number]));

const isDebugTraceGuardCall = (call: import("ts-morph").CallExpression): boolean => {
  const expression = call.getExpression();
  const name = Node.isPropertyAccessExpression(expression)
    ? expression.getName()
    : astIdentifierName(expression);
  return name === "isDebugEnabled" || name === "isTraceEnabled";
};

const hasDebugTraceGuard = (objectLiteral: ObjectLiteralExpression): boolean => objectLiteral.getAncestors()
  .filter((ancestor) => Node.isIfStatement(ancestor) || Node.isConditionalExpression(ancestor))
  .some((ancestor) => ancestor.getDescendantsOfKind(SyntaxKind.CallExpression).some(isDebugTraceGuardCall));

const shouldFlagHeavyPayloadFlow = (input: {
  values: string[] | null;
  objectLiteral: ObjectLiteralExpression;
  payload: ObjectLiteralExpression | null;
}): boolean => (input.values ?? []).includes("FLOW")
  && payloadHasHeavyKey(input.payload)
  && !hasDebugTraceGuard(input.objectLiteral);

const appendModeVisibilityFindingsForCall = (input: {
  call: ReturnType<typeof resolveCallsInSourceFile>[number];
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
}): void => {
  const objectLiteral = input.call.objectLiteralArg;
  if (!objectLiteral) {
    return;
  }
  const values = getArrayLiteralPropertyValues(objectLiteral, "modeVisibility");
  if (hasInvalidModeVisibility({ objectLiteral, values })) {
    input.findings.push({
      checkId: "runtime-log-spine/mode-visibility-values",
      lawId: RuntimeLogSpineLaw.MODE_VISIBILITY,
      file: input.repoPath,
      line: input.call.line,
      severity: "fatal",
      message: "RuntimeLogger.emit contract is incomplete",
      hint: "modeVisibility must contain only FLOW, DEBUG, and TRACE.",
    });
  }
  const payload = getNestedObject(objectLiteral, "payload");
  if (shouldFlagHeavyPayloadFlow({ values, objectLiteral, payload })) {
    input.findings.push({
      checkId: "runtime-log-spine/heavy-payload-flow-guard",
      lawId: RuntimeLogSpineLaw.MODE_VISIBILITY,
      file: input.repoPath,
      line: input.call.line,
      severity: "fatal",
      message: "heavy debug payload is visible in FLOW or built without debug/trace guard",
      hint: "Add correct modeVisibility and guard heavy payload construction with isDebugEnabled/isTraceEnabled.",
    });
  }
};

export const collectModeVisibilityFindings = (context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const inspectedFiles: string[] = [];
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!isRuntimeLogLawSourcePath(repoPath)) continue;
    if (isAuthorizedRuntimeLogHelperPath(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const call of resolveCallsInSourceFile(sourceFile, repoPath).filter((resolvedCall) => resolvedCall.kind === "runtime-log-emit" || resolvedCall.kind === "event-factory")) {
      appendModeVisibilityFindingsForCall({ call, findings, repoPath });
    }
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
