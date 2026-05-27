import { existsSync, readFileSync } from "node:fs";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const pushFinding = (
  findings: Finding[],
  lawId: string,
  filePath: string,
  checkId: string,
  message: string,
  evidence?: string,
): void => {
  findings.push(createFinding({
    checkId,
    lawId,
    filePath,
    message,
    evidence,
  }));
};

const requireText = (input: {
  findings: Finding[];
  lawId: string;
  filePath: string;
  text: string;
  marker: string;
  checkId: string;
}): void => {
  if (input.text.includes(input.marker)) return;
  pushFinding(
    input.findings,
    input.lawId,
    input.filePath,
    input.checkId,
    `${input.filePath} is missing ${input.marker}.`,
  );
};

const inspectTelegramSchemaAndRouting = (findings: Finding[], lawId: string): void => {
  const schemaText = readRepoFile("src/capabilities/video-download/schema.ts");
  const routerText = readRepoFile("src/capabilities/video-download/runtime/platform-router.ts");
  for (const marker of ["telegram-web", "download-telegram-web-video-once", "telegram_sw_progressive_cache", "telegram_sw_download_stream"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/schema.ts",
      text: schemaText,
      marker,
      checkId: "video-download/telegram-schema",
    });
  }
  for (const marker of ["web.telegram.org", "download-telegram-web-video-once"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/platform-router.ts",
      text: routerText,
      marker,
      checkId: "video-download/telegram-routing",
    });
  }
};

const inspectTelegramAppJobEntry = (findings: Finding[], lawId: string): void => {
  for (const [filePath, text] of [
    ["src/app/workbench-video-download-routes.ts", readRepoFile("src/app/workbench-video-download-routes.ts")],
    ["src/plugins/video-download-artifact/video-download-artifact.schema.ts", readRepoFile("src/plugins/video-download-artifact/video-download-artifact.schema.ts")],
  ] as const) {
    requireText({
      findings,
      lawId,
      filePath,
      text,
      marker: "telegram-web",
      checkId: "video-download/telegram-app-job-entry",
    });
  }
};

const inspectTelegramProbeScripts = (findings: Finding[], lawId: string): void => {
  const probeText = readRepoFile("src/capabilities/video-download/runtime/telegram-web-cache-probe-script.ts");
  const visibleProbeText = readRepoFile("src/capabilities/video-download/runtime/telegram-web-visible-media-probe-script.ts");
  for (const marker of ["tt-media-progressive", "CacheStorage", "content-range", "bytesBase64", "telegram_sw_progressive_cache", "initialDocumentIds", "cache.keys()", "querySelectorAll(\"video\")"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/telegram-web-cache-probe-script.ts",
      text: probeText,
      marker,
      checkId: "video-download/telegram-cache-probe",
    });
  }
  for (const marker of ["buildTelegramWebVisibleMediaProbeScript", "documentIdHash", "visible_progressive_video", "cacheComplete"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/telegram-web-visible-media-probe-script.ts",
      text: visibleProbeText,
      marker,
      checkId: "video-download/telegram-visible-media-probe",
    });
  }
};

const inspectTelegramChild = (findings: Finding[], lawId: string): void => {
  const childText = readRepoFile("src/capabilities/video-download/children/download-telegram-web-video-once.ts");
  for (const marker of ["writeVideoArtifact", "metadata_validation_failed", "review_required", "telegram-document-", "source_page_mismatch", "telegramDocumentIdHash"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/children/download-telegram-web-video-once.ts",
      text: childText,
      marker,
      checkId: "video-download/telegram-child",
    });
  }
};

const inspectTelegramWorkbenchProgressAndLimits = (findings: Finding[], lawId: string): void => {
  const pageText = readRepoFile("src/app/workbench-home-page.ts");
  const clientText = readRepoFile("src/app/workbench-video-download-client.ts");
  const routeText = readRepoFile("src/app/workbench-video-download-routes.ts");
  const schemaText = readRepoFile("src/capabilities/video-download/schema.ts");
  for (const marker of ["data-video-download-progress", "progress", "max=\"5000\"", "value=\"5000\""]) {
    requireText({
      findings,
      lawId,
      filePath: "src/app/workbench-home-page.ts",
      text: pageText,
      marker,
      checkId: "video-download/telegram-progress-ui",
    });
  }
  for (const marker of ["updateVideoDownloadProgress", "正在通过授权页面组装媒体分片", "maxMegabytes: 5000"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/app/workbench-video-download-client.ts",
      text: clientText,
      marker,
      checkId: "video-download/telegram-progress-client",
    });
  }
  for (const [filePath, text] of [
    ["src/app/workbench-video-download-routes.ts", routeText],
    ["src/capabilities/video-download/schema.ts", schemaText],
  ] as const) {
    requireText({
      findings,
      lawId,
      filePath,
      text,
      marker: "5_000_000_000",
      checkId: "video-download/telegram-large-file-bound",
    });
  }
};

const inspectForbiddenTelegramStreamPath = (findings: Finding[], lawId: string): void => {
  const forbiddenPath = "src/capabilities/video-download/runtime/telegram-web-download-stream-probe-script.ts";
  if (!existsSync(resolveFromRepo(forbiddenPath))) return;
  pushFinding(
    findings,
    lawId,
    forbiddenPath,
    "video-download/telegram-forbidden-xhr-stream",
    "Do not revive the Telegram progressive XHR/fetch stream path; production evidence showed HTTP 302/opaqueredirect.",
  );
};

export const inspectTelegramWebChain = (findings: Finding[], lawId: string): void => {
  inspectTelegramSchemaAndRouting(findings, lawId);
  inspectTelegramAppJobEntry(findings, lawId);
  inspectTelegramProbeScripts(findings, lawId);
  inspectTelegramChild(findings, lawId);
  inspectTelegramWorkbenchProgressAndLimits(findings, lawId);
  inspectForbiddenTelegramStreamPath(findings, lawId);
};

const objectLiteralHasProperty = (
  source: SourceFile,
  objectName: string,
  propertyName: string,
): boolean => {
  const findObjectArgument = (node: Node): Node | undefined => {
    if (!Node.isCallExpression(node)) return undefined;
    const firstArgument = node.getArguments()[0];
    if (Node.isObjectLiteralExpression(firstArgument)) return firstArgument;
    const expression = node.getExpression();
    return Node.isPropertyAccessExpression(expression)
      ? findObjectArgument(expression.getExpression())
      : undefined;
  };
  return source.getDescendantsOfKind(SyntaxKind.VariableDeclaration).some((declaration) => {
    if (declaration.getName() !== objectName) return false;
    const initializer = declaration.getInitializer();
    const firstArgument = initializer ? findObjectArgument(initializer) : undefined;
    if (!Node.isObjectLiteralExpression(firstArgument)) return false;
    return firstArgument.getProperties().some((property) =>
      Node.isPropertyAssignment(property) && property.getName() === propertyName);
  });
};

const objectLiteralContainsPropertyName = (
  source: SourceFile,
  propertyName: string,
): boolean => source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) =>
    literal.getProperties().some((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return property.getName() === propertyName;
      }
      if (!Node.isSpreadAssignment(property)) return false;
      const expression = property.getExpression();
      if (!Node.isConditionalExpression(expression)) return false;
      const whenTrue = expression.getWhenTrue();
      if (!Node.isObjectLiteralExpression(whenTrue)) return false;
      return whenTrue.getProperties().some((spreadProperty) =>
        Node.isPropertyAssignment(spreadProperty) && spreadProperty.getName() === propertyName);
    }));

const typeHasProperty = (
  source: SourceFile,
  typeName: string,
  propertyName: string,
): boolean => {
  const interfaceDeclaration = source.getInterface(typeName);
  if (interfaceDeclaration) {
    return interfaceDeclaration.getProperties().some((property) => property.getName() === propertyName);
  }
  const typeNode = source.getTypeAlias(typeName)?.getTypeNode();
  if (!typeNode || !Node.isTypeLiteral(typeNode)) return false;
  return typeNode.getMembers().some((member) =>
    Node.isPropertySignature(member) && member.getName() === propertyName);
};

const importedNamesFromPublicFacade = (source: SourceFile): Set<string> => {
  const names = new Set<string>();
  for (const declaration of source.getImportDeclarations()) {
    if (declaration.getModuleSpecifierValue() !== "../../capabilities/video-download/index.js") continue;
    for (const namedImport of declaration.getNamedImports()) {
      names.add(namedImport.getName());
    }
  }
  return names;
};

const sourceContainsCall = (source: SourceFile, functionName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => call.getExpression().getText() === functionName);

const requireAstSources = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): Record<string, SourceFile | undefined> => {
  const sources = {
    schema: sourceFile(context, "src/capabilities/video-download/schema.ts"),
    jobSchema: sourceFile(context, "src/plugins/video-download-artifact/video-download-artifact.schema.ts"),
    flow: sourceFile(context, "src/plugins/video-download-artifact/video-download-artifact.flow.ts"),
    route: sourceFile(context, "src/app/workbench-video-download-routes.ts"),
    localRuntime: sourceFile(context, "src/lib/local-runtime/workbench-video-download-support.ts"),
    visibleProbe: sourceFile(context, "src/capabilities/video-download/runtime/telegram-web-visible-media-probe-script.ts"),
    facade: sourceFile(context, "src/capabilities/video-download/index.ts"),
  };
  for (const [name, source] of Object.entries(sources)) {
    if (source) continue;
    pushFinding(findings, lawId, name, "video-download/telegram-visible-list-ast-source", `${name} is not loaded in the audit AST project.`);
  }
  return sources;
};

export const inspectTelegramVisibleListAst = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const sources = requireAstSources(context, findings, lawId);
  const { schema, jobSchema, flow, route, localRuntime, visibleProbe, facade } = sources;
  if (!schema || !jobSchema || !flow || !route || !localRuntime || !visibleProbe || !facade) return;
  if (!objectLiteralHasProperty(schema, "DownloadTelegramWebVideoInputSchema", "telegramDocumentIdHash")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/schema.ts", "video-download/telegram-target-hash-schema", "Telegram child input schema must accept telegramDocumentIdHash for selected visible media.");
  }
  if (!objectLiteralContainsPropertyName(jobSchema, "telegramDocumentIdHash")) {
    pushFinding(findings, lawId, "src/plugins/video-download-artifact/video-download-artifact.schema.ts", "video-download/telegram-target-hash-job-schema", "Video download job schema must pass the selected Telegram document hash.");
  }
  if (!objectLiteralContainsPropertyName(flow, "telegramDocumentIdHash")) {
    pushFinding(findings, lawId, "src/plugins/video-download-artifact/video-download-artifact.flow.ts", "video-download/telegram-target-hash-flow", "Video download job flow must pass telegramDocumentIdHash through to the public video-download facade.");
  }
  if (!objectLiteralContainsPropertyName(route, "telegramDocumentIdHash")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/telegram-target-hash-route", "App route must accept and forward telegramDocumentIdHash instead of downloading an unbound first cache hit.");
  }
  if (!typeHasProperty(localRuntime, "VideoDownloadSourcePage", "videoCandidates")) {
    pushFinding(findings, lawId, "src/lib/local-runtime/workbench-video-download-support.ts", "video-download/telegram-source-page-candidates", "Detected Telegram source page must return a visible videoCandidates list.");
  }
  if (!importedNamesFromPublicFacade(localRuntime).has("probeTelegramWebVisibleMediaSourcePage")) {
    pushFinding(findings, lawId, "src/lib/local-runtime/workbench-video-download-support.ts", "video-download/telegram-visible-probe-public-facade", "Local runtime must use the video-download public facade for Telegram visible media probing.");
  }
  if (!sourceContainsCall(localRuntime, "probeTelegramWebVisibleMediaSourcePage")) {
    pushFinding(findings, lawId, "src/lib/local-runtime/workbench-video-download-support.ts", "video-download/telegram-visible-probe-call", "Source page detection must execute the Telegram visible media probe.");
  }
};
