import { join, resolve } from "node:path";

export const GRASSEYE_BROWSER_EXTENSION_ID = "emkmbecadncngofidjgocmifhbonifgm";

export type BrowserProfileConfig = Readonly<{
  profileRef: string;
  profileDir: string;
  extensionId: string;
  unpackedExtensionDirectory: string;
}>;

export const resolveProductionBrowserProfileConfig = (dataDir: string): BrowserProfileConfig => ({
  profileRef: "grasseye-managed-browser-profile-v1",
  profileDir: join(dataDir, "browser", "profile"),
  extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
  unpackedExtensionDirectory: resolve(process.cwd(), ".grasseye-local", "browser-build", "extension"),
});
