import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

import { LocalAiRuntimeError } from "../local-ai-runtime-error.js";

type JsonInit = RequestInit & { timeoutMs?: number };

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

export async function fetchJsonWithTimeout(url: string, init: JsonInit = {}): Promise<unknown> {
  const timeoutMs = init.timeoutMs ?? 10_000;
  const controller = init.signal ? null : new AbortController();
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort(`Local AI runtime timed out after ${timeoutMs}ms.`), timeoutMs)
    : null;
  const { timeoutMs: _timeoutMs, ...requestInit } = init;

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: init.signal ?? controller?.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(requestInit.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new LocalAiRuntimeError(
        "service_unreachable",
        `Local AI runtime request failed with HTTP ${response.status}.`,
        await response.text(),
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof LocalAiRuntimeError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new LocalAiRuntimeError("service_unreachable", `Local AI runtime is unreachable: ${message}`);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
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

export async function runCommand(command: string, args: string[], timeoutMs = 10_000, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = signal ? null : setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(new LocalAiRuntimeError("service_unreachable", `${command} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    const cleanup = () => {
      if (timer !== null) {
        clearTimeout(timer);
      }
      signal?.removeEventListener("abort", handleAbort);
    };

    const resolveOnce = (value: string) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const rejectOnce = (error: LocalAiRuntimeError) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const handleAbort = () => {
      child.kill("SIGTERM");
      rejectOnce(new LocalAiRuntimeError("service_unreachable", typeof signal?.reason === "string" ? signal.reason : `${command} aborted.`));
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", (error) => {
      rejectOnce(new LocalAiRuntimeError("engine_missing", error.message));
    });
    child.once("exit", (code) => {
      if (code === 0) {
        resolveOnce(stdout.trim());
        return;
      }
      rejectOnce(new LocalAiRuntimeError("engine_missing", stderr.trim() || `${command} exited with code ${code ?? "unknown"}.`));
    });
  });
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