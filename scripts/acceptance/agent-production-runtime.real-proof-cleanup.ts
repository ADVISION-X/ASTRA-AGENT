export type ProductionProofCleanupObservation = Readonly<{
  browserContextClosed: boolean;
  cleanupVerified: boolean;
  workbenchStopped: boolean;
}>;

type CleanupCheck = Readonly<{
  label: string;
  run: (() => Promise<boolean>) | null;
}>;

export const observeProductionProofCleanup = async (
  workbench: CleanupCheck["run"], browserContext: CleanupCheck["run"],
): Promise<ProductionProofCleanupObservation> => {
  const failures: Error[] = [];
  const attempt = async ({ label, run }: CleanupCheck): Promise<boolean> => {
    if (run === null) return true;
    try {
      if (await run()) return true;
      failures.push(new Error(`${label}:post-condition-false`));
    } catch (error) {
      failures.push(error instanceof Error ? error : new Error(`${label}:${String(error)}`));
    }
    return false;
  };
  const workbenchStopped = await attempt({ label: "workbench", run: workbench });
  const browserContextClosed = await attempt({ label: "browser-context", run: browserContext });
  if (failures.length > 0) {
    throw new AggregateError(failures, "AGENT_PRODUCTION_DYNAMIC_PROOF_CLEANUP_FAILED");
  }
  return Object.freeze({
    browserContextClosed,
    cleanupVerified: workbenchStopped && browserContextClosed,
    workbenchStopped,
  });
};
