import { Node, SyntaxKind, type CallExpression, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorOutput, executedChecksForPlan } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectYoutubeProduction } from "./components/youtube-production-inspector.js";

type Finding = ReturnType<typeof createFinding>;

const governedFiles = [
  "src/capabilities/video-download/schema.ts",
  "src/capabilities/video-download/registry.ts",
  "src/capabilities/video-download/ability-group.ts",
  "src/capabilities/video-download/runtime/result.ts",
  "src/capabilities/video-download/runtime/platform-router.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-args.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-binary.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-download.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-output.ts",
  "src/capabilities/video-download/runtime/youtube-url.ts",
  "src/capabilities/video-download/runtime/artifact-storage.ts",
  "src/capabilities/video-download/ports/video-artifact-storage-port.ts",
  "src/capabilities/video-download/children/download-youtube-video-once.ts",
  "src/capabilities/video-download/children/download-telegram-web-video-once.ts",
  "src/app/workbench-video-download-routes.ts",
  "src/app/workbench-video-download-client.ts",
  "src/app/workbench-api-boundary.ts",
  "src/mediator/video-download-artifact-route.ts",
  "src/plugins/video-download-artifact/video-download-artifact.flow.ts",
  "src/plugins/video-download-artifact/video-download-artifact.schema.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/lib/local-runtime/workbench-video-download-support.ts",
] as const;

const expectedChildren = [
  "download-web-video-once",
  "download-facebook-video-once",
  "download-tiktok-video-once",
  "download-instagram-video-once",
  "download-bilibili-video-once",
  "download-douyin-video-once",
  "download-x-video-once",
  "download-xiaohongshu-video-once",
  "download-youtube-video-once",
  "download-telegram-web-video-once",
] as const;

const expectedQualities = [
  "2160p",
  "1440p",
  "1080p",
  "720p",
  "480p",
  "360p",
  "hd",
  "sd",
  "best_available",
] as const;

const expectedRegistrySymbols: Record<typeof expectedChildren[number], string> = {
  "download-web-video-once": "downloadWebVideoOnce",
  "download-facebook-video-once": "downloadFacebookVideoOnce",
  "download-tiktok-video-once": "downloadTikTokVideoOnce",
  "download-instagram-video-once": "downloadInstagramVideoOnce",
  "download-bilibili-video-once": "downloadBilibiliVideoOnce",
  "download-douyin-video-once": "downloadDouyinVideoOnce",
  "download-x-video-once": "downloadXVideoOnce",
  "download-xiaohongshu-video-once": "downloadXiaohongshuVideoOnce",
  "download-youtube-video-once": "downloadYoutubeVideoOnce",
  "download-telegram-web-video-once": "downloadTelegramWebVideoOnce",
};

const forbiddenIdentifiers = [
  "localStorage",
  "sessionStorage",
  "puppeteer",
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
  pushFinding(findings, lawId, repoPath, "video-download/source-file-present", `${repoPath} must exist in the ts-morph project.`);
  return null;
};

const callExpressionName = (call: CallExpression): string => {
  const expression = call.getExpression();
  if (Node.isIdentifier(expression)) return String(expression.compilerNode.escapedText);
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return "";
};

const identifierName = (node: Node): string | null =>
  Node.isIdentifier(node) ? String(node.compilerNode.escapedText) : null;

const stringLiteralValues = (source: SourceFile): string[] =>
  source.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText());

const hasStringLiteral = (source: SourceFile, value: string): boolean =>
  stringLiteralValues(source).some((literal) => literal === value) ||
  source.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some((literal) =>
    literal.getLiteralText().split(value).length > 1);

const zEnumValues = (source: SourceFile, variableName: string): string[] => {
  const initializer = source.getVariableDeclaration(variableName)?.getInitializer();
  if (!Node.isCallExpression(initializer)) return [];
  const [firstArgument] = initializer.getArguments();
  if (!Node.isArrayLiteralExpression(firstArgument)) return [];
  return firstArgument.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralText()] : []);
};

const objectLiteralPropertyNames = (literal: ObjectLiteralExpression): string[] =>
  literal.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      return [property.getName()];
    }
    return [];
  });

const hasCall = (source: SourceFile, callName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => callExpressionName(call) === callName);

const objectLiteralContainsProperty = (source: SourceFile, propertyName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) =>
    objectLiteralPropertyNames(literal).some((name) => name === propertyName));

const arrayLiteralContainsString = (source: SourceFile, value: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression).some((literal) =>
    literal.getElements().some((element) => Node.isStringLiteral(element) && element.getLiteralText() === value));

const inspectSchemaAndRegistry = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const schema = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/schema.ts");
  const registry = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/registry.ts");
  if (!schema || !registry) return;

  const children = zEnumValues(schema, "VideoDownloadChildCapabilityIdSchema");
  for (const child of expectedChildren) {
    if (!children.some((value) => value === child)) {
      pushFinding(findings, lawId, "src/capabilities/video-download/schema.ts", "video-download/child-schema", `${child} must be declared in VideoDownloadChildCapabilityIdSchema.`);
    }
  }

  const qualities = zEnumValues(schema, "VideoDownloadPreferredQualitySchema");
  for (const quality of expectedQualities) {
    if (!qualities.some((value) => value === quality)) {
      pushFinding(findings, lawId, "src/capabilities/video-download/schema.ts", "video-download/quality-schema", `${quality} must be declared in VideoDownloadPreferredQualitySchema.`);
    }
  }

  const registeredSymbols = new Set(
    registry.getVariableDeclaration("VIDEO_DOWNLOAD_CHILDREN")
      ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
      ?.getElements()
      .map((element) => identifierName(element))
      .filter((value): value is string => value !== null) ?? [],
  );
  for (const child of expectedChildren) {
    if (!registeredSymbols.has(expectedRegistrySymbols[child])) {
      pushFinding(findings, lawId, "src/capabilities/video-download/registry.ts", "video-download/child-registry", `${expectedRegistrySymbols[child]} must be registered in VIDEO_DOWNLOAD_CHILDREN.`);
    }
  }
};

const inspectWorkbenchRoute = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const route = requiredSourceFile(context, findings, lawId, "src/app/workbench-video-download-routes.ts");
  const client = requiredSourceFile(context, findings, lawId, "src/app/workbench-video-download-client.ts");
  const boundary = requiredSourceFile(context, findings, lawId, "src/app/workbench-api-boundary.ts");
  if (!route || !client || !boundary) return;

  for (const literal of ["/api/video-download/start-async", "/api/video-download/status", "video_download_concurrency_limit_reached"]) {
    if (!hasStringLiteral(route, literal)) {
      pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/async-status-route", `Route must expose ${literal}.`);
    }
  }
  for (const functionName of ["persistVideoDownloadTask", "readPersistedVideoDownloadTask", "runningTaskCount"]) {
    if (!hasCall(route, functionName) && !route.getFunction(functionName)) {
      pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/bounded-task-status", `${functionName} must exist for durable bounded async task status.`);
    }
  }
  if (hasCall(route, "execute")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/direct-app-ability-call", "App route must not call ability execute directly.");
  }
  if (!hasStringLiteral(client, "/api/video-download/start-async") || !hasStringLiteral(client, "best_available")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-client.ts", "video-download/ui-async-and-quality", "UI must use async status route and best_available YouTube default.");
  }
  for (const literal of ["/api/video-download/start-async", "/api/video-download/status"]) {
    if (!hasStringLiteral(boundary, literal)) {
      pushFinding(findings, lawId, "src/app/workbench-api-boundary.ts", "video-download/api-boundary-route", `API boundary must admit ${literal}.`);
    }
  }
};

const inspectJobFlowBoundary = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const mediator = requiredSourceFile(context, findings, lawId, "src/mediator/video-download-artifact-route.ts");
  const flow = requiredSourceFile(context, findings, lawId, "src/plugins/video-download-artifact/video-download-artifact.flow.ts");
  const schema = requiredSourceFile(context, findings, lawId, "src/plugins/video-download-artifact/video-download-artifact.schema.ts");
  if (!mediator || !flow || !schema) return;

  if (!hasCall(flow, "downloadVideo")) {
    pushFinding(findings, lawId, "src/plugins/video-download-artifact/video-download-artifact.flow.ts", "video-download/job-flow-public-facade", "Job flow must call videoDownload.downloadVideo public facade.");
  }
  for (const propertyName of ["preferredQuality", "downloadSubtitles", "telegramDocumentIdHash"]) {
    if (!objectLiteralContainsProperty(flow, propertyName) && !objectLiteralContainsProperty(schema, propertyName)) {
      pushFinding(findings, lawId, "src/plugins/video-download-artifact/video-download-artifact.flow.ts", "video-download/job-flow-input-pass-through", `${propertyName} must pass through the job flow.`);
    }
  }
  if (!hasCall(mediator, "runVideoDownloadArtifactFlow")) {
    pushFinding(findings, lawId, "src/mediator/video-download-artifact-route.ts", "video-download/mediator-route", "Mediator route must call runVideoDownloadArtifactFlow.");
  }
};

const inspectNoAuditStringScanning = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const auditFiles = [
    "scripts/audit/domains/video-download-capability/inspector.ts",
    "scripts/audit/domains/video-download-capability/components/youtube-production-inspector.ts",
    "scripts/audit/domains/video-download-capability/components/telegram-web-inspector.ts",
    "scripts/acceptance/video-download-youtube-production.acceptance.ts",
  ] as const;
  for (const repoPath of auditFiles) {
    const file = sourceFile(context, repoPath);
    if (!file) continue;
    for (const declaration of file.getImportDeclarations()) {
      if (declaration.getModuleSpecifierValue() === "node:fs") {
        const imported = declaration.getNamedImports().map((named) => named.getName());
        if (imported.some((name) => name === "readFileSync")) {
          pushFinding(findings, lawId, repoPath, "video-download/audit-no-raw-source", "Video-download inspector must not import readFileSync.");
        }
      }
    }
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const name = callExpressionName(call);
      if (name === "getText" || name === "getFullText" || name === "includes" || name === "match" || name === "test") {
        pushFinding(findings, lawId, repoPath, "video-download/audit-no-string-scan", `Video-download inspector must not use ${name} as enforcement.`);
      }
    }
    for (const newExpression of file.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      if (identifierName(newExpression.getExpression()) === "RegExp") {
        pushFinding(findings, lawId, repoPath, "video-download/audit-no-regex", "Video-download inspector must not construct RegExp.");
      }
    }
    if (file.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).length > 0) {
      pushFinding(findings, lawId, repoPath, "video-download/audit-no-regex", "Video-download inspector must not use regular expression literals.");
    }
  }
};

const inspectForbiddenRuntimeSurfaces = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  for (const repoPath of governedFiles) {
    const file = sourceFile(context, repoPath);
    if (!file) continue;
    const identifiers = new Set(file.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => String(identifier.compilerNode.escapedText)));
    for (const forbidden of forbiddenIdentifiers) {
      if (identifiers.has(forbidden)) {
        pushFinding(findings, lawId, repoPath, "video-download/forbidden-credential-surface", `${repoPath} must not reference ${forbidden}.`);
      }
    }
    if (file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) =>
      identifierName(access.getExpression()) === "document" && access.getName() === "cookie")) {
      pushFinding(findings, lawId, repoPath, "video-download/forbidden-cookie-surface", `${repoPath} must not read document.cookie.`);
    }
  }
};

const inspectTelegramContinuity = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const schema = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/schema.ts");
  const router = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/runtime/platform-router.ts");
  const child = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/children/download-telegram-web-video-once.ts");
  if (!schema || !router || !child) return;

  for (const literal of ["telegram-web", "telegram_sw_progressive_cache", "telegram_sw_download_stream"]) {
    if (!hasStringLiteral(schema, literal)) {
      pushFinding(findings, lawId, "src/capabilities/video-download/schema.ts", "video-download/telegram-schema", `${literal} must be present in schema literal contracts.`);
    }
  }
  if (!hasStringLiteral(router, "web.telegram.org") || !hasStringLiteral(router, "download-telegram-web-video-once")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/platform-router.ts", "video-download/telegram-routing", "Telegram host must route to download-telegram-web-video-once.");
  }
  if (!child.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => String(identifier.compilerNode.escapedText) === "telegramDocumentIdHash") && !arrayLiteralContainsString(child, "telegramDocumentIdHash")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/children/download-telegram-web-video-once.ts", "video-download/telegram-target-binding", "Telegram child must bind selected telegramDocumentIdHash.");
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-009-V1");
  const findings: Finding[] = [];

  for (const repoPath of governedFiles) {
    requiredSourceFile(context, findings, lawId, repoPath);
  }
  inspectSchemaAndRegistry(context, findings, lawId);
  inspectYoutubeProduction(context, findings, lawId);
  inspectWorkbenchRoute(context, findings, lawId);
  inspectJobFlowBoundary(context, findings, lawId);
  inspectTelegramContinuity(context, findings, lawId);
  inspectForbiddenRuntimeSurfaces(context, findings, lawId);
  inspectNoAuditStringScanning(context, findings, lawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
      executedChecks: executedChecksForPlan(context),
    findings,
    inspectedFiles: [...governedFiles, "scripts/audit/domains/video-download-capability/inspector.ts"],
  };
};
