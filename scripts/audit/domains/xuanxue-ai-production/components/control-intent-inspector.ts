import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";

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

export const inspectXuanxueControlIntent = (input: {
  findings: InspectorFinding[];
  lawId: string;
  values: ReadonlySet<string>;
}): void => {
  const ownerPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-control-intent.ts";
  for (const required of [
    "XuanxueAiControlIntent", "readXuanxueAiControlIntent", "applyXuanxueAiControlIntent",
    "acknowledgeXuanxueAiControlIntent", "control_intent", "control_epoch", "control_ack_epoch",
    "pause_requested", "cancel_requested", "handover_requested", "scheduler-dequeue",
    "before-stage-dequeue", "after-response-checkpoint", "before-order-result-commit",
  ]) {
    if (input.values.has(required)) continue;
    input.findings.push(createFinding({ evidenceMode: "static.ast",
      lawId: input.lawId,
      clauseId: "law-xuanxue-ai-production-001-v12-control-intent",
      checkId: "xuanxue-ai-production/control-intent-projection",
      filePath: ownerPath,
      message: `The existing production order must consume the exact website ControlIntent projection and safe point ${required}.`,
    }));
  }
  for (const forbidden of [
    "XuanxueAiInterventionRequest", "requestXuanxueAiIntervention", "INTERVENTION_REQUESTED",
    "/api/xuanxue-ai-production/pause", "/api/xuanxue-ai-production/cancel",
    "/api/xuanxue-ai-production/takeover", "/api/xuanxue-ai-production/resume",
  ]) {
    if (!input.values.has(forbidden)) continue;
    input.findings.push(createFinding({ evidenceMode: "static.ast",
      lawId: input.lawId,
      clauseId: "law-xuanxue-ai-production-001-v12-control-intent",
      checkId: "xuanxue-ai-production/no-second-control-chain",
      filePath: ownerPath,
      message: `The retired Workbench control chain must remain absent: ${forbidden}.`,
    }));
  }
};
