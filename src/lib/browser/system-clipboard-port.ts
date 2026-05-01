import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

import type { ClipboardPort, ClipboardReadResult, ClipboardWriteResult } from "../../capabilities/text-input/ports/clipboard-port.js";

function hashClipboardText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function createClipboardRef(prefix: "clipboard_snapshot" | "clipboard_write"): string {
  return `${prefix}:${randomUUID()}`;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildReadSuccess(text: string): ClipboardReadResult {
  return {
    ok: true,
    text,
    snapshotRef: createClipboardRef("clipboard_snapshot"),
    textHash: hashClipboardText(text),
    textLength: text.length,
    capturedAt: new Date().toISOString(),
    message: "clipboard read succeeded",
    portKind: "system-clipboard",
  };
}

function buildReadFailure(error: unknown): ClipboardReadResult {
  return {
    ok: false,
    text: null,
    snapshotRef: null,
    textHash: null,
    textLength: null,
    capturedAt: null,
    message: toErrorMessage(error, "clipboard read failed"),
    portKind: "system-clipboard",
  };
}

function buildWriteSuccess(text: string): ClipboardWriteResult {
  return {
    ok: true,
    snapshotRef: createClipboardRef("clipboard_write"),
    textHash: hashClipboardText(text),
    textLength: text.length,
    writtenAt: new Date().toISOString(),
    message: "clipboard write succeeded",
    portKind: "system-clipboard",
  };
}

function buildWriteFailure(error: unknown): ClipboardWriteResult {
  return {
    ok: false,
    snapshotRef: null,
    textHash: null,
    textLength: null,
    writtenAt: null,
    message: toErrorMessage(error, "clipboard write failed"),
    portKind: "system-clipboard",
  };
}

function readClipboardText(): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("pbpaste", [], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `pbpaste exited with code ${code ?? "unknown"}`));
    });
  });
}

function writeClipboardText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";

    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `pbcopy exited with code ${code ?? "unknown"}`));
    });
    child.stdin?.end(text);
  });
}

export function createSystemClipboardPort(): ClipboardPort {
  return {
    readText(): Promise<ClipboardReadResult> {
      return readClipboardText().then(buildReadSuccess, buildReadFailure);
    },
    writeText(text: string): Promise<ClipboardWriteResult> {
      return writeClipboardText(text).then(
        () => buildWriteSuccess(text),
        buildWriteFailure,
      );
    },
  };
}