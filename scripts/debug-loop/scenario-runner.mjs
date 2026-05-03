import path from "node:path";

import { readJsonFile } from "./json-utils.mjs";
import { resolveScenarioMapBinding } from "./map-resolver.mjs";
import { getDebugLoopDir } from "./path-policy.mjs";
import { publishScenarioTask } from "./task-publisher.mjs";

function printScenarioRunnerUsage() {
  process.stdout.write([
    "Usage: node scripts/debug-loop/scenario-runner.mjs --scenario <scenarioId>",
    "",
    "Run one Debug Loop scenario and print structured JSON output.",
  ].join("\n") + "\n");
}

function getScenarioPath(scenarioId) {
  return path.join(getDebugLoopDir(), "scenarios", `${scenarioId}.scenario.json`);
}

export function parseScenarioRunnerArgs(argv) {
  const scenarioIndex = argv.indexOf("--scenario");
  const mapResolutionIndex = argv.indexOf("--mapResolution");
  return {
    help: argv.includes("--help") || argv.includes("-h"),
    scenarioId: scenarioIndex === -1 ? null : argv[scenarioIndex + 1] ?? null,
    mapResolution: mapResolutionIndex === -1 ? null : JSON.parse(argv[mapResolutionIndex + 1] ?? "null"),
  };
}

export async function loadScenarioById(scenarioId) {
  return readJsonFile(getScenarioPath(scenarioId));
}

function buildBlockedResult(scenario, mapResolution) {
  return {
    status: "BLOCKED",
    scenarioId: scenario.scenarioId,
    successSignals: [],
    blockingSignals: [mapResolution.decision],
    runtimeEvents: [],
    rootCause: mapResolution.rootCause,
    decision: mapResolution.decision,
    command: null,
  };
}

function buildScenarioOutput(scenario, published) {
  return {
    ...published.scenarioResult,
    scenarioId: scenario.scenarioId,
    command: {
      command: published.commandResult.command,
      exitCode: published.commandResult.exitCode,
      timedOut: published.commandResult.timedOut,
      failureReason: published.commandResult.failureReason,
    },
  };
}

export async function runScenario(input) {
  const scenario = input.scenario ?? await loadScenarioById(input.scenarioId);
  const mapResolution = input.mapResolution ?? await resolveScenarioMapBinding({ scenario });
  if (mapResolution.decision && mapResolution.status === "blocked") {
    return buildBlockedResult(scenario, mapResolution);
  }

  const published = await publishScenarioTask({ scenario });
  return buildScenarioOutput(scenario, published);
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const args = parseScenarioRunnerArgs(process.argv.slice(2));
  if (args.help || !args.scenarioId) {
    printScenarioRunnerUsage();
    process.exitCode = args.help ? 0 : 1;
  } else {
    const result = await runScenario({ scenarioId: args.scenarioId, mapResolution: args.mapResolution });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 2 : 1;
  }
}