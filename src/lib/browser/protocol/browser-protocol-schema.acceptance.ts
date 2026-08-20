import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const protocolDir = dirname(fileURLToPath(import.meta.url));
const protocol = JSON.parse(await readFile(join(protocolDir, "browser-protocol.schema.json"), "utf8"));
const errors = JSON.parse(await readFile(join(protocolDir, "browser-errors.json"), "utf8"));
assert.equal(protocol.controlFrameMaxBytes, 256 * 1024);
assert.equal(protocol.artifactChunkMaxBytes, 4 * 1024 * 1024);
assert.equal(protocol.commandAdmission.maxQueuedCommands > 0, true);
assert.equal(protocol.commandAdmission.maxInFlightCommands, 1);
assert.equal(new Set(errors.codes).size, 23);
assert.equal(errors.codes.includes("BROWSER_LIVENESS_EXPIRED"), true);
console.log("BROWSER_PROTOCOL_SCHEMA_ACCEPTANCE_PASS");
