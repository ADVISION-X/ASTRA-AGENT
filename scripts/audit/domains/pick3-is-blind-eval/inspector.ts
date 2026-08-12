import { existsSync, readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const domain = "pick3-is-blind-eval";
const pluginRoot = "src/plugins/pick3-is-blind-eval";
const sourcePaths = [
  `${pluginRoot}/index.ts`,
  `${pluginRoot}/pick3-is-blind-eval.sync.ts`,
  `${pluginRoot}/pick3-is-blind-eval.official-api.ts`,
  `${pluginRoot}/pick3-is-blind-eval.image.ts`,
  `${pluginRoot}/pick3-is-blind-eval.flow.ts`,
  `${pluginRoot}/pick3-is-blind-eval.schema.ts`,
  `${pluginRoot}/pick3-is-blind-eval.ai.ts`,
  `${pluginRoot}/pick3-is-blind-eval.ai-parse.ts`,
  `${pluginRoot}/pick3-is-blind-eval.scoring.ts`,
  `${pluginRoot}/pick3-is-blind-eval.prompt-versioning.ts`,
  `${pluginRoot}/pick3-is-blind-eval.failure-review.ts`,
  `${pluginRoot}/pick3-is-blind-eval.playbook.ts`,
  `${pluginRoot}/pick3-is-blind-eval.playbook-lessons.ts`,
  `${pluginRoot}/pick3-is-blind-eval.trend.ts`,
  `${pluginRoot}/pick3-is-blind-eval.stability.ts`,
  `${pluginRoot}/pick3-is-blind-eval.history.ts`,
  `${pluginRoot}/pick3-is-blind-eval.storage-schema.ts`,
  "src/app/workbench-pick3-routes.ts",
  "src/app/workbench-api-boundary.ts",
  "src/app/workbench-home-pick3-history-client.ts",
  "src/app/workbench-home-pick3-trend-client.ts",
  "src/lib/local-runtime/workbench-pick3-support.ts",
  "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts",
] as const;
const requiredNonSourcePaths = [
  `${pluginRoot}/playbooks/system.md`,
  `${pluginRoot}/playbooks/visual-grammar.md`,
  `${pluginRoot}/playbooks/free-analysis-strict-reasoning.md`,
  "scripts/acceptance/pick3-is-blind-eval.acceptance.ts",
  "scripts/acceptance/pick3-is-blind-eval-free-analysis.acceptance.ts",
  "scripts/acceptance/pick3-is-blind-eval-full-history.acceptance.ts",
  "scripts/acceptance/pick3-is-blind-eval-playbook-lessons.acceptance.ts",
] as const;

type SourceFacts = {
  numericValues: ReadonlySet<number>;
  values: ReadonlySet<string>;
};

const sourceFacts = (sourceFiles: readonly SourceFile[]): SourceFacts => ({
  numericValues: new Set(sourceFiles.flatMap((file) =>
    file.getDescendantsOfKind(SyntaxKind.NumericLiteral).map((literal) => literal.getLiteralValue()))),
  values: new Set(sourceFiles.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => String(identifier.compilerNode.escapedText)),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).map((property) => property.getName()),
  ])),
});

const hasValue = (facts: SourceFacts, expected: string): boolean =>
  facts.values.has(expected);

const hasValuePart = (facts: SourceFacts, expected: string): boolean =>
  [...facts.values].some((value) => value.includes(expected));

const addMissingFactsFinding = (input: {
  checkId: string;
  facts: SourceFacts;
  filePath: string;
  lawId: string;
  numericValues?: readonly number[];
  values?: readonly string[];
  valueParts?: readonly string[];
  findings: InspectorFinding[];
}): void => {
  const missing = [
    ...(input.values ?? []).filter((value) => !hasValue(input.facts, value)),
    ...(input.valueParts ?? []).filter((value) => !hasValuePart(input.facts, value)),
    ...(input.numericValues ?? []).filter((value) => !input.facts.numericValues.has(value)).map(String),
  ];
  if (missing.length === 0) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} is missing governed AST facts: ${missing.join(", ")}.`,
  }));
};

const lawId = (context: InspectorContext, preferred: string): string =>
  selectLawId(context.planEntry.lawIds, preferred);

type GovernedFactContract = {
  checkId: string;
  filePath: string;
  preferredLawId: string;
  numericValues?: readonly number[];
  values?: readonly string[];
  valueParts?: readonly string[];
};

const governedFactContracts: readonly GovernedFactContract[] = [
  {
    checkId: "pick3-is-blind-eval/owner-flow",
    filePath: `${pluginRoot}/pick3-is-blind-eval.flow.ts`,
    preferredLawId: "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1",
    values: ["syncOfficialDraws", "createPick3BlindImages", "scorePick3Predictions"],
  },
  {
    checkId: "pick3-is-blind-eval/official-source",
    filePath: `${pluginRoot}/pick3-is-blind-eval.official-api.ts`,
    preferredLawId: "GRASSEYE-PICK3-IS-BLIND-EVAL-002-V1",
    values: ["lotteryType"],
    numericValues: [72, 660301],
  },
  {
    checkId: "pick3-is-blind-eval/blind-boundary",
    filePath: `${pluginRoot}/pick3-is-blind-eval.image.ts`,
    preferredLawId: "GRASSEYE-PICK3-IS-BLIND-EVAL-003-V1",
    values: ["PICK3_WINDOW_SIZE", "revealPick3Predictions", "predictionLabel"],
    numericValues: [80],
  },
  {
    checkId: "pick3-is-blind-eval/prompt-repair",
    filePath: `${pluginRoot}/pick3-is-blind-eval.failure-review.ts`,
    preferredLawId: "GRASSEYE-PICK3-IS-BLIND-EVAL-004-V1",
    values: ["reviewPick3Failures", "failureReviewId", "repairInstruction"],
  },
  {
    checkId: "pick3-is-blind-eval/statistical-honesty",
    filePath: `${pluginRoot}/pick3-is-blind-eval.scoring.ts`,
    preferredLawId: "GRASSEYE-PICK3-IS-BLIND-EVAL-005-V1",
    values: ["randomBaseline", "confidence", "abstain"],
  },
  {
    checkId: "pick3-is-blind-eval/agent-brain",
    filePath: `${pluginRoot}/pick3-is-blind-eval.playbook.ts`,
    preferredLawId: "GRASSEYE-PICK3-IS-BRAIN-006-V1",
    values: ["playbookVersionId", "promptPackageId"],
  },
  {
    checkId: "pick3-is-blind-eval/prompt-exchange",
    filePath: `${pluginRoot}/pick3-is-blind-eval.ai.ts`,
    preferredLawId: "GRASSEYE-PICK3-AI-PROMPT-EXCHANGE-007-V1",
    values: ["aiInputGateway", "rawResponseText", "providerProof"],
  },
  {
    checkId: "pick3-is-blind-eval/stability-mode",
    filePath: `${pluginRoot}/pick3-is-blind-eval.stability.ts`,
    preferredLawId: "GRASSEYE-PICK3-NEXT-PREDICTION-STABILITY-008-V1",
    values: ["next_prediction_stability", "batchSize"],
  },
  {
    checkId: "pick3-is-blind-eval/human-review-history",
    filePath: `${pluginRoot}/pick3-is-blind-eval.history.ts`,
    preferredLawId: "GRASSEYE-PICK3-HUMAN-REVIEW-HISTORY-009-V1",
    values: ["rawResponseText", "observedDistribution", "phaseReports"],
  },
  {
    checkId: "pick3-is-blind-eval/trend-display",
    filePath: `${pluginRoot}/pick3-is-blind-eval.trend.ts`,
    preferredLawId: "GRASSEYE-PICK3-TREND-DISPLAY-010-V1",
    values: ["listPick3TrendSnapshot", "windowSize", "hundreds", "tens", "ones"],
  },
  {
    checkId: "pick3-is-blind-eval/playbook-lessons",
    filePath: `${pluginRoot}/pick3-is-blind-eval.playbook-lessons.ts`,
    preferredLawId: "GRASSEYE-PICK3-PLAYBOOK-LESSON-STORE-011-V1",
    values: ["reviewPick3PlaybookLessons", "playbookLessons", "candidateLesson", "aggregateKey"],
  },
] as const;

const inspectGovernedFacts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  facts: SourceFacts,
): void => {
  for (const contract of governedFactContracts) {
    addMissingFactsFinding({
      checkId: contract.checkId,
      facts,
      filePath: contract.filePath,
      lawId: lawId(context, contract.preferredLawId),
      ...(contract.numericValues ? { numericValues: contract.numericValues } : {}),
      ...(contract.values ? { values: contract.values } : {}),
      ...(contract.valueParts ? { valueParts: contract.valueParts } : {}),
      findings,
    });
  }
};

const inspectPhysicalDelete = (
  context: InspectorContext,
  findings: InspectorFinding[],
  deleteLawId: string,
): void => {
  const clientPath = "src/app/workbench-home-pick3-history-client.ts";
  const client = context.project.getSourceFile(resolveFromRepo(clientPath));
  const hasNativeConfirm = client?.getDescendants().some((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      return Node.isPropertyAccessExpression(expression)
        && Node.isIdentifier(expression.getExpression())
        && expression.getExpression().getText() === "window"
        && expression.getName() === "confirm";
    }
    return (Node.isStringLiteral(node)
      || Node.isNoSubstitutionTemplateLiteral(node)
      || Node.isTemplateHead(node)
      || Node.isTemplateMiddle(node)
      || Node.isTemplateTail(node))
      && node.getLiteralText().includes("window.confirm(");
  }) ?? false;
  const routes = context.project.getSourceFile(resolveFromRepo("src/app/workbench-pick3-routes.ts"));
  const routeLiterals = new Set(routes?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText()) ?? []);
  const hasDeleteRoute = routeLiterals.has("DELETE")
    && routeLiterals.has("/api/pick3-is-blind-eval/task")
    && Boolean(routes?.getDescendantsOfKind(SyntaxKind.Identifier)
      .some((identifier) => identifier.getText() === "handlePick3DeleteTask"));
  if (!hasNativeConfirm || !hasDeleteRoute) {
    findings.push(createFinding({
      checkId: "pick3-is-blind-eval/physical-delete",
      lawId: deleteLawId,
      filePath: clientPath,
      message: "Pick3 history physical delete requires the governed DELETE route and a native browser confirmation.",
    }));
  }
};

const inspectPackageScripts = (findings: InspectorFinding[], primaryLawId: string): void => {
  const packagePath = "package.json";
  const packageJson = JSON.parse(readFileSync(resolveFromRepo(packagePath), "utf8")) as {
    scripts?: Record<string, string>;
  };
  for (const scriptName of ["audit:pick3-is-blind-eval", "acceptance:pick3-is-blind-eval"]) {
    if (packageJson.scripts?.[scriptName]) {
      continue;
    }
    findings.push(createFinding({
      checkId: "pick3-is-blind-eval/package-scripts",
      lawId: primaryLawId,
      filePath: packagePath,
      message: `package.json must expose ${scriptName}.`,
    }));
  }
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const findings: InspectorFinding[] = [];
  const inspectedFiles = [...sourcePaths, ...requiredNonSourcePaths, "package.json"];
  const sourceFiles = sourcePaths.flatMap((repoPath) => {
    const sourceFile = context.project.getSourceFile(resolveFromRepo(repoPath));
    if (sourceFile) {
      return [sourceFile];
    }
    findings.push(createFinding({
      checkId: "pick3-is-blind-eval/file-present",
      lawId: lawId(context, "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1"),
      filePath: repoPath,
      message: `${repoPath} must exist in the audit project.`,
    }));
    return [];
  });
  for (const repoPath of requiredNonSourcePaths) {
    if (!existsSync(resolveFromRepo(repoPath))) {
      findings.push(createFinding({
        checkId: "pick3-is-blind-eval/file-present",
        lawId: lawId(context, "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1"),
        filePath: repoPath,
        message: `${repoPath} must exist.`,
      }));
    }
  }
  const facts = sourceFacts(sourceFiles);
  inspectGovernedFacts(context, findings, facts);
  inspectPhysicalDelete(
    context,
    findings,
    lawId(context, "GRASSEYE-PICK3-HISTORY-PHYSICAL-DELETE-010-V1"),
  );
  inspectPackageScripts(findings, lawId(context, "GRASSEYE-PICK3-IS-BLIND-EVAL-001-V1"));

  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles: inspectedFiles.sort(),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("pick3-is-blind-eval requires a runner-owned check session.");
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
