import { resolve } from "node:path";
import { ASTRA_BROWSER_EXTENSION_ID, ASTRA_BROWSER_PROFILE_REF, ASTRA_DATA_DIRECTORY } from "./browser-application-identity.js";

export const GRASSEYE_BROWSER_EXTENSION_ID = ASTRA_BROWSER_EXTENSION_ID;

export type BrowserProfileConfig = Readonly<{
  profileRef: string;
  extensionId: string;
  unpackedExtensionDirectory: string;
}>;

export const resolveProductionBrowserProfileConfig = (): BrowserProfileConfig => ({
  profileRef: ASTRA_BROWSER_PROFILE_REF,
  extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
  unpackedExtensionDirectory: resolve(process.cwd(), ASTRA_DATA_DIRECTORY, "browser-build", "extension"),
});
