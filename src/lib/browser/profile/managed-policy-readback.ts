import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export type BrowserManagedPolicyReadbackV1 = Readonly<{
  schemaVersion: "browser-managed-policy-readback.v1";
  extensionId: string;
  installationMode: "force_installed";
  updateUrl: string;
  enabled: true;
  permissionPolicyHash: `sha256:${string}`;
  originPolicyHash: `sha256:${string}`;
  installedExtensionTreeHash: `sha256:${string}`;
  readbackAt: string;
  policyHash: `sha256:${string}`;
}>;

const hash = (value: unknown): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;

export const browserManagedPolicyReadbackPath = (): string => {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "GrassEye",
      "browser-runtime",
      "managed-policy-readback.json",
    );
  }
  if (process.platform === "linux") {
    return path.join(os.homedir(), ".config", "grasseye", "browser-runtime", "managed-policy-readback.json");
  }
  return path.join(os.homedir(), ".grasseye", "browser-runtime", "managed-policy-readback.json");
};

export const readBrowserManagedPolicyReadback = (input: {
  extensionId: string;
  permissionPolicyHash: `sha256:${string}`;
  originPolicyHash: `sha256:${string}`;
  expectedExtensionTreeHash: `sha256:${string}`;
}): BrowserManagedPolicyReadbackV1 => {
  const filePath = browserManagedPolicyReadbackPath();
  if (!existsSync(filePath)) throw new Error("BROWSER_MANAGED_POLICY_INVALID:readback missing");
  const file = statSync(filePath);
  if (!file.isFile() || (file.mode & 0o077) !== 0) {
    throw new Error("BROWSER_MANAGED_POLICY_INVALID:readback permissions");
  }
  if (typeof process.geteuid === "function" && file.uid !== process.geteuid()) {
    throw new Error("BROWSER_MANAGED_POLICY_INVALID:readback owner");
  }
  const value = JSON.parse(readFileSync(filePath, "utf8")) as BrowserManagedPolicyReadbackV1;
  const { policyHash, ...unsigned } = value;
  if (
    value.schemaVersion !== "browser-managed-policy-readback.v1"
    || value.extensionId !== input.extensionId
    || value.installationMode !== "force_installed"
    || value.enabled !== true
    || value.permissionPolicyHash !== input.permissionPolicyHash
    || value.originPolicyHash !== input.originPolicyHash
    || value.installedExtensionTreeHash !== input.expectedExtensionTreeHash
    || !value.updateUrl
    || hash(unsigned) !== policyHash
  ) {
    throw new Error("BROWSER_MANAGED_POLICY_INVALID:readback mismatch");
  }
  return Object.freeze(value);
};
