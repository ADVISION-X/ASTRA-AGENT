import { spawn } from "node:child_process";

import { getDefaultNpmCommand } from "./dependency-check.mjs";

function wireLineStream(stream, onLine) {
  if (!stream || !onLine) {
    return;
  }

  let buffered = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffered += chunk;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim().length > 0) {
        onLine(line);
      }
    }
  });
  stream.on("end", () => {
    if (buffered.trim().length > 0) {
      onLine(buffered);
    }
  });
}

async function runNpmScript({
  rootDir,
  npmCommand,
  scriptName,
  onStdoutLine,
  onStderrLine,
}) {
  await new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ["run", scriptName], {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    wireLineStream(child.stdout, (line) => onStdoutLine?.(line, scriptName));
    wireLineStream(child.stderr, (line) => onStderrLine?.(line, scriptName));

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`npm run ${scriptName} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function runPreStartScripts({ rootDir, npmCommand, preStartScripts, onStdoutLine, onStderrLine }) {
  for (const preStartScript of preStartScripts) {
    await runNpmScript({
      rootDir,
      npmCommand,
      scriptName: preStartScript,
      onStdoutLine,
      onStderrLine,
    });
  }
}

function buildServiceEnv(env) {
  return {
    ...process.env,
    ...env,
  };
}

function spawnLocalServiceProcess({ rootDir, npmCommand, scriptName, env }) {
  return spawn(npmCommand, ["run", scriptName], {
    cwd: rootDir,
    detached: process.platform !== "win32",
    env: buildServiceEnv(env),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForChildSpawn(child) {
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
}

export async function startLocalService({
  rootDir,
  npmCommand = getDefaultNpmCommand(),
  preStartScripts = ["build"],
  scriptName = "internal:app-server",
  env = {},
  onStdoutLine,
  onStderrLine,
}) {
  await runPreStartScripts({ rootDir, npmCommand, preStartScripts, onStdoutLine, onStderrLine });

  const child = spawnLocalServiceProcess({ rootDir, npmCommand, scriptName, env });

  wireLineStream(child.stdout, (line) => onStdoutLine?.(line, scriptName));
  wireLineStream(child.stderr, (line) => onStderrLine?.(line, scriptName));

  await waitForChildSpawn(child);

  const waitForExit = () =>
    new Promise((resolve) => {
      child.once("exit", (code, signal) => {
        resolve({ code, signal });
      });
    });

  return { child, waitForExit };
}

export async function stopLocalService(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const waitForExit = () => new Promise((resolve) => {
    child.once("exit", () => resolve(undefined));
  });

  const signalOwnedServiceTree = (requestedSignal) => {
    try {
      if (process.platform === "win32") child.kill(requestedSignal);
      else process.kill(-child.pid, requestedSignal);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
    }
  };

  signalOwnedServiceTree(signal);
  const gracefulExit = await Promise.race([
    waitForExit().then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (gracefulExit) {
    return;
  }

  signalOwnedServiceTree("SIGKILL");
  await waitForExit();
}
