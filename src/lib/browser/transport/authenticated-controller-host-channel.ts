import type { BrowserRawControllerHostChannel } from "./raw-controller-host-channel.js";

export type BrowserAuthenticatedControllerHostChannel = Readonly<{
  generation: number;
  sourceChannelToken: string;
  sendAuthenticated(frame: Uint8Array): Promise<void>;
  close(reasonCode: string): Promise<void>;
}>;

export const authenticateControllerHostChannel = (
  channel: BrowserRawControllerHostChannel,
  generation: number,
  sourceChannelToken: string,
): BrowserAuthenticatedControllerHostChannel => ({
  generation,
  sourceChannelToken,
  sendAuthenticated: async (frame) => channel.send(frame),
  close: async (reasonCode) => channel.close(reasonCode),
});
