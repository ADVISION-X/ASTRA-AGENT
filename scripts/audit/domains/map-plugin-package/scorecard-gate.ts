import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { SCORECARD_PATH } = MAP_PLUGIN_PATHS;

export async function runScorecardGate(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings: Finding[] = [];
  const text = await readTextFile(pathFromRepoRoot(SCORECARD_PATH));

  const scoreRows = text.split("\n").filter((line) => line.startsWith("| ") && !line.includes("---"));
  if (scoreRows.length < 12) {
    findings.push(createFinding({
      lawId: MAP_PLUGIN_LAWS.ENFORCEMENT,
      file: SCORECARD_PATH,
      line: 1,
      severity: "fatal",
      message: "Map package scorecard must track the full enforcement surface, not a partial subset.",
    }));
  }

  if (!text.includes("MAP_PLUGIN_PACKAGE_NOT_READY")) {
    findings.push(createFinding({
      lawId: MAP_PLUGIN_LAWS.ENFORCEMENT,
      file: SCORECARD_PATH,
      line: 1,
      severity: "fatal",
      message: "Map package scorecard must keep the explicit not-ready gate until the governed closeout is complete.",
    }));
  }

  const passed = findings.length === 0;
  return {
    findings,
    phase: createPhase(
      "scorecard-gate",
      passed ? "PASS" : "LAW-SCRIPT DRIFT",
      passed,
      passed
        ? "Map package scorecard remains explicit, provisional, and aligned with the governed closeout gate."
        : "Map package scorecard drifted away from the governed readiness gate.",
    ),
  };
}
