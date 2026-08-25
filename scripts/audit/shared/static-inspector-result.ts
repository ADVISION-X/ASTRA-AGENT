import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Node, Project, SyntaxKind } from "ts-morph";

import { fail } from "../governance-runtime.js";
import type {
  InspectorContext, InspectorEvaluation, InspectorExecutedCheck, InspectorLawRequirement, InspectorLawResult, InspectorOutput,
} from "./inspector-contracts.js";
import { inspectTargetObjects } from "./static-target-object-inspector.js";
import { staticClauseRoutesForDomain } from "./static-clause-routes.js";

const evidenceKind: Readonly<Record<string, string>> = {
  "static.filesystem": "file", "static.text": "text", "static.ast": "ast", "static.types": "ast",
  "static.contract": "config", "static.dependency": "dependency", "static.config": "config",
  "static.json": "json", "static.yaml": "yaml", "static.sql": "sql", "static.migration": "file",
};
const ordered = (values: readonly string[]): string[] => [...new Set(values)].sort((left, right) =>
  Buffer.compare(Buffer.from(left), Buffer.from(right)));
export type StaticLawRoute = Readonly<{
  lawId: string;
}>;
export type StaticInspectorExecutor = (context: InspectorContext) => InspectorEvaluation | Promise<InspectorEvaluation>;

const enforcementRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const resolvedSymbolDeclarations = (identifier: import("ts-morph").Identifier): AstNode[] => {
  const symbol = identifier.getSymbol();
  if (!symbol) return [];
  let resolvedSymbol = symbol;
  try { resolvedSymbol = symbol.getAliasedSymbol() ?? symbol; } catch { /* local symbol */ }
  return resolvedSymbol.getDeclarations();
};

const resolvedSymbolPaths = (identifier: import("ts-morph").Identifier): string[] =>
  resolvedSymbolDeclarations(identifier).map((declaration) => declaration.getSourceFile().getFilePath());

type AstNode = import("ts-morph").Node;

const containsNode = (container: AstNode, candidate: AstNode): boolean =>
  container === candidate || candidate.getAncestors().includes(container);

const identifiersIn = (node: AstNode): import("ts-morph").Identifier[] => [
  ...(Node.isIdentifier(node) ? [node] : []),
  ...node.getDescendantsOfKind(SyntaxKind.Identifier),
];

const localVariableDeclaration = (
  identifier: import("ts-morph").Identifier,
  executor: AstNode,
): import("ts-morph").VariableDeclaration | undefined => {
  const resolved = identifier.getSymbol()?.getDeclarations()
    .find((declaration): declaration is import("ts-morph").VariableDeclaration =>
      Node.isVariableDeclaration(declaration) && containsNode(executor, declaration));
  return resolved ?? executor.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === identifier.getText());
};

const returnedFindingExpressions = (executor: AstNode): AstNode[] => {
  const expressions: AstNode[] = [];
  const addObjectFinding = (node: AstNode | undefined): void => {
    if (!node) return;
    const expression = Node.isParenthesizedExpression(node) ? node.getExpression() : node;
    if (!Node.isObjectLiteralExpression(expression)) return;
    const property = expression.getProperty("findings");
    if (Node.isPropertyAssignment(property)) {
      const initializer = property.getInitializer();
      if (initializer) expressions.push(initializer);
    } else if (Node.isShorthandPropertyAssignment(property)) {
      expressions.push(property.getNameNode());
    }
  };
  if (Node.isArrowFunction(executor)) addObjectFinding(executor.getBody());
  for (const statement of executor.getDescendantsOfKind(SyntaxKind.ReturnStatement)) {
    const boundary = statement.getFirstAncestor((ancestor) =>
      Node.isArrowFunction(ancestor) || Node.isFunctionDeclaration(ancestor)
      || Node.isFunctionExpression(ancestor) || Node.isMethodDeclaration(ancestor));
    if (boundary === executor) addObjectFinding(statement.getExpression());
  }
  return expressions;
};

const semanticFindingBoundCalls = (executor: AstNode): Set<import("ts-morph").CallExpression> => {
  const findingExpressions = returnedFindingExpressions(executor);
  const dependencies = new Set<AstNode>(findingExpressions);
  const trackedDeclarations = new Set<import("ts-morph").VariableDeclaration>();
  const calls = executor.getDescendantsOfKind(SyntaxKind.CallExpression);
  const exactlyTracked = (node: AstNode): boolean => Node.isIdentifier(node)
    && Boolean(localVariableDeclaration(node, executor))
    && trackedDeclarations.has(localVariableDeclaration(node, executor)!);
  const carriesTrackedSink = (node: AstNode): boolean => {
    if (exactlyTracked(node)) return true;
    if (!Node.isObjectLiteralExpression(node)) return false;
    return node.getProperties().some((property) => {
      if (Node.isShorthandPropertyAssignment(property)) return exactlyTracked(property.getNameNode());
      return Node.isPropertyAssignment(property) && Boolean(property.getInitializer())
        && exactlyTracked(property.getInitializer()!);
    });
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const dependency of [...dependencies]) {
      for (const identifier of identifiersIn(dependency)) {
        const declaration = localVariableDeclaration(identifier, executor);
        if (!declaration || trackedDeclarations.has(declaration)) continue;
        trackedDeclarations.add(declaration);
        const initializer = declaration.getInitializer();
        if (initializer) dependencies.add(initializer);
        changed = true;
      }
    }
    for (const call of calls) {
      const expression = call.getExpression();
      if (!Node.isPropertyAccessExpression(expression) || !exactlyTracked(expression.getExpression())) continue;
      for (const argument of call.getArguments()) {
        if (dependencies.has(argument)) continue;
        dependencies.add(argument);
        changed = true;
      }
    }
  }
  const isTrackedReceiverCall = (node: AstNode): boolean => {
    if (!Node.isCallExpression(node)) return false;
    const expression = node.getExpression();
    return Node.isPropertyAccessExpression(expression) && exactlyTracked(expression.getExpression());
  };
  const isBound = (call: import("ts-morph").CallExpression): boolean => {
    if ([...dependencies].some((dependency) => containsNode(dependency, call))) return true;
    if (call.getArguments().some(carriesTrackedSink)) return true;
    if (call.getAncestors().some(isTrackedReceiverCall)) return true;
    const guardedTry = call.getFirstAncestorByKind(SyntaxKind.TryStatement);
    const catchClause = guardedTry?.getCatchClause();
    return Boolean(catchClause && identifiersIn(catchClause).some(exactlyTracked));
  };
  return new Set(calls.filter(isBound));
};

export const semanticFindingBindingsForSource = (sourceText: string, executorName: string): string[] => {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile("inspector.ts", sourceText);
  const executor = source.getFunction(executorName) ?? source.getVariableDeclaration(executorName)?.getInitializer();
  if (!executor) return [];
  return ordered([...semanticFindingBoundCalls(executor)].flatMap((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) ? [expression.getText()] : [];
  }));
};

const referencedLawIds = (node: AstNode, knownLawIds: ReadonlySet<string>): Set<string> => {
  const result = new Set<string>();
  const visitedDeclarations = new Set<AstNode>();
  const inspect = (current: AstNode): void => {
    const stringNodes = [
      ...(Node.isStringLiteral(current) || Node.isNoSubstitutionTemplateLiteral(current) ? [current] : []),
      ...current.getDescendants().filter((descendant) =>
        Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant)),
    ];
    for (const literal of stringNodes) {
      const value = literal.getLiteralText();
      if (knownLawIds.has(value)) result.add(value);
    }
    for (const identifier of identifiersIn(current)) {
      for (const declaration of resolvedSymbolDeclarations(identifier)) {
        if (!Node.isVariableDeclaration(declaration) || visitedDeclarations.has(declaration)) continue;
        visitedDeclarations.add(declaration);
        const initializer = declaration.getInitializer();
        if (initializer) inspect(initializer);
      }
    }
  };
  inspect(node);
  return result;
};

const callLawIds = (
  call: import("ts-morph").CallExpression,
  knownLawIds: ReadonlySet<string>,
): Set<string> => new Set(call.getArguments().flatMap((argument) => [...referencedLawIds(argument, knownLawIds)]));

export const semanticLawBindingsForSource = (
  sourceText: string,
  executorName: string,
  lawIds: readonly string[],
): Readonly<Record<string, string[]>> => {
  const callBindings = semanticLawCallBindingsForSource(sourceText, executorName, lawIds);
  return Object.fromEntries(Object.entries(callBindings).map(([name, bindings]) => [
    name, ordered(bindings.flatMap((binding) => binding)),
  ]));
};

export const semanticLawCallBindingsForSource = (
  sourceText: string,
  executorName: string,
  lawIds: readonly string[],
): Readonly<Record<string, string[][]>> => {
  const project = new Project({ useInMemoryFileSystem: true });
  const source = project.createSourceFile("inspector.ts", sourceText);
  const executor = source.getFunction(executorName) ?? source.getVariableDeclaration(executorName)?.getInitializer();
  if (!executor) return {};
  const knownLawIds = new Set(lawIds);
  const bindings = new Map<string, string[][]>();
  for (const call of semanticFindingBoundCalls(executor)) {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression)) continue;
    const current = bindings.get(expression.getText()) ?? [];
    current.push(ordered([...callLawIds(call, knownLawIds)]));
    bindings.set(expression.getText(), current);
  }
  return Object.fromEntries([...bindings].sort(([left], [right]) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
    .map(([name, callBindings]) => [name, callBindings]));
};

export const semanticLawOwnershipIsExact = (
  callBindings: Readonly<Record<string, readonly (readonly string[])[]>>,
  expectedLawIdsByCheck: Readonly<Record<string, readonly string[]>>,
): boolean => Object.entries(expectedLawIdsByCheck).every(([semanticCheck, expectedLawIds]) => {
  const bindings = callBindings[semanticCheck] ?? [];
  const actualLawIds = ordered(bindings.flatMap((binding) => binding));
  return bindings.length > 0
    && bindings.every((binding) => binding.length === 1)
    && JSON.stringify(actualLawIds) === JSON.stringify(ordered(expectedLawIds));
});

const domainSemanticExecutorCalls = (
  context: InspectorContext,
  executorName: string,
): Map<string, Set<string>[]> => {
  const project = new Project({ tsConfigFilePath: resolve(enforcementRoot, "tsconfig.json") });
  const source = project.getSourceFile(resolve(enforcementRoot, context.planEntry.ownerInspectorPath));
  if (!source) return new Map();
  const executor = source.getFunction(executorName)
    ?? source.getVariableDeclaration(executorName)?.getInitializer();
  if (!executor) return new Map();
  const domainRoot = `${resolve(enforcementRoot, "scripts/audit/domains", context.planEntry.capabilityDomain)}/`;
  const knownLawIds = new Set(context.lawRequirements.map((requirement) => requirement.lawId));
  const bindings = new Map<string, Set<string>[]>();
  for (const call of semanticFindingBoundCalls(executor)) {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression)) continue;
    const declarationPaths = resolvedSymbolPaths(expression);
    if (!declarationPaths.some((path) => path.startsWith(domainRoot))) continue;
    const current = new Set<string>();
    for (const lawId of callLawIds(call, knownLawIds)) current.add(lawId);
    if (current.size === 0 && knownLawIds.size === 1) current.add([...knownLawIds][0]!);
    const calls = bindings.get(expression.getText()) ?? [];
    calls.push(current);
    bindings.set(expression.getText(), calls);
  }
  return bindings;
};

const validateSemanticExecutor = (
  context: InspectorContext, executorName: string, evaluation: InspectorEvaluation,
): void => {
  const executedSemanticChecks = domainSemanticExecutorCalls(context, executorName);
  const expectedLawsByCheck = new Map<string, Set<string>>();
  for (const check of evaluation.executedChecks) {
    for (const semanticCheck of check.semanticChecks) {
      const laws = expectedLawsByCheck.get(semanticCheck) ?? new Set<string>();
      laws.add(check.lawId);
      expectedLawsByCheck.set(semanticCheck, laws);
    }
  }
  const callBindings = Object.fromEntries([...executedSemanticChecks].map(([name, bindings]) => [
    name, bindings.map((binding) => ordered([...binding])),
  ]));
  const expected = Object.fromEntries([...expectedLawsByCheck].map(([name, lawIds]) => [name, ordered([...lawIds])]));
  if (!semanticLawOwnershipIsExact(callBindings, expected)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:semantic-law-binding:${JSON.stringify({ expected, callBindings })}`);
  }
};

export const authenticatedStaticChecks = (domain: string): InspectorExecutedCheck[] =>
  staticClauseRoutesForDomain(domain);

const validateStaticRoutes = (
  context: InspectorContext, routes: readonly StaticLawRoute[],
): string[] => {
  const requiredIds = context.lawRequirements.map((law) => law.lawId);
  if (JSON.stringify(ordered(routes.map((route) => route.lawId))) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_ROUTE_MISSING", context.planEntry.capabilityDomain);
  }
  for (const requirement of context.lawRequirements) {
    const requiredClauses = ordered(Object.values(requirement.clausesByMode).flat());
    const availableClauses = ordered([
      ...Array.from({ length: requirement.forbiddenCount }, (_, index) => `forbidden:${index}`), "summary",
    ]);
    if (!Number.isInteger(requirement.forbiddenCount) || requirement.forbiddenCount < 1
      || !requiredClauses.includes("summary") || requiredClauses.some((clause) => !availableClauses.includes(clause))) {
      fail("LAW_CHECK_ROUTE_MISSING", `${requirement.lawId}:clause`);
    }
  }
  return requiredIds;
};

const checkSignature = (check: InspectorExecutedCheck): string =>
  `${check.lawId}\0${check.evidenceMode}\0${JSON.stringify(ordered(check.clauses))}`;

const validateExecutedChecks = (context: InspectorContext, evaluation: InspectorEvaluation): void => {
  const expected = context.lawRequirements.flatMap((requirement) => Object.entries(requirement.clausesByMode)
    .map(([evidenceMode, clauses]) => `${requirement.lawId}\0${evidenceMode}\0${JSON.stringify(ordered(clauses))}`));
  if (!Array.isArray(evaluation.executedChecks)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:clause-execution`);
  }
  const actual = evaluation.executedChecks.map(checkSignature);
  if (evaluation.executedChecks.some((check) => !check || !Array.isArray(check.clauses)
    || !Array.isArray(check.semanticChecks) || check.semanticChecks.length === 0
    || JSON.stringify(check.semanticChecks) !== JSON.stringify(ordered(check.semanticChecks))
    || typeof check.lawId !== "string" || typeof check.evidenceMode !== "string"
    || !/^[a-z0-9]+(?:[a-z0-9-]*)(?:\/[a-z0-9]+(?:[a-z0-9-]*))*$/u.test(check.checkId))
    || actual.length !== new Set(actual).size
    || JSON.stringify(ordered(actual)) !== JSON.stringify(ordered(expected))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:clause-execution`);
  }
};

const validateStaticEvaluation = (
  context: InspectorContext, evaluation: InspectorEvaluation, requiredIds: readonly string[],
  requiredTargets: readonly string[], executorName: string,
): void => {
  inspectTargetObjects(context, requiredTargets);
  if (evaluation.capabilityDomain !== context.planEntry.capabilityDomain
    || JSON.stringify(evaluation.reportedLawIds) !== JSON.stringify(requiredIds)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}:result`);
  }
  const declaredInspected = new Set(evaluation.inspectedFiles);
  if (declaredInspected.size !== evaluation.inspectedFiles.length
    || JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(ordered(evaluation.inspectedFiles))) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:inspection-order`);
  }
  if (JSON.stringify(evaluation.inspectedFiles) !== JSON.stringify(requiredTargets)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}:target-denominator`);
  }
  validateExecutedChecks(context, evaluation);
  validateSemanticExecutor(context, executorName, evaluation);
};

const resultForRequirement = (
  context: InspectorContext, evaluation: InspectorEvaluation,
  requirement: InspectorLawRequirement, executionId: string,
): InspectorLawResult => {
  const findings = evaluation.findings.filter((finding) => finding.lawId === requirement.lawId);
  const checks = evaluation.executedChecks.filter((check) => check.lawId === requirement.lawId);
  return {
    lawId: requirement.lawId,
    assertions: checks.map((check) => ({
      clauses: check.clauses,
      evidenceMode: check.evidenceMode,
      passed: findings.length === 0,
      refs: ordered([
        ...check.clauses.map((clause) =>
          `${evidenceKind[check.evidenceMode] ?? "file"}:${context.planEntry.ownerInspectorPath}#${encodeURIComponent(`executionId=${executionId};checkId=${check.checkId};semanticChecks=${check.semanticChecks.join(",")};clause=${clause};mode=${check.evidenceMode};targetCount=${requirement.targetSet.count}`)}`),
        requirement.targetSet.queryRef,
      ]),
    })),
    findings,
  };
};

export const finalizeStaticInspection = async (
  context: InspectorContext,
  routes: readonly StaticLawRoute[],
  execute: StaticInspectorExecutor,
): Promise<InspectorOutput> => {
  const executorName = execute.name;
  if (!/^[A-Za-z][A-Za-z0-9]*$/u.test(executorName)) {
    fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:unnamed-executor`);
  }
  const requiredIds = validateStaticRoutes(context, routes);
  const requiredTargets = ordered(context.lawRequirements.flatMap((requirement) => requirement.targetPaths));
  let evaluation: InspectorEvaluation;
  try { evaluation = await execute(context); }
  catch { return fail("LAW_CHECK_EXECUTION_INCOMPLETE", `${context.planEntry.capabilityDomain}:${executorName}`); }
  validateStaticEvaluation(context, evaluation, requiredIds, requiredTargets, executorName);
  const executionId = `${context.planEntry.capabilityDomain}/${executorName}`;
  const lawResults = context.lawRequirements.map((requirement) =>
    resultForRequirement(context, evaluation, requirement, executionId));
  return {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: requiredIds,
    lawResults,
    inspectedFiles: evaluation.inspectedFiles,
  };
};
