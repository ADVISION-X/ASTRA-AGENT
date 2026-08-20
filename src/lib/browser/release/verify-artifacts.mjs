import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const modulePath = fileURLToPath(import.meta.url);
const releaseDir = dirname(modulePath);

export const verifyBrowserReleaseSlot = async ({
  activationPath = join(releaseDir, "active-activation.json"),
} = {}) => {
  let activation;
  try {
    activation = JSON.parse(await readFile(activationPath, "utf8"));
  } catch {
    throw new Error("BROWSER_ACTIVATION_SLOT_UNREADABLE");
  }
  if (!activation || typeof activation !== "object" || activation.state !== "ABSENT") {
    throw new Error("BROWSER_ACTIVATION_TUPLE_INVALID");
  }
  return Object.freeze({
    state: "ABSENT",
    activationPath,
  });
};

if (process.argv[1] && resolve(process.argv[1]) === modulePath) {
  await verifyBrowserReleaseSlot();
  console.log("BROWSER_RELEASE_SLOT_ABSENT_PASS");
}
