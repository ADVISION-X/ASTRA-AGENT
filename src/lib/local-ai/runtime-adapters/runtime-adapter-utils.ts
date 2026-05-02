import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";

type JsonInit = RequestInit & { timeoutMs?: number };
type ExecFileError = Error & {
  code?: string | number;
  killed?: boolean;
  signal?: NodeJS.Signals | null;
  stderr?: string | Buffer;
};

type JsonScannerState = {
  startIndex: number;
  depth: number;
  inString: boolean;
  escaping: boolean;
};

const createJsonScannerState = (): JsonScannerState => ({
  startIndex: -1,
  depth: 0,
  inString: false,
  escaping: false,
});

const consumeEscapingToken = (state: JsonScannerState, char: string): boolean => {
  if (state.escaping) {
    state.escaping = false;
    return true;
  }
  if (char === "\\") {
    state.escaping = true;
    return true;
  }
  if (char === '"') {
    state.inString = !state.inString;
    return true;
  }
  return state.inString;
};

const consumeBraceToken = (state: JsonScannerState, char: string, index: number, text: string): string | null => {
  if (char === "{") {
    if (state.depth === 0) {
      state.startIndex = index;
    }
    state.depth += 1;
    return null;
  }

  if (char !== "}") {
    return null;
  }

  state.depth -= 1;
  if (state.depth === 0 && state.startIndex >= 0) {
    return text.slice(state.startIndex, index + 1);
  }

  return null;
};

const debugRuntimeAdapterUtil = (message: string): void => {
  if (process.env.GRASSEYE_AUDIT_DEBUG === "1") {
    process.stdout.write(`[local-ai:runtime-utils] ${message}\n`);
  }
};

const execFileAsync = promisify(execFile);

function createFetchTimeoutContext(timeoutMs: number, signal?: AbortSignal | null) {
  if (signal) {
    return {
      requestSignal: signal,
      clear: () => undefined,
    };
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(`Local AI runtime timed out after ${timeoutMs}ms.`), timeoutMs);
  return {
    requestSignal: controller.signal,
    clear: () => clearTimeout(timeoutHandle),
  };
}

function buildJsonRequestInit(init: JsonInit, requestSignal: AbortSignal): RequestInit {
  const { timeoutMs: _timeoutMs, ...requestInit } = init;
  return {
    ...requestInit,
    signal: requestSignal,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(requestInit.headers ?? {}),
    },
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new LocalAiRuntimeError(
      "service_unreachable",
      `Local AI runtime request failed with HTTP ${response.status}.`,
      await response.text(),
    );
  }

  return response.json();
}

function toServiceUnreachableError(error: unknown): LocalAiRuntimeError {
  const message = error instanceof Error ? error.message : String(error);
  return new LocalAiRuntimeError("service_unreachable", `Local AI runtime is unreachable: ${message}`);
}

export async function fetchJsonWithTimeout(url: string, init: JsonInit = {}): Promise<unknown> {
  const timeoutMs = init.timeoutMs ?? 10_000;
  const timeoutContext = createFetchTimeoutContext(timeoutMs, init.signal);

  try {
    const response = await fetch(url, buildJsonRequestInit(init, timeoutContext.requestSignal));
    return await parseJsonResponse(response);
  } catch (error) {
    if (error instanceof LocalAiRuntimeError) {
      throw error;
    }
    throw toServiceUnreachableError(error);
  } finally {
    timeoutContext.clear();
  }
}

export async function readImageAsBase64(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return buffer.toString("base64");
}

export function extractFirstJsonObject(text: string): string {
  const state = createJsonScannerState();

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === undefined) {
      continue;
    }
    if (consumeEscapingToken(state, char)) {
      continue;
    }

    const extracted = consumeBraceToken(state, char, index, text);
    if (extracted) {
      return extracted;
    }
  }

  throw new LocalAiRuntimeError("invalid_output", "Local AI runtime did not return a JSON object.", text);
}

function getExecFileStderr(error: ExecFileError): string {
  if (typeof error.stderr === "string") {
    return error.stderr.trim();
  }
  if (error.stderr instanceof Buffer) {
    return error.stderr.toString("utf8").trim();
  }
  return "";
}

function getAbortCommandMessage(command: string, signal: AbortSignal | undefined): string {
  return typeof signal?.reason === "string" ? signal.reason : `${command} aborted.`;
}

function isCommandTimeoutError(error: ExecFileError): boolean {
  return error.killed === true || error.signal === "SIGTERM" || error.code === "ETIMEDOUT";
}

function getRunCommandFailureMessage(error: unknown): string {
  const execError = error as ExecFileError;
  return getExecFileStderr(execError) || (error instanceof Error ? error.message : String(error));
}

function toRunCommandError(input: {
  command: string;
  timeoutMs: number;
  signal: AbortSignal | undefined;
  error: unknown;
}): LocalAiRuntimeError {
  if (input.error instanceof Error && input.error.name === "AbortError") {
    return new LocalAiRuntimeError("service_unreachable", getAbortCommandMessage(input.command, input.signal));
  }
  if (isCommandTimeoutError(input.error as ExecFileError)) {
    return new LocalAiRuntimeError("service_unreachable", `${input.command} timed out after ${input.timeoutMs}ms.`);
  }
  return new LocalAiRuntimeError("engine_missing", getRunCommandFailureMessage(input.error));
}

export async function runCommand(command: string, args: string[], timeoutMs = 10_000, signal?: AbortSignal): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      encoding: "utf8",
      timeout: timeoutMs,
      ...(signal ? { signal } : {}),
    });
    return stdout.trim();
  } catch (error) {
    throw toRunCommandError({ command, timeoutMs, signal, error });
  }
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    await runCommand("which", [command], 3_000);
    return true;
  } catch (error) {
    debugRuntimeAdapterUtil(`commandExists fallback for ${command}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}