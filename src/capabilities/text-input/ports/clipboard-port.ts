export type ClipboardReadResult = {
  ok: boolean;
  text: string | null;
  snapshotRef: string | null;
  textHash: string | null;
  textLength: number | null;
  capturedAt: string | null;
  message: string;
  portKind: string;
};

export type ClipboardWriteResult = {
  ok: boolean;
  snapshotRef: string | null;
  textHash: string | null;
  textLength: number | null;
  writtenAt: string | null;
  message: string;
  portKind: string;
};

export interface ClipboardPort {
  readText(): Promise<ClipboardReadResult>;
  writeText(text: string): Promise<ClipboardWriteResult>;
}