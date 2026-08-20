export const GRASSEYE_BROWSER_CONTROLLER_HOST_MAX_MESSAGE_BYTES =
  64 * 1024 * 1024;

export {
  GRASSEYE_BROWSER_EXTENSION_TO_HOST_MAX_BYTES,
  GRASSEYE_BROWSER_HOST_TO_EXTENSION_MAX_BYTES,
  GRASSEYE_BROWSER_PROTOCOL_VERSION,
  GRASSEYE_BROWSER_RELEASE_IDENTITY,
  GRASSEYE_NATIVE_HOST_NAME,
  isBrowserWireMessage,
  type BrowserWireCommand,
  type BrowserWireCommandPayload,
  type BrowserWireCommandPermit,
  type BrowserWireMessage,
  type BrowserWireMutationClass,
  type BrowserWireResponsePayload,
  type BrowserWireTargetDescriptor,
} from "../chrome-extension/protocol.js";
