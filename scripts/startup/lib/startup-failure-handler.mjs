import { writeStartupFailureBundle } from "./startup-failure-bundle.mjs";

const isMapPackageFailure = (failureReason) => failureReason.includes("MAP_PACKAGE");

const ownerForFailure = (failureReason) =>
  isMapPackageFailure(failureReason) ? "map-plugin-package" : "startup-entrypoint";

const actionableForFailure = (failureReason) =>
  isMapPackageFailure(failureReason)
    ? "Fix map package readiness and rerun npm run audit:map-plugin-package."
    : "Inspect startup structured logs and rerun npm run grasseye:start.";

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
