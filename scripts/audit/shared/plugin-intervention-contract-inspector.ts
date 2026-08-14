import { Node, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "./finding-utils.js";
import type { InspectorContext, InspectorFinding } from "./inspector-contracts.js";
import { resolveFromRepo } from "./paths.js";

export type PluginInterventionInspectionSpec = {
  readonly lawId: string;
  readonly domain: string;
  readonly ownerFilePaths: readonly string[];
  readonly routeFilePath: string;
  readonly routePrefix: string;
  readonly handleMethods: readonly string[];
  readonly safePointSymbol: string;
  readonly interventionSymbol: string;
  readonly acceptancePath: string;
  readonly forbiddenSymbols?: readonly string[];
};

const literals = (source: SourceFile): string[] => [
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
];

const identifiers = (source: SourceFile): string[] =>
  source.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText());

const propertyValue = (object: ObjectLiteralExpression, name: string): string | boolean | null => {
  const property = object.getProperty(name);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  if (initializer && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))) return initializer.getLiteralText();
  if (initializer?.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer?.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

type AddFinding = (filePath: string, message: string) => void;

const inspectOwnerContract = (
  context: InspectorContext,
  spec: PluginInterventionInspectionSpec,
  add: AddFinding,
): void => {
  const ownerSources = spec.ownerFilePaths.flatMap((filePath) => {
    const source = context.project.getSourceFile(resolveFromRepo(filePath));
    if (!source) add(filePath, "intervention owner source must exist in the audit project");
    return source ? [source] : [];
  });
  const ownerIdentifiers = new Set(ownerSources.flatMap(identifiers));
  const ownerLiterals = new Set(ownerSources.flatMap(literals));
  for (const symbol of ["PluginInterventionRequestSchema", spec.safePointSymbol, spec.interventionSymbol]) {
    if (!ownerIdentifiers.has(symbol)) add(spec.ownerFilePaths[0] ?? context.planEntry.ownerInspectorPath, `required intervention symbol missing: ${symbol}`);
  }
  for (const value of [
    "running", "pause_requested", "paused", "cancel_requested", "cancelled",
    "takeover_requested", "taken_over", "resume", "STALE_INTERVENTION_REVISION",
  ]) {
    if (!ownerLiterals.has(value)) add(spec.ownerFilePaths[0] ?? context.planEntry.ownerInspectorPath, `required intervention state or failure token missing: ${value}`);
  }
  for (const forbidden of spec.forbiddenSymbols ?? []) {
    if (ownerIdentifiers.has(forbidden) || ownerLiterals.has(forbidden)) add(spec.ownerFilePaths[0] ?? context.planEntry.ownerInspectorPath, `retired intervention symbol remains: ${forbidden}`);
  }
};

const inspectRouteContract = (
  context: InspectorContext,
  spec: PluginInterventionInspectionSpec,
  add: AddFinding,
): void => {
  const route = context.project.getSourceFile(resolveFromRepo(spec.routeFilePath));
  if (!route) {
    add(spec.routeFilePath, "explicit plugin intervention route source must exist");
    return;
  }
  const routeIdentifiers = new Set(identifiers(route));
  const routeLiterals = literals(route);
  for (const handleMethod of spec.handleMethods) {
    if (!routeIdentifiers.has(handleMethod)) add(spec.routeFilePath, `route must call named Workbench handle ${handleMethod}`);
  }
  const routeBase = spec.routePrefix.endsWith("/") ? spec.routePrefix.slice(0, -1) : spec.routePrefix;
  if (!routeLiterals.includes(routeBase)) add(spec.routeFilePath, `route must own exact local base ${routeBase}`);
};

const inspectBoundaryContract = (
  context: InspectorContext,
  spec: PluginInterventionInspectionSpec,
  add: AddFinding,
): void => {
  const boundaryPath = "src/app/workbench-api-boundary.ts";
  const boundary = context.project.getSourceFile(resolveFromRepo(boundaryPath));
  const routeBase = spec.routePrefix.endsWith("/") ? spec.routePrefix.slice(0, -1) : spec.routePrefix;
  const expectedRules = [
    { method: "GET", path: `${routeBase}/status` },
    ...["pause", "cancel", "takeover", "resume"].map((action) => ({ method: "POST", path: `${routeBase}/${action}` })),
  ];
  for (const expected of expectedRules) {
    const boundaryRule = boundary?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).find((object) =>
      propertyValue(object, "path") === expected.path
      && propertyValue(object, "method") === expected.method
      && propertyValue(object, "pathPattern") === "exact");
    if (!boundaryRule
      || propertyValue(boundaryRule, "localUiAllowed") !== true
      || propertyValue(boundaryRule, "externalApiAllowed") !== false
      || propertyValue(boundaryRule, "requiresApiKey") !== false) {
      add(boundaryPath, `intervention route ${expected.method} ${expected.path} must be local-only and fail closed to external callers`);
    }
  }
};

export const inspectPluginInterventionContract = (
  context: InspectorContext,
  spec: PluginInterventionInspectionSpec,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const add = (filePath: string, message: string) => findings.push(createFinding({
    lawId: spec.lawId,
    clauseId: spec.lawId.toLowerCase().replaceAll("-v1", "-requirement"),
    checkId: `${spec.domain}/local-intervention-contract`,
    filePath,
    message,
  }));
  inspectOwnerContract(context, spec, add);
  inspectRouteContract(context, spec, add);
  inspectBoundaryContract(context, spec, add);
  if (!context.project.getSourceFile(resolveFromRepo(spec.acceptancePath))) {
    add(spec.acceptancePath, "plugin intervention acceptance must exist and be included in the audit project");
  }
  return findings;
};
