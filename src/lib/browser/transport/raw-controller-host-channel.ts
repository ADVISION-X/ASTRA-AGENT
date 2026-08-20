export type BrowserRawControllerHostChannel = Readonly<{
  send(frame: Uint8Array): Promise<void>;
  close(reasonCode: string): Promise<void>;
}>;
