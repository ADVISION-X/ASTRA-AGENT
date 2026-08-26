import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";

const semanticTokens = (value: string): string[] => {
  const separators = new Set([" ", "\n", "\r", "\t", "(", ")", ",", ";", "'", '"', "`", ".", "=", "/", ":"]);
  const tokens: string[] = [];
  let current = "";
  for (const character of value) {
    if (!separators.has(character)) {
      current += character;
      continue;
    }
    if (current) tokens.push(current);
    current = "";
  }
  if (current) tokens.push(current);
  return tokens;
};

export const collectXuanxueSourceValues = (sources: readonly SourceFile[]): Set<string> => new Set(
  sources.flatMap((file) => {
    const literals = [
      ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
      ...file.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).map((node) => node.getText()),
    ];
    return [
      ...file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
      ...file.getDescendantsOfKind(SyntaxKind.NumericLiteral).map((node) => node.getText()),
      ...literals,
      ...literals.flatMap(semanticTokens),
    ];
  }),
);

export const inspectXuanxueLocalIntervention = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  lawId: string;
  values: ReadonlySet<string>;
}): void => {
  const ownerPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-intervention.ts";
  for (const required of [
    "XuanxueAiInterventionRequest", "requestXuanxueAiIntervention",
    "acknowledgeXuanxueAiIntervention", "INTERVENTION_REQUESTED", "INTERVENTION_ACK",
    "expectedRevision", "requestId", "before-stage-dequeue", "after-response-checkpoint",
    "before-order-result-commit", "/api/xuanxue-ai-production/pause", "/api/xuanxue-ai-production/cancel",
    "/api/xuanxue-ai-production/takeover", "/api/xuanxue-ai-production/resume",
  ]) {
    if (!input.values.has(required)) input.findings.push(createFinding({ evidenceMode: "static.ast",
      lawId: input.lawId,
      clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
      checkId: "xuanxue-ai-production/local-intervention-contract",
      filePath: ownerPath,
      message: `Local whole-order intervention must contain ${required}.`,
    }));
  }
  const cloudPaths = [
    "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.ts",
    "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts",
  ];
  const cloudSources = cloudPaths.flatMap((filePath) => {
    const source = input.context.project.getSourceFile(resolveFromRepo(filePath));
    return source ? [source] : [];
  });
  const cloudValues = collectXuanxueSourceValues(cloudSources);
  for (const forbidden of ["INTERVENTION_REQUESTED", "pending_request", "expectedRevision", "takeoverOrder", "pauseOrder"]) {
    if (cloudValues.has(forbidden)) input.findings.push(createFinding({ evidenceMode: "static.ast",
      lawId: input.lawId,
      clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
      checkId: "xuanxue-ai-production/no-cloud-intervention-ingress",
      filePath: cloudPaths[0],
      message: `Cloud transport must not contain local intervention token ${forbidden}.`,
    }));
  }
};
