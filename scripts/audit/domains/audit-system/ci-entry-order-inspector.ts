import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type Block,
  type CallExpression,
  type SourceFile,
  type VariableDeclaration,
} from "ts-morph";

const resolvesTo = (node: Node | undefined, declaration: Node): boolean => {
  const symbol = node?.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  return target?.getDeclarations().includes(declaration) ?? false;
};

type MainSetup = Record<"acceptanceSkeletons" | "completedSteps" | "lawCoverage" | "ownerReports" | "currentPlannedSteps" | "failFast", VariableDeclaration>;
const setupNames = ["acceptanceSkeletons", "completedSteps", "lawCoverage", "ownerReports", "currentPlannedSteps", "failFast"] as const;

const readMainSetup = (body: Block): MainSetup | null => {
  const declarations = body.getStatements().slice(0, setupNames.length).map((statement) => {
    if (!Node.isVariableStatement(statement) || statement.getDeclarations().length !== 1) return null;
    return statement.getDeclarations()[0] ?? null;
  });
  if (declarations.some((item, index) => item?.getName() !== setupNames[index])) return null;
  return Object.fromEntries(setupNames.map((name, index) => [name, declarations[index]])) as MainSetup;
};

const phaseCalls = (
  main: ArrowFunction, ciFull: SourceFile, phasePlan: SourceFile | undefined,
) => {
  const names = ["runCommandStepOrFail", "runBuildAuditArtifactsOrFail", "runActiveLawCoverageStep",
    "runAuditPlanStep", "runAcceptancePhaseOrFail", "runGeneratedArtifactTruthOrFail"];
  const declarations = names.flatMap((name) => ciFull.getVariableDeclaration(name) ?? []);
  for (const name of ["buildCiPhasePlan", "buildCiPlanSkeleton"]) {
    const declaration = phasePlan?.getVariableDeclaration(name);
    if (declaration) declarations.push(declaration);
  }
  const leafBuilder = ciFull.getImportDeclarations()
    .find((item) => item.getModuleSpecifierValue() === "./ci-acceptance-leaf-plan.js")
    ?.getModuleSpecifierSourceFile()?.getVariableDeclaration("buildAcceptanceLeafSkeletons");
  if (leafBuilder) declarations.push(leafBuilder);
  return main.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === main)
    .filter((call) => declarations.some((declaration) => resolvesTo(call.getExpression(), declaration)))
    .sort((left, right) => left.getStart() - right.getStart());
};

const initialStateIsAuthentic = (
  setup: MainSetup, ciFull: SourceFile, phasePlan: SourceFile | undefined,
): boolean => {
  const defaultCoverage = ciFull.getVariableDeclaration("defaultLawCoverage");
  const coverageCall = setup.lawCoverage.getInitializerIfKind(SyntaxKind.CallExpression);
  const preArtifactPlan = phasePlan?.getVariableDeclaration("preArtifactPlannedSteps");
  const currentPlanInitializer = setup.currentPlannedSteps.getInitializer();
  return Node.isArrayLiteralExpression(setup.completedSteps.getInitializer())
    && Node.isArrayLiteralExpression(setup.ownerReports.getInitializer())
    && Node.isArrayLiteralExpression(setup.acceptanceSkeletons.getInitializer())
    && defaultCoverage !== undefined && coverageCall !== undefined
    && resolvesTo(coverageCall.getExpression(), defaultCoverage)
    && preArtifactPlan !== undefined && currentPlanInitializer !== undefined
    && resolvesTo(currentPlanInitializer, preArtifactPlan);
};

const failFastSetupIsAuthentic = (setup: MainSetup, ciFull: SourceFile): boolean => {
  const imported = ciFull.getImportDeclarations()
    .find((item) => item.getModuleSpecifierValue() === "./ci-fail-fast.js")
    ?.getModuleSpecifierSourceFile()?.getVariableDeclaration("createFailFast");
  const call = setup.failFast.getInitializerIfKind(SyntaxKind.CallExpression);
  const getter = call?.getArguments()[3];
  const getterBody = Node.isArrowFunction(getter) ? getter.getBody() : undefined;
  return imported !== undefined && call !== undefined && resolvesTo(call.getExpression(), imported)
    && resolvesTo(call.getArguments()[0], setup.completedSteps)
    && Node.isIdentifier(getterBody) && resolvesTo(getterBody, setup.currentPlannedSteps);
};

const entryCallIsAuthentic = (
  call: CallExpression, ciFull: SourceFile, phasePlan: SourceFile | undefined,
): boolean => {
  const runner = ciFull.getVariableDeclaration("runCommandStepOrFail");
  const entry = phasePlan?.getVariableDeclaration("codexEntryGateStep");
  const [phase, index, entryArgument] = call.getArguments();
  return runner !== undefined && entry !== undefined && resolvesTo(call.getExpression(), runner)
    && Node.isStringLiteral(phase) && phase.getLiteralText() === "codex-entry-gate"
    && Node.isNumericLiteral(index) && index.getLiteralValue() === 0
    && resolvesTo(entryArgument, entry);
};

export const ciEntryGateIsFirstMainPhase = (
  ciFull: SourceFile | undefined, phasePlan: SourceFile | undefined,
): boolean => {
  const main = ciFull?.getVariableDeclaration("main")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const body = main?.getBody();
  if (!ciFull || !main || !Node.isBlock(body)) return false;
  const setup = readMainSetup(body);
  const firstCall = phaseCalls(main, ciFull, phasePlan)[0];
  const statement = firstCall?.getFirstAncestorByKind(SyntaxKind.ExpressionStatement);
  if (!setup || !firstCall || statement !== body.getStatements()[setupNames.length]
    || !Node.isAwaitExpression(firstCall.getParent())) return false;
  return initialStateIsAuthentic(setup, ciFull, phasePlan) && failFastSetupIsAuthentic(setup, ciFull)
    && entryCallIsAuthentic(firstCall, ciFull, phasePlan);
};
