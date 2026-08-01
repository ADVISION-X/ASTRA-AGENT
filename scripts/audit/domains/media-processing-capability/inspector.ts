import { existsSync } from "node:fs";
import { relative } from "node:path";

import { Node, SyntaxKind, type CallExpression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
import { repoRoot, resolveFromRepo } from "../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const lawPath = ".github/instructions/agent-rules/modules/module-media-processing-capability.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Media Processing 媒体处理能力组施工图.md";
const dependencyReadinessPath = "src/capabilities/media-processing/dependency-readiness.ts";

const governedFiles = [
  "src/capabilities/media-processing/schema.ts",
  "src/capabilities/media-processing/contract.ts",
  "src/capabilities/media-processing/index.ts",
  "src/capabilities/media-processing/ability-group.ts",
  "src/capabilities/media-processing/registry.ts",
  "src/capabilities/media-processing/children/image-children.ts",
  "src/capabilities/media-processing/children/video-children.ts",
  "src/capabilities/media-processing/runtime/artifact-storage.ts",
  "src/capabilities/media-processing/runtime/ffprobe-metadata.ts",
  "src/capabilities/media-processing/runtime/ffmpeg-runner.ts",
  "src/capabilities/media-processing/runtime/hash-stream.ts",
  "src/capabilities/media-processing/runtime/media-source.ts",
  "src/capabilities/media-processing/runtime/result.ts",
  "src/capabilities/media-processing/dependency-readiness.ts",
  "src/capabilities/media-processing/runtime/sharp-runner.ts",
  "src/capabilities/media-processing/runtime/image-redline-observer.ts",
  "src/plugins/media-processing-artifact/media-processing-artifact.flow.ts",
  "src/plugins/media-processing-artifact/media-processing-artifact.schema.ts",
  "src/plugins/media-processing-artifact/media-processing-artifact.result.ts",
  "src/mediator/media-processing-artifact-route.ts",
  "src/app/workbench-media-processing-routes.ts",
  "src/app/app-shell/skill-registry.ts",
  "src/app/app-shell/app-shell-layout.ts",
  "src/app/app-shell/app-shell.ts",
  "src/app/skills/media-optimizer/media-optimizer-workspace.ts",
  "src/app/skills/media-optimizer/media-optimizer-client.ts",
  "src/lib/local-runtime/workbench-media-processing-support.ts",
  "src/lib/local-runtime/workbench-assembly.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/lib/local-runtime/workbench.ts",
] as const;

const expectedChildren = [
  "optimize-video-for-web-once",
  "compress-video-for-web-once",
  "generate-video-poster-once",
  "optimize-image-for-web-once",
  "resize-image-for-web-once",
  "generate-responsive-image-variants-once",
  "inspect-public-knowledge-image-redlines-once",
] as const;

const expectedRegistrySymbols: Record<typeof expectedChildren[number], string> = {
  "optimize-video-for-web-once": "createOptimizeVideoForWeb",
  "compress-video-for-web-once": "createCompressVideoForWeb",
  "generate-video-poster-once": "createGenerateVideoPosterForWeb",
  "optimize-image-for-web-once": "createOptimizeImageForWeb",
  "resize-image-for-web-once": "createResizeImageForWeb",
  "generate-responsive-image-variants-once": "createGenerateResponsiveImageSet",
  "inspect-public-knowledge-image-redlines-once": "createInspectPublicKnowledgeImageRedlines",
};

const forbiddenMediaOwnerNames = [
  "video-processing",
  "image-processing",
  "asset-processing",
] as const;

const pushFinding = (
  findings: Finding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ checkId, lawId, filePath, message }));
};

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const requiredSourceFile = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  repoPath: string,
): SourceFile | null => {
  const file = sourceFile(context, repoPath);
  if (file) return file;
  pushFinding(findings, lawId, repoPath, "media-processing/source-file-present", `${repoPath} must exist in the ts-morph project.`);
  return null;
};

const callExpressionName = (call: CallExpression): string => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) return String(expression.compilerNode.escapedText);
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return "";
};

const registryElementName = (node: Node): string | null => {
  if (Node.isIdentifier(node)) return String(node.compilerNode.escapedText);
  if (Node.isCallExpression(node)) return callExpressionName(node);
  return null;
};

const stringLiteralValues = (source: SourceFile): string[] => [
  ...source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()),
  ...source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((literal) => literal.getLiteralText()),
];

const hasStringLiteral = (source: SourceFile, value: string): boolean =>
  new Set(stringLiteralValues(source)).has(value);

const zEnumValues = (source: SourceFile, variableName: string): string[] => {
  const initializer = source.getVariableDeclaration(variableName)?.getInitializer();
  if (!Node.isCallExpression(initializer)) return [];
  const [firstArgument] = initializer.getArguments();
  if (!Node.isArrayLiteralExpression(firstArgument)) return [];
  return firstArgument.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
};

const callNames = (source: SourceFile): Set<string> =>
  new Set(source.getDescendantsOfKind(SyntaxKind.CallExpression).map((call) => callExpressionName(call)));

const importSpecifiers = (source: SourceFile): Set<string> =>
  new Set(source.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue()));

const exportedSpecifiers = (source: SourceFile): Set<string> =>
  new Set(source.getExportDeclarations().flatMap((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return specifier ? [specifier] : [];
  }));

const projectRepoPath = (file: SourceFile): string =>
  relative(repoRoot, file.getFilePath());

const initializerIsNull = (node: Node): boolean =>
  node.getKind() === SyntaxKind.NullKeyword;

const buildArtifactCallsInsideFunction = (source: SourceFile, functionName: string): CallExpression[] => {
  const declaration = source.getVariableDeclaration(functionName);
  const initializer = declaration?.getInitializer();
  if (!initializer) return [];
  return initializer.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => callExpressionName(call) === "buildMediaProcessingArtifact");
};

const objectPropertyInitializers = (call: CallExpression): Map<string, Node> => {
  const firstArgument = call.getArguments()[0];
  if (!Node.isObjectLiteralExpression(firstArgument)) return new Map();
  return new Map(firstArgument.getProperties().flatMap((property) => {
    if (!Node.isPropertyAssignment(property)) return [];
    const nameNode = property.getNameNode();
    const name = Node.isIdentifier(nameNode)
      ? nameNode.getText()
      : Node.isStringLiteral(nameNode)
        ? nameNode.getLiteralText()
        : null;
    return name ? [[name, property.getInitializer() ?? property]] : [];
  }));
};

const inspectAuthorityFiles = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  if (!existsSync(resolveFromRepo(lawPath))) {
    pushFinding(findings, lawId, lawPath, "media-processing/law-file", "Media-processing law file must exist.");
  }
  if (!existsSync(resolveFromRepo(blueprintPath))) {
    pushFinding(findings, lawId, blueprintPath, "media-processing/blueprint-file", "Media-processing construction blueprint must exist.");
  }
  if (!sourceFile(context, "scripts/audit/domains/media-processing-capability/inspector.ts")) {
    pushFinding(findings, lawId, "scripts/audit/domains/media-processing-capability/inspector.ts", "media-processing/inspector-project-access", "Media-processing inspector must be visible to the ts-morph audit project.");
  }
};

const inspectSchemaAndRegistry = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const schema = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/schema.ts");
  const registry = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/registry.ts");
  if (!schema || !registry) return;

  if (!hasStringLiteral(schema, "media-processing")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/schema.ts", "media-processing/group-id", "Schema must declare media-processing as the ability group id.");
  }
  const childValues = new Set(zEnumValues(schema, "MediaProcessingChildCapabilityIdSchema"));
  for (const child of expectedChildren) {
    if (!childValues.has(child)) {
      pushFinding(findings, lawId, "src/capabilities/media-processing/schema.ts", "media-processing/child-schema", `${child} must be declared in MediaProcessingChildCapabilityIdSchema.`);
    }
  }
  const registeredSymbols = new Set(
    registry.getVariableDeclaration("MEDIA_PROCESSING_CHILDREN")
      ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
      ?.getElements()
      .map((element) => registryElementName(element))
      .filter((value): value is string => value !== null) ?? [],
  );
  for (const child of expectedChildren) {
    if (!registeredSymbols.has(expectedRegistrySymbols[child])) {
      pushFinding(findings, lawId, "src/capabilities/media-processing/registry.ts", "media-processing/child-registry", `${expectedRegistrySymbols[child]} must be registered in MEDIA_PROCESSING_CHILDREN.`);
    }
  }
};

const inspectPublicFacade = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const index = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/index.ts");
  const abilityGroup = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/ability-group.ts");
  const pluginResult = requiredSourceFile(context, findings, lawId, "src/plugins/media-processing-artifact/media-processing-artifact.result.ts");
  if (!index || !abilityGroup || !pluginResult) return;

  for (const specifier of exportedSpecifiers(index)) {
    if (specifier === "./registry.js" || specifier === "./children/image-children.js" || specifier === "./children/video-children.js" || specifier === "./runtime/ffmpeg-runner.js" || specifier === "./runtime/sharp-runner.js") {
      pushFinding(findings, lawId, "src/capabilities/media-processing/index.ts", "media-processing/public-facade-no-private-export", `Public facade must not export ${specifier}.`);
    }
  }
  if (!callNames(abilityGroup).has("createMediaProcessingCapabilityRegistry")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/ability-group.ts", "media-processing/facade-registry-owner", "Ability group factory must own the private child registry.");
  }
  if (!exportedSpecifiers(index).has("./schema.js")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/index.ts", "media-processing/public-result-schema-export", "Public facade must export MediaProcessingResultSchema through index.ts.");
  }
  if (importSpecifiers(pluginResult).has("../../capabilities/media-processing/schema.js")) {
    pushFinding(findings, lawId, "src/plugins/media-processing-artifact/media-processing-artifact.result.ts", "media-processing/plugin-no-direct-schema-import", "Plugin result schema must import media-processing result schema from the public facade.");
  }
};

const inspectJobFlowBoundary = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const flow = requiredSourceFile(context, findings, lawId, "src/plugins/media-processing-artifact/media-processing-artifact.flow.ts");
  const mediator = requiredSourceFile(context, findings, lawId, "src/mediator/media-processing-artifact-route.ts");
  const route = requiredSourceFile(context, findings, lawId, "src/app/workbench-media-processing-routes.ts");
  const boundary = requiredSourceFile(context, findings, lawId, "src/app/workbench-api-boundary.ts");
  if (!flow || !mediator || !route || !boundary) return;

  if (!callNames(flow).has("processMedia")) {
    pushFinding(findings, lawId, "src/plugins/media-processing-artifact/media-processing-artifact.flow.ts", "media-processing/job-flow-public-facade", "Plugin flow must call mediaProcessing.processMedia public facade.");
  }
  if (!callNames(mediator).has("runMediaProcessingArtifactFlow")) {
    pushFinding(findings, lawId, "src/mediator/media-processing-artifact-route.ts", "media-processing/mediator-route", "Mediator route must call runMediaProcessingArtifactFlow.");
  }
  if (!callNames(route).has("routeMediaProcessingArtifactJob")) {
    pushFinding(findings, lawId, "src/app/workbench-media-processing-routes.ts", "media-processing/app-route-mediator", "App API route must enter through the mediator route.");
  }
  if (!callNames(route).has("assertAllowedMediaProcessingInputPath")) {
    pushFinding(findings, lawId, "src/app/workbench-media-processing-routes.ts", "media-processing/app-route-input-root-guard", "App API route must guard direct inputFilePath with the governed media-processing input roots.");
  }
  for (const forbiddenImport of ["sharp", "node:child_process"]) {
    if (importSpecifiers(route).has(forbiddenImport)) {
      pushFinding(findings, lawId, "src/app/workbench-media-processing-routes.ts", "media-processing/app-route-no-runtime", `App API route must not import ${forbiddenImport}.`);
    }
  }
  for (const literal of ["/api/media-processing/start-async", "/api/media-processing/status", "/api/media-processing/download"]) {
    if (!hasStringLiteral(boundary, literal)) {
      pushFinding(findings, lawId, "src/app/workbench-api-boundary.ts", "media-processing/api-boundary-route", `API boundary must admit ${literal}.`);
    }
  }
};

const inspectAppShellSkillBoundary = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const registry = requiredSourceFile(context, findings, lawId, "src/app/app-shell/skill-registry.ts");
  const layout = requiredSourceFile(context, findings, lawId, "src/app/app-shell/app-shell-layout.ts");
  const appShell = requiredSourceFile(context, findings, lawId, "src/app/app-shell/app-shell.ts");
  const client = requiredSourceFile(context, findings, lawId, "src/app/skills/media-optimizer/media-optimizer-client.ts");
  const workspace = requiredSourceFile(context, findings, lawId, "src/app/skills/media-optimizer/media-optimizer-workspace.ts");
  if (!registry || !layout || !appShell || !client || !workspace) return;

  for (const literal of ["media-optimizer", "/skills/media-optimizer", "media-processing"]) {
    if (!hasStringLiteral(registry, literal) && literal !== "media-processing") {
      pushFinding(findings, lawId, "src/app/app-shell/skill-registry.ts", "media-processing/app-shell-registry", `Skill registry must include ${literal}.`);
    }
  }
  for (const renderer of ["renderMediaSourceSurface", "renderMediaArtifactSurface", "renderMediaSettingsSurface", "renderMediaOptimizerWorkspace"]) {
    if (!workspace.getVariableDeclaration(renderer)) {
      pushFinding(findings, lawId, "src/app/skills/media-optimizer/media-optimizer-workspace.ts", "media-processing/app-shell-workspace", `Media Optimizer workspace must declare ${renderer}.`);
    }
  }
  if (!client.getVariableDeclaration("MEDIA_OPTIMIZER_CLIENT") || !client.getVariableDeclaration("renderMediaOptimizerClient")) {
    pushFinding(findings, lawId, "src/app/skills/media-optimizer/media-optimizer-client.ts", "media-processing/app-shell-client-functions", "Media Optimizer client must expose the approved client renderer.");
  }
};

const inspectGeneratedPlanVisibility = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  if (!context.generatedPlan.some((entry) => entry.capabilityDomain === "media-processing-capability")) {
    pushFinding(findings, lawId, "scripts/audit/generated/audit-plan.generated.json", "media-processing/generated-plan-visible", "Generated audit plan must include media-processing-capability.");
  }
};

const inspectFfprobeRunnerProof = (runner: SourceFile, ffprobe: SourceFile, findings: Finding[], lawId: string): void => {
  if (!callNames(runner).has("probeVideoOutputMetadata")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/runtime/ffmpeg-runner.ts", "media-processing/video-ffprobe-metadata", "Video ffmpeg runner must validate output with ffprobe before success.");
  }
  if (!callNames(ffprobe).has("spawn") || !hasStringLiteral(ffprobe, "ffprobe_missing_required_video_metadata")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/runtime/ffprobe-metadata.ts", "media-processing/ffprobe-required-metadata", "ffprobe metadata adapter must fail when required video metadata is missing.");
  }
  for (const call of buildArtifactCallsInsideFunction(runner, "runFfmpegVideoForWeb")) {
    const properties = objectPropertyInitializers(call);
    for (const field of ["width", "height", "durationMs", "format"]) {
      const initializer = properties.get(field);
      if (!initializer || initializerIsNull(initializer)) {
        pushFinding(findings, lawId, "src/capabilities/media-processing/runtime/ffmpeg-runner.ts", "media-processing/video-success-no-null-metadata", `Video success artifact must populate ${field} from ffprobe metadata.`);
      }
    }
  }
};

const inspectRuntimeReadinessProof = (dependencies: SourceFile, findings: Finding[], lawId: string): void => {
  if (!callNames(dependencies).has("resolveFfprobeStaticPath") || !hasStringLiteral(dependencies, "ffprobe_runtime_unavailable")) {
    pushFinding(findings, lawId, dependencyReadinessPath, "media-processing/ffprobe-readiness-proof", "Runtime readiness must prove ffprobePath as part of video availability.");
  }
  if (!callNames(dependencies).has("resolveFfmpegStaticPath") || !hasStringLiteral(dependencies, "ffmpeg-static")) {
    pushFinding(findings, lawId, dependencyReadinessPath, "media-processing/ffmpeg-packaged-readiness", "Runtime readiness must prefer packaged ffmpeg-static before PATH ffmpeg for production video closure.");
  }
};

const inspectFfprobeAndMetadataProof = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const runner = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/runtime/ffmpeg-runner.ts");
  const ffprobe = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/runtime/ffprobe-metadata.ts");
  const dependencies = requiredSourceFile(context, findings, lawId, dependencyReadinessPath);
  const result = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/runtime/result.ts");
  if (!runner || !ffprobe || !dependencies || !result) return;

  inspectFfprobeRunnerProof(runner, ffprobe, findings, lawId);
  inspectRuntimeReadinessProof(dependencies, findings, lawId);
  if (!callNames(result).has("writeMediaProcessingProof")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/runtime/result.ts", "media-processing/proof-ref-file-path", "Result builder must write a media-processing proof file before returning proofRef.");
  }
};

const inspectLockedDependencyUseGate = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const dependencies = requiredSourceFile(context, findings, lawId, dependencyReadinessPath);
  const abilityGroup = requiredSourceFile(context, findings, lawId, "src/capabilities/media-processing/ability-group.ts");
  if (!dependencies || !abilityGroup) return;

  if (!dependencies.getVariableDeclaration("MEDIA_PROCESSING_LOCKED_DEPENDENCY_PACKAGES")) {
    pushFinding(findings, lawId, dependencyReadinessPath, "media-processing/latest-dependency-package-list", "Runtime dependency gate must declare the repository-locked dependency package list.");
  }
  for (const packageName of ["sharp", "@img/sharp-darwin-arm64", "ffmpeg-static", "ffprobe-static"]) {
    if (!hasStringLiteral(dependencies, packageName)) {
      pushFinding(findings, lawId, dependencyReadinessPath, "media-processing/latest-dependency-package-covered", `Locked dependency gate must cover ${packageName}.`);
    }
  }
  if (!dependencies.getVariableDeclaration("ensureMediaProcessingLockedDependenciesForUse")) {
    pushFinding(findings, lawId, dependencyReadinessPath, "media-processing/latest-dependency-gate-function", "Runtime dependencies must expose ensureMediaProcessingLockedDependenciesForUse.");
  }
  if (hasStringLiteral(dependencies, "outdated") || hasStringLiteral(dependencies, "install") || hasStringLiteral(dependencies, "@latest")) {
    pushFinding(findings, lawId, dependencyReadinessPath, "media-processing/latest-dependency-npm-latest", "Runtime media processing must not update packages or resolve latest versions.");
  }
  if (!callNames(abilityGroup).has("ensureMediaProcessingLockedDependenciesForUse") || !hasStringLiteral(abilityGroup, "media_processing_locked_dependency_unavailable")) {
    pushFinding(findings, lawId, "src/capabilities/media-processing/ability-group.ts", "media-processing/latest-dependency-before-child", "Ability group execution must confirm locked dependencies before child processing starts.");
  }
};

const inspectNoVideoDownloadOwnerLeak = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const videoDownloadFiles = context.project.getSourceFiles().filter((file) =>
    projectRepoPath(file).startsWith("src/capabilities/video-download/"));
  for (const file of videoDownloadFiles) {
    const repoPath = projectRepoPath(file);
    const literals = new Set(stringLiteralValues(file));
    for (const literal of ["media-processing", ...expectedChildren]) {
      if (literals.has(literal)) {
        pushFinding(findings, lawId, repoPath, "media-processing/no-video-download-owner-leak", "video-download must not contain media-processing child capability ownership.");
      }
    }
  }
};

const inspectNoParallelMediaOwner = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  for (const file of context.project.getSourceFiles()) {
    const repoPath = projectRepoPath(file);
    if (!repoPath.startsWith("src/")) continue;
    const literals = new Set(stringLiteralValues(file));
    for (const owner of forbiddenMediaOwnerNames) {
      if (literals.has(owner)) {
        pushFinding(findings, lawId, repoPath, "media-processing/no-parallel-owner", `${owner} must not become a parallel media processing owner.`);
      }
    }
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1");
  const findings: Finding[] = [];

  inspectAuthorityFiles(context, findings, lawId);
  for (const repoPath of governedFiles) {
    requiredSourceFile(context, findings, lawId, repoPath);
  }
  inspectSchemaAndRegistry(context, findings, lawId);
  inspectPublicFacade(context, findings, lawId);
  inspectJobFlowBoundary(context, findings, lawId);
  inspectAppShellSkillBoundary(context, findings, lawId);
  inspectGeneratedPlanVisibility(context, findings, lawId);
  inspectFfprobeAndMetadataProof(context, findings, lawId);
  inspectLockedDependencyUseGate(context, findings, lawId);
  inspectNoVideoDownloadOwnerLeak(context, findings, lawId);
  inspectNoParallelMediaOwner(context, findings, lawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
      executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...governedFiles, lawPath, blueprintPath, "scripts/audit/domains/media-processing-capability/inspector.ts"],
  };
};
