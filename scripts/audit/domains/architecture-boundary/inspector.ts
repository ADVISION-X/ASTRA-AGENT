import { createFinding } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { relative, resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { resolveArchitectureLawIds } from "./components/architecture-boundary-shared.js";
import { inspectActivePluginGate } from "./components/scan-active-plugin-gate.js";
import { inspectBusinessRecoveryAuthorityBoundaries, inspectProductAcceptanceBoundaries } from "./components/scan-product-acceptance-boundaries.js";
import { inspectProjectSources } from "./components/scan-project-sources.js";
import { inspectRootAllowlist } from "./components/scan-root-allowlist.js";
import { inspectTargetAuthorityBoundary } from "./components/scan-target-authority-boundary.js";
import { inspectTypesContractRelations, inspectTypesContractRoot } from "./components/scan-types-contract-root.js";
import { inspectConstitutionalBoundary } from "./constitutional-boundary-inspector.js";
import { producerModePassed, recordStaticCheck, staticForbiddenClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";
import { observeStaticMode } from "../../shared/static-target-object-inspector.js";

const PK_IMAGE_PATH = "src/plugins/public-knowledge-article-pipeline/seo-image-call.ts";

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

const soleSharpOwner = (context: InspectorContext, inspectedFiles: Set<string>): boolean => {
  const sharpImports = context.project.getSourceFiles().flatMap((candidate) => candidate.getImportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() === "sharp")
    .map((declaration) => ({ declaration,
      path: relative(context.sealedRoot, candidate.getFilePath()).replaceAll("\\", "/") })))
    .filter(({ path }) => path.startsWith("src/"));
  for (const item of sharpImports) inspectedFiles.add(item.path);
  return sharpImports.length === 1 && sharpImports[0]?.path === PK_IMAGE_PATH
    && sharpImports[0].declaration.getDefaultImport()?.getText() === "sharp";
};

/** The WebP owner decodes without pixel caps, keeps oriented geometry, strips metadata and never resizes. */
const webpOwnerIsFormatOnly = (webp: Node | undefined): boolean => {
  const sharpCalls = webp?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "sharp") ?? [];
  const properties = webp?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression) ?? [];
  const chains = ["originalMetadata", "webpBytes", "outputMetadata"].map((name) => sharpChain(webp
    ?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === name)?.getInitializer()));
  return sharpCalls.length === 3 && sharpCalls.every((call) => {
    const options = call.getArguments()[1];
    return options !== undefined && Node.isObjectLiteralExpression(options)
      && options.getProperty("limitInputPixels")?.getText().endsWith(": false") === true;
  })
    && ["originalMetadata.autoOrient.width", "originalMetadata.autoOrient.height"]
      .every((text) => properties.some((property) => property.getText() === text))
    && ["exif", "icc", "iptc", "xmp"].every((name) => properties.some((property) =>
      property.getExpression().getText() === "outputMetadata" && property.getName() === name))
    && JSON.stringify(chains) === JSON.stringify([{ root: "sharp", methods: ["metadata"] },
      { root: "sharp", methods: ["toBuffer", "webp", "rotate"] }, { root: "sharp", methods: ["metadata"] }])
    && !(webp?.getDescendantsOfKind(SyntaxKind.NumericLiteral)
      .some((literal) => literal.getLiteralValue() === 1200 || literal.getLiteralValue() === 630) ?? true);
};

/** The mediator artifact and result validator carry actual integer dimensions and no Provider original. */
const imageContractKeepsActualDimensions = (mediator: SourceFile | undefined, result: SourceFile | undefined): boolean => {
  const artifactFields = mediator?.getInterface("GeneratedImageArtifact")?.getProperties()
    .map((property) => property.getName()).sort() ?? [];
  const validateImage = result?.getVariableDeclaration("validatePublicKnowledgeImage")?.getInitializer();
  const safeIntegerArgs = validateImage?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "Number.isSafeInteger")
    .map((call) => call.getArguments()[0]?.getText()) ?? [];
  const contractGeometryAccess = validateImage?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((property) => property.getExpression().getText() === "contract"
      && ["width", "height"].includes(property.getName())) ?? true;
  return JSON.stringify(artifactFields) === JSON.stringify(
    ["artifact_id", "bytes", "height", "media_type", "sha256", "webp_bytes", "width"].sort())
    && safeIntegerArgs.includes("image.width") && safeIntegerArgs.includes("image.height")
    && !contractGeometryAccess;
};

export const inspectPublicKnowledgeImageOwnership = (
  context: InspectorContext,
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const source = (path: string): SourceFile | undefined => {
    inspectedFiles.add(path);
    return context.project.getSourceFile(resolve(context.sealedRoot, path));
  };
  const image = source(PK_IMAGE_PATH);
  const checkpoint = image?.getVariableDeclaration("checkpointSubmittedImage")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const artifactRefLengthGate = checkpoint?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
    .some((property) => property.getText() === "artifactRefs.length") === true;
  const valid = soleSharpOwner(context, inspectedFiles)
    && webpOwnerIsFormatOnly(image?.getVariableDeclaration("orientedWebp")
      ?.getInitializerIfKind(SyntaxKind.ArrowFunction))
    && artifactRefLengthGate
    && imageContractKeepsActualDimensions(source("src/mediator/product-plugin-contract.ts"),
      source("src/plugins/public-knowledge-article-pipeline/result-contract.ts"));
  if (!valid) findings.push(createFinding({
    evidenceMode: "static.ast", lawId,
    clauseId: `${lawId.toLowerCase()}-requirement`,
    checkId: "architecture-boundary/public-knowledge-image-owner",
    filePath: PK_IMAGE_PATH,
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
  recordStaticCheck({ check: "inspectTargetAuthorityBoundary", findings, implementation: inspectTargetAuthorityBoundary,
    lawIds: [lawIds.targetAuthorityLawId], receipts: staticCheckReceipts,
    run: () => inspectTargetAuthorityBoundary({
      findings, inspectedFiles, lawId: lawIds.targetAuthorityLawId, project: context.project,
    }) });
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
  const targetLawId = resolveArchitectureLawIds(context.planEntry).targetAuthorityLawId;
  const targetFindings = evaluation.findings.filter((finding) => finding.lawId === targetLawId);
  const refsFor = (owner: string, mode: string, clauses: string[], checks: string[]) => ({
    passed: producerModePassed(evaluation.staticCheckReceipts, owner, checks),
    refs: staticEvidenceRefs(context, owner, mode, clauses, evaluation.staticCheckReceipts, checks),
  });
  const refs = (mode: string, clauses: string[], checks: string[]) => refsFor(lawId, mode, clauses, checks);
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain,
    reportedLawIds: evaluation.reportedLawIds,
    lawResults: [{ lawId, assertions: [
      { clauses: staticForbiddenClauses(1, 2, 3, 4, 5), evidenceMode: "static.ast", ...refs("static.ast", staticForbiddenClauses(1, 2, 3, 4, 5), ["inspectProjectSources", "inspectProductAcceptanceBoundaries", "inspectBusinessRecoveryAuthorityBoundaries", "inspectPublicKnowledgeImageOwnership", "inspectTypesContractRoot"]) },
      { clauses: staticForbiddenClauses(0), evidenceMode: "static.dependency", ...refs("static.dependency", staticForbiddenClauses(0), ["inspectActivePluginGate"]) },
      { clauses: staticForbiddenClauses(6), evidenceMode: "static.filesystem", ...refs("static.filesystem", staticForbiddenClauses(6), ["inspectRootAllowlist"]) },
      { clauses: staticForbiddenClauses(7), evidenceMode: "static.types", ...refs("static.types", staticForbiddenClauses(7), ["inspectTypesContractRelations"]) },
    ], findings }, { lawId: targetLawId, assertions: [
      { clauses: staticForbiddenClauses(0), evidenceMode: "static.ast", ...refsFor(targetLawId, "static.ast", staticForbiddenClauses(0), ["inspectTargetAuthorityBoundary"]) },
    ], findings: targetFindings }],
    inspectedFiles: evaluation.inspectedFiles,
  });
};
