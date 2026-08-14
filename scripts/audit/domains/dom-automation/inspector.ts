import { type InspectorContext, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectDomBoundaries } from "./components/inspect-dom-boundaries.js";
import { inspectDomContracts } from "./components/inspect-dom-contracts.js";
import { inspectDomFoundationGates } from "./components/inspect-dom-foundation-gates.js";
import { inspectDomRuntimeGuards } from "./components/inspect-dom-runtime-guards.js";
import { createDomFindingCollector } from "./components/dom-inspector-support.js";
import { createFinding } from "../../shared/finding-utils.js";
import { SyntaxKind } from "ts-morph";
import { resolveFromRepo } from "../../shared/paths.js";

const inspectExactTargetBinding = (context: InspectorContext) => {
  const findings = [];
  const lawId = "APEX-DOM-020-V1";
  const clauseId = "apex-dom-020-requirement";
  const paths = [
    "src/capabilities/dom-automation/schema.ts",
    "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
    "src/capabilities/dom-automation/runtime/dom-target-binding.ts",
  ];
  const identifiers = new Set(paths.flatMap((filePath) => context.project
    .getSourceFile(resolveFromRepo(filePath))
    ?.getDescendantsOfKind(SyntaxKind.Identifier)
    .map((node) => node.getText()) ?? []));
  const stringLiterals = new Set(paths.flatMap((filePath) => context.project
    .getSourceFile(resolveFromRepo(filePath))
    ?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((node) => node.getLiteralText()) ?? []));
  for (const required of ["targetRef", "documentRef", "assertDomTargetBinding", "DOCUMENT_STALE", "TARGET_FOREIGN_SESSION"]) {
    if (!identifiers.has(required) && !stringLiterals.has(required)) findings.push(createFinding({
      checkId: "dom-automation/owner-assertion-set",
      lawId,
      clauseId,
      filePath: paths[0],
      message: `document-bound DOM contract is missing ${required}`,
    }));
  }
  return findings;
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const project = context.project;
  const scopedContext = { ...context, project };
  const collector = createDomFindingCollector();

  inspectDomContracts(scopedContext, collector);
  inspectDomRuntimeGuards(scopedContext, collector);
  const inspectedFiles = inspectDomBoundaries(scopedContext, collector);
  inspectDomFoundationGates(scopedContext, collector);
  collector.findings.push(...inspectExactTargetBinding(context));

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings: collector.findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("dom-automation requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
