import { Node, SyntaxKind, type CallExpression } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

export type CapabilityGroupFindingInput = Omit<Parameters<typeof createFinding>[0], "evidenceMode">
  & { evidenceMode?: string };

export const createDedupedFindingPusher = (findings: ReturnType<typeof createFinding>[]) => {
  const findingKeys = new Set<string>();
  return (input: CapabilityGroupFindingInput): void => {
    const key = `${input.checkId}:${input.filePath ?? ""}:${input.message}`;
    if (findingKeys.has(key)) return;
    findingKeys.add(key);
    findings.push(createFinding({ ...input, evidenceMode: input.evidenceMode ?? "static.ast" }));
  };
};

const judgeName = (value: string): boolean => {
  const normalized = value.toLocaleLowerCase("en-US");
  const subject = ["semantic", "quality", "professional", "faithful", "strength", "keyword", "similarity", "score"]
    .some((term) => normalized.includes(term));
  const decision = ["assert", "validate", "verify", "ensure", "check", "guard", "gate", "judge", "evaluate", "review", "reject", "block", "retry"]
    .some((term) => normalized.includes(term));
  const heuristic = ["answer", "response", "output", "content", "result"].some((term) => normalized.includes(term))
    && ["keyword", "regex", "length", "score", "similarity", "strength"].some((term) => normalized.includes(term));
  return subject && decision || heuristic;
};

const callName = (call: CallExpression): string => {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression) ? expression.getName() : expression.getText();
};

const decisionSource = (path: string): boolean => path.startsWith("src/plugins/")
  || path.startsWith("src/capabilities/gpt/") || path.startsWith("src/lib/browser/");

const judgeCalls = (project: InspectorContext["project"]) => listActiveSourceFiles(project)
  .filter((source) => decisionSource(getRepoSourcePath(source)))
  .flatMap((source) => source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => judgeName(callName(call))).map((call) => ({ call, path: getRepoSourcePath(source) })));

type InspectionInput = {
  lawId: string;
  project: InspectorContext["project"];
  pushFinding: ReturnType<typeof createDedupedFindingPusher>;
};

export const pushMechanicalContentAstFindings = (input: InspectionInput): void => {
  for (const { call, path } of judgeCalls(input.project)) {
    const name = callName(call);
    input.pushFinding({ checkId: "capability-governance/deterministic-content-judge", lawId: input.lawId,
      filePath: path, evidenceMode: "static.ast", evidence: name,
      message: `${path} invokes deterministic content judge ${name}.` });
  }
};

export const pushMechanicalContentTypeFindings = (input: InspectionInput): void => {
  for (const { call, path } of judgeCalls(input.project)) {
    const name = callName(call);
    const resultType = call.getType().getText(call);
    input.pushFinding({ checkId: "capability-governance/deterministic-content-judge-type", lawId: input.lawId,
      filePath: path, evidenceMode: "static.types", evidence: `${name}:${resultType}`,
      message: `${path} types deterministic content judge ${name} as ${resultType}.` });
  }
};

export const pushMechanicalContentDependencyFindings = (input: InspectionInput): void => {
  for (const source of listActiveSourceFiles(input.project)) {
    const path = getRepoSourcePath(source);
    if (!decisionSource(path)) continue;
    for (const declaration of source.getImportDeclarations()) for (const imported of declaration.getNamedImports()) {
      if (!judgeName(imported.getName())) continue;
      input.pushFinding({ checkId: "capability-governance/deterministic-content-judge-dependency",
        lawId: input.lawId, filePath: path, evidenceMode: "static.dependency",
        evidence: `${declaration.getModuleSpecifierValue()}:${imported.getName()}`,
        message: `${path} imports deterministic content judge ${imported.getName()}.` });
    }
  }
};
