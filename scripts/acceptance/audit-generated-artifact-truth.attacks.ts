import assert from "node:assert/strict";

import { Node, Project, SyntaxKind } from "ts-morph";

import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import {
  generatedArtifactFileSetIsExact,
  inspectGeneratedArtifactTruthContract,
} from "../audit/domains/audit-system/generated-artifact-truth-inspector.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo } from "../audit/shared/paths.js";

const createContext = (project: Project): InspectorContext => {
  const generatedPlan = loadGeneratedAuditPlan();
  const planEntry = generatedPlan.find((entry) => entry.capabilityDomain === "audit-system");
  if (!planEntry) throw new Error("audit-system plan entry is missing.");
  return {
    checks: createInspectorCheckSession(planEntry, "acceptance-run:audit-generated-artifact-truth").checks,
    completedReports: {},
    generatedPlan,
    planEntry,
    project,
  };
};

const freshProject = (): Project => new Project({ tsConfigFilePath: resolveFromRepo("tsconfig.json") });

const hasFinding = (project: Project): boolean =>
  inspectGeneratedArtifactTruthContract(createContext(project), "APEX-AUDIT-008-V1").findings
    .some((finding) => finding.checkId === "audit-system/generated-artifact-truth");

const runCoverageAttack = (): void => {
  const project = freshProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const verifier = source.getVariableDeclarationOrThrow("verifyGeneratedArtifactTruthStep")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const machineCoverage = verifier.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((expression) => {
    const left = expression.getLeft();
    return Node.isPropertyAccessExpression(left) && left.getName() === "machineFacetClauseCount";
  });
  if (!machineCoverage) throw new Error("generated truth machine coverage fixture is missing.");
  machineCoverage.replaceWithText("true");
  assert.equal(hasFinding(project), true,
    "meta governance must reject generated truth that no longer proves all machine clauses executed.");
};

const runProviderCoverageAttack = (): void => {
  const project = freshProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const verifier = source.getVariableDeclarationOrThrow("verifyGeneratedArtifactTruthStep")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const providerCoverage = verifier.getDescendantsOfKind(SyntaxKind.BinaryExpression).find((expression) => {
    const left = expression.getLeft();
    return Node.isPropertyAccessExpression(left) && left.getName() === "deferredRealProviderFacetCount";
  });
  if (!providerCoverage) throw new Error("generated truth real-provider coverage fixture is missing.");
  providerCoverage.replaceWithText("true");
  assert.equal(hasFinding(project), true,
    "meta governance must reject generated truth that collapses or omits the real-provider facet.");
};

const runReceiptLawAttack = (): void => {
  const project = freshProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const verifier = source.getVariableDeclarationOrThrow("verifyGeneratedArtifactTruthStep")
    .getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const stepCall = verifier.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "createStepResult");
  const argument = stepCall?.getArguments()[0];
  const lawProperty = Node.isObjectLiteralExpression(argument) ? argument.getProperty("lawId") : undefined;
  if (!Node.isPropertyAssignment(lawProperty)) throw new Error("generated truth step law fixture is missing.");
  lawProperty.setInitializer('"APEX-AUDIT-008-V1"');
  assert.equal(hasFinding(project), true,
    "meta governance must reject a generated truth receipt detached from APEX-AUDIT-004-V1.");
};

const runOrderAttack = (): void => {
  const project = freshProject();
  const source = project.getSourceFileOrThrow(resolveFromRepo("scripts/audit/ci-full.ts"));
  const main = source.getVariableDeclarationOrThrow("main").getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction);
  const body = main.getBody().asKindOrThrow(SyntaxKind.Block);
  const ownerPlan = body.getVariableDeclarationOrThrow("auditPlanStep").getVariableStatementOrThrow();
  const generatedTruth = body.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) =>
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "runGeneratedArtifactTruthOrFail")
    ?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!generatedTruth) throw new Error("generated truth order fixture is missing.");
  const ownerPlanText = ownerPlan.getText();
  const generatedTruthText = generatedTruth.getText();
  ownerPlan.replaceWithText(generatedTruthText);
  generatedTruth.replaceWithText(ownerPlanText);
  assert.equal(hasFinding(project), true,
    "meta governance must reject generated truth verification scheduled before owner execution.");
};

const runExtraGeneratedArtifactAttack = (): void => {
  const generatedPlan = loadGeneratedAuditPlan();
  const domains = generatedPlan.map((entry) => entry.capabilityDomain);
  const valid = [
    "audit-conflicts.generated.json", "audit-plan.generated.json",
    "ci-full-summary.generated.json", "enforcement-matrix.generated.json",
    "enforcement-matrix.generated.yaml", "law-registry.generated.json",
    "static-clause-coverage.generated.json",
    ...domains.map((domain) => `${domain}-report.generated.json`),
    "local-app-shell-report.generated.md", "local-browser-session-report.generated.md",
    "runtime-log-spine-report.generated.md",
  ];
  assert.equal(generatedArtifactFileSetIsExact(valid, domains), true);
  assert.equal(
    generatedArtifactFileSetIsExact([...valid, "retired-owner-report.generated.json"], domains),
    false,
    "an extra retired generated truth artifact must change the audit-system verdict",
  );
};

export const runGeneratedArtifactTruthAttacks = (): void => {
  assert.equal(hasFinding(freshProject()), false, "current generated truth contract must satisfy meta governance.");
  runCoverageAttack();
  runProviderCoverageAttack();
  runReceiptLawAttack();
  runOrderAttack();
  runExtraGeneratedArtifactAttack();
};
