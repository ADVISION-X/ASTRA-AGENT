import { strict as assert } from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";
import { buildVideoDownloadJobInput, copyResultToDownloads, persistTerminalVideoDownloadTask, safeDeliveryTitleSegment } from "../../src/app/workbench-video-download-routes.js";
import { youtubeProductionDisplayTitle, youtubeProductionExpectedSubtitleLanguages, youtubeProductionLanguageMatches, youtubeProductionMaxHeightForQuality } from "../../src/capabilities/video-download/index.js";
import type { VideoDownloadResult } from "../../src/capabilities/video-download/index.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
  compilerOptions: { allowJs: true },
});

const source = (filePath: string): SourceFile => {
  const file = project.getSourceFile(filePath);
  assert(file, `${filePath} must be present in the ts-morph project.`);
  return file;
};

const callName = (node: Node): string => {
  if (!Node.isCallExpression(node)) return "";
  const expression = node.getExpression();
  if (Node.isIdentifier(expression)) return String(expression.compilerNode.escapedText);
  if (Node.isPropertyAccessExpression(expression)) return expression.getName();
  return "";
};

const identifierName = (node: Node): string | null =>
  Node.isIdentifier(node) ? String(node.compilerNode.escapedText) : null;

const hasCall = (file: SourceFile, name: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => callName(call) === name);

const hasPropertyAccess = (file: SourceFile, expressionName: string, propertyName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) =>
    identifierName(access.getExpression()) === expressionName && access.getName() === propertyName);

const hasStringLiteral = (file: SourceFile, value: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralText() === value) ||
  file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).some((literal) =>
    literal.getLiteralText().split(value).length > 1);

const objectLiteralHasProperty = (file: SourceFile, propertyName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) =>
    literal.getProperties().some((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return property.getName() === propertyName;
      }
      return false;
    }));

const objectLiteralHasInitializer = (
  file: SourceFile,
  propertyName: string,
  expressionName: string,
  initializerPropertyName: string,
): boolean => file.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) => {
  const property = literal.getProperty(propertyName);
  if (!Node.isPropertyAssignment(property)) return false;
  const initializer = property.getInitializer();
  return Node.isPropertyAccessExpression(initializer) &&
    identifierName(initializer.getExpression()) === expressionName &&
    initializer.getName() === initializerPropertyName;
});

const objectLiteralStringValue = (
  file: SourceFile,
  variableName: string,
  propertyName: string,
): string | null => {
  const initializer = file.getVariableDeclaration(variableName)?.getInitializer();
  const objectLiteral = Node.isObjectLiteralExpression(initializer)
    ? initializer
    : initializer?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0];
  if (!objectLiteral) return null;
  const property = objectLiteral.getProperties().find((candidate) =>
    (Node.isPropertyAssignment(candidate) || Node.isShorthandPropertyAssignment(candidate)) &&
    candidate.getName().replaceAll('"', "").replaceAll("'", "") === propertyName);
  if (!Node.isPropertyAssignment(property)) return null;
  const propertyInitializer = property.getInitializer();
  return Node.isStringLiteral(propertyInitializer) ? propertyInitializer.getLiteralText() : null;
};

const selectorBranches = (selector: string): string[] =>
  selector.split("/").map((branch) => branch.trim()).filter((branch) => branch.length > 0);

const selectorIsFullyBounded = (selector: string, maxHeight: string): boolean =>
  selectorBranches(selector).every((branch) => branch.split(`height<=${maxHeight}`).length > 1);

const typeLiteralPropertyNames = (node: Node | undefined): string[] => {
  if (!node) return [];
  if (Node.isTypeLiteral(node)) {
    return node.getMembers().flatMap((member) =>
      Node.isPropertySignature(member) ? [member.getName()] : []);
  }
  return node.forEachChildAsArray().flatMap((childNode) => typeLiteralPropertyNames(childNode));
};

const client = source("src/app/workbench-video-download-client.ts");
const route = source("src/app/workbench-video-download-routes.ts");
const runtime = source("src/capabilities/video-download/runtime/youtube-dlp-download.ts");
const child = source("src/capabilities/video-download/children/download-youtube-video-once.ts");
const resultBuilder = source("src/capabilities/video-download/runtime/result.ts");
const abilityGroup = source("src/capabilities/video-download/ability-group.ts");
const binary = source("src/capabilities/video-download/runtime/youtube-dlp-binary.ts");
const output = source("src/capabilities/video-download/runtime/youtube-dlp-output.ts");
const policy = source("src/capabilities/video-download/runtime/youtube-dlp-policy.ts");
const schema = source("src/capabilities/video-download/schema.ts");
const storagePort = source("src/capabilities/video-download/ports/video-artifact-storage-port.ts");
const storage = source("src/capabilities/video-download/runtime/artifact-storage.ts");
const boundary = source("src/app/workbench-api-boundary.ts");
const args = source("src/capabilities/video-download/runtime/youtube-dlp-args.ts");

assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "2160p") ?? "", "2160"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "1440p") ?? "", "1440"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "1080p") ?? "", "1080"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "720p") ?? "", "720"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "480p") ?? "", "480"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "360p") ?? "", "360"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "hd") ?? "", "1080"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "sd") ?? "", "480"), true);
assert.equal(selectorIsFullyBounded(objectLiteralStringValue(args, "YOUTUBE_FORMAT_SELECTORS", "best_available") ?? "", "2160"), true);
assert.equal(hasStringLiteral(client, "best_available"), true);
assert.equal(hasStringLiteral(client, "/api/video-download/start-async"), true);
assert.equal(hasStringLiteral(client, "/api/video-download/status?taskId="), true);
assert.equal(hasStringLiteral(client, "subtitleLanguages"), true);
assert.equal(hasStringLiteral(client, "selectedQuality"), true);
assert.equal(hasStringLiteral(client, "durationMs"), true);
assert.equal(hasStringLiteral(client, "proofRef"), true);
assert.equal(hasStringLiteral(client, "subtitleArtifacts"), true);
assert.equal(hasStringLiteral(client, "sourceTitle"), true);
assert.equal(hasStringLiteral(client, "displayTitle"), true);

assert.equal(hasStringLiteral(route, "/api/video-download/start-async"), true);
assert.equal(hasStringLiteral(route, "/api/video-download/status"), true);
assert.equal(hasStringLiteral(route, "video_download_concurrency_limit_reached"), true);
assert.equal(hasCall(route, "persistVideoDownloadTask"), true);
assert.equal(hasCall(route, "readPersistedVideoDownloadTask"), true);
assert.equal(hasCall(route, "runningTaskCount"), true);
assert.equal(hasCall(route, "rename"), true);
const youtubeDefaultMaxBytesInitializer = route.getVariableDeclaration("YOUTUBE_DEFAULT_MAX_BYTES")?.getInitializer();
assert(Node.isNumericLiteral(youtubeDefaultMaxBytesInitializer));
assert.equal(Number(youtubeDefaultMaxBytesInitializer.getLiteralValue()), 5_000_000_000);

assert.equal(hasStringLiteral(runtime, "--max-filesize"), true);
assert.equal(hasStringLiteral(runtime, "metadata_validation_failed"), true);
assert.equal(hasCall(runtime, "selectedQualityFromHeight"), true);
assert.equal(objectLiteralHasProperty(runtime, "selectedQuality"), true);
assert.equal(hasCall(runtime, "getPreparedYtDlpBinaryPath"), true);
assert.equal(hasCall(runtime, "resolveYtDlpBinaryPath"), false);
assert.equal(hasPropertyAccess(runtime, "record", "title"), true);
assert.equal(hasCall(runtime, "youtubeDisplayTitle"), true);
assert.equal(hasStringLiteral(runtime, "youtube_video.%(ext)s"), false);
assert.equal(objectLiteralHasProperty(runtime, "sourceTitle"), true);
assert.equal(objectLiteralHasProperty(runtime, "displayTitle"), true);

assert.equal(hasCall(child, "importVideoArtifactFromFile"), true);
assert.equal(objectLiteralHasInitializer(child, "sourceFilePath", "downloaded", "filePath"), true);
assert.equal(objectLiteralHasInitializer(child, "sourceFilePath", "subtitle", "filePath"), true);
assert.equal(objectLiteralHasProperty(child, "selectedQuality"), true);
assert.equal(objectLiteralHasProperty(child, "candidateKind"), true);
assert.equal(objectLiteralHasInitializer(child, "sourceTitle", "downloaded", "sourceTitle"), true);
assert.equal(objectLiteralHasInitializer(child, "displayTitle", "downloaded", "displayTitle"), true);
assert.equal(hasCall(child, "safeArtifactTitleSegment"), true);
assert.equal(hasCall(child, "setTimeout"), true);
assert.equal(hasCall(child, "randomUUID"), true);
assert.equal(child.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => String(identifier.compilerNode.escapedText) === "ARTIFACT_REF_RECORDED"), false);
assert.equal(hasStringLiteral(child, "youtube_download_retryable_runtime_error"), true);
assert.equal(objectLiteralHasProperty(child, "progressPhase"), true);
assert.equal(objectLiteralHasProperty(resultBuilder, "candidateKind"), true);
assert.equal(objectLiteralHasProperty(resultBuilder, "sourceTitle"), true);
assert.equal(objectLiteralHasProperty(resultBuilder, "displayTitle"), true);

assert(abilityGroup.getVariableDeclaration("prepareVideoDownloadRuntimeDependencies"), "prepareVideoDownloadRuntimeDependencies must be exported.");
assert.equal(hasCall(abilityGroup, "resolveYtDlpBinaryPath"), true);
assert.equal(hasCall(abilityGroup, "verifyFfprobeAvailable"), true);
assert.equal(hasCall(binary, "downloadFromGithub"), true);
assert.equal(hasStringLiteral(binary, "yt-dlp_macos"), true);
assert.equal(hasStringLiteral(policy, "runtime_dependency_unavailable"), true);
assert.equal(hasStringLiteral(schema, "runtime_dependency_unavailable"), true);
assert(binary.getVariableDeclaration("getPreparedYtDlpBinaryPath"), "prepared yt-dlp accessor must be exported.");

assert.equal(hasCall(output, "execFileAsync"), true);
assert.equal(hasStringLiteral(output, "ffprobe"), true);
assert.equal(objectLiteralHasProperty(output, "durationMs"), true);
assert.equal(objectLiteralHasProperty(output, "width"), true);
assert.equal(objectLiteralHasProperty(output, "height"), true);

const outputFilesTypeNode = output.getTypeAlias("YoutubeOutputFiles")?.getTypeNode();
const videoProperty = Node.isTypeLiteral(outputFilesTypeNode)
  ? outputFilesTypeNode.getMembers().find((member) => Node.isPropertySignature(member) && member.getName() === "video")
  : undefined;
assert.equal(typeLiteralPropertyNames(videoProperty).some((propertyName) => propertyName === "bytes"), false);

const subtitleTypeNode = output.getTypeAlias("YoutubeSubtitleDownload")?.getTypeNode();
assert.equal(typeLiteralPropertyNames(subtitleTypeNode).some((propertyName) => propertyName === "filePath"), true);
assert.equal(typeLiteralPropertyNames(subtitleTypeNode).some((propertyName) => propertyName === "bytes"), false);

assert.equal(storagePort.getInterface("VideoArtifactStoragePort")?.getMethods().some((method) => method.getName() === "importVideoArtifactFromFile"), true);
assert.equal(hasCall(storage, "createReadStream"), true);
assert.equal(hasCall(storage, "copyFile"), true);

assert.equal(hasStringLiteral(boundary, "/api/video-download/start-async"), true);
assert.equal(hasStringLiteral(boundary, "/api/video-download/status"), true);
assert.equal(hasCall(route, "safeDeliveryTitleSegment"), true);

const defaultYoutubeJob = buildVideoDownloadJobInput({
  platform: "youtube",
  sourcePageUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
});
assert(defaultYoutubeJob);
assert.equal(defaultYoutubeJob.preferredQuality, "best_available");
assert.equal(defaultYoutubeJob.maxBytes, 5_000_000_000);
assert.deepEqual(defaultYoutubeJob.subtitleLanguages, ["en"]);

const boundedYoutubeJob = buildVideoDownloadJobInput({
  platform: "youtube",
  sourcePageUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  maxBytes: 123_456,
  subtitleLanguages: ["en", "zh"],
});
assert(boundedYoutubeJob);
assert.equal(boundedYoutubeJob.maxBytes, 123_456);
assert.deepEqual(boundedYoutubeJob.subtitleLanguages, ["en", "zh"]);

const cappedYoutubeJob = buildVideoDownloadJobInput({
  platform: "youtube",
  sourcePageUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  maxBytes: 9_000_000_000,
});
assert(cappedYoutubeJob);
assert.equal(cappedYoutubeJob.maxBytes, 5_000_000_000);

const fixtureSuccess = {
  status: "success",
  output: {
    status: "success",
    candidateKind: "media_resource",
    sourceTitle: "Real YouTube Title",
    displayTitle: "Real YouTube Title",
  },
  runtimeProof: {
    candidateKind: "media_resource",
    sourceTitle: "Real YouTube Title",
    displayTitle: "Real YouTube Title",
  },
} as VideoDownloadResult;
assert.equal(fixtureSuccess.status, "success");
assert.equal(fixtureSuccess.output.status, "success");
assert.equal(fixtureSuccess.output.candidateKind, "media_resource");
assert.equal(fixtureSuccess.runtimeProof.candidateKind, "media_resource");
assert.equal(fixtureSuccess.output.candidateKind, fixtureSuccess.runtimeProof.candidateKind);
assert.equal(fixtureSuccess.output.sourceTitle, "Real YouTube Title");
assert.equal(fixtureSuccess.runtimeProof.displayTitle, "Real YouTube Title");
assert.equal(fixtureSuccess.output.displayTitle, fixtureSuccess.runtimeProof.displayTitle);

assert.equal(youtubeProductionLanguageMatches("en", "en-US"), true);
assert.equal(youtubeProductionLanguageMatches("zh", "zh-Hans"), true);
assert.equal(youtubeProductionLanguageMatches("en-US", "en"), true);
assert.equal(youtubeProductionLanguageMatches("en", "fr"), false);
assert.deepEqual(youtubeProductionExpectedSubtitleLanguages(["en-US", "fr"], ["en"], true), ["en-US"]);
assert.deepEqual(youtubeProductionExpectedSubtitleLanguages(["zh-Hans", "en"], ["zh"], true), ["zh-Hans"]);
assert.deepEqual(youtubeProductionExpectedSubtitleLanguages(["en-US"], ["en"], false), []);
assert.equal(youtubeProductionMaxHeightForQuality("720p"), 720);
assert.equal(youtubeProductionMaxHeightForQuality("hd"), 1080);
assert.equal(youtubeProductionMaxHeightForQuality("best_available"), 2160);
assert.equal(youtubeProductionDisplayTitle("  Real / YouTube: Title?  "), "Real YouTube Title");
assert.equal(safeDeliveryTitleSegment("Real / YouTube: Title?"), "Real YouTube Title");

const failedPersistence = await persistTerminalVideoDownloadTask(
  { getDataDir: () => "/dev/null" } as GrassEyeWorkbenchHandle,
  "video_download_acceptance",
  {
    taskId: "video_download_acceptance",
    status: "success",
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    platform: "youtube",
    sourcePageUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    record: null,
    downloadsPath: null,
    failureReason: null,
  },
);
assert.equal(failedPersistence.status, "failed");
assert(failedPersistence.failureReason?.startsWith("video_download_task_persistence_failed"));

const deliveryFixtureDir = await mkdtemp(path.join(tmpdir(), "grasseye-delivery-"));
try {
  const deliveryRoot = path.join(deliveryFixtureDir, "acceptance-downloads");
  const missingDelivery = await copyResultToDownloads({
    jobType: "video-download-artifact",
    status: "success",
    result: { status: "success", output: { filePath: path.join(deliveryFixtureDir, "missing.mp4") } },
  } as Awaited<ReturnType<typeof import("../../src/mediator/video-download-artifact-route.js").routeVideoDownloadArtifactJob>>, true, deliveryRoot)
    .then(() => "unexpected_success")
    .catch((error: unknown) => error instanceof Error ? error.message : String(error));
  assert.notEqual(missingDelivery, "unexpected_success");

  const deliverySource = path.join(deliveryFixtureDir, "video.mp4");
  await writeFile(deliverySource, "fixture");
  const deliveredPath = await copyResultToDownloads({
    jobType: "video-download-artifact",
    status: "success",
    result: { status: "success", output: { filePath: deliverySource, displayTitle: "Real YouTube Title" } },
  } as Awaited<ReturnType<typeof import("../../src/mediator/video-download-artifact-route.js").routeVideoDownloadArtifactJob>>, true, deliveryRoot);
  assert(deliveredPath);
  assert.equal(path.dirname(deliveredPath), deliveryRoot);
  assert.equal(path.basename(deliveredPath).startsWith("Real YouTube Title-"), true);
  assert.equal(path.basename(deliveredPath).endsWith(".mp4"), true);
  assert.notEqual(path.basename(deliveredPath), `${Date.now()}-video.mp4`);
} finally {
  await rm(deliveryFixtureDir, { force: true, recursive: true });
}

process.stdout.write("[ACCEPTANCE][video-download-youtube-production] PASS\n");
