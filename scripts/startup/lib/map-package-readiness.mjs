import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const probeScriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "map-package-readiness-probe.ts");

const parseProbeOutput = (stdout, stderr) => {
  const jsonLine = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  if (!jsonLine) {
    throw new Error(stderr.trim() || "Map package startup readiness probe produced no JSON output.");
  }
  return JSON.parse(jsonLine);
};

export async function ensureMapPackageReadiness({ logger = () => {} } = {}) {
  return await new Promise((resolve, reject) => {
    const stdoutChunks = [];
    const stderrChunks = [];
    const child = spawn("node", ["--import", "tsx", probeScriptPath], {
      env: { ...process.env, TSX_DISABLE_CACHE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });
    child.stderr.on("data", (chunk) => {
      const text = Buffer.from(chunk).toString("utf8").trim();
      if (text.length > 0) {
        logger(text);
      }
      stderrChunks.push(Buffer.from(chunk));
    });
    child.once("error", reject);
    child.once("close", () => {
      try {
        resolve(parseProbeOutput(Buffer.concat(stdoutChunks).toString("utf8"), Buffer.concat(stderrChunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
  });
}
