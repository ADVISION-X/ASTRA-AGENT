import { SyntaxKind, type Project } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";

import { LAW_IDS } from "./config.js";
import { runPostActionGovernedRuntimeFixtures } from "./governed-runtime-fixtures.js";
import { getSource } from "./project-access.js";

const EXECUTOR_PATH = "src/lib/local-runtime/workbench-ability-command-executor.ts";
const BUILDER_PATH = "src/lib/local-runtime/workbench-post-action-dispatch-input.ts";

type RuntimePhaseResult = {
  findings: Finding[];
  phase: InspectorPhase;
};

function createRuntimePhase(name: string, findings: Finding[], passSummary: string, failSummary: string): RuntimePhaseResult {
  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? passSummary : failSummary),
  };
}

function inspectLocalRuntimeRoute(project: Project): RuntimePhaseResult {
  const executorSource = getSource(project, EXECUTOR_PATH);
  const callExpression = executorSource.getDescendantsOfKind(SyntaxKind.CallExpression).find((node) => node.getExpression().getText() === "buildPostActionVerificationInput") ?? null;
  const findings: Finding[] = [];

  if (callExpression === null) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: EXECUTOR_PATH, line: 1, severity: "fatal", message: "Local runtime must route post-action-verification dispatch through buildPostActionVerificationInput." }));
  } else {
    const args = callExpression.getArguments().map((arg) => arg.getText());
    if (args.length !== 3 || args[0] !== "runtime") {
      findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: EXECUTOR_PATH, line: callExpression.getStartLineNumber(), severity: "fatal", message: "Local runtime must pass the governed runtime into buildPostActionVerificationInput so page-state observations come from the current browser session." }));
    }
  }

  return createRuntimePhase(
    "local-runtime-route",
    findings,
    "Local runtime routes post-action verification through the governed builder with runtime session access.",
    "Local runtime no longer routes post-action verification through the governed builder/runtime handoff.",
  );
}

export async function runGovernedRuntimeChecks(project: Project): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const localRuntimeRoute = inspectLocalRuntimeRoute(project);
  const governedFixtureFindings: Finding[] = [];

  try {
    await runPostActionGovernedRuntimeFixtures();
  } catch (error) {
    governedFixtureFindings.push(createFinding({
      lawId: LAW_IDS.PROOF,
      file: BUILDER_PATH,
      line: 1,
      severity: "fatal",
      message: error instanceof Error ? error.message : "Post Action Verification governed runtime fixture failed.",
    }));
  }

  const governedFixtures = createRuntimePhase(
    "governed-runtime-fixtures",
    governedFixtureFindings,
    "Governed PAV fixtures prove builder/schema parity, confidence-policy propagation, invalid-input fallback integrity, generic before/after gate enforcement, and observation-only page-open verification success.",
    "Governed PAV fixtures still expose builder drift, confidence-policy regression, invalid-input fallback regression, broken before/after gate enforcement, or broken observation-only page-open verification.",
  );

  return {
    findings: [...localRuntimeRoute.findings, ...governedFixtures.findings],
    phases: [localRuntimeRoute.phase, governedFixtures.phase],
  };
}
