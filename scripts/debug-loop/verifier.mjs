import path from "node:path";

import { runCommand } from "./command-runner.mjs";
import { captureGitState } from "./git-guard.mjs";
import { getRepoRoot } from "./path-policy.mjs";
import { readLawEnforcementState } from "./law-enforcement-reader.mjs";
import { writeJsonFile } from "./json-utils.mjs";

function statusFromExitCode(result) {
  return result.exitCode === 0 ? "PASS" : "FAIL";
}

function resolveLogTargets(iterationDir, baseName) {
  return {
    stdoutPath: path.join(iterationDir, `${baseName}.stdout.log`),
    stderrPath: path.join(iterationDir, `${baseName}.stderr.log`),
  };
}

async function runNpmScript(scriptName, iterationDir, baseName) {
  return runCommand("npm", ["run", scriptName], {
    cwd: getRepoRoot(),
    ...resolveLogTargets(iterationDir, baseName),
  });
}

function tryParseTrailingJson(stdout) {
  const match = stdout.match(/\{[\s\S]*\}\s*$/u);
  if (!match) {
    return { ok: false, payload: null, errorMessage: "No trailing JSON found." };
  }

  try {
    return { ok: true, payload: JSON.parse(match[0]), errorMessage: null };
  } catch (error) {
    return {
      ok: false,
      payload: null,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

function parseTrailingJson(stdout) {
  const parsed = tryParseTrailingJson(stdout);
  return parsed.ok ? parsed.payload : null;
}

function resolveRuntimeScenarioStatus(commandResult, runtimeResult) {
  if (commandResult.exitCode === 0) {
    return "PASS";
  }
  if (runtimeResult?.status === "BLOCKED" || commandResult.stdout.includes("BLOCKED_") || commandResult.stderr.includes("BLOCKED_")) {
    return "BLOCKED";
  }
  return "FAIL";
}

function isVerificationPass(input) {
  return [
    input.ciFull === "PASS",
    input.runtimeScenario === "PASS",
    input.lawEnforcementPassed === true,
    Array.isArray(input.ciFullFailures),
    input.ciFullFailures.length === 0,
  ].every(Boolean);
}

function buildVerdict(input) {
  if (input.runtimeScenario === "BLOCKED") {
    return "BLOCKED";
  }

  return isVerificationPass(input) ? "PASS" : "NOT_PASS";
}

function buildSkippedLawEnforcementState() {
  return {
    hasActiveLaw: true,
    hasMatrixEntry: true,
    ownerInAuditPlan: true,
    missingMatrixLawIds: [],
    missingAuditPlanLawIds: [],
    missingP0P1LawCoverage: [],
    warningOnlyP0: false,
    detachedInspector: false,
    lawEnforcementPassed: true,
    ciFullFailures: [],
  };
}

async function runVerificationCommands(input) {
  const ciFullResult = await runNpmScript("ci:full", input.iterationDir, "ci-full");
  const postCiFullGitState = await captureGitState({ iterationDir: input.iterationDir, fileName: "git-state-post-ci-full.json" });
  const runtimeScenarioResult = await runCommand("npm", ["run", "debug:scenario", "--", "--scenario", input.scenarioId], {
    cwd: getRepoRoot(),
    ...resolveLogTargets(input.iterationDir, "runtime-recheck"),
  });

  return {
    ciFullResult,
    postCiFullGitState,
    runtimeScenarioResult,
    enforcementState: input.owner
      ? await readLawEnforcementState({ owner: input.owner })
      : buildSkippedLawEnforcementState(),
  };
}

function resolveFallbackRuntimeStatus(runtimeScenarioResult) {
  return runtimeScenarioResult.exitCode === 0
    ? "PASS"
    : runtimeScenarioResult.stdout.includes("BLOCKED_") || runtimeScenarioResult.stderr.includes("BLOCKED_")
      ? "BLOCKED"
      : "FAIL";
}

function createRuntimeScenarioPayload(runtimeScenarioResult) {
  const parsedPayload = parseTrailingJson(runtimeScenarioResult.stdout);
  if (parsedPayload) {
    return parsedPayload;
  }

  return {
    status: resolveFallbackRuntimeStatus(runtimeScenarioResult),
    rootCause: (runtimeScenarioResult.failureReason ?? runtimeScenarioResult.stderr)
      || runtimeScenarioResult.stdout
      || "runtime recheck result could not be parsed",
  };
}

function buildVerificationResult(input) {
  const verificationResult = {
    ciFull: statusFromExitCode(input.commandResults.ciFullResult),
    runtimeScenario: resolveRuntimeScenarioStatus(input.commandResults.runtimeScenarioResult, input.runtimeScenarioPayload),
    runtimeScenarioPayload: input.runtimeScenarioPayload,
    runtimeScenarioResultPath: path.join(input.iterationDir, "runtime-recheck-result.json"),
    hasActiveLaw: input.enforcementState.hasActiveLaw,
    hasMatrixEntry: input.enforcementState.hasMatrixEntry,
    ownerInAuditPlan: input.enforcementState.ownerInAuditPlan,
    missingMatrixLawIds: input.enforcementState.missingMatrixLawIds,
    missingAuditPlanLawIds: input.enforcementState.missingAuditPlanLawIds,
    missingP0P1LawCoverage: input.enforcementState.missingP0P1LawCoverage,
    warningOnlyP0: input.enforcementState.warningOnlyP0,
    detachedInspector: input.enforcementState.detachedInspector,
    lawEnforcementPassed: input.enforcementState.lawEnforcementPassed,
    ciFullGeneratedHashesAfter: input.commandResults.postCiFullGitState.generatedHashes,
    ciFullFailures: input.enforcementState.ciFullFailures,
    verdict: "NOT_PASS",
  };

  verificationResult.verdict = buildVerdict(verificationResult);
  return verificationResult;
}

export async function runVerification(input) {
  const commandResults = await runVerificationCommands(input);
  const runtimeScenarioPayload = createRuntimeScenarioPayload(commandResults.runtimeScenarioResult);
  await writeJsonFile(path.join(input.iterationDir, "runtime-recheck-result.json"), runtimeScenarioPayload);

  const verificationResult = buildVerificationResult({
    iterationDir: input.iterationDir,
    commandResults,
    enforcementState: commandResults.enforcementState,
    runtimeScenarioPayload,
  });
  await writeJsonFile(path.join(input.iterationDir, "verification-result.json"), verificationResult);
  return verificationResult;
}

function parseCliArgs(argv) {
  const scenarioIndex = argv.indexOf("--scenario");
  const ownerIndex = argv.indexOf("--owner");
  const iterationIndex = argv.indexOf("--iterationDir");
  return {
    scenarioId: scenarioIndex === -1 ? null : argv[scenarioIndex + 1] ?? null,
    owner: ownerIndex === -1 ? null : argv[ownerIndex + 1] ?? null,
    iterationDir: iterationIndex === -1 ? null : argv[iterationIndex + 1] ?? null,
  };
}

if (import.meta.url === new URL(process.argv[1], "file://").href) {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.scenarioId || !args.iterationDir) {
    process.stderr.write("Usage: node scripts/debug-loop/verifier.mjs --scenario <scenarioId> --iterationDir <path> [--owner <owner>]\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`${JSON.stringify(await runVerification(args), null, 2)}\n`);
  }
}
