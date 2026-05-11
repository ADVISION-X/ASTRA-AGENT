import { writeStartupFailureBundle } from "./startup-failure-bundle.mjs";

const FAILURE_ACTIONS = [
  [/PROMPT_CONTRACT/i, "Fix AI prompt contract integrity and rerun npm run ci:full."],
  [/MUSCLE_MEMORY_CATALOG/i, "Fix MuscleMemoryCatalog integrity and rerun npm run ci:full."],
  [/PLATFORM_REGISTRY/i, "Fix PlatformRegistry integrity and rerun npm run ci:full."],
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
