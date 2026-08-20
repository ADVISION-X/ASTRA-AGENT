import { spawnSync } from "node:child_process";

const SERVICE = "com.grasseye.browser.install-identity";

const run = (command: string, args: string[]): string => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `INSTALL_IDENTITY_REPAIR_REQUIRED:${command}:${result.stderr || result.error?.message || result.status}`,
    );
  }
  return result.stdout.trim();
};

export const readBrowserInstallIdentitySecret = (): Buffer => {
  if (process.platform === "darwin") {
    const value = run("/usr/bin/security", [
      "find-generic-password",
      "-w",
      "-s",
      SERVICE,
    ]);
    if (!value)
      throw new Error("INSTALL_IDENTITY_REPAIR_REQUIRED:empty credential");
    return Buffer.from(value, "base64url");
  }
  if (process.platform === "linux") {
    const value = run("/usr/bin/secret-tool", [
      "lookup",
      "service",
      SERVICE,
      "key",
      "install-identity",
    ]);
    if (!value)
      throw new Error("INSTALL_IDENTITY_REPAIR_REQUIRED:empty credential");
    return Buffer.from(value, "base64url");
  }
  throw new Error(
    `INSTALL_IDENTITY_REPAIR_REQUIRED:unsupported platform ${process.platform}`,
  );
};
