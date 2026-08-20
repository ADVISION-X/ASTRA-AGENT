import { BROWSER_CONTROL_FRAME_MAX_BYTES } from "../protocol/generated/browser-protocol.generated.js";

export const encodeBrowserControlFrame = (payload: unknown): Uint8Array => {
  const frame = Buffer.from(JSON.stringify(payload), "utf8");
  if (frame.byteLength > BROWSER_CONTROL_FRAME_MAX_BYTES) throw new Error("BROWSER_BACKPRESSURE");
  return frame;
};

export const decodeBrowserControlFrame = (frame: Uint8Array): unknown => {
  if (frame.byteLength > BROWSER_CONTROL_FRAME_MAX_BYTES) throw new Error("BROWSER_BACKPRESSURE");
  return JSON.parse(Buffer.from(frame).toString("utf8")) as unknown;
};
