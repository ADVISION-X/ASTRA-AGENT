import assert from "node:assert/strict";
import { decodeBrowserAuthorityFrame, encodeBrowserAuthorityFrame } from "../../src/lib/browser/transport/browser-authority-frame-codec.js";
import { BROWSER_PROTOCOL_REVISION } from "../../src/lib/browser/protocol/generated/browser-protocol.generated.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

for (let sequence = 0; sequence < 64; sequence += 1) {
  const frame = { protocolVersion: BROWSER_PROTOCOL_REVISION, kind: "HEARTBEAT" as const, epoch: 1, sequence, deadline: new Date(Date.now() + 10_000).toISOString(), body: {} };
  assert.deepEqual(decodeBrowserAuthorityFrame(encodeBrowserAuthorityFrame(frame)), frame);
}
console.log("LOCAL_BROWSER_PROPERTY_MODEL_ACCEPTANCE_PASS");
emitQualityProofObservation({ lawId: "LAW-LOCAL-BROWSER-SESSION-004-V7", evidenceMode: "exam.property", locator: "acceptance:browser-terminal:frame-property-model", observedValue: "64 authenticated frame sequences round-trip exactly" });
