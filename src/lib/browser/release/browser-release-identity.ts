export const GRASSEYE_BROWSER_PROTOCOL_VERSION = "grasseye-browser-v2" as const;
export const GRASSEYE_BROWSER_RELEASE_IDENTITY = "grasseye-browser-runtime-2026-08-18-v2" as const;
export const GRASSEYE_BROWSER_EXTENSION_ID = "mepfnlhndaiihhfejbbhfehegpbdnipl" as const;
export const GRASSEYE_BROWSER_EXTENSION_VERSION = "2.0.0" as const;
export const GRASSEYE_NATIVE_HOST_NAME = "com.grasseye.browser" as const;
export const GRASSEYE_BROWSER_MINIMUM_CHROME_VERSION = "120" as const;
export const GRASSEYE_BROWSER_RELEASE_SEQUENCE = 2 as const;
export const GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE = 2 as const;

export type BrowserReleaseIdentity = Readonly<{
  releaseIdentity: typeof GRASSEYE_BROWSER_RELEASE_IDENTITY;
  protocolVersion: typeof GRASSEYE_BROWSER_PROTOCOL_VERSION;
  extensionId: typeof GRASSEYE_BROWSER_EXTENSION_ID;
  extensionVersion: typeof GRASSEYE_BROWSER_EXTENSION_VERSION;
  nativeHostName: typeof GRASSEYE_NATIVE_HOST_NAME;
  minimumChromeVersion: typeof GRASSEYE_BROWSER_MINIMUM_CHROME_VERSION;
}>;

export const BROWSER_RELEASE_IDENTITY: BrowserReleaseIdentity = Object.freeze({
  releaseIdentity: GRASSEYE_BROWSER_RELEASE_IDENTITY,
  protocolVersion: GRASSEYE_BROWSER_PROTOCOL_VERSION,
  extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
  extensionVersion: GRASSEYE_BROWSER_EXTENSION_VERSION,
  nativeHostName: GRASSEYE_NATIVE_HOST_NAME,
  minimumChromeVersion: GRASSEYE_BROWSER_MINIMUM_CHROME_VERSION,
});
