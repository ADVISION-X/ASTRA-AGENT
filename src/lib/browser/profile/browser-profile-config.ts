import { join } from "node:path";

export const GRASSEYE_BROWSER_EXTENSION_ID = "emkmbecadncngofidjgocmifhbonifgm";
export const GRASSEYE_BROWSER_EXTENSION_UPDATE_URL = "https://clients2.google.com/service/update2/crx";

export type BrowserProfileConfig = Readonly<{
  profileRef: string;
  profileDir: string;
  extensionId: string;
  extensionUpdateUrl: string;
}>;

export const resolveProductionBrowserProfileConfig = (dataDir: string): BrowserProfileConfig => ({
  profileRef: "grasseye-managed-browser-profile-v1",
  profileDir: join(dataDir, "browser", "profile"),
  extensionId: GRASSEYE_BROWSER_EXTENSION_ID,
  extensionUpdateUrl: GRASSEYE_BROWSER_EXTENSION_UPDATE_URL,
});
