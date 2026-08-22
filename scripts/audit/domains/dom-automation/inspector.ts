import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectDomBoundaries } from "./components/inspect-dom-boundaries.js";
import { inspectDomContracts } from "./components/inspect-dom-contracts.js";
import { inspectDomFoundationGates } from "./components/inspect-dom-foundation-gates.js";
import { inspectDomRuntimeGuards } from "./components/inspect-dom-runtime-guards.js";
import { createDomFindingCollector } from "./components/dom-inspector-support.js";
import { createFinding } from "../../shared/finding-utils.js";
import { astExpressionPath, astIdentifierName } from "../../shared/ast-node-identity.js";
import { Node, SyntaxKind, type FunctionDeclaration, type SourceFile } from "ts-morph";
import { resolveFromRepo } from "../../shared/paths.js";

const inspectExactTargetBinding = (context: InspectorContext) => {
  const findings: InspectorFinding[] = [];
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
  for (const required of ["targetRef", "documentRef", "assertDomTargetBinding", "BROWSER_DOCUMENT_INVALID", "BROWSER_TARGET_INVALID"]) {
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

const methodCallNames = (fn: FunctionDeclaration): string[] =>
  fn.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) ? [expression.getName()] : [];
  });

const sourceMethodCallNames = (file: SourceFile): string[] =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) ? [expression.getName()] : [];
  });

type DomActionFiles = Record<"click" | "fill" | "upload", SourceFile | undefined>;

const inspectAtomicDomMutationBoundary = (
  files: DomActionFiles,
  paths: Record<keyof DomActionFiles, string>,
  addGap: (filePath: string, message: string) => void,
): void => {
  for (const [key, required, forbidden] of [
    ["click", "executeDomIntent", ["evaluate", "clickLocatedDomElement", "textInput"]],
    ["fill", "executeDomIntent", ["evaluate", "clickLocatedDomElement", "textInput"]],
  ] as const) {
    const file = files[key];
    if (!file) continue;
    const calls = sourceMethodCallNames(file);
    if (calls.filter((name) => name === required).length !== 1) {
      addGap(paths[key], `${key} must dispatch exactly one BrowserTargetLease.${required} atomic command`);
    }
    for (const name of forbidden) {
      if (calls.includes(name)) addGap(paths[key], `${key} must not retain split observation/mutation call ${name}`);
    }
  }
};

const inspectObservationMutationSeparation = (context: InspectorContext): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const lawId = "APEX-DOM-021-V1";
  const clauseId = "apex-dom-021-requirement";
  const paths = {
    click: "src/capabilities/dom-automation/runtime/dom-click.ts",
    fill: "src/capabilities/dom-automation/runtime/dom-fill.ts",
    upload: "src/capabilities/dom-automation/runtime/dom-upload.ts",
  } as const;
  const files = Object.fromEntries(Object.entries(paths).map(([key, filePath]) => [key, context.project.getSourceFile(resolveFromRepo(filePath))])) as DomActionFiles;
  const addGap = (filePath: string, message: string) => findings.push(createFinding({
    checkId: "dom-automation/owner-assertion-set", lawId, clauseId, filePath, message,
  }));
  const requiredCalls: ReadonlyArray<readonly [keyof typeof paths, string, readonly string[]]> = [
    ["click", "clickDomElementOnce", ["executeDomIntent"]],
    ["fill", "fillDomElementOnce", ["executeDomIntent"]],
    ["upload", "uploadApprovedFileOnce", ["attachFile"]],
  ];
  for (const [key, functionName, required] of requiredCalls) {
    const fn = files[key]?.getFunction(functionName);
    if (!fn) {
      addGap(paths[key], `${functionName} is missing`);
      continue;
    }
    const calls = new Set(key === "fill" ? sourceMethodCallNames(files[key]!) : methodCallNames(fn));
    for (const call of required) if (!calls.has(call)) addGap(paths[key], `${functionName} must call BrowserTargetLease.${call}`);
  }
  inspectAtomicDomMutationBoundary(files, paths, addGap);
  return findings;
};

const inspectRealChromeProofRoute = (
  context: InspectorContext,
  inspectedFiles: Set<string>,
): InspectorFinding[] => {
  const findings: InspectorFinding[] = [];
  const paths = [
    "scripts/acceptance/dom-real-chrome-proof-support.ts",
    "scripts/acceptance/dom-automation-exact-target.real-chrome.ts",
    "scripts/acceptance/dom-automation.real-chrome.ts",
    "src/lib/browser/exact-target/browser-command-actor.ts",
    "src/lib/browser/exact-target/browser-proof-journal.ts",
    "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
  ] as const;
  const sources = paths.map((filePath) => {
    inspectedFiles.add(filePath);
    return context.project.getSourceFile(resolveFromRepo(filePath));
  });
  if (sources.some((source) => !source)) return [createFinding({
    checkId: "dom-automation/real-chrome-proof-route", lawId: "APEX-DOM-021-V1",
    clauseId: "apex-dom-021-requirement", filePath: paths.find((_, index) => !sources[index]) ?? paths[0],
    message: "DOM real-Chrome verifiers, Browser producer and canonical journal must all exist.",
  })];
  const identifiers = new Set(sources.flatMap((source) => source!
    .getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText())));
  const strings = new Set(sources.flatMap((source) => source!
    .getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText())));
  for (const required of [
    "readBrowserProofJournal", "buildStartupSourceFingerprint", "mutationChain",
    "recordCommand", "previousEntryHash", "entryHash", "transportSequence", "permitSequence",
    "resultSummary", "accessibilityValue", "retainedValueVerified",
    "postconditionVerified", "nodesWithExactText",
  ]) if (!identifiers.has(required)) findings.push(createFinding({
    checkId: "dom-automation/real-chrome-proof-route", lawId: "APEX-DOM-021-V1",
    clauseId: "apex-dom-021-requirement", filePath: paths[0],
    message: `The DOM real-Chrome proof route is missing ${required}.`,
  }));
  for (const phase of ["PREPARED", "SEND", "UNKNOWN", "CONFIRMED", "COMPLETED"]) {
    if (strings.has(phase)) continue;
    findings.push(createFinding({
      checkId: "dom-automation/real-chrome-proof-route", lawId: "APEX-DOM-021-V1",
      clauseId: "apex-dom-021-requirement", filePath: paths[0],
      message: `The DOM real-Chrome proof route must enforce ${phase}.`,
    }));
  }
  return findings;
};

const strictExactTextMatcher = (runtime: SourceFile): boolean => {
  const matcher = runtime.getVariableDeclaration("nodesWithExactText")?.getInitializer();
  if (!matcher) return false;
  if (matcher.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "includes";
    })) return false;
  const expected = matcher.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "expected")?.getInitializer();
  if (!Node.isCallExpression(expected)
    || astExpressionPath(expected.getExpression()) !== "expectedText.trim") return false;
  const loop = matcher.getDescendantsOfKind(SyntaxKind.ForOfStatement);
  if (loop.length !== 1) return false;
  const loopBody = loop[0]!.getStatement();
  if (!Node.isBlock(loopBody)) return false;
  const comparison = loopBody.getStatements()[0];
  if (!Node.isIfStatement(comparison)) return false;
  const condition = comparison.getExpression();
  return Node.isBinaryExpression(condition)
    && condition.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
    && astIdentifierName(condition.getRight()) === "expected";
};

const exactChoiceFlowsIntoRuntime = (runtime: SourceFile): boolean => {
  const click = runtime.getVariableDeclaration("executeClickIntent")?.getInitializer();
  if (!click) return false;
  const calls = click.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => astExpressionPath(call.getExpression()) === "nodesWithExactText");
  if (calls.length !== 1) return false;
  const arguments_ = calls[0]!.getArguments();
  return astExpressionPath(arguments_[0]) === "debuggerRuntime"
    && astExpressionPath(arguments_[1]) === "target.tabId"
    && astExpressionPath(arguments_[2]) === "nodes"
    && astExpressionPath(arguments_[3]) === "intent.expectedTextEquals";
};

const postconditionFlowsIntoJournal = (runtime: SourceFile, actor: SourceFile): boolean => {
  const click = runtime.getVariableDeclaration("executeClickIntent")?.getInitializer();
  const verified = actor.getVariableDeclaration("verifiedMutationResult")?.getInitializer();
  if (!click || !verified) return false;
  const runtimeComparisons = click.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const actorComparisons = verified.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  const runtimeProof = runtimeComparisons.some((binary) =>
    binary.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
    && astExpressionPath(binary.getRight()) === "intent.postClickAttribute.equals");
  const actorProof = actorComparisons.some((binary) =>
    binary.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken
    && astExpressionPath(binary.getLeft()) === "value.postconditionVerified"
    && binary.getRight().getKind() === SyntaxKind.TrueKeyword);
  return runtimeProof && actorProof
    && verified.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
      .some((property) => property.getName() === "postconditionVerified");
};

export const domAtomicIfAndThenContractIsExact = (
  intent: SourceFile,
  runtime: SourceFile,
  actor: SourceFile,
): boolean => {
  const clickAssertion = intent.getVariableDeclaration("assertClickIntent")?.getInitializer();
  const clickType = intent.getTypeAlias("BrowserDomIntent")?.getTypeNode();
  if (!clickAssertion || !clickType) return false;
  const typeProperties = new Set(clickType.getDescendantsOfKind(SyntaxKind.PropertySignature)
    .map((property) => property.getName()));
  const assertionPaths = new Set(clickAssertion.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .map(astExpressionPath).filter((path): path is string => path !== undefined));
  return typeProperties.has("expectedTextEquals")
    && typeProperties.has("postClickAttribute")
    && assertionPaths.has("intent.expectedText")
    && assertionPaths.has("intent.expectedTextEquals")
    && assertionPaths.has("intent.postClickAttribute.name")
    && assertionPaths.has("intent.postClickAttribute.equals")
    && strictExactTextMatcher(runtime)
    && exactChoiceFlowsIntoRuntime(runtime)
    && postconditionFlowsIntoJournal(runtime, actor);
};

const inspectAtomicDomIfAndThen = (
  context: InspectorContext,
  inspectedFiles: Set<string>,
): InspectorFinding[] => {
  const paths = [
    "src/lib/browser/exact-target/browser-dom-intent.ts",
    "src/lib/browser/chrome-extension/dom-intent-runtime.ts",
    "src/lib/browser/exact-target/browser-command-actor.ts",
  ] as const;
  const sources = paths.map((filePath) => {
    inspectedFiles.add(filePath);
    return context.project.getSourceFile(resolveFromRepo(filePath));
  });
  if (sources.some((source) => !source)
    || domAtomicIfAndThenContractIsExact(sources[0]!, sources[1]!, sources[2]!)) return [];
  return [createFinding({
    checkId: "dom-automation/owner-assertion-set",
    lawId: "APEX-DOM-021-V1",
    clauseId: "apex-dom-021-requirement",
    filePath: paths.find((_, index) => !sources[index]) ?? paths[0],
    message: "The effective DOM exact-choice path must enforce adjacent-label exclusion, strict equality and same-command postcondition dataflow into the Browser journal.",
  })];
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const project = context.project;
  const scopedContext = { ...context, project };
  const collector = createDomFindingCollector();

  inspectDomContracts(scopedContext, collector);
  inspectDomRuntimeGuards(scopedContext, collector);
  const inspectedFiles = inspectDomBoundaries(scopedContext, collector);
  const inspectedFileSet = new Set(inspectedFiles);
  inspectDomFoundationGates(scopedContext, collector);
  collector.findings.push(...inspectExactTargetBinding(context));
  collector.findings.push(...inspectObservationMutationSeparation(context));
  collector.findings.push(...inspectRealChromeProofRoute(context, inspectedFileSet));
  collector.findings.push(...inspectAtomicDomIfAndThen(context, inspectedFileSet));

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,

    findings: collector.findings,
    inspectedFiles: [...inspectedFileSet].sort(),
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
