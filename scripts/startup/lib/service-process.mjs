import { spawn } from "node:child_process";

import { getDefaultNpmCommand } from "./dependency-check.mjs";

function wirePrefixedStream(stream, prefix, writer) {
  if (!stream) {
    return;
  }

  let buffered = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      writer(`${prefix} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffered.length > 0) {
      writer(`${prefix} ${buffered}\n`);
    }
  });
}

export async function startLocalService({
  rootDir,
  npmCommand = getDefaultNpmCommand(),
  scriptName = "start",
}) {
  const child = spawn(npmCommand, ["run", scriptName], {
    cwd: rootDir,
    env: process.env,
    detached: true,
    stdio: ["ignore", "ignore", "ignore"],
  });

  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });

  const waitForExit = () =>
    new Promise((resolve) => {
      child.once("exit", (code, signal) => {
        resolve({ code, signal });
      });
    });

  return { child, waitForExit };
}

export function releaseLocalService(child) {
  if (!child) {
    return;
  }

  child.unref();
}

export async function stopLocalService(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    child.once("exit", () => resolve(undefined));
    child.kill(signal);
  });
}