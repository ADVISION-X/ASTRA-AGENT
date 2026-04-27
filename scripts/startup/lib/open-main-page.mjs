import { spawn } from "node:child_process";

export function getOpenCommand(url, platform = process.platform) {
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }

  if (platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }

  return { command: "xdg-open", args: [url] };
}

export async function openMainPage(url, platform = process.platform) {
  const { command, args } = getOpenCommand(url, platform);

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }

      reject(new Error(`Open command exited with code ${code ?? "unknown"}.`));
    });
  });
}