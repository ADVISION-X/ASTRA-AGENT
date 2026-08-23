import path from "node:path";

import { getListeningProcessIds, getProcessIdentity, terminateProcess, waitForDelay } from "./port-listener-ops.mjs";

const PORT_LISTENER_FOREIGN = "PORT_LISTENER_FOREIGN";
const PORT_LISTENER_IDENTITY_UNAVAILABLE = "PORT_LISTENER_IDENTITY_UNAVAILABLE";
const PORT_LISTENER_IDENTITY_CHANGED = "PORT_LISTENER_IDENTITY_CHANGED";
const PORT_OWNERSHIP_POLICY_REQUIRED = "PORT_OWNERSHIP_POLICY_REQUIRED";

function isPathInside(rootDir, candidate) {
  const relative = path.relative(path.resolve(rootDir), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function identityKey(identity) {
  return [identity.processId, identity.uid, identity.startTime, identity.cwd, identity.command].join("\u0000");
}

function assertOwnedIdentity(identity, { rootDir, allowedCommandFragments }) {
  const currentUid = typeof process.getuid === "function" ? process.getuid() : null;
  const sameUser = currentUid !== null && identity.uid === currentUid;
  const ownedCwd = isPathInside(rootDir, identity.cwd);
  const ownedCommand = allowedCommandFragments.some((fragment) => identity.command.includes(fragment));
  if (!sameUser || !ownedCwd || !ownedCommand) {
    throw new Error(`${PORT_LISTENER_FOREIGN}:pid=${identity.processId}:cwd=${identity.cwd}`);
  }
}

async function captureOwnedListeners(port, ownership) {
  const processIds = await getListeningProcessIds(port);
  const identities = [];
  for (const processId of processIds) {
    const identity = await getProcessIdentity(processId);
    if (!identity) throw new Error(`${PORT_LISTENER_IDENTITY_UNAVAILABLE}:pid=${processId}`);
    identities.push(identity);
  }
  for (const identity of identities) assertOwnedIdentity(identity, ownership);
  return identities;
}

async function signalOwnedListeners(identities, signal, ownership, logger) {
  const validated = [];
  for (const expected of identities) {
    const current = await getProcessIdentity(expected.processId);
    if (!current) continue;
    assertOwnedIdentity(current, ownership);
    if (identityKey(current) !== identityKey(expected)) {
      throw new Error(`${PORT_LISTENER_IDENTITY_CHANGED}:pid=${expected.processId}`);
    }
    validated.push(current);
  }
  for (const identity of validated) {
    if (await terminateProcess(identity.processId, signal)) {
      logger?.(`Sent ${signal} to verified repository listener PID ${identity.processId}.`);
    }
  }
}

async function clearAttempt({ host, port, attempt, attempts, waitMs, ownership, logger }) {
  const initial = await captureOwnedListeners(port, ownership);
  if (initial.length === 0) return true;

  logger?.(`Clearing verified repository listener(s) on ${host}:${port} (attempt ${attempt}/${attempts}).`);
  await signalOwnedListeners(initial, "SIGTERM", ownership, logger);
  await waitForDelay(waitMs);

  const remaining = await captureOwnedListeners(port, ownership);
  if (remaining.length === 0) return true;

  const originalKeys = new Map(initial.map((identity) => [identity.processId, identityKey(identity)]));
  for (const identity of remaining) {
    const originalKey = originalKeys.get(identity.processId);
    if (originalKey && originalKey !== identityKey(identity)) {
      throw new Error(`${PORT_LISTENER_IDENTITY_CHANGED}:pid=${identity.processId}`);
    }
  }
  await signalOwnedListeners(remaining, "SIGKILL", ownership, logger);
  await waitForDelay(waitMs);
  return (await getListeningProcessIds(port)).length === 0;
}

export async function clearPortListeners({
  host = "127.0.0.1",
  port,
  rootDir,
  allowedCommandFragments,
  attempts = 3,
  waitMs = 500,
  logger,
}) {
  if (!rootDir || !Array.isArray(allowedCommandFragments) || allowedCommandFragments.length === 0) {
    throw new Error(PORT_OWNERSHIP_POLICY_REQUIRED);
  }
  const ownership = { rootDir, allowedCommandFragments };
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (await clearAttempt({ host, port, attempt, attempts, waitMs, ownership, logger })) {
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
