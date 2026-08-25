import { writeStartupFailureBundle } from "./startup-failure-bundle.mjs";

const FAILURE_ACTIONS = [
  [/BROWSER_PROFILE_ENROLLMENT_MISSING/i, "Complete the explicit browserctl profile enrollment with the required bootstrap inputs; startup does not install or enroll Browser Runtime."],
  [/BROWSER_UNPACKED_|BROWSER_PAIRING_|BROWSER_AUTHENTICATION_INCOMPLETE/i, "Rebuild the fixed unpacked extension, manually Reload it, complete a fresh pairing and repair only the one loopback WebSocket chain."],
  [/BROWSER_RUNTIME_VERIFY_FAILED|BROWSER_ARTIFACT_|BROWSER_RELEASE_/i, "Run the explicit browserctl verify/doctor path and repair the installed Browser Runtime before rerunning npm run grasseye:start."],
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
