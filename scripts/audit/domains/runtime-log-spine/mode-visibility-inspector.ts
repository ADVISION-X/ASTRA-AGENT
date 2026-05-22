import { SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import { getArrayLiteralPropertyValues, getNestedObject, getPropertyInitializer, hasProperty } from "./ast/ast-object-literal-reader.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { isAuthorizedRuntimeLogHelperPath, isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

const heavyPayloadKeys = /\b(raw|rawOutput|prompt|fullPrompt|html|bodyText|dom|selectorCandidates|comments|signature|before|after|videoFacts|uploadState|browserState|candidateValidation)\b/u;

const hasInvalidModeVisibility = (input: {
  objectLiteral: Parameters<typeof hasProperty>[0];
  values: string[] | null;
}): boolean => !hasProperty(input.objectLiteral, "modeVisibility")
  || input.values === null
  || input.values.length === 0
  || input.values.some((value) => !["FLOW", "DEBUG", "TRACE"].includes(value));

const shouldFlagHeavyPayloadFlow = (input: {
  values: string[] | null;
  payloadText: string;
  nearbyText: string;
}): boolean => (input.values ?? []).includes("FLOW")
  && heavyPayloadKeys.test(input.payloadText)
  && !/isDebugEnabled\(|isTraceEnabled\(/u.test(input.nearbyText);

const appendModeVisibilityFindingsForCall = (input: {
  call: ReturnType<typeof resolveCallsInSourceFile>[number];
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
  sourceFile: SourceFile;
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
  const payloadText = payload?.getText() ?? getPropertyInitializer(objectLiteral, "payload")?.getText() ?? "";
  const nearbyText = input.sourceFile.getText().slice(Math.max(0, objectLiteral.getStart() - 900), objectLiteral.getEnd() + 900);
  if (shouldFlagHeavyPayloadFlow({ values, payloadText, nearbyText })) {
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
      appendModeVisibilityFindingsForCall({ call, findings, repoPath, sourceFile });
    }
  }
  return { findings, inspectedFiles: inspectedFiles.sort() };
};
