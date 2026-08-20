import { chmodSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";

import { BrowserOwnerLock } from "../infrastructure/browser-owner-lock.js";
import type { BrowserTransportEvent } from "./transport-event.js";
import type { TransportActorRuntime } from "./transport-actor-runtime.js";

type LifecycleInput = Readonly<{
  dataDir: string;
  socketPath: string;
  ownerLockHelperPath: string;
  supervisorEpoch: number;
  processEpoch: number;
  runtime: TransportActorRuntime;
  applyEvent(event: BrowserTransportEvent): void;
  accept(socket: net.Socket): void;
}>;

export const startTransportActorLifecycle = async (
  input: LifecycleInput,
): Promise<void> => {
  beginTransportControlState(input);
  input.runtime.ownerLock = await acquireOwnerLock(input);
  cleanupStaleSocket(input);
  input.runtime.server = await bindTransportServer(input);
  input.applyEvent({
    type: "OWNER_BOUND",
    supervisorEpoch: input.supervisorEpoch,
  });
};

const beginTransportControlState = (input: LifecycleInput): void => {
  input.applyEvent({ type: "START", supervisorEpoch: input.supervisorEpoch });
  input.applyEvent({
    type: "INSTALL_VERIFIED",
    supervisorEpoch: input.supervisorEpoch,
  });
  input.applyEvent({
    type: "CHROME_STARTED",
    supervisorEpoch: input.supervisorEpoch,
    processEpoch: input.processEpoch,
  });
};

const acquireOwnerLock = (input: LifecycleInput): Promise<BrowserOwnerLock> =>
  BrowserOwnerLock.acquire({
    helperPath: input.ownerLockHelperPath,
    lockPath: path.join(
      input.dataDir,
      "browser-runtime",
      "controller-owner.lock",
    ),
  });

const cleanupStaleSocket = (input: LifecycleInput): void => {
  if (!input.runtime.ownerLock?.isAlive())
    throw new Error("BROWSER_CONTROLLER_ALREADY_OWNED");
  try {
    const current = lstatSync(input.socketPath);
    if (!current.isSocket())
      throw new Error("BROWSER_CONTROLLER_SOCKET_IDENTITY_INVALID");
    if ((current.mode & 0o077) !== 0)
      throw new Error("BROWSER_CONTROLLER_SOCKET_PERMISSION_INVALID");
    if (
      typeof process.geteuid === "function" &&
      current.uid !== process.geteuid()
    )
      throw new Error("BROWSER_CONTROLLER_SOCKET_OWNER_INVALID");
    rmSync(input.socketPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

const bindTransportServer = async (
  input: LifecycleInput,
): Promise<net.Server> => {
  mkdirSync(path.dirname(input.socketPath), { recursive: true, mode: 0o700 });
  const server = net.createServer((socket) => input.accept(socket));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.socketPath, resolve);
  });
  chmodSync(input.socketPath, 0o600);
  return server;
};

export const stopTransportActorLifecycle = async (
  input: Readonly<{
    runtime: TransportActorRuntime;
    socketPath: string;
  }>,
): Promise<void> => {
  if (input.runtime.server) {
    await new Promise<void>((resolve) =>
      input.runtime.server!.close(() => resolve()),
    );
  }
  input.runtime.server = null;
  if (input.runtime.ownerLock?.isAlive()) {
    try {
      rmSync(input.socketPath, { force: true });
    } catch {
      // The exclusive owner lock proves this cleanup target belongs to this actor.
    }
  }
  await input.runtime.ownerLock?.release();
  input.runtime.ownerLock = null;
};
