import { strict as assert } from "node:assert";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";
import { youtubeProductionDisplayTitle, youtubeProductionExpectedSubtitleLanguages, youtubeProductionLanguageMatches, youtubeProductionMaxHeightForQuality } from "../../src/capabilities/video-download/index.js";
import type { VideoDownloadResult } from "../../src/capabilities/video-download/index.js";

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

const abortHandle = source("src/capabilities/video-download/runtime/abort-handle.ts");
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
assert.equal(hasCall(abortHandle, "setTimeout"), true);
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

process.stdout.write("[ACCEPTANCE][video-download-youtube-production] PASS\n");
