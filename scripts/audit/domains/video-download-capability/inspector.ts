import { readFileSync } from "node:fs";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  inspectTelegramVisibleListAst,
  inspectTelegramWebChain,
} from "./components/telegram-web-inspector.js";

type Finding = ReturnType<typeof createFinding>;

const sourceFiles = [
  "src/capabilities/video-download/schema.ts",
  "src/capabilities/video-download/registry.ts",
  "src/capabilities/video-download/runtime/platform-router.ts",
  "src/capabilities/video-download/runtime/result.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-args.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-binary.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-download.ts",
  "src/capabilities/video-download/runtime/youtube-dlp-output.ts",
  "src/capabilities/video-download/runtime/youtube-url.ts",
  "src/capabilities/video-download/runtime/telegram-web-cache-probe-script.ts",
  "src/capabilities/video-download/runtime/telegram-web-visible-media-probe-script.ts",
  "scripts/audit/domains/video-download-capability/components/telegram-web-inspector.ts",
  "src/capabilities/video-download/children/download-youtube-video-once.ts",
  "src/capabilities/video-download/children/download-telegram-web-video-once.ts",
  "src/capabilities/video-download/ability-group.ts",
  "src/app/workbench-home-page.ts",
  "src/app/workbench-home-styles.ts",
  "src/app/workbench-video-download-client.ts",
  "src/mediator/video-download-artifact-route.ts",
  "src/plugins/video-download-artifact/video-download-artifact.flow.ts",
  "src/plugins/video-download-artifact/video-download-artifact.schema.ts",
  "src/app/workbench-video-download-routes.ts",
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

const inspectYoutubeDependencyAutoUpdate = (findings: Finding[], lawId: string): void => {
  const abilityGroupText = readRepoFile("src/capabilities/video-download/ability-group.ts");
  const binaryText = readRepoFile("src/capabilities/video-download/runtime/youtube-dlp-binary.ts");
  const downloadText = readRepoFile("src/capabilities/video-download/runtime/youtube-dlp-download.ts");
  const workbenchText = readRepoFile("src/lib/local-runtime/workbench.ts");
  for (const marker of [
    "prepareVideoDownloadRuntimeDependencies",
    "resolveYtDlpBinaryPath({ refresh: process.env.GRASSEYE_YT_DLP_AUTO_UPDATE !== \"0\" })",
  ]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/ability-group.ts",
      text: abilityGroupText,
      marker,
      checkId: "video-download/youtube-dependency-startup-refresh",
    });
  }
  for (const marker of [
    "downloadFromGithub",
    "resolveCachedLocalBinaryPath",
    "input.refresh === true",
    "python3.10",
    "yt-dlp-runner",
  ]) {
    requireText({
      findings,
      lawId,
      filePath: "src/capabilities/video-download/runtime/youtube-dlp-binary.ts",
      text: binaryText,
      marker,
      checkId: "video-download/youtube-managed-binary",
    });
  }
  requireText({
    findings,
    lawId,
    filePath: "src/lib/local-runtime/workbench.ts",
    text: workbenchText,
    marker: "await prepareVideoDownloadRuntimeDependencies();",
    checkId: "video-download/youtube-startup-entry",
  });
  const refreshBranchIndex = binaryText.indexOf("if (input.refresh === true)");
  const systemBinaryIndex = binaryText.indexOf("canExecute(\"yt-dlp\")");
  if (refreshBranchIndex < 0 || systemBinaryIndex < 0 || systemBinaryIndex < refreshBranchIndex) {
    pushFinding(
      findings,
      lawId,
      "src/capabilities/video-download/runtime/youtube-dlp-binary.ts",
      "video-download/youtube-refresh-before-system-binary",
      "Default startup refresh must prefer the managed latest yt-dlp before PATH yt-dlp.",
    );
  }
  if (downloadText.includes("resolveYtDlpBinaryPath({ refresh")) {
    pushFinding(
      findings,
      lawId,
      "src/capabilities/video-download/runtime/youtube-dlp-download.ts",
      "video-download/youtube-download-time-refresh",
      "YouTube dependency refresh must stay in Workbench startup, not inside each download execution.",
    );
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
  if (routeText.includes("getVideoDownloadAbilityGroup().execute")) {
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
  for (const marker of ["videoDownload.downloadVideo", "VideoDownloadArtifactJobResultSchema", "jobType: \"video-download-artifact\""]) {
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

const inspectForbiddenDownloadSurfaces = (findings: Finding[], lawId: string): void => {
  const scanned = sourceFiles.map((filePath) => [filePath, readRepoFile(filePath)] as const);
  const forbiddenMarkers = [
    "downloader website",
    "localStorage",
    "sessionStorage",
    "document.cookie",
    "puppeteer",
  ] as const;
  for (const [filePath, text] of scanned) {
    const matched = forbiddenMarkers.find((marker) => text.toLowerCase().includes(marker.toLowerCase()));
    if (!matched) {
      continue;
    }
    pushFinding(
      findings,
      lawId,
      filePath,
      "video-download/forbidden-surface",
      `${filePath} contains a forbidden downloader, credential, or browser-bypass surface.`,
      matched,
    );
  }
};

const inspectAstProjectCoverage = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
): void => {
  const missingFiles = sourceFiles.filter(
    (filePath) => !context.project.getSourceFile(resolveFromRepo(filePath)),
  );
  if (missingFiles.length === 0) {
    return;
  }
  const firstMissingFile = missingFiles[0];
  if (!firstMissingFile) {
    return;
  }
  pushFinding(
    findings,
    lawId,
    firstMissingFile,
    "video-download/ast-project-coverage",
    "Video-download inspector must resolve governed source files through context.project.",
    missingFiles.join(", "),
  );
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawId = selectLawId(context.planEntry.lawIds, "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-009-V1");
  const findings: Finding[] = [];

  inspectAstProjectCoverage(context, findings, lawId);
  inspectChildRegistry(findings, lawId);
  inspectYoutubeQualityAndSubtitles(findings, lawId);
  inspectYoutubeDependencyAutoUpdate(findings, lawId);
  inspectRoutingAndApi(findings, lawId);
  inspectTelegramWebChain(findings, lawId);
  inspectTelegramVisibleListAst(context, findings, lawId);
  inspectForbiddenDownloadSurfaces(findings, lawId);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...sourceFiles],
  };
};
