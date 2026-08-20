import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BrowserWireMutationClass } from "../protocol/generated/browser-protocol.js";

export type BrowserMutationIntentState =
  | "PREPARED"
  | "TERMINAL_SUCCESS"
  | "TERMINAL_FAILURE"
  | "OUTCOME_UNKNOWN";

export type BrowserMutationIntentRecord = Readonly<{
  schemaVersion: "browser-mutation-intent.v1";
  state: BrowserMutationIntentState;
  commandId: string;
  authorityCertificateHash: `sha256:${string}`;
  executionFenceHash: `sha256:${string}`;
  mutationClass: Exclude<BrowserWireMutationClass, "observation">;
  payloadHash: `sha256:${string}`;
  recordedAt: string;
}>;

const hashPayload = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

const line = (record: BrowserMutationIntentRecord): string => `${JSON.stringify(record)}\n`;

export class BrowserMutationIntentJournal {
  private readonly journalPath: string;

  constructor(dataDir: string) {
    this.journalPath = path.join(dataDir, "browser-runtime", "mutation-intent.jsonl");
  }

  async prepare(input: {
    commandId: string;
    authorityCertificateHash: `sha256:${string}`;
    executionFenceHash: `sha256:${string}`;
    mutationClass: Exclude<BrowserWireMutationClass, "observation">;
    payload: unknown;
  }): Promise<void> {
    await this.append({
      schemaVersion: "browser-mutation-intent.v1",
      state: "PREPARED",
      commandId: input.commandId,
      authorityCertificateHash: input.authorityCertificateHash,
      executionFenceHash: input.executionFenceHash,
      mutationClass: input.mutationClass,
      payloadHash: hashPayload(input.payload),
      recordedAt: new Date().toISOString(),
    });
  }

  async terminal(input: {
    commandId: string;
    authorityCertificateHash: `sha256:${string}`;
    executionFenceHash: `sha256:${string}`;
    mutationClass: Exclude<BrowserWireMutationClass, "observation">;
    payloadHash: `sha256:${string}`;
    state: Exclude<BrowserMutationIntentState, "PREPARED">;
  }): Promise<void> {
    await this.append({
      schemaVersion: "browser-mutation-intent.v1",
      ...input,
      recordedAt: new Date().toISOString(),
    });
  }

  async unresolvedPrepared(): Promise<BrowserMutationIntentRecord[]> {
    let text = "";
    try { text = await readFile(this.journalPath, "utf8"); } catch { return []; }
    const byCommand = new Map<string, BrowserMutationIntentRecord>();
    for (const raw of text.split("\n")) {
      if (!raw) continue;
      const record = JSON.parse(raw) as BrowserMutationIntentRecord;
      byCommand.set(record.commandId, record);
    }
    return [...byCommand.values()].filter((record) => record.state === "PREPARED");
  }

  async compactTerminalOnly(): Promise<void> {
    let text = "";
    try { text = await readFile(this.journalPath, "utf8"); } catch { return; }
    const latest = new Map<string, BrowserMutationIntentRecord>();
    for (const raw of text.split("\n")) {
      if (!raw) continue;
      const record = JSON.parse(raw) as BrowserMutationIntentRecord;
      latest.set(record.commandId, record);
    }
    const terminal = [...latest.values()].filter((record) => record.state !== "PREPARED");
    const temp = `${this.journalPath}.tmp`;
    await mkdir(path.dirname(this.journalPath), { recursive: true, mode: 0o700 });
    await writeFile(temp, terminal.map(line).join(""), { mode: 0o600 });
    await rename(temp, this.journalPath);
  }

  private async append(record: BrowserMutationIntentRecord): Promise<void> {
    await mkdir(path.dirname(this.journalPath), { recursive: true, mode: 0o700 });
    const handle = await open(this.journalPath, "a", 0o600);
    try {
      await handle.write(line(record));
      await handle.sync();
      const file = await stat(this.journalPath);
      if ((file.mode & 0o077) !== 0) {
        throw new Error("BROWSER_MUTATION_JOURNAL_PERMISSION_INVALID");
      }
    } finally {
      await handle.close();
    }
  }
}
