import type { BrowserProfileConfig } from "./browser-profile-config.js";

export type BrowserDedicatedProfilePolicy = Readonly<{
  profileRef: string;
  extensionId: string;
  extensionUpdateUrl: string;
  disallowDefaultProfile: true;
}>;

export const createDedicatedProfilePolicy = (config: BrowserProfileConfig): BrowserDedicatedProfilePolicy => ({
  profileRef: config.profileRef,
  extensionId: config.extensionId,
  extensionUpdateUrl: config.extensionUpdateUrl,
  disallowDefaultProfile: true,
});
