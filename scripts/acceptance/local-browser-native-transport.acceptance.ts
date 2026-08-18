import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { BrowserNativeTransportServer } from "../../src/lib/browser/exact-target/browser-native-transport-server.js";

const root = await mkdtemp(path.join(tmpdir(), "grasseye-browser-transport-"));
const lifecycleStages: string[] = [];
const socketPath = path.join(root, "controller.sock");
const server = new BrowserNativeTransportServer(
  "acceptance-controller",
  socketPath,
  "acceptance-profile",
  (event) => lifecycleStages.push(event.stage),
);

try {
  await server.start();
  assert.deepEqual(lifecycleStages, ["listener_ready"]);
  assert.equal(server.authoritySnapshot().state, "AUTHORITY_ABSENT");

  const duplicate = new BrowserNativeTransportServer(
    "duplicate-controller",
    socketPath,
    "acceptance-profile",
  );
  await assert.rejects(
    duplicate.start(),
    /BROWSER_CONTROLLER_ALREADY_OWNED/u,
    "a second Native transport owner must fail closed",
  );
  await duplicate.close();
  assert.deepEqual(lifecycleStages, ["listener_ready"]);
} finally {
  await server.close();
}

process.stdout.write("local-browser-native-transport acceptance: PASS\n");
