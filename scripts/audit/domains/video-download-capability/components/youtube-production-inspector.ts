import { Node, SyntaxKind, type CallExpression, type ObjectLiteralExpression, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

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

const objectLiteralPropertyNames = (literal: ObjectLiteralExpression): string[] =>
  literal.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      return [property.getName()];
    }
    return [];
  });

const objectPropertyInitializer = (literal: ObjectLiteralExpression, propertyName: string): Node | null => {
  const property = literal.getProperties().find((candidate) =>
    (Node.isPropertyAssignment(candidate) || Node.isShorthandPropertyAssignment(candidate)) &&
    candidate.getName().replaceAll('"', "").replaceAll("'", "") === propertyName);
  if (!Node.isPropertyAssignment(property)) return null;
  return property.getInitializer() ?? null;
};

const initializerObjectLiteral = (source: SourceFile, variableName: string): ObjectLiteralExpression | null => {
  const initializer = source.getVariableDeclaration(variableName)?.getInitializer();
  if (Node.isObjectLiteralExpression(initializer)) return initializer;
  return initializer?.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)[0] ?? null;
};

const objectPropertyStringValue = (literal: ObjectLiteralExpression, propertyName: string): string | null => {
  const property = literal.getProperties().find((candidate) =>
    (Node.isPropertyAssignment(candidate) || Node.isShorthandPropertyAssignment(candidate)) &&
    candidate.getName().replaceAll('"', "").replaceAll("'", "") === propertyName);
  if (!Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  return Node.isStringLiteral(initializer) ? initializer.getLiteralText() : null;
};

const hasCall = (source: SourceFile, callName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => callExpressionName(call) === callName);

const callHasStringArgument = (source: SourceFile, callName: string, value: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    if (callExpressionName(call) !== callName) return false;
    return call.getArguments().some((argument) => Node.isStringLiteral(argument) && argument.getLiteralText() === value);
  });

const objectLiteralContainsProperty = (source: SourceFile, propertyName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) =>
    objectLiteralPropertyNames(literal).some((name) => name === propertyName));

const isPropertyAccess = (node: Node | undefined, expressionName: string, propertyName: string): boolean =>
  Node.isPropertyAccessExpression(node) &&
  identifierName(node.getExpression()) === expressionName &&
  node.getName() === propertyName;

const objectLiteralContainsPropertyAccessInitializer = (
  source: SourceFile,
  propertyName: string,
  expressionName: string,
  initializerPropertyName: string,
): boolean => source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) =>
    isPropertyAccess(objectPropertyInitializer(literal, propertyName) ?? undefined, expressionName, initializerPropertyName));

const objectLiteralContainsCallInitializer = (
  source: SourceFile,
  propertyName: string,
  callName: string,
): boolean => source.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((literal) => {
    const initializer = objectPropertyInitializer(literal, propertyName);
    if (initializer === null) return false;
    if (!Node.isCallExpression(initializer)) return false;
    return callExpressionName(initializer) === callName;
  });

const importedNamesFromModule = (source: SourceFile, moduleSpecifier: string): string[] =>
  source.getImportDeclarations().flatMap((declaration) =>
    declaration.getModuleSpecifierValue() === moduleSpecifier
      ? declaration.getNamedImports().map((named) => named.getName())
      : []);

const sourceImportsName = (source: SourceFile, moduleSpecifier: string, importName: string): boolean =>
  importedNamesFromModule(source, moduleSpecifier).some((name) => name === importName);

const sourceContainsIdentifier = (source: SourceFile, identifierName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => String(identifier.compilerNode.escapedText) === identifierName);

const hasNumericLiteralInitializer = (source: SourceFile, variableName: string, value: number): boolean => {
  const initializer = source.getVariableDeclaration(variableName)?.getInitializer();
  return Node.isNumericLiteral(initializer) && Number(initializer.getLiteralValue()) === value;
};

const hasPropertyAccess = (source: SourceFile, expressionText: string, propertyName: string): boolean =>
  source.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).some((access) =>
    identifierName(access.getExpression()) === expressionText && access.getName() === propertyName);

const typeAliasPropertyNames = (source: SourceFile, typeAliasName: string): string[] => {
  const typeNode = source.getTypeAlias(typeAliasName)?.getTypeNode();
  if (!typeNode) return [];
  const collect = (node: Node): string[] => {
    if (Node.isTypeLiteral(node)) {
      return node.getMembers().flatMap((member) =>
        Node.isPropertySignature(member) ? [member.getName()] : []);
    }
    return node.forEachChildAsArray().flatMap((child) => collect(child));
  };
  return collect(typeNode);
};

const selectorBranches = (selector: string): string[] =>
  selector.split("/").map((branch) => branch.trim()).filter((branch) => branch.length > 0);

const selectorBranchIsHeightBounded = (branch: string, maxHeight: string): boolean =>
  branch.split(`height<=${maxHeight}`).length > 1;

const selectorIsFullyBounded = (selector: string, maxHeight: string): boolean =>
  selectorBranches(selector).every((branch) => selectorBranchIsHeightBounded(branch, maxHeight));

const inspectYoutubeQualitySelectors = (args: SourceFile, findings: Finding[], lawId: string): void => {
  const selectors = initializerObjectLiteral(args, "YOUTUBE_FORMAT_SELECTORS");
  if (!selectors) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/quality-selector", "YOUTUBE_FORMAT_SELECTORS must be an object literal.");
    return;
  }
  for (const quality of expectedQualities) {
    const selector = objectPropertyStringValue(selectors, quality);
    if (!selector) {
      pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/quality-selector", `${quality} must have a bounded selector.`);
    }
    if (quality.endsWith("p")) {
      const height = quality.slice(0, -1);
      if (!selector || !selectorIsFullyBounded(selector, height)) {
        pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/quality-selector-bound", `${quality} selector must not exceed requested height.`);
      }
    }
  }
  const hdSelector = objectPropertyStringValue(selectors, "hd");
  const sdSelector = objectPropertyStringValue(selectors, "sd");
  const bestAvailableSelector = objectPropertyStringValue(selectors, "best_available");
  if (!hdSelector || !selectorIsFullyBounded(hdSelector, "1080")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/quality-selector-bound", "hd selector must be fully bounded at 1080p.");
  }
  if (!sdSelector || !selectorIsFullyBounded(sdSelector, "480")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/quality-selector-bound", "sd selector must be fully bounded at 480p.");
  }
  if (!bestAvailableSelector || !selectorIsFullyBounded(bestAvailableSelector, "2160")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/quality-selector-bound", "best_available selector must be fully bounded at 2160p and must not contain naked best fallback.");
  }
};

const inspectYoutubeSubtitleArgs = (args: SourceFile, findings: Finding[], lawId: string): void => {
  for (const literal of ["--write-subs", "--write-auto-subs", "--sub-langs", "--sub-format"]) {
    if (!hasStringLiteral(args, literal)) {
      pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts", "video-download/subtitle-args", `subtitleArgs must pass ${literal}.`);
    }
  }
};

const inspectYoutubeDependencyGate = (abilityGroup: SourceFile, binary: SourceFile, findings: Finding[], lawId: string): void => {
  if (!hasCall(abilityGroup, "verifyFfprobeAvailable")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/ability-group.ts", "video-download/ffprobe-startup-gate", "prepareVideoDownloadRuntimeDependencies must verify ffprobe availability.");
  }
  if (!hasCall(abilityGroup, "resolveYtDlpBinaryPath")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/ability-group.ts", "video-download/youtube-startup-refresh", "prepareVideoDownloadRuntimeDependencies must resolve managed yt-dlp.");
  }
  if (!binary.getVariableDeclaration("getPreparedYtDlpBinaryPath")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-binary.ts", "video-download/prepared-runtime-accessor", "Managed yt-dlp module must expose a prepared runtime accessor for download execution.");
  }
  const hasPathFallback = binary.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    callExpressionName(call) === "canExecute" &&
    call.getArguments().some((argument) => Node.isStringLiteral(argument) && argument.getLiteralText() === "yt-dlp"));
  if (hasPathFallback) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-binary.ts", "video-download/no-path-ytdlp-fallback", "Managed runtime resolution must not fall back to PATH yt-dlp.");
  }
  if (!hasStringLiteral(binary, "python3.10") || !hasCall(binary, "downloadFromGithub")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-binary.ts", "video-download/managed-yt-dlp", "Managed yt-dlp path must support refresh and Python 3.10+ runner.");
  }
};

const inspectYoutubeMediaProbe = (output: SourceFile, findings: Finding[], lawId: string): void => {
  if (!callHasStringArgument(output, "execFileAsync", "ffprobe")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-output.ts", "video-download/media-probe", "YouTube media validation must call ffprobe through execFileAsync.");
  }
  for (const propertyName of ["durationMs", "width", "height"]) {
    if (!objectLiteralContainsProperty(output, propertyName)) {
      pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-output.ts", "video-download/media-probe-fields", `ffprobe media result must expose ${propertyName}.`);
    }
  }
};

const inspectYoutubeDownloadRuntimeProof = (download: SourceFile, findings: Finding[], lawId: string): void => {
  if (!hasStringLiteral(download, "--max-filesize") || !hasStringLiteral(download, "metadata_validation_failed")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/youtube-download-hardening", "YouTube download must include max-filesize and subtitle metadata validation failure.");
  }
  if (!hasCall(download, "selectedQualityFromHeight") || !objectLiteralContainsProperty(download, "selectedQuality")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/actual-selected-quality", "YouTube success must derive selectedQuality from probed media height.");
  }
  if (!hasCall(download, "maxYoutubeHeightForQuality")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/actual-selected-quality-bound", "YouTube success must fail when probed height exceeds requested quality limit.");
  }
  if (!hasCall(download, "youtubeLanguageMatches")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/subtitle-language-variants", "YouTube subtitle availability must match language variants such as en-US for en.");
  }
  if (!hasCall(download, "youtubeExpectedSubtitleLanguages")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/subtitle-availability-fixture", "YouTube subtitle availability must be centralized in a fixture-callable variant-aware helper.");
  }
  if (!hasCall(download, "runYtDlpProcess")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/metadata-process-abort", "YouTube metadata and download execution must share the abortable yt-dlp process runner.");
  }
  if (sourceContainsIdentifier(download, "YTDlpWrapRuntime")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/metadata-process-abort", "Metadata probe must not use the separate yt-dlp-wrap execPromise path.");
  }
  if (hasCall(download, "resolveYtDlpBinaryPath")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/no-download-runtime-resolution", "Download execution must not resolve or refresh yt-dlp dependencies.");
  }
  if (!hasCall(download, "getPreparedYtDlpBinaryPath")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/prepared-runtime-only", "Download execution must use the prepared managed yt-dlp runtime accessor.");
  }
  if (!hasCall(download, "rm")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts", "video-download/tempdir-cleanup", "YouTube temporary directories must be cleaned for failed validation and thrown download failures.");
  }
};

const inspectYoutubeChildProof = (child: SourceFile, findings: Finding[], lawId: string): void => {
  if (!hasCall(child, "importVideoArtifactFromFile") || !objectLiteralContainsPropertyAccessInitializer(child, "sourceFilePath", "downloaded", "filePath")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/children/download-youtube-video-once.ts", "video-download/file-artifact-import", "YouTube child must import downloaded file path instead of full bytes.");
  }
  if (!objectLiteralContainsProperty(child, "selectedQuality")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/children/download-youtube-video-once.ts", "video-download/selected-quality-proof", "YouTube child must pass actual selectedQuality into result proof.");
  }
  if (!hasCall(child, "setTimeout") || !hasPropertyAccess(child, "abortController", "abort")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/children/download-youtube-video-once.ts", "video-download/total-timeout-abort", "YouTube child must enforce total timeout by aborting the active yt-dlp process.");
  }
  if (!hasCall(child, "randomUUID")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/children/download-youtube-video-once.ts", "video-download/collision-resistant-artifact-id", "YouTube artifact ids must use collision-resistant ids, not timestamp-only ids.");
  }
};

const inspectWorkbenchYoutubeBoundary = (route: SourceFile, findings: Finding[], lawId: string): void => {
  if (!hasNumericLiteralInitializer(route, "YOUTUBE_DEFAULT_MAX_BYTES", 5_000_000_000)) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/youtube-finite-maxbytes", "YouTube Workbench requests must use a finite governed maxBytes constant.");
  }
  if (!objectLiteralContainsCallInitializer(route, "maxBytes", "min")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/youtube-request-maxbytes", "Workbench YouTube route must honor caller maxBytes while capping it to the governed finite maximum.");
  }
  if (!typeAliasPropertyNames(route, "VideoDownloadRequestBody").some((propertyName) => propertyName === "subtitleLanguages") ||
    !hasCall(route, "readSubtitleLanguages")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/subtitle-language-pass-through", "Workbench route must pass caller subtitleLanguages through the mediated job input.");
  }
  if (!hasCall(route, "randomUUID")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/downloads-delivery-id", "Downloads delivery filenames must use collision-resistant ids.");
  }
  if (sourceContainsIdentifier(route, "Number") && hasPropertyAccess(route, "Number", "MAX_SAFE_INTEGER")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/youtube-unbounded-maxbytes", "YouTube Workbench requests must not use Number.MAX_SAFE_INTEGER for maxBytes.");
  }
  if (!hasCall(route, "rename")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/atomic-task-snapshot", "Async task snapshots must be persisted through an atomic temporary write and rename.");
  }
  if (!hasCall(route, "persistTerminalVideoDownloadTask") || !hasStringLiteral(route, "video_download_task_persistence_failed")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/terminal-persistence-failure", "Terminal async persistence failure must turn the task into an observable failed state.");
  }
  if (!hasCall(route, "persistenceFailureReason")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/initial-persistence-failure", "Initial async snapshot persistence failure must become an observable failed task response.");
  }
  if (!hasStringLiteral(route, "youtube_requires_async_status_route")) {
    pushFinding(findings, lawId, "src/app/workbench-video-download-routes.ts", "video-download/youtube-sync-route-blocked", "Synchronous /api/video-download/start must reject YouTube long downloads.");
  }
};

const inspectYoutubeFileArtifacts = (output: SourceFile, child: SourceFile, findings: Finding[], lawId: string): void => {
  if (sourceImportsName(output, "node:fs/promises", "readFile")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-output.ts", "video-download/no-subtitle-readfile", "YouTube subtitle collection must not import readFile for artifact persistence.");
  }
  if (typeAliasPropertyNames(output, "YoutubeSubtitleDownload").some((propertyName) => propertyName === "bytes")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-output.ts", "video-download/no-subtitle-bytes", "YouTube subtitle output contract must carry filePath, not bytes.");
  }
  if (!typeAliasPropertyNames(output, "YoutubeSubtitleDownload").some((propertyName) => propertyName === "filePath")) {
    pushFinding(findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-output.ts", "video-download/subtitle-file-path", "YouTube subtitle output contract must expose subtitle filePath.");
  }
  if (objectLiteralContainsPropertyAccessInitializer(child, "sourceFilePath", "subtitle", "filePath") === false) {
    pushFinding(findings, lawId, "src/capabilities/video-download/children/download-youtube-video-once.ts", "video-download/subtitle-file-artifact-import", "YouTube subtitle artifacts must be imported from subtitle.filePath.");
  }
};

export const inspectYoutubeProduction = (context: InspectorContext, findings: Finding[], lawId: string): void => {
  const args = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-args.ts");
  const binary = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-binary.ts");
  const download = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-download.ts");
  const output = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/runtime/youtube-dlp-output.ts");
  const child = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/children/download-youtube-video-once.ts");
  const abilityGroup = requiredSourceFile(context, findings, lawId, "src/capabilities/video-download/ability-group.ts");
  const route = requiredSourceFile(context, findings, lawId, "src/app/workbench-video-download-routes.ts");
  const support = requiredSourceFile(context, findings, lawId, "src/lib/local-runtime/workbench-video-download-support.ts");
  if (!args || !binary || !download || !output || !child || !abilityGroup || !route || !support) return;
  inspectYoutubeQualitySelectors(args, findings, lawId);
  inspectYoutubeSubtitleArgs(args, findings, lawId);
  inspectYoutubeDependencyGate(abilityGroup, binary, findings, lawId);
  inspectYoutubeMediaProbe(output, findings, lawId);
  inspectYoutubeDownloadRuntimeProof(download, findings, lawId);
  inspectYoutubeChildProof(child, findings, lawId);
  inspectYoutubeFileArtifacts(output, child, findings, lawId);
  inspectWorkbenchYoutubeBoundary(route, findings, lawId);
  if (support.getDescendantsOfKind(SyntaxKind.RegularExpressionLiteral).length > 0 ||
    support.getDescendantsOfKind(SyntaxKind.NewExpression).some((node) => identifierName(node.getExpression()) === "RegExp")) {
    pushFinding(findings, lawId, "src/lib/local-runtime/workbench-video-download-support.ts", "video-download/source-page-safety-no-regex", "Source-page script safety gate must not use regex or text blacklist enforcement.");
  }
};
