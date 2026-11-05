import type { BrowserProfileConfig } from "./browser-profile-config.js";

export type BrowserDedicatedProfilePolicy = Readonly<{
  profileRef: string;
  extensionId: string;
  unpackedExtensionDirectory: string;
}>;

export const createDedicatedProfilePolicy = (config: BrowserProfileConfig): BrowserDedicatedProfilePolicy => ({
  profileRef: config.profileRef,
  extensionId: config.extensionId,
  unpackedExtensionDirectory: config.unpackedExtensionDirectory,
});
