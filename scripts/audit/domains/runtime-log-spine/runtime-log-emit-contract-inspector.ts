import { Node, SyntaxKind } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";
import { resolveCallsInSourceFile } from "./ast/ast-call-resolver.js";
import {
  containsUnresolvedSpread,
  getNestedObject,
  getStringLiteralProperty,
  hasNestedProperty,
  hasProperty,
  isEventTypeFromRegistry,
} from "./ast/ast-object-literal-reader.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { isAuthorizedRuntimeLogHelperPath, isRuntimeLogLawSourcePath } from "./runtime-log-scope.js";

const requiredTopLevelFields = ["traceId", "level", "modeVisibility", "eventType", "owner"] as const;
const requiredEventFactoryFields = ["context", "level", "modeVisibility", "eventType"] as const;
const failurePayloadFields = ["failureClass", "stageName", "retryable", "terminal", "recoveryPolicy"] as const;
const authorizedHelperNames = [
  "createRuntimeEvent",
  "createStageLogger",
] as const;

type ResolvedRuntimeLogCall = ReturnType<typeof resolveCallsInSourceFile>[number];

const buildEmitContractHint = (input: {
  kind: ResolvedRuntimeLogCall["kind"];
  missing: readonly string[];
  unresolvedSpread: boolean;
}): string => `${input.kind === "event-factory"
  ? "createRuntimeEvent input must include context, level, modeVisibility, and eventType."
  : "Add traceId, level, modeVisibility, eventType, owner and mission/run/round identifiers."} Failed/review_required/skipped events must include failureClass contract.${input.missing.length > 0 ? ` Missing: ${input.missing.join(", ")}.` : input.unresolvedSpread ? " Spread fields must be statically proven." : ""}`;

const appendTraceContractFindingIfNeeded = (input: {
  call: ResolvedRuntimeLogCall;
  findings: RuntimeLogSpineFinding[];
  firstArg: NonNullable<ResolvedRuntimeLogCall["objectLiteralArg"]>;
  repoPath: string;
}): void => {
  const unresolvedSpread = containsUnresolvedSpread(input.firstArg);
  const requiredFields = input.call.kind === "event-factory" ? requiredEventFactoryFields : requiredTopLevelFields;
  const missing = requiredFields.filter((field) => !hasProperty(input.firstArg, field));
  if (missing.length === 0 && !unresolvedSpread) {
    return;
  }
  input.findings.push({
    checkId: "runtime-log-spine/emit-trace-contract",
    lawId: RuntimeLogSpineLaw.TRACE_CONTRACT,
    file: input.repoPath,
    line: input.call.line,
    severity: "fatal",
    message: "RuntimeLogger.emit contract is incomplete",
    hint: buildEmitContractHint({ kind: input.call.kind, missing, unresolvedSpread }),
  });
};

const appendEventTypeRegistryFindingIfNeeded = (input: {
  call: ResolvedRuntimeLogCall;
  findings: RuntimeLogSpineFinding[];
  firstArg: NonNullable<ResolvedRuntimeLogCall["objectLiteralArg"]>;
  repoPath: string;
}): void => {
  if (!hasProperty(input.firstArg, "eventType") || isEventTypeFromRegistry(input.firstArg)) {
    return;
  }
  const eventType = input.firstArg.getProperty("eventType");
  if (!eventType || !Node.isPropertyAssignment(eventType)) {
    return;
  }
  input.findings.push({
    checkId: "runtime-log-spine/emit-event-type-registry",
    lawId: RuntimeLogSpineLaw.EVENT_REGISTRY,
    file: input.repoPath,
    line: input.call.line,
    severity: "fatal",
    message: "eventType is not proven to come from RuntimeLogEventType registry",
    hint: "Import RuntimeLogEventType from the runtime log registry and use RuntimeLogEventType.X directly or through a traceable constant.",
  });
};

const appendFailureContractFindingIfNeeded = (input: {
  call: ResolvedRuntimeLogCall;
  findings: RuntimeLogSpineFinding[];
  firstArg: NonNullable<ResolvedRuntimeLogCall["objectLiteralArg"]>;
  repoPath: string;
}): void => {
  const statusText = getStringLiteralProperty(input.firstArg, "status") ?? "";
  if (!["failed", "review_required", "skipped"].includes(statusText)) {
    return;
  }
  const payload = getNestedObject(input.firstArg, "payload");
  const missingFailureFields = failurePayloadFields.filter((field) => !payload || !hasProperty(payload, field));
  if (missingFailureFields.length === 0 && hasNestedProperty(input.firstArg, ["payload", "failureClass"])) {
    return;
  }
  input.findings.push({
    checkId: "runtime-log-spine/emit-failure-contract",
    lawId: RuntimeLogSpineLaw.FAILURE_CLASS,
    file: input.repoPath,
    line: input.call.line,
    severity: "fatal",
    message: "failure status lacks RuntimeFailureClass enum contract",
    hint: `Add payload.failureClass using RuntimeFailureClass.X and include stageName/retryable/terminal/recoveryPolicy. Missing: ${missingFailureFields.join(", ")}.`,
  });
};

const appendRuntimeEmitFindingsForCall = (input: {
  call: ResolvedRuntimeLogCall;
  emitCallCount: number;
  findings: RuntimeLogSpineFinding[];
  repoPath: string;
}): number => {
  const firstArg = input.call.objectLiteralArg;
  if (!firstArg) {
    return input.emitCallCount + (input.call.kind === "runtime-log-emit" ? 1 : 0);
  }
  const nextEmitCallCount = input.emitCallCount + 1;
  appendTraceContractFindingIfNeeded({ call: input.call, findings: input.findings, firstArg, repoPath: input.repoPath });
  appendEventTypeRegistryFindingIfNeeded({ call: input.call, findings: input.findings, firstArg, repoPath: input.repoPath });
  appendFailureContractFindingIfNeeded({ call: input.call, findings: input.findings, firstArg, repoPath: input.repoPath });
  return nextEmitCallCount;
};

const appendAuthorizedHelperPresentFindings = (context: InspectorContext, findings: RuntimeLogSpineFinding[]): void => {
  for (const helperName of authorizedHelperNames) {
    if (context.project.getSourceFiles().some((sourceFile) =>
      sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
        .some((identifier) => astIdentifierName(identifier) === helperName))) {
      continue;
    }
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
};

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
    if (!isRuntimeLogLawSourcePath(repoPath)) continue;
    if (isAuthorizedRuntimeLogHelperPath(repoPath)) continue;
    inspectedFiles.push(repoPath);
    for (const call of resolveCallsInSourceFile(sourceFile, repoPath).filter((resolvedCall) => resolvedCall.kind === "runtime-log-emit" || resolvedCall.kind === "event-factory")) {
      emitCallCount = appendRuntimeEmitFindingsForCall({ call, emitCallCount, findings, repoPath });
    }
  }

  appendAuthorizedHelperPresentFindings(context, findings);
  return { findings, inspectedFiles: inspectedFiles.sort(), emitCallCount };
};
