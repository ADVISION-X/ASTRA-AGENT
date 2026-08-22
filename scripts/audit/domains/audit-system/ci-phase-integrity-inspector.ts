import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { ciEntryGateIsFirstMainPhase } from "./ci-entry-order-inspector.js";
import { isDefinitelyUnreachable } from "./control-flow-reachability.js";
import { nodeReferencesDeclaration, resolvesTo, variableCall } from "./ci-integrity-ast.js";
import { failureLedgerUsesOneSkeleton } from "./ci-failure-ledger-inspector.js";
const ciFullPath = "scripts/audit/ci-full.ts";
const phasePlanPath = "scripts/audit/ci-full-phase-plan.ts";
const acceptanceLeafPlanPath = "scripts/audit/ci-acceptance-leaf-plan.ts";
const acceptanceLawBindingsPath = "scripts/audit/ci-acceptance-law-bindings.ts";
const failFastPath = "scripts/audit/ci-fail-fast.ts";
const phaseSealerDeclaration = (ciFull: SourceFile | undefined) => ciFull?.getImportDeclarations()
  .find((item) => item.getModuleSpecifierValue() === "./ci-phase-sealer.js")
  ?.getModuleSpecifierSourceFile()?.getVariableDeclaration("sealCiPhasePlanOrFail");
const phasePlanReturnsLazySteps = (phasePlan: SourceFile | undefined, leafPlan: SourceFile | undefined): boolean => {
  const leafBuilder = leafPlan?.getVariableDeclaration("sealAcceptanceLeafSteps");
  const phaseBuilder = phasePlan?.getVariableDeclaration("buildCiPhasePlan")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const body = phaseBuilder?.getBody();
  const acceptance = body?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "acceptanceSteps");
  const planned = body?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "plannedSteps");
  const call = acceptance?.getInitializerIfKind(SyntaxKind.CallExpression);
  const returned = body?.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .map((item) => item.getExpression()).find(Node.isObjectLiteralExpression);
  const returnedAcceptance = returned?.getProperty("acceptanceSteps");
  const returnedPlanned = returned?.getProperty("plannedSteps");
  return leafBuilder !== undefined && call !== undefined && resolvesTo(call.getExpression(), leafBuilder)
    && planned !== undefined && Node.isShorthandPropertyAssignment(returnedAcceptance)
    && (returnedAcceptance.getValueSymbol()?.getDeclarations().includes(acceptance!) ?? false)
    && Node.isShorthandPropertyAssignment(returnedPlanned)
    && (returnedPlanned.getValueSymbol()?.getDeclarations().includes(planned) ?? false)
    && !phasePlan?.getVariableDeclaration("acceptanceSteps") && !phasePlan?.getVariableDeclaration("plannedSteps");
};
const planExpressionMapsEveryLeaf = (expression: import("ts-morph").Node | undefined, leaves: import("ts-morph").Node): boolean => {
  const array = Node.isCallExpression(expression) ? expression.getArguments()[0] : expression;
  if (!Node.isArrayLiteralExpression(array)) return false;
  const mappedSpreads = array.getElements().filter(Node.isSpreadElement).filter((spread) => {
    const call = spread.getExpression();
    const callee = Node.isCallExpression(call) ? call.getExpression() : undefined;
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "map"
      && resolvesTo(callee.getExpression(), leaves);
  });
  return mappedSpreads.length === 1;
};

const physicalPlansMapEveryLeaf = (phasePlan: SourceFile | undefined): boolean => {
  const skeletonBuilder = phasePlan?.getVariableDeclaration("buildCiPlanSkeleton")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const skeletonLeaves = skeletonBuilder?.getParameters()[0];
  const skeletonBody = skeletonBuilder?.getBody();
  const phaseBuilder = phasePlan?.getVariableDeclaration("buildCiPhasePlan")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const phaseBody = phaseBuilder?.getBody();
  const acceptanceSteps = phaseBody?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "acceptanceSteps");
  const plannedSteps = phaseBody?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "plannedSteps");
  return skeletonLeaves !== undefined && skeletonBody !== undefined
    && planExpressionMapsEveryLeaf(skeletonBody, skeletonLeaves)
    && acceptanceSteps !== undefined && plannedSteps !== undefined
    && planExpressionMapsEveryLeaf(plannedSteps.getInitializer(), acceptanceSteps);
};

const leafPlanLoadsCurrentAuthority = (leafPlan: SourceFile | undefined): boolean => {
  const builder = leafPlan?.getVariableDeclaration("selectExecutableAcceptanceSkeletons")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const body = builder?.getBody();
  const generatedPlan = body?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "generatedPlan");
  const planLoader = leafPlan?.getVariableDeclaration("loadGeneratedPlan");
  return planLoader !== undefined && variableCall(generatedPlan, planLoader) !== null
    && !leafPlan?.getVariableDeclaration("generatedPlan");
};

const leafExpansionIsAtomic = (leafPlan: SourceFile | undefined): boolean => {
  const packageLoader = leafPlan?.getVariableDeclaration("loadPackageScripts");
  const expander = leafPlan?.getVariableDeclaration("expandNpmScript");
  const discovery = leafPlan?.getVariableDeclaration("discoverAcceptanceLeafInvocations");
  const closure = leafPlan?.getVariableDeclaration("assertAcceptanceBindingClosure");
  const skeletonBuilder = leafPlan?.getVariableDeclaration("buildAcceptancePackageSkeletons")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const executableBuilder = leafPlan?.getVariableDeclaration("buildAcceptanceLeafSkeletons")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const packageBuilder = leafPlan?.getVariableDeclaration("buildAcceptancePackageSkeletons");
  const executableSelector = leafPlan?.getVariableDeclaration("selectExecutableAcceptanceSkeletons");
  const packageScripts = skeletonBuilder?.getParameters()[0];
  const packageLoaderCall = packageScripts?.getInitializerIfKind(SyntaxKind.CallExpression);
  const invocations = skeletonBuilder?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "invocations");
  const discoveryCall = invocations?.getInitializerIfKind(SyntaxKind.CallExpression);
  const skeletonMap = skeletonBuilder?.getBody().getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => callMapsDeclaration(call, "map", invocations));
  const closureCall = skeletonBuilder?.getBody().getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => callUsesDeclaration(call, closure, invocations));
  const executablePackageCall = executableBuilder?.getBody().getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => packageBuilder !== undefined && resolvesTo(call.getExpression(), packageBuilder));
  const executableSelectorCall = executableBuilder?.getBody().getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => executableSelector !== undefined && resolvesTo(call.getExpression(), executableSelector));
  const recursiveExpansion = expander?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => resolvesTo(call.getExpression(), expander)) ?? false;
  const discoveryUsesExpander = discovery?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => expander !== undefined && resolvesTo(call.getExpression(), expander)) ?? false;
  const packageLoadIsDirect = packageLoaderCall !== undefined && packageLoader !== undefined
    && resolvesTo(packageLoaderCall.getExpression(), packageLoader);
  const discoveryIsDirect = discoveryCall !== undefined && discovery !== undefined
    && resolvesTo(discoveryCall.getExpression(), discovery);
  const discoveryUsesPackageScripts = discoveryCall?.getArguments()
    .some((argument) => packageScripts !== undefined
      && nodeReferencesDeclaration(argument, packageScripts)) ?? false;
  return [packageLoader, expander, discovery, closure, skeletonMap, closureCall,
    executablePackageCall, executableSelectorCall].every(Boolean)
    && packageLoadIsDirect && discoveryIsDirect && discoveryUsesPackageScripts
    && recursiveExpansion && discoveryUsesExpander;
};

const callMapsDeclaration = (
  call: import("ts-morph").CallExpression,
  methodName: string,
  declaration: import("ts-morph").Node | undefined,
): boolean => {
  const callee = call.getExpression();
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== methodName) return false;
  return declaration !== undefined && resolvesTo(callee.getExpression(), declaration);
};

const callUsesDeclaration = (
  call: import("ts-morph").CallExpression,
  calleeDeclaration: import("ts-morph").Node | undefined,
  argumentDeclaration: import("ts-morph").Node | undefined,
): boolean => {
  if (calleeDeclaration === undefined || !resolvesTo(call.getExpression(), calleeDeclaration)) return false;
  return call.getArguments().some((argument) =>
    argumentDeclaration !== undefined && nodeReferencesDeclaration(argument, argumentDeclaration));
};

const leafPlanHasOneAuthorityChain = (leafPlan: SourceFile | undefined): boolean =>
  Boolean(leafPlan?.getVariableDeclaration("acceptanceAuthority")
    && leafPlan.getVariableDeclaration("buildAcceptanceLeafSkeletons")
    && leafPlan.getVariableDeclaration("buildAcceptancePackageSkeletons")
    && leafPlan.getVariableDeclaration("selectExecutableAcceptanceSkeletons")
    && leafPlan.getVariableDeclaration("sealAcceptanceLeafSteps")
    && leafPlan.getVariableDeclaration("expandNpmScript")
    && leafPlan.getVariableDeclaration("loadPackageScripts")
    && leafPlan.getVariableDeclaration("discoverAcceptanceLeafInvocations")
    && leafPlan.getVariableDeclaration("assertAcceptanceBindingClosure")
    && !leafPlan.getVariableDeclaration("acceptanceOwner") && !leafPlan.getVariableDeclaration("ownerRules"));

const deferredAcceptanceUsesGeneratedEvidence = (leafPlan: SourceFile | undefined): boolean => {
  const builder = leafPlan?.getVariableDeclaration("selectExecutableAcceptanceSkeletons")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const authorityResolver = leafPlan?.getVariableDeclaration("acceptanceAuthority");
  const generatedPlan = builder?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "generatedPlan");
  const skeletons = builder?.getParameters()[0];
  const mapCall = builder?.getBody().getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => callMapsDeclaration(call, "map", skeletons));
  const callback = mapCall?.getArguments()[0];
  const callbackBody = Node.isArrowFunction(callback) ? callback.getBody() : undefined;
  const skeleton = Node.isArrowFunction(callback) ? callback.getParameters()[0] : undefined;
  const authority = callbackBody?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "authority");
  const authorityCall = authority?.getInitializerIfKind(SyntaxKind.CallExpression);
  const deferredGuard = callbackBody?.getDescendantsOfKind(SyntaxKind.IfStatement)
    .find((guard) => guardDefersGeneratedRealChrome(guard, authority));
  const discoveryFunctions = ["expandNpmScript", "discoverAcceptanceLeafInvocations"]
    .flatMap((name) => {
      const initializer = leafPlan?.getVariableDeclaration(name)?.getInitializer();
      return initializer ? [initializer] : [];
    });
  const deferredNames = new Set(["real-chrome", "real-proof"]);
  const hasNameHeuristic = discoveryFunctions.some((node) =>
    node.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .some((literal) => deferredNames.has(literal.getLiteralText())));
  const resolverCallIsExact = authorityCall !== undefined && authorityResolver !== undefined
    && resolvesTo(authorityCall.getExpression(), authorityResolver);
  const filePathArgument = authorityCall?.getArguments()[0];
  const resolverArgumentsAreExact = authorityCall !== undefined && skeleton !== undefined
    && generatedPlan !== undefined && Node.isPropertyAccessExpression(filePathArgument)
    && filePathArgument.getName() === "filePath" && resolvesTo(filePathArgument.getExpression(), skeleton)
    && resolvesTo(authorityCall.getArguments()[1], generatedPlan);
  return resolverCallIsExact && resolverArgumentsAreExact
    && deferredGuard !== undefined && !hasNameHeuristic;
};

const guardDefersGeneratedRealChrome = (
  guard: import("ts-morph").IfStatement,
  authority: import("ts-morph").Node | undefined,
): boolean => {
  const condition = guard.getExpression();
  const thenStatement = guard.getThenStatement();
  const returned = Node.isReturnStatement(thenStatement)
    ? thenStatement.getExpression()
    : thenStatement.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression();
  const callee = Node.isCallExpression(condition) ? condition.getExpression() : undefined;
  const symbol = callee?.getSymbol();
  const target = symbol?.isAlias() ? symbol.getAliasedSymbol() : symbol;
  const helperIsExact = target?.getDeclarations().some((declaration) =>
    declaration.getSourceFile().getFilePath()
      === resolveFromRepo("scripts/audit/shared/law-contracts.ts")
      && ((Node.isFunctionDeclaration(declaration)
        && declaration.getName() === "evidenceFacetIsDeferredDynamic")
        || (Node.isVariableDeclaration(declaration)
          && declaration.getName() === "evidenceFacetIsDeferredDynamic"))) ?? false;
  const argument = Node.isCallExpression(condition) ? condition.getArguments()[0] : undefined;
  const bindsGeneratedFacet = Node.isPropertyAccessExpression(argument)
    && argument.getName() === "evidenceFacet"
    && authority !== undefined
    && resolvesTo(argument.getExpression(), authority);
  return Node.isNullLiteral(returned) && helperIsExact && bindsGeneratedFacet;
};

const nestedFailureHelperIsBound = (
  sealer: import("ts-morph").ArrowFunction,
  failCall: import("ts-morph").CallExpression | undefined,
  failFast: import("ts-morph").Node | undefined,
): boolean => {
  const failureHelper = sealer.getSourceFile().getVariableDeclaration("failAcceptanceAuthority");
  const failureFunction = failureHelper?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const helperFailFast = failureFunction?.getParameters()[2];
  const helperCall = failureFunction?.getBody().getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => helperFailFast !== undefined && resolvesTo(call.getExpression(), helperFailFast));
  return failCall !== undefined && failureHelper !== undefined && failFast !== undefined
    && resolvesTo(failCall.getExpression(), failureHelper)
    && resolvesTo(failCall.getArguments()[2], failFast) && helperCall !== undefined;
};

const sealerBuildIsFailClosed = (
  sealer: import("ts-morph").ArrowFunction,
  builder: import("ts-morph").VariableDeclaration,
): boolean => {
  const body = sealer.getBody();
  const tries = Node.isBlock(body) ? body.getStatements().filter(Node.isTryStatement) : [];
  const statement = tries[0];
  const tryBody = statement?.getTryBlock();
  const returned = tryBody?.getStatements()[0];
  const buildCall = Node.isReturnStatement(returned)
    ? returned.getExpressionIfKind(SyntaxKind.CallExpression) : undefined;
  const failFast = sealer.getParameters()[1];
  const caught = statement?.getCatchClause()?.getVariableDeclaration();
  const catchBody = statement?.getCatchClause()?.getBlock();
  const terminal = catchBody?.getStatements().at(-1);
  const failCall = Node.isExpressionStatement(terminal)
    ? terminal.getExpressionIfKind(SyntaxKind.CallExpression)
    : Node.isReturnStatement(terminal) ? terminal.getExpressionIfKind(SyntaxKind.CallExpression) : undefined;
  const message = catchBody?.getVariableDeclaration("message");
  return tries.length === 1 && tryBody?.getStatements().length === 1
    && buildCall !== undefined && resolvesTo(buildCall.getExpression(), builder)
    && caught !== undefined && message !== undefined && message.getInitializer() !== undefined
    && nodeReferencesDeclaration(message.getInitializerOrThrow(), caught)
    && failCall !== undefined && nestedFailureHelperIsBound(sealer, failCall, failFast)
    && failCall.getArguments().some((argument) => nodeReferencesDeclaration(argument, message))
    && catchBody?.getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 0;
};

const acceptancePlanBuildIsPostArtifact = (
  ciFull: SourceFile | undefined,
  phasePlan: SourceFile | undefined,
): boolean => {
  const main = ciFull?.getVariableDeclaration("main")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const buildArtifacts = ciFull?.getVariableDeclaration("runBuildAuditArtifactsOrFail");
  const phaseSealer = phaseSealerDeclaration(ciFull);
  const phaseSealerFunction = phaseSealer?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const phaseBuilder = phasePlan?.getVariableDeclaration("buildCiPhasePlan");
  const skeletonBuilder = phasePlan?.getVariableDeclaration("buildCiPlanSkeleton");
  const packageSkeletonBuilder = ciFull?.getImportDeclarations()
    .find((item) => item.getModuleSpecifierValue() === "./ci-phase-sealer.js")
    ?.getModuleSpecifierSourceFile()?.getVariableDeclaration("buildAcceptancePackageSkeletonsOrFail");
  if (!main || !buildArtifacts || !phaseSealer || !phaseSealerFunction || !phaseBuilder
    || !skeletonBuilder || !packageSkeletonBuilder) return false;
  const directMainCalls = main.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === main);
  const artifactCall = directMainCalls.find((call) => resolvesTo(call.getExpression(), buildArtifacts));
  const packageBuildCall = directMainCalls.find((call) => resolvesTo(call.getExpression(), packageSkeletonBuilder));
  const skeletonBuildCall = directMainCalls.find((call) => resolvesTo(call.getExpression(), skeletonBuilder));
  const phaseSealCall = directMainCalls.find((call) => resolvesTo(call.getExpression(), phaseSealer));
  return artifactCall !== undefined && packageBuildCall !== undefined && skeletonBuildCall !== undefined
    && phaseSealCall !== undefined
    && sealerBuildIsFailClosed(phaseSealerFunction, phaseBuilder)
    && artifactCall.getStart() < packageBuildCall.getStart()
    && packageBuildCall.getStart() < skeletonBuildCall.getStart()
    && skeletonBuildCall.getStart() < phaseSealCall.getStart();
};

const acceptanceAuthorityFunction = (leafPlan: SourceFile | undefined) =>
  leafPlan?.getVariableDeclaration("acceptanceAuthority")?.getInitializerIfKind(SyntaxKind.ArrowFunction);

const authorityBindingLookupIsAuthentic = (leafPlan: SourceFile | undefined, lawBindings: SourceFile | undefined): boolean => {
  const resolver = acceptanceAuthorityFunction(leafPlan);
  const filePath = resolver?.getParameters()[0];
  const resolverBindings = resolver?.getParameters()[2];
  const binding = resolver?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "binding");
  const bindingMap = lawBindings?.getVariableDeclaration("acceptanceLawBindings");
  const call = binding?.getInitializerIfKind(SyntaxKind.CallExpression);
  const callee = call?.getExpression();
  const receiver = Node.isPropertyAccessExpression(callee) && callee.getName() === "get"
    ? callee.getExpression() : undefined;
  return filePath !== undefined && bindingMap !== undefined && resolverBindings !== undefined && call !== undefined
    && resolvesTo(resolverBindings.getInitializer(), bindingMap)
    && resolvesTo(receiver, resolverBindings) && call.getArguments().length === 1
    && resolvesTo(call.getArguments()[0], filePath);
};

const ownerResolutionIsGenerated = (leafPlan: SourceFile | undefined): boolean => {
  const resolver = acceptanceAuthorityFunction(leafPlan);
  const generatedPlan = resolver?.getParameters()[1];
  const binding = resolver?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "binding");
  const matches = resolver?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "ownerMatches");
  const initializer = matches?.getInitializer();
  const properties = new Set(initializer?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .map((item) => item.getName()) ?? []);
  return generatedPlan !== undefined && binding !== undefined && initializer !== undefined
    && nodeReferencesDeclaration(initializer, binding) && nodeReferencesDeclaration(initializer, generatedPlan)
    && ["bindings", "capabilityDomain", "clauseId", "entries", "lawId"].every((name) => properties.has(name));
};

const authorityGuardsAreFailClosed = (leafPlan: SourceFile | undefined): boolean => {
  const resolver = acceptanceAuthorityFunction(leafPlan);
  const matches = resolver?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "ownerMatches");
  const candidate = resolver?.getBody().getDescendantsOfKind(SyntaxKind.BindingElement)
    .find((item) => item.getName() === "candidate");
  const facets = resolver?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "facets");
  const evidenceFacet = resolver?.getBody().getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((item) => item.getName() === "evidenceFacet");
  const guards = resolver?.getBody().getDescendantsOfKind(SyntaxKind.IfStatement) ?? [];
  const unique = guards.some((guard) => matches !== undefined && nodeReferencesDeclaration(guard.getExpression(), matches)
    && guard.getExpression().getDescendantsOfKind(SyntaxKind.NumericLiteral).some((item) => item.getLiteralValue() === 1)
    && guard.getThenStatement().getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 1);
  const evidence = guards.some((guard) => {
    const condition = guard.getExpression();
    return candidate !== undefined && nodeReferencesDeclaration(condition, candidate)
      && condition.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
        .some((item) => item.getName() === "evidenceMode" && resolvesTo(item.getExpression(), candidate))
      && guard.getThenStatement().getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 1;
  });
  const facetGuards = guards.filter((guard) =>
    guard.getThenStatement().getDescendantsOfKind(SyntaxKind.ThrowStatement).length === 1
    && ((facets !== undefined && nodeReferencesDeclaration(guard.getExpression(), facets))
      || (evidenceFacet !== undefined && nodeReferencesDeclaration(guard.getExpression(), evidenceFacet))));
  return unique && evidence && facets !== undefined && evidenceFacet !== undefined && facetGuards.length >= 2;
};

const returnedMemberIsBound = (
  returned: import("ts-morph").ObjectLiteralExpression | undefined,
  propertyName: string,
  memberName: string,
  declaration: import("ts-morph").Node | undefined,
): boolean => {
  const property = returned?.getProperty(propertyName);
  const initializer = Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
  return declaration !== undefined && Node.isPropertyAccessExpression(initializer)
    && initializer.getName() === memberName && resolvesTo(initializer.getExpression(), declaration);
};

const returnedShorthandIsBound = (
  returned: import("ts-morph").ObjectLiteralExpression | undefined,
  propertyName: string,
  declaration: import("ts-morph").Node | undefined,
): boolean => {
  const property = returned?.getProperty(propertyName);
  return declaration !== undefined && Node.isShorthandPropertyAssignment(property)
    && (property.getValueSymbol()?.getDeclarations().includes(declaration) ?? false);
};

const returnedAuthorityIsBound = (leafPlan: SourceFile | undefined): boolean => {
  const resolver = acceptanceAuthorityFunction(leafPlan);
  const body = resolver?.getBody();
  const binding = body?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === "binding");
  const candidate = body?.getDescendantsOfKind(SyntaxKind.BindingElement).find((item) => item.getName() === "candidate");
  const ownerBinding = body?.getDescendantsOfKind(SyntaxKind.BindingElement).find((item) => item.getName() === "ownerId");
  const facetBinding = body?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find((item) => item.getName() === "evidenceFacet");
  const returns = body?.getDescendantsOfKind(SyntaxKind.ReturnStatement)
    .filter((item) => item.getFirstAncestor(Node.isFunctionLikeDeclaration) === resolver)
    .map((item) => item.getExpression()).filter(Node.isObjectLiteralExpression) ?? [];
  const returned = returns.length === 1 ? returns[0] : undefined;
  return returnedMemberIsBound(returned, "lawId", "lawId", binding)
    && returnedMemberIsBound(returned, "clauseId", "clauseId", binding)
    && returnedMemberIsBound(returned, "evidenceMode", "evidenceMode", candidate)
    && returnedShorthandIsBound(returned, "ownerId", ownerBinding)
    && returnedShorthandIsBound(returned, "evidenceFacet", facetBinding);
};

const staticBindingTruthExists = (phasePlan: SourceFile | undefined, lawBindings: SourceFile | undefined): boolean => {
  const typecheck = phasePlan?.getVariableDeclaration("typecheckStep")?.getInitializer();
  const strings = new Set(typecheck?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((item) => item.getLiteralText()) ?? []);
  const entries = lawBindings?.getVariableDeclaration("acceptanceLawBindings")?.getInitializer()
    ?.getFirstDescendantByKind(SyntaxKind.ArrayLiteralExpression)?.getElements();
  return strings.has("APEX-CODE-PURITY-008-V1") && strings.has("code-purity")
    && entries !== undefined && entries.length > 0;
};

const acceptanceAuthorityIsExplicit = (
  phasePlan: SourceFile | undefined, leafPlan: SourceFile | undefined, lawBindings: SourceFile | undefined,
): boolean => authorityBindingLookupIsAuthentic(leafPlan, lawBindings)
  && ownerResolutionIsGenerated(leafPlan) && authorityGuardsAreFailClosed(leafPlan)
  && returnedAuthorityIsBound(leafPlan) && staticBindingTruthExists(phasePlan, lawBindings);

type CommitSpec = readonly [runner: string, result: string, state: string, property: string];

const commitForStepIsOrdered = (
  ciFull: SourceFile, body: import("ts-morph").Block,
  assignments: readonly import("ts-morph").BinaryExpression[], failCalls: readonly import("ts-morph").CallExpression[],
  [runnerName, resultName, stateName, propertyName]: CommitSpec,
): boolean => {
  const runner = ciFull.getVariableDeclaration(runnerName);
  const result = body.getVariableDeclaration(resultName);
  const state = body.getVariableDeclaration(stateName);
  if (!runner || !result || !state) return false;
  const initializer = result.getInitializer();
  const invocation = Node.isAwaitExpression(initializer) ? initializer.getExpression() : initializer;
  if (!Node.isCallExpression(invocation) || !resolvesTo(invocation.getExpression(), runner)) return false;
  const assignment = assignments.find((item) => {
    const right = item.getRight();
    return item.getOperatorToken().getKind() === SyntaxKind.EqualsToken && resolvesTo(item.getLeft(), state)
      && Node.isPropertyAccessExpression(right) && right.getName() === propertyName
      && resolvesTo(right.getExpression(), result);
  });
  const failure = failCalls.find((call) => {
    const argument = call.getArguments()[1];
    return Node.isPropertyAccessExpression(argument) && argument.getName() === "failure"
      && resolvesTo(argument.getExpression(), result);
  });
  return assignment !== undefined && failure !== undefined && result.getStart() < assignment.getStart()
    && assignment.getStart() < failure.getStart();
};

const failureEvidenceIsCommittedBeforeFailFast = (ciFull: SourceFile | undefined): boolean => {
  const main = ciFull?.getVariableDeclaration("main")?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const body = main?.getBody();
  if (!ciFull || !main || !Node.isBlock(body)) return false;
  const failFast = body.getVariableDeclaration("failFast");
  if (!failFast) return false;
  const assignments = body.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    .filter((item) => item.getFirstAncestor(Node.isFunctionLikeDeclaration) === main
      && !isDefinitelyUnreachable(item, main));
  const failCalls = body.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getFirstAncestor(Node.isFunctionLikeDeclaration) === main
      && resolvesTo(call.getExpression(), failFast) && !isDefinitelyUnreachable(call, main));
  const specs: readonly CommitSpec[] = [["runActiveLawCoverageStep", "lawCoverageStep", "lawCoverage", "lawCoverage"],
    ["runAuditPlanStep", "auditPlanStep", "ownerReports", "ownerReports"]];
  return specs.every((spec) => commitForStepIsOrdered(ciFull, body, assignments, failCalls, spec));
};

export const evaluateCiPhaseIntegrity = (context: InspectorContext) => {
  const phasePlan = context.project.getSourceFile(resolveFromRepo(phasePlanPath));
  const ciFull = context.project.getSourceFile(resolveFromRepo(ciFullPath));
  const leafPlan = context.project.getSourceFile(resolveFromRepo(acceptanceLeafPlanPath));
  const lawBindings = context.project.getSourceFile(resolveFromRepo(acceptanceLawBindingsPath));
  const failFastFile = context.project.getSourceFile(resolveFromRepo(failFastPath));
  return {
    acceptanceAuthorityIsExplicit: acceptanceAuthorityIsExplicit(phasePlan, leafPlan, lawBindings),
    acceptancePlanBuildIsPostArtifact: acceptancePlanBuildIsPostArtifact(ciFull, phasePlan),
    ciEntryGateIsFirstMainPhase: ciEntryGateIsFirstMainPhase(ciFull, phasePlan),
    deferredAcceptanceUsesGeneratedEvidence: deferredAcceptanceUsesGeneratedEvidence(leafPlan),
    failureEvidenceIsCommittedBeforeFailFast: failureEvidenceIsCommittedBeforeFailFast(ciFull),
    failureLedgerUsesOneSkeleton: failureLedgerUsesOneSkeleton(ciFull, phasePlan, failFastFile),
    leafExpansionIsAtomic: leafExpansionIsAtomic(leafPlan),
    leafPlanHasOneAuthorityChain: leafPlanHasOneAuthorityChain(leafPlan),
    leafPlanLoadsCurrentAuthority: leafPlanLoadsCurrentAuthority(leafPlan),
    phasePlanReturnsLazySteps: phasePlanReturnsLazySteps(phasePlan, leafPlan),
    physicalPlansMapEveryLeaf: physicalPlansMapEveryLeaf(phasePlan),
  };
};
