import { readFileSync } from "node:fs";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

type Finding = ReturnType<typeof createFinding>;

const sourceFiles = [
  "src/capabilities/video-download/schema.ts",
  "src/capabilities/video-download/registry.ts",
  "src/capabilities/video-download/runtime/platform-router.ts",
  "src/capabilities/video-download/runtime/result.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-args.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-download.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-output.ts",
  "src/capabilities/video-download/runtime/youtube-url.ts",
  "src/capabilities/video-download/runtime/telegram-web-cache-probe-script.ts",
  "src/capabilities/video-download/children/download-youtube-video-once.ts",
  "src/capabilities/video-download/children/download-telegram-web-video-once.ts",
  "src/mediator/video-download-artifact-route.ts",
  "src/plugins/video-download-artifact/video-download-artifact.flow.ts",
  "src/plugins/video-download-artifact/video-download-artifact.schema.ts",
  "src/app/workbench-video-download-routes.ts",
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

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

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
  if (input.text.includes(input.marker)) {
    return;
  }
  pushFinding(
    input.findings,
    input.lawId,
    input.filePath,
    input.checkId,
    `${input.filePath} is missing ${input.marker}.`,
  );
};

const inspectChildRegistry = (findings: Finding[], lawId: string): void => {
  const schemaText = readRepoFile("src/capabilities/video-download/schema.ts");
  const registryText = readRepoFile("src/capabilities/video-download/registry.ts");
  for (const child of expectedChildren) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/schema.ts",
      text: schemaText,
      marker: child,
      checkId: "video-download/child-schema",
    });
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/registry.ts",
      text: registryText,
      marker: expectedRegistrySymbols[child],
      checkId: "video-download/child-registry",
    });
  }
};

const inspectYoutubeQualityAndSubtitles = (findings: Finding[], lawId: string): void => {
  const schemaText = readRepoFile("src/capabilities/video-download/schema.ts");
  const argsText = readRepoFile("src/capabilities/video-download/runtime/youtube-dlp-args.ts");
  const outputText = readRepoFile("src/capabilities/video-download/runtime/youtube-dlp-output.ts");
  const resultText = readRepoFile("src/capabilities/video-download/runtime/result.ts");
  for (const quality of expectedQualities) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/schema.ts",
      text: schemaText,
      marker: quality,
      checkId: "video-download/quality-schema",
    });
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/youtube-dlp-args.ts",
      text: argsText,
      marker: quality,
      checkId: "video-download/quality-selector",
    });
  }
  for (const marker of ["--write-subs", "--write-auto-subs", "--sub-langs", "subtitleLanguages.join", "--sub-format"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/youtube-dlp-args.ts",
      text: argsText,
      marker,
      checkId: "video-download/subtitle-args",
    });
  }
  for (const marker of ["YoutubeSubtitleDownload", "sourceKind", "text/vtt", "application/x-subrip", "parseSubtitleName"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/youtube-dlp-output.ts",
      text: outputText,
      marker,
      checkId: "video-download/subtitle-output",
    });
  }
  for (const marker of ["subtitleArtifacts", "selectedQuality"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/result.ts",
      text: resultText,
      marker,
      checkId: "video-download/result-proof",
    });
  }
};

const inspectRoutingAndApi = (findings: Finding[], lawId: string): void => {
  const routerText = readRepoFile("src/capabilities/video-download/runtime/platform-router.ts");
  const routeText = readRepoFile("src/app/workbench-video-download-routes.ts");
  const mediatorText = readRepoFile("src/mediator/video-download-artifact-route.ts");
  const flowText = readRepoFile("src/plugins/video-download-artifact/video-download-artifact.flow.ts");
  const localRuntimeText = readRepoFile("src/lib/local-runtime/workbench-video-download-support.ts");
  for (const marker of ["youtube.com", "youtu.be", "youtube-nocookie.com", "download-youtube-video-once"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/platform-router.ts",
      text: routerText,
      marker,
      checkId: "video-download/youtube-routing",
    });
  }
  for (const marker of ["preferredQuality", "downloadSubtitles", "/api/video-download/start", "routeVideoDownloadArtifactJob"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/app/workbench-video-download-routes.ts",
      text: routeText,
      marker,
      checkId: "video-download/api-surface",
    });
  }
  if (/getVideoDownloadAbilityGroup\(\)\.execute/u.test(routeText)) {
    pushFinding(
      findings,
      lawId,
      "src/app/workbench-video-download-routes.ts",
      "video-download/direct-app-ability-call",
      "App API must not directly execute the video-download ability group.",
    );
  }
  for (const marker of ["VideoDownloadArtifactJobInputSchema", "runVideoDownloadArtifactFlow"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/mediator/video-download-artifact-route.ts",
      text: mediatorText,
      marker,
      checkId: "video-download/mediator-route",
    });
  }
  for (const marker of ["videoDownload.execute", "VideoDownloadArtifactJobResultSchema", "jobType: \"video-download-artifact\""]) {
    requireText({
      findings,
      lawId,
      filePath: "src/plugins/video-download-artifact/video-download-artifact.flow.ts",
      text: flowText,
      marker,
      checkId: "video-download/job-flow",
    });
  }
  requireText({
    findings,
    lawId,
    filePath: "src/lib/local-runtime/workbench-video-download-support.ts",
    text: localRuntimeText,
    marker: "../../capabilities/video-download/index.js",
    checkId: "video-download/public-facade",
  });
};

const inspectTelegramWebChain = (findings: Finding[], lawId: string): void => {
  const schemaText = readRepoFile("src/capabilities/video-download/schema.ts");
  const routerText = readRepoFile("src/capabilities/video-download/runtime/platform-router.ts");
  const childText = readRepoFile("src/capabilities/video-download/children/download-telegram-web-video-once.ts");
  const probeText = readRepoFile("src/capabilities/video-download/runtime/telegram-web-cache-probe-script.ts");
  for (const marker of [
    "telegram-web",
    "download-telegram-web-video-once",
    "telegram_sw_progressive_cache",
    "telegram_sw_download_stream",
  ]) {
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
  for (const marker of ["tt-media-progressive", "CacheStorage", "content-range", "bytesBase64", "telegram_sw_progressive_cache"]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/telegram-web-cache-probe-script.ts",
      text: probeText,
      marker,
      checkId: "video-download/telegram-cache-probe",
    });
  }
  for (const marker of ["writeVideoArtifact", "metadata_validation_failed", "review_required", "telegram-document-", "source_page_mismatch"]) {
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

const inspectForbiddenDownloadSurfaces = (findings: Finding[], lawId: string): void => {
  const scanned = sourceFiles.map((filePath) => [filePath, readRepoFile(filePath)] as const);
  const forbiddenPatterns = [
    /downloader\s*website/iu,
    /localStorage|sessionStorage|document\.cookie/iu,
    /puppeteer/iu,
  ] as const;
  for (const [filePath, text] of scanned) {
    const matched = forbiddenPatterns.find((pattern) => pattern.test(text));
    if (!matched) {
      continue;
    }
    pushFinding(
      findings,
      lawId,
      filePath,
      "video-download/forbidden-surface",
      `${filePath} contains a forbidden downloader, credential, or browser-bypass surface.`,
      String(matched),
    );
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-009-V1");
  const findings: Finding[] = [];

  inspectChildRegistry(findings, lawId);
  inspectYoutubeQualityAndSubtitles(findings, lawId);
  inspectRoutingAndApi(findings, lawId);
  inspectTelegramWebChain(findings, lawId);
  inspectForbiddenDownloadSurfaces(findings, lawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...sourceFiles],
  };
};
