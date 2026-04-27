import { createPhase } from "../../core/result.js";
import { fileExists, listFilesRecursive, readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { scanFilesForPatterns } from "../_shared/scan-for-patterns.js";
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";

export default createPendingDomainInspector({
  inspector: "GrassEye Platform Action Owner Inspector",
  inspectorId: "platform-action-owner",
  capabilityDomain: "platform-action",
  inspectorEntry: "scripts/audit/domains/platform-action/inspector.ts",
  ownedPaths: ["src/features/platform-action", "src/lib/browser"],
  pendingSummary: "platform-action implementation pending; manual-first law only; no adapter-level enforcement yet",
  implementedSummary: "platform-action is implemented through a vision-first coordinate real-platform boundary",
  extraChecks: async () => {
    const sourceFiles = await listFilesRecursive(pathFromRepoRoot("src"), { extensions: [".ts"] });
    const realAdapterSource = await readTextFile(pathFromRepoRoot("src/features/platform-action/adapters/tiktok-platform-adapter.ts")).catch(() => "");
    const browserSource = await readTextFile(pathFromRepoRoot("src/lib/browser/browser-controller.ts"));
    const fixtureAdapterExists = await fileExists(pathFromRepoRoot("src/features/platform-action/adapters/fixture-platform-adapter.ts"));
    const visualTargetSource = await readTextFile(pathFromRepoRoot("src/features/platform-action/visual-target.ts")).catch(() => "");
    const geometryGuardSource = await readTextFile(pathFromRepoRoot("src/features/platform-action/screen-geometry-guard.ts")).catch(() => "");
    const coordinatePolicySource = await readTextFile(pathFromRepoRoot("src/features/platform-action/coordinate-action-policy.ts")).catch(() => "");
    const visionAdapterSource = await readTextFile(pathFromRepoRoot("src/features/platform-action/adapters/vision-coordinate-platform-adapter.ts")).catch(() => "");
    const findings = await scanFilesForPatterns(sourceFiles, [
      {
        lawId: "GRASSEYE-PLATFORM-ACTION-001-V1",
        severity: "error",
        pattern: /account pool|proxy pool|fingerprint spoof|captcha bypass|account switching|stealth|anti-detect/i,
        message: "Forbidden abuse keyword found in source tree.",
      },
    ]);

    const realBoundaryPassed =
      realAdapterSource.includes("BrowserController") &&
      realAdapterSource.includes("openFeed") &&
      realAdapterSource.includes("openComments") &&
      realAdapterSource.includes("captureCommentRegion") &&
      realAdapterSource.includes("executeCoordinateAction") &&
      !realAdapterSource.includes("readVisibleTexts");
    const browserBoundaryPassed =
      browserSource.includes("click") &&
      browserSource.includes("getGeometrySnapshot") &&
      browserSource.includes("point:") &&
      browserSource.includes("screenshotRegion") &&
      browserSource.includes("scroll") &&
      browserSource.includes("open(input") &&
      !browserSource.includes("readVisibleTexts");
    const adapterBoundaryPassed = realBoundaryPassed && browserBoundaryPassed;
    const coordinateModePassed =
      (visualTargetSource.includes("sourceScreenshotEvidenceId") || visualTargetSource.includes("sourceScreenshotEvidenceRef")) &&
      geometryGuardSource.includes("browser geometry drift detected") &&
      coordinatePolicySource.includes("minimumConfidence") &&
      visionAdapterSource.includes("executeVisionCoordinateAction") &&
      realAdapterSource.includes("VisionCoordinatePlatformAdapter") &&
      realAdapterSource.includes("executeCoordinateAction") &&
      realAdapterSource.includes("Visual-only Coordinate Runtime") &&
      !realAdapterSource.includes("operator-approved dom fallback") &&
      !fixtureAdapterExists;

    return {
      findings,
      phases: [
        createPhase(
          "platform-adapter-boundary",
          adapterBoundaryPassed ? "PASS" : "LAW-SCRIPT DRIFT",
          adapterBoundaryPassed,
          adapterBoundaryPassed
            ? "Platform actions flow through the governed real-platform adapter and local browser controller boundary."
            : "Platform adapter, browser controller, or fixture-removal boundary is incomplete.",
        ),
        createPhase(
          "vision-coordinate-mode-boundary",
          coordinateModePassed ? "PASS" : "LAW-SCRIPT DRIFT",
          coordinateModePassed,
          coordinateModePassed
            ? "Real-platform action flow exposes visual target, geometry guard, coordinate policy, and visual-only runtime markers."
            : "Coordinate-mode platform action boundary is missing required visual-only governed markers.",
        ),
        createPhase(
          "anti-abuse-scan",
          findings.length === 0 ? "PASS" : "CODE VIOLATION",
          findings.length === 0,
          findings.length === 0
            ? "No obvious abuse-tool keywords were found in source files."
            : "Forbidden platform-abuse patterns were found in source files.",
        ),
      ],
    };
  },
});