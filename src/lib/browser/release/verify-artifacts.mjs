import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const releaseDir = dirname(fileURLToPath(import.meta.url));
const activation = JSON.parse(await readFile(join(releaseDir, "active-activation.json"), "utf8"));
if (activation.state !== "ABSENT") throw new Error("BROWSER_ACTIVATION_TUPLE_INVALID");
console.log("BROWSER_RELEASE_SLOT_ABSENT_PASS");
