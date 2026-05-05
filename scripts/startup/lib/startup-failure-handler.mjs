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
