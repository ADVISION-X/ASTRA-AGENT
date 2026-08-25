import { existsSync } from "node:fs";

import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type CallExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  type Project,
  type SourceFile,
} from "ts-morph";

type RouteFunction = ArrowFunction | FunctionDeclaration | FunctionExpression;

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../../shared/paths.js";
import { collectResolvedModuleTargets } from "../../../shared/source-module-targets.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import type { ActivePluginContract } from "./scan-active-plugin-gate.js";

type MediatorPluginContract = Pick<
  ActivePluginContract,
  "allowedEntrypoints" | "mediatorBindings" | "mediatorRoute" | "pluginId" | "status"
>;

type MediatorInspectionInput = {
  entries: readonly MediatorPluginContract[];
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
  project: Project;
};

const declarationKeys = (node: Node | undefined): string[] => {
  const symbol = node?.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return target?.getDeclarations().map((declaration) =>
    `${toRepoPath(declaration.getSourceFile().getFilePath())}:${declaration.getStart()}`,
  ) ?? [];
};

const lifecycleIntakeVerbs = new Set([
  "continue",
  "create",
  "enqueue",
  "execute",
  "generate",
  "recover",
  "resume",
  "retry",
  "run",
  "start",
]);

const leadingVerb = (name: string | undefined): string | undefined => {
  if (!name) return undefined;
  let end = 0;
  while (end < name.length) {
    const character = name[end]!;
    if (character >= "A" && character <= "Z") break;
    end += 1;
  }
  return end === 0 ? undefined : name.slice(0, end);
};

const symbolName = (node: Node): string | undefined => {
  const symbol = node.getSymbol();
  return (symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol)?.getName();
};

const namedCallableAncestor = (call: CallExpression): string | undefined => {
  for (const ancestor of call.getAncestors()) {
    if (Node.isMethodDeclaration(ancestor) || Node.isFunctionDeclaration(ancestor)) {
      const name = ancestor.getName();
      if (name) return name;
    }
    if (!Node.isArrowFunction(ancestor) && !Node.isFunctionExpression(ancestor)) continue;
    const parent = ancestor.getParent();
    if (Node.isVariableDeclaration(parent) || Node.isPropertyAssignment(parent)) return parent.getName();
  }
  return undefined;
};

const isLifecycleIntakeCall = (call: CallExpression): boolean => {
  const wrapperVerb = leadingVerb(namedCallableAncestor(call));
  const targetVerb = leadingVerb(symbolName(call.getExpression()));
  return wrapperVerb !== undefined && targetVerb !== undefined
    && lifecycleIntakeVerbs.has(wrapperVerb)
    && lifecycleIntakeVerbs.has(targetVerb);
};

const importedBinding = (sourceFile: SourceFile, exportName: string): Node | undefined =>
  sourceFile.getImportDeclarations().flatMap((declaration) => declaration.getNamedImports())
    .find((specifier) => specifier.getName() === exportName);

const routeFunction = (
  sourceFile: SourceFile,
  exportName: string,
): RouteFunction | undefined => {
  const declaration = sourceFile.getVariableDeclaration(exportName);
  const initializer = declaration?.getInitializer();
  if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) return initializer;
  return sourceFile.getFunction(exportName);
};

const directCalls = (fn: RouteFunction): CallExpression[] =>
  fn.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === fn);

const parseCallUsesSchema = (call: CallExpression, schemaBinding: Node): boolean => {
  const expression = call.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === "parse"
    && declarationKeys(expression.getExpression()).some((key) =>
      declarationKeys(schemaBinding).includes(key));
};

const taskCallUsesBinding = (call: CallExpression, taskBinding: Node): boolean =>
  declarationKeys(call.getExpression()).some((key) => declarationKeys(taskBinding).includes(key));

const parseResultReachesTask = (
  parseCall: CallExpression,
  taskCall: CallExpression,
): boolean => {
  if (parseCall.getFirstAncestor((node) => node === taskCall)) return true;
  const declaration = parseCall.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
  return declaration !== undefined && taskCall.getArguments().some((argument) =>
    [...(Node.isIdentifier(argument) ? [argument] : []), ...argument.getDescendantsOfKind(SyntaxKind.Identifier)]
      .some((identifier) =>
      declarationKeys(identifier).some((key) => declarationKeys(declaration).includes(key))));
};

const exportedRouteNames = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getVariableDeclarations()
    .filter((declaration) => declaration.getVariableStatement()?.isExported())
    .filter((declaration) => {
      const initializer = declaration.getInitializer();
      return Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer);
    })
    .map((declaration) => declaration.getName()),
  ...sourceFile.getFunctions().filter((declaration) => declaration.isExported())
    .map((declaration) => declaration.getName()).filter((name): name is string => name !== undefined),
].sort();

const pushFinding = (
  input: MediatorInspectionInput,
  filePath: string,
  checkId: string,
  message: string,
  evidence?: string,
): void => {
  input.findings.push(createFinding({
    checkId,
    lawId: input.lawId,
    filePath,
    message,
    evidence,
  }));
};

const inspectBypassCalls = (
  input: MediatorInspectionInput,
  taskKeys: ReadonlySet<string>,
  pluginId: string,
): void => {
  const ownerRoot = `src/plugins/${pluginId}/`;
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/app/") && !repoPath.startsWith("src/lib/local-runtime/")) continue;
    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const targetKeys = declarationKeys(call.getExpression());
      const registeredTaskCall = targetKeys.some((key) => taskKeys.has(key));
      const unregisteredLifecycleCall = !registeredTaskCall
        && targetKeys.some((key) => key.startsWith(ownerRoot))
        && isLifecycleIntakeCall(call);
      if (!registeredTaskCall && !unregisteredLifecycleCall) continue;
      input.inspectedFiles.add(repoPath);
      pushFinding(
        input,
        repoPath,
        unregisteredLifecycleCall
          ? "architecture/active-plugin-mediator-unregistered-intake"
          : "architecture/active-plugin-mediator-bypass",
        unregisteredLifecycleCall
          ? `${repoPath} calls an unregistered ${pluginId} lifecycle task intake; every lifecycle intake must have an exact mediator binding.`
          : `${repoPath} calls the ${pluginId} task entry directly instead of its unique mediator route.`,
        call.getExpression().getText(),
      );
    }
  }
};

const inspectExtraRoutes = (
  input: MediatorInspectionInput,
  entries: readonly MediatorPluginContract[],
): void => {
  const canonicalRoutes = new Set(entries
    .filter((entry) => entry.status === "active")
    .map((entry) => entry.mediatorRoute));
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/mediator/") || canonicalRoutes.has(repoPath)) continue;
    input.inspectedFiles.add(repoPath);
    pushFinding(input, repoPath, "architecture/active-plugin-mediator-duplicate",
      `${repoPath} is an extra mediator file outside the exact active-plugin canonical route set.`);
  }
};

const routeHasOneUnconditionalTaskPath = (
  fn: RouteFunction,
  taskCall: CallExpression | undefined,
): boolean => {
  if (!taskCall) return false;
  const body = fn.getBody();
  if (!Node.isBlock(body)) {
    return body === taskCall || taskCall.getFirstAncestor((node) => node === body) !== undefined;
  }
  const statements = body.getStatements();
  const returns = statements.filter(Node.isReturnStatement);
  if (returns.length !== 1 || statements.at(-1) !== returns[0]
    || statements.some((statement) =>
      !Node.isVariableStatement(statement) && !Node.isReturnStatement(statement))) {
    return false;
  }
  const returnExpression = returns[0]?.getExpression();
  return returnExpression !== undefined
    && (returnExpression === taskCall
      || taskCall.getFirstAncestor((node) => node === returnExpression) !== undefined);
};

const bindingCallsAreExact = (
  parseCalls: readonly CallExpression[],
  taskCalls: readonly CallExpression[],
): boolean => parseCalls.length === 1 && taskCalls.length === 1
  && parseResultReachesTask(parseCalls[0]!, taskCalls[0]!);

const nodeOwnsMutableState = (node: Node): boolean => {
  if (Node.isNewExpression(node) || Node.isClassDeclaration(node)) return true;
  if (!Node.isBinaryExpression(node)) return false;
  const operator = node.getOperatorToken().getKind();
  return operator >= SyntaxKind.FirstAssignment && operator <= SyntaxKind.LastAssignment;
};

const routeControlKinds = new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.TryStatement,
  SyntaxKind.SwitchStatement,
  SyntaxKind.ConditionalExpression,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
]);
const shortCircuitOperators = new Set([
  SyntaxKind.AmpersandAmpersandToken,
  SyntaxKind.BarBarToken,
  SyntaxKind.QuestionQuestionToken,
  SyntaxKind.CommaToken,
]);
const nodeControlsRoutePath = (node: Node): boolean => {
  if (routeControlKinds.has(node.getKind())) return true;
  if (Node.isBinaryExpression(node)) {
    return shortCircuitOperators.has(node.getOperatorToken().getKind());
  }
  if (Node.isPropertyAccessExpression(node)) return node.hasQuestionDotToken();
  return Node.isCallExpression(node) && node.hasQuestionDotToken();
};

const findRouteStructureViolation = (
  fn: RouteFunction,
  calls: readonly CallExpression[],
  allowedCalls: ReadonlySet<CallExpression>,
  taskCall: CallExpression | undefined,
): Node | undefined => {
  const checks: Array<Node | undefined | false> = [
    calls.find((call) => !allowedCalls.has(call)),
    fn.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((declaration) =>
      declaration.getVariableStatement()?.getDeclarationKind() !== "const"),
    fn.getDescendants().find((node) => Node.isFunctionLikeDeclaration(node) && node !== fn),
    fn.getDescendants().find(nodeOwnsMutableState),
    fn.getDescendants().find(nodeControlsRoutePath),
    routeHasOneUnconditionalTaskPath(fn, taskCall) ? undefined : fn,
  ];
  return checks.find((node): node is Node => Boolean(node));
};

const inspectRouteBinding = (
  input: MediatorInspectionInput,
  entry: MediatorPluginContract,
  route: SourceFile,
  binding: ActivePluginContract["mediatorBindings"][number],
  taskKeys: Set<string>,
): void => {
  const fn = routeFunction(route, binding.routeExport);
  const schemaBinding = importedBinding(route, binding.schemaExport);
  const taskBinding = importedBinding(route, binding.taskExport);
  if (!fn || !schemaBinding || !taskBinding) {
    pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-binding-missing",
      `Mediator binding ${binding.routeExport} must import and expose exact schema ${binding.schemaExport} and task ${binding.taskExport}.`);
    return;
  }
  const ownerRoot = `src/plugins/${entry.pluginId}/`;
  const schemaOwned = declarationKeys(schemaBinding).some((key) => key.startsWith(ownerRoot));
  const taskOwned = declarationKeys(taskBinding).some((key) => key.startsWith(ownerRoot));
  if (!schemaOwned || !taskOwned) {
    pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-binding-owner",
      `Mediator binding ${binding.routeExport} must resolve both schema and task to ${ownerRoot}.`);
    return;
  }
  const calls = directCalls(fn);
  const parseCalls = calls.filter((call) => parseCallUsesSchema(call, schemaBinding));
  const taskCalls = calls.filter((call) => taskCallUsesBinding(call, taskBinding));
  const allowedCalls = new Set([...parseCalls, ...taskCalls]);
  if (!bindingCallsAreExact(parseCalls, taskCalls)) {
    pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-binding-inexact",
      `Mediator binding ${binding.routeExport} must parse once with ${binding.schemaExport} and pass that result to exactly one ${binding.taskExport} call.`);
  }
  const structureViolation = findRouteStructureViolation(fn, calls, allowedCalls, taskCalls[0]);
  if (structureViolation) {
    pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-state-or-action",
      `Mediator binding ${binding.routeExport} must have one unconditional parse-to-task return path and cannot own state, helpers, branching, error swallowing or additional actions.`,
      structureViolation.getText());
  }
  for (const key of declarationKeys(taskBinding)) taskKeys.add(key);
};

export const inspectActivePluginMediators = (input: MediatorInspectionInput): void => {
  inspectExtraRoutes(input, input.entries);
  for (const entry of input.entries.filter((candidate) => candidate.status === "active")) {
    const expectedRoute = `src/mediator/${entry.pluginId}-route.ts`;
    if (entry.mediatorRoute !== expectedRoute) {
      pushFinding(input, expectedRoute, "architecture/active-plugin-mediator-noncanonical",
        `Active plugin ${entry.pluginId} must own exactly ${expectedRoute}.`, entry.mediatorRoute);
      continue;
    }
    input.inspectedFiles.add(entry.mediatorRoute);
    if (!existsSync(resolveFromRepo(entry.mediatorRoute))) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-missing",
        `Active plugin ${entry.pluginId} is missing its mediator route.`);
      continue;
    }
    if (!entry.allowedEntrypoints.includes(entry.mediatorRoute)) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-not-allowlisted",
        `Active plugin ${entry.pluginId} does not allowlist its mediator route.`, entry.mediatorRoute);
    }
    const route = input.project.getSourceFile(resolveFromRepo(entry.mediatorRoute));
    if (!route) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-not-loaded",
        `Mediator route ${entry.mediatorRoute} is not loaded by the audit project.`);
      continue;
    }
    const ownerRoot = `src/plugins/${entry.pluginId}/`;
    const pluginTargets = collectResolvedModuleTargets(route).map((target) => target.targetPath)
      .filter((target) => target.startsWith("src/plugins/"));
    if (!pluginTargets.some((target) => target.startsWith(ownerRoot))) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-owner-missing",
        `Mediator route ${entry.mediatorRoute} does not import its owning plugin public surface.`);
    }
    const foreignTarget = pluginTargets.find((target) => !target.startsWith(ownerRoot));
    if (foreignTarget) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-foreign-owner",
        `Mediator route ${entry.mediatorRoute} imports a foreign plugin owner.`, foreignTarget);
    }
    const configuredRoutes = entry.mediatorBindings.map((binding) => binding.routeExport).sort();
    const actualRoutes = exportedRouteNames(route);
    if (new Set(configuredRoutes).size !== configuredRoutes.length
      || configuredRoutes.join("\0") !== actualRoutes.join("\0")) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-export-closure",
        `Mediator route exports must exactly match configured route bindings.`,
        `configured=${configuredRoutes.join("|")};actual=${actualRoutes.join("|")}`);
    }
    const moduleState = route.getVariableDeclarations().find((declaration) =>
      !declaration.getFirstAncestor(Node.isFunctionLikeDeclaration)
      && !configuredRoutes.includes(declaration.getName()));
    if (moduleState) {
      pushFinding(input, entry.mediatorRoute, "architecture/active-plugin-mediator-module-state",
        `Mediator route ${entry.mediatorRoute} cannot own module state or helper values.`, moduleState.getName());
    }
    const taskKeys = new Set<string>();
    for (const binding of entry.mediatorBindings) {
      inspectRouteBinding(input, entry, route, binding, taskKeys);
    }
    inspectBypassCalls(input, taskKeys, entry.pluginId);
  }
};
