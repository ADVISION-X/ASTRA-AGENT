import { writeStartupFailureBundle } from "./startup-failure-bundle.mjs";

const FAILURE_ACTIONS = [
  [/Dependency state/i, "Repair local dependencies and rerun npm run grasseye:start."],
  [/native dependency.*could not|NODE_MODULE_VERSION|better_sqlite3\.node|native addon/i, "Rebuild native dependencies with npm rebuild <package> (for this repo: npm rebuild better-sqlite3) and rerun npm run grasseye:start."],
  [/Local workbench health is not ready: degraded/i, "Inspect startup logs for the failing owner (recent xuanxue-ai-production poll retries observed). Verify environment/config and rerun npm run grasseye:start."],
  [/UPDATE_PREFLIGHT_FAILED/i, "Review dependency ranges before rerunning npm run grasseye:start -- --update."],
  [/health returned HTTP/i, "Inspect the local app health endpoint and rerun npm run grasseye:start."],
  [/Could not clear/i, "Stop the remaining local listener or choose another GRASSEYE_PORT."],
];

const ownerForFailure = () => "startup-entrypoint";

const actionableForFailure = (failureReason) =>
  FAILURE_ACTIONS.find(([pattern]) => pattern.test(failureReason))?.[1]
  ?? "Inspect startup structured logs and rerun npm run grasseye:start.";

export async function createStartupFailureReport({
  rootDir,
  runId,
  baseUrl,
  failureReason,
}) {
  const ownerResponsible = ownerForFailure(failureReason);
  const actionableMessage = actionableForFailure(failureReason);
  const bundleDir = await writeStartupFailureBundle({
    rootDir,
    runId,
    baseUrl,
    failureReason,
    ownerResponsible,
    actionableMessage,
  });
  return { bundleDir, ownerResponsible, actionableMessage };
}

export async function handleStartupBootstrapFailure({
  rootDir,
  runId,
  baseUrl,
  failureReason,
  logFail,
  shutdown,
}) {
  const failureReport = await createStartupFailureReport({ rootDir, runId, baseUrl, failureReason });
  logFail("STARTUP", "startup_entrypoint", "bootstrap_failed", "failed", "startup bootstrap failed", {
    failureReason,
    refs: [`startupFailureBundle=${failureReport.bundleDir}`],
    ownerResponsible: failureReport.ownerResponsible,
    actionableMessage: failureReport.actionableMessage,
  });
  await shutdown("SIGTERM");
  process.exitCode = 1;
}
