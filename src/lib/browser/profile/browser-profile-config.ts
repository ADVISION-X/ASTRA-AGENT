import { join } from "node:path";

export type BrowserProfileConfig = Readonly<{
  profileRef: string;
  profileDir: string;
  extensionId: string;
  extensionUpdateUrl: string;
}>;

export const resolveProductionBrowserProfileConfig = (dataDir: string): BrowserProfileConfig => ({
  profileRef: "grasseye-managed-browser-profile-v1",
  profileDir: join(dataDir, "browser", "profile"),
  extensionId: "grasseye_browser_authority",
  extensionUpdateUrl: "https://updates.invalid/grasseye-browser-authority.xml",
});
