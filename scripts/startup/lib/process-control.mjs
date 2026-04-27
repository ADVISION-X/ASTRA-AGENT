import { getListeningProcessIds, terminateProcess, waitForDelay } from "./port-listener-ops.mjs";

export { releaseLocalService, startLocalService, stopLocalService } from "./service-process.mjs";

async function signalListeners(processIds, signal, logger) {
  for (const processId of processIds) {
    if (await terminateProcess(processId, signal)) {
      logger?.(`Sent ${signal} to listener PID ${processId}.`);
    }
  }
}

async function clearAttempt({ host, port, attempt, attempts, waitMs, logger }) {
  const processIds = await getListeningProcessIds(port);
  if (processIds.length === 0) {
    return true;
  }

  logger?.(`Clearing listener(s) on ${host}:${port} (attempt ${attempt}/${attempts}).`);
  await signalListeners(processIds, "SIGTERM", logger);
  await waitForDelay(waitMs);

  const remainingAfterTerm = await getListeningProcessIds(port);
  if (remainingAfterTerm.length === 0) {
    return true;
  }

  await signalListeners(remainingAfterTerm, "SIGKILL", logger);
  await waitForDelay(waitMs);
  return (await getListeningProcessIds(port)).length === 0;
}

export async function clearPortListeners({
  host = "127.0.0.1",
  port,
  attempts = 3,
  waitMs = 500,
  logger,
}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await clearAttempt({ host, port, attempt, attempts, waitMs, logger })) {
      return;
    }
  }

  const remaining = await getListeningProcessIds(port);
  if (remaining.length > 0) {
    throw new Error(
      `Could not clear ${host}:${port} before startup. Remaining listener PIDs: ${remaining.join(", ")}.`,
    );
  }
}