import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { relative, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectBusinessRecoveryAuthorityBoundaries, inspectProductAcceptanceBoundaries } from "./components/scan-product-acceptance-boundaries.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTypesContractRelations, inspectTypesContractRoot } from "./components/scan-types-contract-root.js";
import { inspectConstitutionalBoundary } from "./constitutional-boundary-inspector.js";
import { producerModePassed, recordStaticCheck, staticForbiddenClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";

export const inspectPublicKnowledgeImageOwnership = (
  context: InspectorContext,
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const imagePath = "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts";
  const resultPath = "src/plugins/public-knowledge-article-pipeline/result-contract.ts";
  const mediatorPath = "src/mediator/product-plugin-contract.ts";
  const source = (path: string): SourceFile | undefined => {
    inspectedFiles.add(path);
    return context.project.getSourceFile(resolve(context.sealedRoot, path));
  };
  const image = source(imagePath);
  const result = source(resultPath);
  const mediator = source(mediatorPath);
  const render = image?.getVariableDeclaration("renderImageArtifact")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const checkpoint = image?.getVariableDeclaration("checkpointSubmittedImage")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const sharpImports = context.project.getSourceFiles().flatMap((candidate) => candidate.getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === "sharp")
    .map((declaration) => ({ declaration,
      path: relative(context.sealedRoot, candidate.getFilePath()).replaceAll("\\", "/") })))
    .filter(({ path }) => path.startsWith("src/"));
  for (const item of sharpImports) inspectedFiles.add(item.path);
  const soleSharpOwner = sharpImports.length === 1 && sharpImports[0]?.path === imagePath
    && sharpImports[0].declaration.getDefaultImport()?.getText() === "sharp";
  const calls = render?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const sharpCalls = calls.filter((call) => call.getExpression().getText() === "sharp");
  const unlimitedDecode = sharpCalls.length === 3 && sharpCalls.every((call) => {
    const options = call.getArguments()[1];
    if (!options || !Node.isObjectLiteralExpression(options)) return false;
    return options.getProperty("limitInputPixels")?.getText().endsWith(": false") === true;
  });
  const orientedGeometry = ["originalMetadata.autoOrient.width", "originalMetadata.autoOrient.height"]
    .every((text) => render?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((property) => property.getText() === text));
  const metadataStripped = ["exif", "icc", "iptc", "xmp"].every((name) =>
    render?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((property) => property.getExpression().getText() === "outputMetadata"
        && property.getName() === name));
  const sharpChain = (initializer: Node | undefined): Readonly<{ root: string; methods: readonly string[] }> | null => {
    let current = initializer;
    while (current && Node.isAwaitExpression(current)) current = current.getExpression();
    const methods: string[] = [];
    while (current && Node.isCallExpression(current)) {
      const expression = current.getExpression();
      if (Node.isIdentifier(expression)) return { root: expression.getText(), methods };
      if (!Node.isPropertyAccessExpression(expression)) return null;
      methods.push(expression.getName());
      current = expression.getExpression();
    }
    return null;
  };
  const initializerFor = (name: string): Node | undefined => render
    ?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === name)?.getInitializer();
  const originalMetadataChain = sharpChain(initializerFor("originalMetadata"));
  const webpChain = sharpChain(initializerFor("webpBytes"));
  const outputMetadataChain = sharpChain(initializerFor("outputMetadata"));
  const exactFormatOnlyChains = originalMetadataChain?.root === "sharp"
    && JSON.stringify(originalMetadataChain.methods) === JSON.stringify(["metadata"])
    && webpChain?.root === "sharp"
    && JSON.stringify(webpChain.methods) === JSON.stringify(["toBuffer", "webp", "rotate"])
    && outputMetadataChain?.root === "sharp"
    && JSON.stringify(outputMetadataChain.methods) === JSON.stringify(["metadata"]);
  const noFixedGeometry = !(render?.getDescendantsOfKind(SyntaxKind.NumericLiteral)
    .some((literal) => literal.getLiteralValue() === 1200 || literal.getLiteralValue() === 630) ?? true);
  const artifactRefLengthGate = checkpoint?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((property) => property.getText() === "artifactRefs.length") === true;
  const generatedArtifact = mediator?.getInterface("GeneratedImageArtifact");
  const artifactFields = generatedArtifact?.getProperties().map((property) => property.getName()).sort() ?? [];
  const expectedArtifactFields = [
    "artifact_id", "bytes", "height", "media_type", "sha256", "webp_bytes", "width",
  ].sort();
  const validateImage = result?.getVariableDeclaration("validatePublicKnowledgeImage")?.getInitializer();
  const safeIntegerArgs = validateImage?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "Number.isSafeInteger")
    .map((call) => call.getArguments()[0]?.getText()) ?? [];
  const contractGeometryAccess = validateImage?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((property) => property.getExpression().getText() === "contract"
      && ["width", "height"].includes(property.getName())) ?? true;
  const valid = soleSharpOwner && unlimitedDecode && orientedGeometry && metadataStripped
    && exactFormatOnlyChains && noFixedGeometry
    && artifactRefLengthGate
    && JSON.stringify(artifactFields) === JSON.stringify(expectedArtifactFields)
    && safeIntegerArgs.includes("image.width") && safeIntegerArgs.includes("image.height")
    && !contractGeometryAccess;
  if (!valid) findings.push(createFinding({
    evidenceMode: "static.ast", lawId,
    clauseId: `${lawId.toLowerCase()}-requirement`,
    checkId: "architecture-boundary/public-knowledge-image-owner",
    filePath: imagePath,
    message: "The public-knowledge Product must be the sole format-only WebP owner and must preserve source-oriented geometry without exporting Provider originals.",
  }));
};



const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const lawId = context.planEntry.lawIds[0]!;
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = <T>(check: string, implementation: (...args: never[]) => unknown, action: () => T): T => recordStaticCheck({
    check, findings, implementation, lawIds: [lawId], receipts: staticCheckReceipts, run: action,
  });

  run("inspectRootAllowlist", inspectRootAllowlist, () => inspectRootAllowlist(findings, lawIds.rootLawId));
  run("inspectProjectSources", inspectProjectSources, () => inspectProjectSources(context.project, findings, inspectedFiles, lawIds));
  run("inspectActivePluginGate", inspectActivePluginGate, () => {
    const result = inspectActivePluginGate({
      lawId: lawIds.pluginStageLawId,
      project: context.project,
      inspectedFiles,
      targetPaths: context.targetPaths,
    });
    findings.push(...result.findings);
    return result;
  });
  run("inspectProductAcceptanceBoundaries", inspectProductAcceptanceBoundaries, () =>
    inspectProductAcceptanceBoundaries({
      findings,
      inspectedFiles,
      lawId,
      project: context.project,
    }));
  run("inspectBusinessRecoveryAuthorityBoundaries", inspectBusinessRecoveryAuthorityBoundaries, () =>
    inspectBusinessRecoveryAuthorityBoundaries({
      findings,
      inspectedFiles,
      lawId,
      project: context.project,
    }));
  run("inspectPublicKnowledgeImageOwnership", inspectPublicKnowledgeImageOwnership, () =>
    inspectPublicKnowledgeImageOwnership(context, findings, inspectedFiles, lawId));
  run("inspectTypesContractRoot", inspectTypesContractRoot, () => inspectTypesContractRoot({
        findings,
        inspectedFiles,
        lawId: lawIds.lawFirstChangeLawId,
        project: context.project,
      }));
  recordStaticCheck({ check: "inspectTypesContractRelations", findings, implementation: inspectTypesContractRelations,
    lawIds: [lawId], observe: () => observeStaticMode(context, "static.types"),
    receipts: staticCheckReceipts, run: () => inspectTypesContractRelations({
      findings, inspectedFiles, lawId: lawIds.lawFirstChangeLawId, project: context.project,
    }) });

  const constitutional = await inspectConstitutionalBoundary(context);
  findings.push(...constitutional.findings);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawId = context.planEntry.lawIds[0]!;
  const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
  const refs = (mode: string, clauses: string[], checks: string[]) => ({
    passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks),
    refs: staticEvidenceRefs(context, lawId, mode, clauses, evaluation.staticCheckReceipts, checks),
  });
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticForbiddenClauses(1, 2, 3, 4, 5), evidenceMode: "static.ast", ...refs("static.ast", staticForbiddenClauses(1, 2, 3, 4, 5), ["inspectProjectSources", "inspectProductAcceptanceBoundaries", "inspectBusinessRecoveryAuthorityBoundaries", "inspectPublicKnowledgeImageOwnership", "inspectTypesContractRoot"]) },
      { clauses: staticForbiddenClauses(0), evidenceMode: "static.dependency", ...refs("static.dependency", staticForbiddenClauses(0), ["inspectActivePluginGate"]) },
      { clauses: staticForbiddenClauses(6), evidenceMode: "static.filesystem", ...refs("static.filesystem", staticForbiddenClauses(6), ["inspectRootAllowlist"]) },
      { clauses: staticForbiddenClauses(7), evidenceMode: "static.types", ...refs("static.types", staticForbiddenClauses(7), ["inspectTypesContractRelations"]) },
    ], findings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
