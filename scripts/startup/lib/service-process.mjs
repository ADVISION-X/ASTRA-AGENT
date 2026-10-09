import { spawn } from "node:child_process";

function relay(stream, write) {
  if (!stream || !write) return;
  let remainder = "";
  stream.setEncoding("utf8");
  stream.on("data", chunk => {
    const lines = (remainder + chunk).split(/\r?\n/u);
    remainder = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) write(line);
  });
  stream.on("end", () => { if (remainder.trim()) write(remainder); });
}

export function startLocalService({ rootDir, env = {}, onStdoutLine, onStderrLine }) {
  const child = spawn(process.execPath, ["--import", "tsx", "src/app/server.ts"], {
    cwd: rootDir, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"],
  });
  const started = new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  const closed = new Promise(resolve => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  relay(child.stdout, onStdoutLine);
  relay(child.stderr, onStderrLine);
  let stopping;
  return {
    child, started, waitForExit: () => closed,
    stop(signal) {
      stopping ??= started.then(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill(signal);
        return closed;
      });
      return stopping;
    },
  };
}
