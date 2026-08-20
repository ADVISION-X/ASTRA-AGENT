import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const releaseDir = dirname(fileURLToPath(import.meta.url));
const browserDir = dirname(releaseDir);
const destination = join(process.cwd(), ".grasseye-local", "browser-artifacts");
const inputs = [
  join(browserDir, "protocol", "browser-protocol.schema.json"),
  join(browserDir, "protocol", "browser-capabilities.json"),
  join(browserDir, "chrome-extension", "manifest.json"),
  join(browserDir, "native-messaging-host", "Cargo.lock"),
];
const files = await Promise.all(inputs.map(async (path) => ({ path: path.slice(browserDir.length + 1), sha256: `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}` })));
const artifactSetHash = `sha256:${createHash("sha256").update(JSON.stringify(files)).digest("hex")}`;
await mkdir(destination, { recursive: true });
await writeFile(join(destination, "artifact-set.unsigned.json"), JSON.stringify({ artifactSetHash, files, createdAt: new Date().toISOString(), status: "UNSIGNED_NOT_ACTIVATABLE" }, null, 2) + "\n");
console.log(JSON.stringify({ status: "UNSIGNED_NOT_ACTIVATABLE", artifactSetHash }));
