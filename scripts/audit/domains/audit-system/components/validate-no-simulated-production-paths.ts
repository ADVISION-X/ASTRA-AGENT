import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { listFilesRecursive, readTextFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot } from "../../../core/paths.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const PRODUCTION_ROOTS = [
  "src/app",
  "src/lib",
  "src/features",
  "scripts/startup",
] as const;

const FORBIDDEN_MARKERS = [
  "LocalFixtureBrowserController",
  "FixturePlatformAdapter",
  "fixture-platform-web",
  "fixture-demo",
  "Fixture Demo",
  ".grasseye-demo-data",
  "/api/demo/",
  "/fixture/platform",
  "renderFixturePlatformPage",
  "mode.fixtureDemo",
  "actions.runDemo",
  "actions.resetDemoData",
  "dialogs.resetDemoConfirm",
] as const;

export const validateNoSimulatedProductionPaths = async (
  _context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];

  for (const root of PRODUCTION_ROOTS) {
    const files = await listFilesRecursive(pathFromRepoRoot(root), {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    }).catch(() => []);

    for (const file of files) {
      const source = await readTextFile(file);
      for (const marker of FORBIDDEN_MARKERS) {
        if (!source.includes(marker)) {
          continue;
        }

        findings.push(
          createFinding({
            lawId: LAW_ID,
            file: file.replace(`${pathFromRepoRoot(".")}/`, ""),
            line: 1,
            severity: "fatal",
            message: `Production path contains forbidden simulated-runtime marker: ${marker}`,
          }),
        );
      }
    }
  }

  return {
    findings,
    phases: [
      createPhase(
        "production-path-simulation-ban",
        findings.length === 0 ? "PASS" : "CODE VIOLATION",
        findings.length === 0,
        findings.length === 0
          ? "Production startup and runtime paths are free of fixture/demo simulation markers."
          : "Production startup or runtime paths still contain forbidden fixture/demo simulation markers.",
      ),
    ],
  };
};