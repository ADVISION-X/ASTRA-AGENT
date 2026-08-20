import { createHash } from "node:crypto";
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

export const hashProfileConfig = (config: BrowserProfileConfig): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(config)).digest("hex")}`;
