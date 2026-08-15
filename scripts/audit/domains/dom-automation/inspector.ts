import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectDomBoundaries } from "./components/inspect-dom-boundaries.js";
import { inspectDomContracts } from "./components/inspect-dom-contracts.js";
import { inspectDomFoundationGates } from "./components/inspect-dom-foundation-gates.js";
import { inspectDomRuntimeGuards } from "./components/inspect-dom-runtime-guards.js";
import { createDomFindingCollector } from "./components/dom-inspector-support.js";
import { createFinding } from "../../shared/finding-utils.js";
import { Node, Project, SyntaxKind, type FunctionDeclaration, type SourceFile } from "ts-morph";
import { resolveFromRepo } from "../../shared/paths.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";

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

const embeddedScriptSource = (fn: FunctionDeclaration): SourceFile | null => {
  const returned = fn.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression();
  if (!returned) return null;
  let body: string;
  if (Node.isNoSubstitutionTemplateLiteral(returned)) {
    body = returned.getLiteralText();
  } else if (Node.isTemplateExpression(returned)) {
    body = returned.getHead().getLiteralText()
      + returned.getTemplateSpans().map((span) => `null${span.getLiteral().getLiteralText()}`).join("");
  } else {
    return null;
  }
  const project = new Project({ useInMemoryFileSystem: true });
  return project.createSourceFile("embedded-observation.ts", `function observed(){${body}}`);
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

const inspectObservationBuilders = (
  files: DomActionFiles,
  paths: Record<keyof DomActionFiles, string>,
  addGap: (filePath: string, message: string) => void,
): void => {
  for (const [key, functionNames] of [
    ["click", ["buildClickObservationScript"]],
    ["fill", ["buildFillObservationScript", "buildVerifyScript"]],
  ] as const) {
    for (const functionName of functionNames) {
      const builder = files[key]?.getFunction(functionName);
      if (!builder) {
        addGap(paths[key], `${functionName} observation builder is missing`);
        continue;
      }
      const embedded = embeddedScriptSource(builder);
      if (!embedded) {
        addGap(paths[key], `${functionName} must expose an AST-parseable observation body`);
        continue;
      }
      const forbiddenCalls = embedded.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
        const expression = call.getExpression();
        const name = Node.isPropertyAccessExpression(expression)
          ? expression.getName()
          : Node.isIdentifier(expression) ? astIdentifierName(expression) ?? "" : "";
        return ["click", "scrollIntoView", "focus", "execCommand", "dispatchEvent", "eval"].includes(name);
      });
      const propertyMutations = embedded.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((binary) =>
        binary.getOperatorToken().getKind() === SyntaxKind.EqualsToken
        && Node.isPropertyAccessExpression(binary.getLeft()));
      const constructors = embedded.getDescendantsOfKind(SyntaxKind.NewExpression).filter((node) =>
        Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === "Function");
      if (forbiddenCalls.length || propertyMutations.length || constructors.length) {
        addGap(paths[key], `${functionName} must remain observation-only and contain no page mutation`);
      }
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
    ["click", "clickDomElementOnce", ["evaluate", "clickLocatedDomElement"]],
    ["fill", "fillDomElementOnce", ["evaluate", "clickLocatedDomElement", "textInput"]],
    ["upload", "uploadApprovedFileOnce", ["setFileInputFiles"]],
  ];
  for (const [key, functionName, required] of requiredCalls) {
    const fn = files[key]?.getFunction(functionName);
    if (!fn) {
      addGap(paths[key], `${functionName} is missing`);
      continue;
    }
    const calls = new Set(key === "fill" ? sourceMethodCallNames(files[key]!) : methodCallNames(fn));
    for (const call of required) if (!calls.has(call)) addGap(paths[key], `${functionName} must call BrowserTargetSession.${call}`);
  }
  const fillLiterals = new Set(files.fill?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  for (const required of ["Tab", "dom-fill-commit-failed"]) {
    if (!fillLiterals.has(required)) addGap(paths.fill, `fill must commit component text through ${required}`);
  }
  inspectObservationBuilders(files, paths, addGap);
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
  collector.findings.push(...inspectObservationMutationSeparation(context));

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
