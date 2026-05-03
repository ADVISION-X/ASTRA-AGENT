import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import path from "node:path";

import { ensureDirectory } from "./json-utils.mjs";

function getNowIso() {
  return new Date().toISOString();
}

function resolveCommandCwd(options) {
  return options.cwd ?? process.cwd();
}

function resolveEnvWhitelist(options) {
  if (Array.isArray(options.envWhitelist)) {
    return options.envWhitelist;
  }

  return Object.keys(options.env ?? {}).sort();
}

async function ensureOutputTargets(stdoutPath, stderrPath) {
  const targets = [stdoutPath, stderrPath].filter(Boolean);
  await Promise.all(targets.map((filePath) => ensureDirectory(path.dirname(filePath))));
}

function createResult(input) {
  return {
    command: input.command,
    args: input.args,
    cwd: input.cwd,
    envWhitelist: input.envWhitelist,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMs: input.durationMs,
    exitCode: input.exitCode,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    timedOut: input.timedOut,
    signal: input.signal,
    stdout: input.stdout,
    stderr: input.stderr,
    failureReason: input.failureReason,
  };
}

function createFailureReason(error, timedOut, signal) {
  if (timedOut) {
    return `command timed out${signal ? ` and exited with signal ${signal}` : ""}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return signal ? `command exited with signal ${signal}` : null;
}

async function closeStream(stream) {
  if (!stream) {
    return;
  }

  stream.end();
  await once(stream, "finish");
}

function createOutputStreams(stdoutPath, stderrPath) {
  if (stdoutPath && stderrPath && stdoutPath === stderrPath) {
    const mergedStream = createWriteStream(stdoutPath, { flags: "w" });
    return {
      stdoutStream: mergedStream,
      stderrStream: mergedStream,
      uniqueStreams: [mergedStream],
    };
  }

  const stdoutStream = stdoutPath ? createWriteStream(stdoutPath, { flags: "w" }) : null;
  const stderrStream = stderrPath ? createWriteStream(stderrPath, { flags: "w" }) : null;
  return {
    stdoutStream,
    stderrStream,
    uniqueStreams: [stdoutStream, stderrStream].filter(Boolean),
  };
}

function appendOutputChunk(chunks, stream, chunk) {
  const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
  chunks.push(buffer);
  stream?.write(buffer);
}

function createCompletedCommandResult(input) {
  return createResult({
    command: input.command,
    args: input.args,
    cwd: input.cwd,
    envWhitelist: input.envWhitelist,
    startTime: input.startTime,
    endTime: getNowIso(),
    durationMs: Date.now() - input.startTimestamp,
    exitCode: input.exitCode,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    timedOut: input.timedOut,
    signal: input.signal ?? null,
    stdout: Buffer.concat(input.stdoutChunks).toString("utf8"),
    stderr: Buffer.concat(input.stderrChunks).toString("utf8"),
    failureReason: createFailureReason(input.error, input.timedOut, input.signal ?? null),
  });
}

async function settleRunCommand(state, uniqueStreams, resolve, resultFactory) {
  if (state.settled) {
    return;
  }

  state.settled = true;
  if (state.timeoutHandle) {
    clearTimeout(state.timeoutHandle);
  }

  await Promise.all(uniqueStreams.map((stream) => closeStream(stream)));
  resolve(resultFactory());
}

function createSpawnOptions(cwd, options) {
  return {
    cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    shell: options.shell === true,
    stdio: ["ignore", "pipe", "pipe"],
  };
}

function attachOutputStream(streamSource, chunks, stream) {
  streamSource?.on("data", (chunk) => {
    appendOutputChunk(chunks, stream, chunk);
  });
}

function attachChildLifecycle(child, finish) {
  child.on("error", (error) => {
    finish({ exitCode: 1, signal: null, error });
  });

  child.on("close", (exitCode, signal) => {
    finish({ exitCode: typeof exitCode === "number" ? exitCode : 1, signal, error: null });
  });
}

function scheduleCommandTimeout(child, timeoutMs, state) {
  if (typeof timeoutMs !== "number" || timeoutMs <= 0) {
    return;
  }

  state.timeoutHandle = setTimeout(() => {
    state.timedOut = true;
    child.kill("SIGTERM");
  }, timeoutMs);
}

function executeSpawnedCommand(input) {
  return new Promise((resolve) => {
    const state = { settled: false, timedOut: false, timeoutHandle: null };
    const stdoutChunks = [];
    const stderrChunks = [];
    const { stdoutStream, stderrStream, uniqueStreams } = createOutputStreams(input.stdoutPath, input.stderrPath);
    const child = spawn(input.command, input.args, createSpawnOptions(input.cwd, input.options));
    const finish = (result) => void settleRunCommand(state, uniqueStreams, resolve, () =>
      createCompletedCommandResult({
        ...input,
        exitCode: result.exitCode,
        timedOut: state.timedOut,
        signal: result.signal,
        stdoutChunks,
        stderrChunks,
        error: result.error,
      }),
    );

    attachOutputStream(child.stdout, stdoutChunks, stdoutStream);
    attachOutputStream(child.stderr, stderrChunks, stderrStream);
    attachChildLifecycle(child, finish);
    scheduleCommandTimeout(child, input.options.timeoutMs, state);
  });
}

export async function runCommand(command, args = [], options = {}) {
  const cwd = resolveCommandCwd(options);
  const envWhitelist = resolveEnvWhitelist(options);
  const startTimestamp = Date.now();
  const startTime = getNowIso();
  const stdoutPath = options.stdoutPath ?? null;
  const stderrPath = options.stderrPath ?? null;

  await ensureOutputTargets(stdoutPath, stderrPath);

  return executeSpawnedCommand({ command, args, options, cwd, envWhitelist, startTime, startTimestamp, stdoutPath, stderrPath });
}