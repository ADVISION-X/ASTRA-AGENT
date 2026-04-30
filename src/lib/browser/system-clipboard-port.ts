import { spawn } from "node:child_process";

import type { ClipboardPort, ClipboardReadResult, ClipboardWriteResult } from "../../capabilities/text-input/ports/clipboard-port.js";
import { hashTextValue } from "../../capabilities/text-input/shared/text-input-types.js";
import { createId } from "../local-runtime/ids.js";

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
    async readText(): Promise<ClipboardReadResult> {
      try {
        const text = await readClipboardText();
        return {
          ok: true,
          text,
          snapshotRef: createId("clipboard_snapshot"),
          textHash: hashTextValue(text),
          textLength: text.length,
          capturedAt: new Date().toISOString(),
          message: "clipboard read succeeded",
          portKind: "system-clipboard",
        };
      } catch (error) {
        return {
          ok: false,
          text: null,
          snapshotRef: null,
          textHash: null,
          textLength: null,
          capturedAt: null,
          message: error instanceof Error ? error.message : "clipboard read failed",
          portKind: "system-clipboard",
        };
      }
    },
    async writeText(text: string): Promise<ClipboardWriteResult> {
      try {
        await writeClipboardText(text);
        return {
          ok: true,
          snapshotRef: createId("clipboard_write"),
          textHash: hashTextValue(text),
          textLength: text.length,
          writtenAt: new Date().toISOString(),
          message: "clipboard write succeeded",
          portKind: "system-clipboard",
        };
      } catch (error) {
        return {
          ok: false,
          snapshotRef: null,
          textHash: null,
          textLength: null,
          writtenAt: null,
          message: error instanceof Error ? error.message : "clipboard write failed",
          portKind: "system-clipboard",
        };
      }
    },
  };
}