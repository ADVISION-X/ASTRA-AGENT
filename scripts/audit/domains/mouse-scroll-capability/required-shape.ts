import { Node, SyntaxKind, type CallExpression, type PropertyAssignment, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { hasInterfaceMethod } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { LAW_IDS, PATHS } from "./config.js";
import { getSourceFile, makeProject, missingRequiredFiles, toMouseScrollRelativePath } from "./project-access.js";

async function collectMissingFileFindings(findings: Finding[]): Promise<void> {
  for (const filePath of await missingRequiredFiles()) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: filePath, line: 1, severity: "fatal", message: "Mouse Scroll required production file is missing." }));
  }
}

function collectContractFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const contractSource = getSourceFile(project, PATHS.CONTRACT);
  if (!contractSource || !hasInterfaceMethod(contractSource, "MouseScrollAbilityGroup", "execute")) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.CONTRACT, line: 1, severity: "fatal", message: "Mouse Scroll must expose a stable public execute contract." }));
  }
  const abilityGroupSource = getSourceFile(project, PATHS.ABILITY_GROUP);
  if (!abilityGroupSource || !hasCallExpression(abilityGroupSource, "parseMouseScrollAbilityInput") || !hasCallExpressionPath(abilityGroupSource, ["MouseScrollAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: "Mouse Scroll ability-group must parse input and parse governed output." }));
  }
  return abilityGroupSource ? findings.concat(collectAbilityGroupFactoryFindings(abilityGroupSource)) : findings;
}

function collectAbilityGroupFactoryFindings(abilityGroupSource: NonNullable<ReturnType<typeof getSourceFile>>): Finding[] {
  return ["createSystemMouseScrollClock", "createMouseScrollIdempotencyRegistry"]
    .filter((forbidden) => hasCallExpression(abilityGroupSource, forbidden))
    .map((forbidden) => createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.ABILITY_GROUP, line: 1, severity: "fatal", message: `Mouse Scroll ability-group must not construct ${forbidden}.` }));
}

function collectSchemaAndRegistryFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const schemaSource = getSourceFile(project, PATHS.SCHEMA);
  if (!schemaSource) {
    findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Scroll schema file is missing." }));
  } else {
    for (const name of ["MouseScrollAbilityInputSchema", "MouseScrollAbilityResultSchema", "MouseScrollRuntimeProofSchema", "MouseScrollSuccessOutputSchema"]) {
      if (!schemaSource.getVariableDeclaration(name)) {
        findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: `Mouse Scroll schema must declare ${name}.` }));
      }
    }
    const hasOutputNullGuard = schemaSource.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === "failed and review_required require output=null");
    if (!hasOutputNullGuard) {
      findings.push(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.SCHEMA, line: 1, severity: "fatal", message: "Mouse Scroll result schema must force output=null for non-success states." }));
    }
  }
  const registrySource = getSourceFile(project, PATHS.REGISTRY);
  return !registrySource || !registrySource.getVariableDeclaration("CHILDREN")
    ? findings.concat(createFinding({ lawId: LAW_IDS.SCHEMA, file: PATHS.REGISTRY, line: 1, severity: "fatal", message: "Mouse Scroll registry must declare canonical children." }))
    : findings;
}

function collectExecutorFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const executorSource = getSourceFile(project, PATHS.EXECUTOR);
  if (!executorSource) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: "Mouse Scroll executor file is missing." })];
  }

  const routeSources = [
    executorSource,
    getSourceFile(project, PATHS.EXECUTION_VALIDATOR),
    getSourceFile(project, PATHS.EXECUTION_RESERVATION),
    getSourceFile(project, PATHS.BLOCKED_RESULT_BUILDER),
    getSourceFile(project, PATHS.PRIMITIVE_RESULT_BUILDER),
  ].filter((sourceFile): sourceFile is NonNullable<typeof sourceFile> => sourceFile !== null);

  return ["validateGeometryScrollProof", "validateScrollPolicy", "validatePreScrollSafety", "resolveScrollDelta", "runPrimitiveScroll", "buildMouseScrollResult"]
    .filter((calleeName) => !routeSources.some((sourceFile) => hasCallExpression(sourceFile, calleeName)))
    .map((calleeName) => createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.EXECUTOR, line: 1, severity: "fatal", message: `Mouse Scroll executor must call ${calleeName}.` }));
}

function collectBuilderFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  const resultBuilderSource = getSourceFile(project, PATHS.RESULT_BUILDER);
  if (!resultBuilderSource || !hasCallExpressionPath(resultBuilderSource, ["MouseScrollAbilityResultSchema", "parse"])) {
    findings.push(createFinding({ lawId: LAW_IDS.RESULT, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll result builder must parse the governed result shape before returning success, failure, or review_required." }));
  }
  if (!resultBuilderSource || !hasCallExpression(resultBuilderSource, "buildMouseScrollRuntimeProof")) {
    findings.push(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.RESULT_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll result builder must preserve the governed runtime proof output." }));
  }
  const proofBuilderSource = getSourceFile(project, PATHS.PROOF_BUILDER);
  return !proofBuilderSource || !hasCallExpressionPath(proofBuilderSource, ["MouseScrollRuntimeProofSchema", "parse"])
    ? findings.concat(createFinding({ lawId: LAW_IDS.PROOF, file: PATHS.PROOF_BUILDER, line: 1, severity: "fatal", message: "Mouse Scroll proof builder must parse runtime proof output." }))
    : findings;
}

function buildMouseScrollViewportBoundsFinding(builderNode: Node, line: number): Finding | null {
  const hasGeometrySnapshot = (builderNode.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]).some((call) => call.getExpression().getText() === "runtime.browserController.getGeometrySnapshot");
  const boundsProperty = (builderNode.getDescendantsOfKind(SyntaxKind.PropertyAssignment) as PropertyAssignment[]).find((property) => property.getName() === "bounds");
  const boundsText = boundsProperty?.getInitializer()?.getText() ?? "";
  const bindsViewportBounds = boundsText.includes("geometry.viewportWidth") && boundsText.includes("geometry.viewportHeight");
  const hasSyntheticHundredPxBounds = boundsText.includes("width: 100") || boundsText.includes("height: 100");
  return !hasGeometrySnapshot || !bindsViewportBounds || hasSyntheticHundredPxBounds
    ? createFinding({
      lawId: LAW_IDS.EXECUTION,
      file: PATHS.WORKBENCH_ACTION_DISPATCH_INPUT,
      line,
      severity: "fatal",
      message: "Workbench mouse-scroll dispatch must bind onePage bounds to the live browser viewport, not synthetic 100px bounds.",
    })
    : null;
}

function buildMouseScrollViewportAnchorFinding(builderNode: Node, line: number): Finding | null {
  const anchorProperty = (builderNode.getDescendantsOfKind(SyntaxKind.PropertyAssignment) as PropertyAssignment[]).find((property) => property.getName() === "normalizedAnchorPoint");
  const anchorText = anchorProperty?.getInitializer()?.getText() ?? "";
  const bindsViewportCenterAnchor = anchorText.includes("executableAnchorPoint")
    && builderNode.getText().includes("geometry.viewportWidth / 2")
    && builderNode.getText().includes("geometry.viewportHeight / 2");
  const hasHardcodedTopLeftAnchor = anchorText.includes("x: 50") || anchorText.includes("y: 50");
  return !bindsViewportCenterAnchor || hasHardcodedTopLeftAnchor
    ? createFinding({
      lawId: LAW_IDS.EXECUTION,
      file: PATHS.WORKBENCH_ACTION_DISPATCH_INPUT,
      line,
      severity: "fatal",
      message: "Workbench mouse-scroll dispatch must target the live viewport center, not a hardcoded top-left anchor that can miss the video feed.",
    })
    : null;
}

function collectChildImplementationFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const findings: Finding[] = [];
  for (const filePath of [PATHS.BROWSER_CHILD_IMPL, PATHS.DESKTOP_CHILD_IMPL, PATHS.REGION_CHILD_IMPL]) {
    const childSource = getSourceFile(project, filePath);
    if (!childSource || !hasCallExpression(childSource, "executeMouseScroll")) {
      findings.push(createFinding({ lawId: LAW_IDS.CHILDREN, file: childSource ? toMouseScrollRelativePath(childSource) : PATHS.INDEX, line: 1, severity: "fatal", message: "Mouse Scroll child implementation must delegate through executeMouseScroll." }));
      continue;
    }
    const hasParse = childSource.getDescendants().some((node) => {
      if (!Node.isCallExpression(node)) {
        return false;
      }
      const expression = node.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "parse";
    });
    if (!hasParse) {
      findings.push(createFinding({ lawId: LAW_IDS.CHILDREN, file: toMouseScrollRelativePath(childSource), line: 1, severity: "fatal", message: "Mouse Scroll child implementation must parse its governed child result." }));
    }
  }
  return findings;
}

function collectWorkbenchDispatchFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const source = getSourceFile(project, PATHS.WORKBENCH_ACTION_DISPATCH_INPUT);
  if (!source) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_ACTION_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Workbench mouse-scroll dispatch input builder is missing." })];
  }

  const builder = source.getVariableDeclaration("buildMouseScrollCommand")
    ?? source.getExportedDeclarations().get("buildMouseScrollCommand")?.find(Node.isVariableDeclaration)
    ?? null;
  if (!builder) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.WORKBENCH_ACTION_DISPATCH_INPUT, line: 1, severity: "fatal", message: "Workbench must expose buildMouseScrollCommand for governed mouse-scroll dispatch." })];
  }

  const builderNode = builder.getSourceFile();
  const findings: Finding[] = [];
  const boundsFinding = buildMouseScrollViewportBoundsFinding(builderNode, builder.getStartLineNumber());
  const anchorFinding = buildMouseScrollViewportAnchorFinding(builderNode, builder.getStartLineNumber());
  if (boundsFinding) {
    findings.push(boundsFinding);
  }
  if (anchorFinding) {
    findings.push(anchorFinding);
  }
  return findings;
}

function buildVisibleScrollPrimitiveOrderingFinding(scrollMethod: Node): Finding | null {
  const calls = (scrollMethod.getDescendantsOfKind(SyntaxKind.CallExpression) as CallExpression[]).map((call) => ({
    name: call.getExpression().getText(),
    position: call.getStart(),
  }));
  const activateCall = calls.find((call) => call.name === "activateChrome") ?? null;
  const scrollAtCall = calls.find((call) => call.name === "scrollAt") ?? null;
  return activateCall === null || scrollAtCall === null || activateCall.position > scrollAtCall.position
    ? createFinding({
      lawId: LAW_IDS.EXECUTION,
      file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER,
      line: scrollMethod.getStartLineNumber(),
      severity: "fatal",
      message: "Current Chrome scroll primitive must activate Chrome before posting the wheel event so production scroll is visible and targets the controlled browser.",
    })
    : null;
}

function buildVisibleScrollPrimitiveVideoIdentityFinding(source: SourceFile, scrollMethod: Node): Finding | null {
  const text = source.getFullText();
  const hasForbiddenVideoIdentityPolling = source.getClass("CurrentChromeBrowserController")?.getInstanceMethod("waitForScrollNextVideoIdentityChange") !== undefined
    || text.includes("AND THEN observed video identity change")
    || text.includes("AND THEN fallback timeout reached without video identity change")
    || text.includes("readCurrentVideoIdentitySnapshot");
  const hasFixedScrollNextTimeout = text.includes("targetLabel.includes(\"scroll_next_video\") ? 1200 : 300")
    || text.includes("targetLabel.includes('scroll_next_video') ? 1200 : 300");
  return hasForbiddenVideoIdentityPolling || hasFixedScrollNextTimeout
    ? createFinding({
      lawId: LAW_IDS.EXECUTION,
      file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER,
      line: scrollMethod.getStartLineNumber(),
      severity: "fatal",
      message: "Current Chrome scroll-next-video primitive must not use DOM/URL/native video identity polling or fixed waits as next-video proof; Mouse Scroll may only execute the primitive, observe settle, and hand off downstream evidence refs.",
    })
    : null;
}

function buildVisibleScrollPrimitiveClickBridgeFinding(scrollMethod: Node): Finding | null {
  const scrollMethodText = scrollMethod.getText();
  const hasForbiddenClickBridge = scrollMethodText.includes("clickAt(")
    || scrollMethodText.includes("FACEBOOK_REELS_NEXT_ARROW_CLICK_TARGET_LABEL")
    || scrollMethodText.includes("isFacebookReelsNextVideoScroll")
    || scrollMethodText.includes("resolveFacebookReelsNextArrowPoint");
  return hasForbiddenClickBridge
    ? createFinding({
      lawId: LAW_IDS.EXECUTION,
      file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER,
      line: scrollMethod.getStartLineNumber(),
      severity: "fatal",
      message: "Current Chrome scroll primitive must stay scroll-only. Embedding click execution or facebook-specific arrow-click substitution inside scroll_next_video is a forbidden cross-owner bridge.",
    })
    : null;
}

function collectVisibleScrollPrimitiveFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const source = getSourceFile(project, PATHS.CURRENT_CHROME_BROWSER_CONTROLLER);
  if (!source) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER, line: 1, severity: "fatal", message: "Current Chrome browser controller is missing." })];
  }

  const scrollMethod = source.getClass("CurrentChromeBrowserController")?.getInstanceMethod("scroll") ?? null;
  if (!scrollMethod) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER, line: 1, severity: "fatal", message: "Current Chrome browser controller must expose governed scroll primitive execution." })];
  }
  const orderingFinding = buildVisibleScrollPrimitiveOrderingFinding(scrollMethod);
  if (orderingFinding) {
    return [orderingFinding];
  }
  const videoIdentityFinding = buildVisibleScrollPrimitiveVideoIdentityFinding(source, scrollMethod);
  if (videoIdentityFinding) {
    return [videoIdentityFinding];
  }
  const clickBridgeFinding = buildVisibleScrollPrimitiveClickBridgeFinding(scrollMethod);
  return clickBridgeFinding ? [clickBridgeFinding] : [];
}

function buildQuartzWheelConverterFinding(source: SourceFile): Finding | null {
  const converter = source.getVariableDeclaration("toQuartzWheelDelta");
  const converterInitializer = converter?.getInitializer();
  const converterBody = Node.isArrowFunction(converterInitializer) ? converterInitializer.getBody() : null;
  const converterNegatesBrowserDelta = converterBody !== null
    && Node.isPrefixUnaryExpression(converterBody)
    && converterBody.getOperatorToken() === SyntaxKind.MinusToken
    && converterBody.getOperand().getText().startsWith("Math.round(");
  return converterNegatesBrowserDelta ? null : createFinding({
    lawId: LAW_IDS.EXECUTION,
    file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER_PRIMITIVES,
    line: converter?.getStartLineNumber() ?? 1,
    severity: "fatal",
    message: "Current Chrome Quartz wheel primitive must invert browser-semantic deltas before posting CGEvent scroll events, so direction=down advances the feed instead of replaying the current video.",
  });
}

function buildQuartzWheelScrollAtFinding(source: SourceFile): Finding | null {
  const scrollAt = source.getVariableDeclaration("scrollAt");
  const scrollAtInitializer = scrollAt?.getInitializer();
  const scrollAtCallsConverter = scrollAtInitializer?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => call.getExpression().getText() === "toQuartzWheelDelta" && ["input.deltaY", "input.deltaX"].includes(call.getArguments()[0]?.getText() ?? "")) === true;
  const scrollTemplate = scrollAtInitializer?.getText() ?? "";
  const scrollTemplateUsesConvertedDeltas = scrollTemplate.includes("${quartzWheelDeltaY}") && scrollTemplate.includes("${quartzWheelDeltaX}");
  return scrollAtCallsConverter && scrollTemplateUsesConvertedDeltas ? null : createFinding({
    lawId: LAW_IDS.EXECUTION,
    file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER_PRIMITIVES,
    line: scrollAt?.getStartLineNumber() ?? 1,
    severity: "fatal",
    message: "Current Chrome Quartz wheel primitive must invert browser-semantic deltas before posting CGEvent scroll events, so direction=down advances the feed instead of replaying the current video.",
  });
}

function collectQuartzWheelPolarityFindings(project: ReturnType<typeof makeProject>): Finding[] {
  const source = getSourceFile(project, PATHS.CURRENT_CHROME_BROWSER_CONTROLLER_PRIMITIVES);
  if (!source) {
    return [createFinding({ lawId: LAW_IDS.EXECUTION, file: PATHS.CURRENT_CHROME_BROWSER_CONTROLLER_PRIMITIVES, line: 1, severity: "fatal", message: "Current Chrome scroll primitive adapter is missing." })];
  }

  const findings: Finding[] = [];
  const converterFinding = buildQuartzWheelConverterFinding(source);
  const scrollAtFinding = buildQuartzWheelScrollAtFinding(source);
  if (converterFinding) {
    findings.push(converterFinding);
  }
  if (scrollAtFinding) {
    findings.push(scrollAtFinding);
  }
  return findings;
}

export async function runRequiredShapeAttack(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  await collectMissingFileFindings(findings);
  const project = makeProject();
  findings.push(...collectContractFindings(project));
  findings.push(...collectSchemaAndRegistryFindings(project));
  findings.push(...collectExecutorFindings(project));
  findings.push(...collectBuilderFindings(project));
  findings.push(...collectChildImplementationFindings(project));
  findings.push(...collectWorkbenchDispatchFindings(project));
  findings.push(...collectVisibleScrollPrimitiveFindings(project));
  findings.push(...collectQuartzWheelPolarityFindings(project));

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "required-shape",
      passed ? "PASS" : "CODE VIOLATION",
      passed,
      passed
        ? "Mouse Scroll required package, runtime chain, and governed schema/result surfaces exist."
        : "Mouse Scroll required package or governed execution chain is incomplete.",
    ),
  };
}
