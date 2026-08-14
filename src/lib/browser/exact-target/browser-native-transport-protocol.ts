export const GRASSEYE_BROWSER_MAX_MESSAGE_BYTES = 4 * 1024 * 1024;

export {
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireMessage,
  type BrowserWireMutationClass,
  type BrowserWireTargetDescriptor,
} from "../chrome-extension/protocol.js";
