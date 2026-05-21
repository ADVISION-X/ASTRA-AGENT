import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase, finalizeInspectorResult } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorResult } from "../../core/schema.js";

const LAW_FILE = ".github/instructions/cursor-rules/modules/module-video-download-capability.instructions.md";
const BLUEPRINT_FILE = "docs/法案辅助文件/GrassEye Video Download 视频下载能力组施工图.md";
const RUNTIME_ROOT = "src/capabilities/video-download";

const REQUIRED_LAW_IDS = [
  "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-001-V1",
  "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-002-V1",
  "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-003-V1",
  "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1",
  "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-005-V1",
  "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-006-V1",
] as const;

const FORBIDDEN_RUNTIME_ROOTS = [
  "src/capabilities/dom-automation",
  "src/plugins/product-video-dom-runtime",
  "src/platforms",
] as const;

const FORBIDDEN_CATALOG_TOKENS = [
  "DOWNLOAD_TIKTOK_VIDEO_ONCE",
  "download-tiktok-video-once",
] as const;

const FORBIDDEN_SHADOW_PATTERNS = [
  /third[-_\s]?party\s+downloader/iu,
  /tiktok\s+downloader/iu,
  /facebook\s+downloader/iu,
  /download(?:Facebook|Tiktok|TikTok|Video)/u,
  /browser_native_hd_url/u,
  /browser_native_sd_url/u,
  /playable_url/u,
  /dash_manifest_url/u,
] as const;

const FORBIDDEN_SECURITY_PATTERNS = [
  /document\.cookie/u,
  /localStorage/u,
  /sessionStorage/u,
  /cookie\s*export/iu,
  /session\s*export/iu,
  /token\s*export/iu,
  /captcha\s*bypass/iu,
  /drm\s*bypass/iu,
  /risk[-_\s]?control\s*bypass/iu,
] as const;

const CODE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs)$/u;

const readRepoFile = (relativePath: string): string =>
  readFileSync(pathFromRepoRoot(relativePath), "utf8");

const fileExists = (relativePath: string): boolean =>
  existsSync(pathFromRepoRoot(relativePath));

const walkFiles = (relativeRoot: string, acc: string[] = []): string[] => {
  const absoluteRoot = pathFromRepoRoot(relativeRoot);
  if (!existsSync(absoluteRoot)) return acc;
  for (const entry of readdirSync(absoluteRoot)) {
    const absolutePath = join(absoluteRoot, entry);
    const relativePath = `${relativeRoot}/${entry}`;
    if (statSync(absolutePath).isDirectory()) {
      walkFiles(relativePath, acc);
      continue;
    }
    if (CODE_FILE_PATTERN.test(entry)) acc.push(relativePath);
  }
  return acc;
};

const videoDownloadFinding = (
  lawId: string,
  file: string,
  message: string,
  hint: string,
): Finding => createFinding({
    lawId,
    file,
    line: 1,
    severity: "fatal",
    message,
    hint,
  });

const collectRequiredDocumentFindings = (): Finding[] => {
  const findings: Finding[] = [];
  if (!fileExists(LAW_FILE)) {
    findings.push(videoDownloadFinding(
      REQUIRED_LAW_IDS[0],
      LAW_FILE,
      "video-download law file is missing",
      "Create the governing law file before runtime construction.",
    ));
    return findings;
  }
  const lawText = readRepoFile(LAW_FILE);
  for (const lawId of REQUIRED_LAW_IDS) {
    if (!lawText.includes(lawId)) {
      findings.push(videoDownloadFinding(
        lawId,
        LAW_FILE,
        "video-download law id is missing from law file",
        "Restore the complete video-download law set.",
      ));
    }
  }
  if (!fileExists(BLUEPRINT_FILE)) {
    findings.push(videoDownloadFinding(
      REQUIRED_LAW_IDS[0],
      BLUEPRINT_FILE,
      "video-download blueprint is missing",
      "Create the blueprint before runtime construction.",
    ));
  }
  return findings;
};

const collectPrematureExposureFindings = (): Finding[] => {
  const catalogFiles = [
    "src/muscle-memory/generated-catalog.json",
    "src/muscle-memory/catalog.ts",
  ].filter(fileExists);
  return catalogFiles.flatMap((file) => {
    const text = readRepoFile(file);
    return FORBIDDEN_CATALOG_TOKENS
      .filter((token) => text.includes(token))
      .map((token) => videoDownloadFinding(
        REQUIRED_LAW_IDS[3],
        file,
        `video-download token is exposed before runtime implementation: ${token}`,
        "Keep video-download out of MuscleMemoryCatalog until the runtime code phase proves executable strength.",
      ));
  });
};

const collectFacebookRuntimeFindings = (): Finding[] => {
  const requiredPaths = [
    "src/capabilities/video-download/index.ts",
    "src/capabilities/video-download/schema.ts",
    "src/capabilities/video-download/contract.ts",
    "src/capabilities/video-download/ability-group.ts",
    "src/capabilities/video-download/manifest.ts",
    "src/capabilities/video-download/children/download-facebook-video-once.ts",
    "src/capabilities/video-download/runtime/candidate-validation.ts",
    "src/capabilities/video-download/runtime/media-download.ts",
  ];
  const findings = requiredPaths
    .filter((relativePath) => !fileExists(relativePath))
    .map((relativePath) => videoDownloadFinding(
      REQUIRED_LAW_IDS[0],
      relativePath,
      "video-download Facebook runtime required path is missing",
      "Create the owned runtime path for download-facebook-video-once.",
    ));
  const manifestText = fileExists("src/capabilities/video-download/manifest.ts")
    ? readRepoFile("src/capabilities/video-download/manifest.ts")
    : "";
  if (!manifestText.includes("DOWNLOAD_FACEBOOK_VIDEO_ONCE")) {
    findings.push(videoDownloadFinding(
      REQUIRED_LAW_IDS[2],
      "src/capabilities/video-download/manifest.ts",
      "Facebook download child is not registered in the owner catalog extension",
      "Register DOWNLOAD_FACEBOOK_VIDEO_ONCE with allowedForAiActionPlan=false.",
    ));
  }
  return findings;
};

const collectShadowDownloaderFindings = (): Finding[] =>
  FORBIDDEN_RUNTIME_ROOTS.flatMap((root) =>
    walkFiles(root).flatMap((file) => {
      const text = readRepoFile(file);
      return FORBIDDEN_SHADOW_PATTERNS
        .filter((pattern) => pattern.test(text))
        .map((pattern) => videoDownloadFinding(
          REQUIRED_LAW_IDS[0],
          file,
          `shadow video-download implementation signal found outside owner root: ${pattern.source}`,
          "Move future media extraction into src/capabilities/video-download during the code phase.",
        ));
    }));

const fileHasShadowDownloaderSignal = (text: string): boolean =>
  FORBIDDEN_SHADOW_PATTERNS.some((pattern) => pattern.test(text));

const securityScanRoots = (): string[] => [
  ...(fileExists(RUNTIME_ROOT) ? [RUNTIME_ROOT] : []),
  ...FORBIDDEN_RUNTIME_ROOTS,
];

const collectSecurityBypassFindings = (): Finding[] =>
  securityScanRoots().flatMap((root) =>
    walkFiles(root).flatMap((file) => {
      const text = readRepoFile(file);
      if (root !== RUNTIME_ROOT && !fileHasShadowDownloaderSignal(text)) {
        return [];
      }
      return FORBIDDEN_SECURITY_PATTERNS
        .filter((pattern) => pattern.test(text))
        .map((pattern) => videoDownloadFinding(
          REQUIRED_LAW_IDS[1],
          file,
          `forbidden credential or bypass signal found: ${pattern.source}`,
          "Remove cookie/session/token access or bypass logic from video-download construction paths.",
        ));
    }));

export const runVideoDownloadCapabilityInspector = async (
  _context: InspectorContext,
): Promise<InspectorResult> => {
  const findings = [
    ...collectRequiredDocumentFindings(),
    ...collectPrematureExposureFindings(),
    ...collectFacebookRuntimeFindings(),
    ...collectShadowDownloaderFindings(),
    ...collectSecurityBypassFindings(),
  ];
  const passed = findings.length === 0;
  return finalizeInspectorResult({
    inspector: "video-download-capability",
    inspectorId: "video-download-capability-owner",
    capabilityDomain: "video-download-capability",
    findings,
    phases: [
      createPhase("phase-0-documents", passed ? "PASS" : "CODE VIOLATION", passed, "law and blueprint presence checked."),
      createPhase("catalog-exposure", passed ? "PASS" : "CODE VIOLATION", passed, "catalog exposure checked."),
      createPhase("facebook-runtime-shape", passed ? "PASS" : "CODE VIOLATION", passed, "Facebook runtime shape checked."),
      createPhase("shadow-downloader-boundary", passed ? "PASS" : "CODE VIOLATION", passed, "shadow downloader surfaces checked."),
      createPhase("security-bypass-redlines", passed ? "PASS" : "CODE VIOLATION", passed, "credential and bypass red lines checked."),
    ],
    summary: passed
      ? "video-download Facebook runtime governance is ready."
      : "video-download Facebook runtime governance has blocking findings.",
  });
};
