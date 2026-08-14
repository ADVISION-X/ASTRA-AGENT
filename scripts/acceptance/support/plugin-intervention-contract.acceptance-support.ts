import { strict as assert } from "node:assert";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { PluginInterventionRequestSchema } from "../../../src/types/plugin-intervention.js";

type Spec = {
  name: string;
  ownerFiles: string[];
  routeFile: string;
  routePrefix: string;
  handleMethods: string[];
  safePointSymbol: string;
  interventionSymbol: string;
  forbiddenSymbols?: string[];
};

const project = new Project({ tsConfigFilePath: "tsconfig.json" });
const source = (filePath: string): SourceFile => {
  const result = project.getSourceFile(filePath);
  assert(result, `${filePath} must exist in the TypeScript project`);
  return result;
};
const values = (files: SourceFile[]) => new Set(files.flatMap((file) => [
  ...file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
  ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
]));

export const runPluginInterventionContractAcceptance = (spec: Spec): void => {
  assert.equal(PluginInterventionRequestSchema.safeParse({ taskId: "task-1", expectedRevision: 0, reason: "operator", requestId: "request-1" }).success, true);
  assert.equal(PluginInterventionRequestSchema.safeParse({ taskId: "task-1", expectedRevision: 0, reason: "operator", requestId: "request-1", selector: "#unsafe" }).success, false);
  const ownerValues = values(spec.ownerFiles.map(source));
  for (const required of [
    "PluginInterventionRequestSchema", spec.safePointSymbol, spec.interventionSymbol,
    "pause_requested", "paused", "cancel_requested", "cancelled",
    "takeover_requested", "taken_over", "resume", "STALE_INTERVENTION_REVISION",
  ]) assert(ownerValues.has(required), `${spec.name}: missing ${required}`);
  for (const forbidden of spec.forbiddenSymbols ?? []) assert.equal(ownerValues.has(forbidden), false, `${spec.name}: retired ${forbidden} remains`);
  const routeValues = values([source(spec.routeFile)]);
  const routeBase = spec.routePrefix.endsWith("/") ? spec.routePrefix.slice(0, -1) : spec.routePrefix;
  assert(routeValues.has(routeBase), `${spec.name}: explicit local route base missing`);
  for (const handleMethod of spec.handleMethods) {
    assert(routeValues.has(handleMethod), `${spec.name}: named Workbench handle ${handleMethod} missing`);
  }
  const boundary = source("src/app/workbench-api-boundary.ts");
  for (const expectedPath of ["status", "pause", "cancel", "takeover", "resume"].map((action) => `${routeBase}/${action}`)) {
    const rule = boundary.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).find((object) => {
      const property = object.getProperty("path");
      return Node.isPropertyAssignment(property) && Node.isStringLiteral(property.getInitializer())
        && property.getInitializer()?.getText().slice(1, -1) === expectedPath;
    });
    assert(rule, `${spec.name}: API boundary rule ${expectedPath} missing`);
    assert.equal(rule.getProperty("externalApiAllowed")?.getText(), "externalApiAllowed: false");
    assert.equal(rule.getProperty("localUiAllowed")?.getText(), "localUiAllowed: true");
  }
  process.stdout.write(`[ACCEPTANCE][${spec.name}] PASS\n`);
};
