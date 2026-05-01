import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasLiteralTextFragment } from "../_shared/ast-literal-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { ROOT } from "./constants.js";
import type { Project } from "ts-morph";

function collectExecutorFindings(project: Project): Finding[] {
  const findings: Finding[] = [];
  const executorSource = getSource(project, `${ROOT}/runtime/page-state-executor.ts`);
  for (const callee of ["gatePageStatePayloadBudget", "gateObservationProofBinding", "buildPageStateRuntimeProof", "buildPageStateResult"]) {
    if (!hasCallExpression(executorSource, callee)) {
      findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V1", file: `${ROOT}/runtime/page-state-executor.ts`, line: 1, severity: "fatal", message: `Page State executor must not bypass ${callee}.` }));
    }
  }
  return findings;
}

function collectProfileGateFindings(project: Project): Finding[] {
  const profileGateSource = getSource(project, `${ROOT}/runtime/platform-profile-gate.ts`);
  return hasLiteralTextFragment(profileGateSource, "profileId === expectedProfileId") && !hasLiteralTextFragment(profileGateSource, "matchedHost")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/runtime/platform-profile-gate.ts`, line: 1, severity: "fatal", message: "Platform profile resolution must not allow profileId match without host match." })]
    : [];
}

function collectPlatformKindFindings(project: Project): Finding[] {
  const platformKindSource = getSource(project, `${ROOT}/children/detect-platform-page-kind/implementation.ts`);
  const hasLocalhostIncludesBypass = platformKindSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "includes") {
      return false;
    }

    return callExpression.getArguments().some((argument) => Node.isStringLiteral(argument)
      && (argument.getLiteralText() === "localhost" || argument.getLiteralText() === "127.0.0.1"));
  });

  return hasLocalhostIncludesBypass
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/children/detect-platform-page-kind/implementation.ts`, line: 1, severity: "fatal", message: "Platform page-kind child must not use URL includes for localhost detection." })]
    : [];
}

function collectFeedReadyFindings(project: Project): Finding[] {
  const feedReadySource = getSource(project, `${ROOT}/children/detect-feed-ready/implementation.ts`);
  return hasLiteralTextFragment(feedReadySource, "path === \"/foryou\"") || hasLiteralTextFragment(feedReadySource, "path.startsWith(\"/@\")")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/children/detect-feed-ready/implementation.ts`, line: 1, severity: "fatal", message: "Feed-ready child must not hardcode TikTok-only paths." })]
    : [];
}

function collectDispatchFailureFindings(project: Project): Finding[] {
  const dispatchFailureSource = getSource(project, `${ROOT}/runtime/page-state-dispatch-failure.ts`);
  return hasLiteralTextFragment(dispatchFailureSource, "invalid-mission") || hasLiteralTextFragment(dispatchFailureSource, "https://invalid.local/")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/runtime/page-state-dispatch-failure.ts`, line: 1, severity: "fatal", message: "Invalid input handling must not forge fake mission or URL context." })]
    : [];
}

function collectSchemaFindings(project: Project): Finding[] {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  return !hasLiteralTextFragment(schemaSource, "failed or review_required result must null output")
    || !hasLiteralTextFragment(schemaSource, "failed or review_required proof must null outputRef")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V1", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Schema anti-escape rules for output/outputRef are missing." })]
    : [];
}

export async function runAntiEscape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...collectExecutorFindings(project),
    ...collectProfileGateFindings(project),
    ...collectPlatformKindFindings(project),
    ...collectFeedReadyFindings(project),
    ...collectDispatchFailureFindings(project),
    ...collectSchemaFindings(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-anti-escape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State anti-escape checks are closed." : "Page State still allows one or more anti-escape bypasses."),
  };
}