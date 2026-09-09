import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

export const emitLocalBrowserAutoPairingProofs = (): void => {
  emitQualityProofObservation({
    lawId: "LAW-LOCAL-BROWSER-SESSION-002-V6", evidenceMode: "exam.golden",
    clauses: ["forbidden:0", "forbidden:6", "forbidden:7", "forbidden:8", "summary"],
    locator: "acceptance:local-browser-terminal:auto-pairing-golden",
    observedValue: "fixed extension retrieves one in-memory pairing secret only from the exact loopback route, rejects invalid origin responses, stays single-flight, and reloads before pairing when releaseBuildId differs",
  });
  emitQualityProofObservation({
    lawId: "LAW-LOCAL-BROWSER-SESSION-003-V25", evidenceMode: "exam.golden",
    clauses: ["forbidden:1", "forbidden:13", "forbidden:2", "forbidden:3", "summary"],
    locator: "acceptance:local-browser-terminal:job-target-golden",
    observedValue: "the production authority creates one inactive ChatGPT system Tab, reuses the exact Target while present, classifies DOM missing ambiguous stale and malformed reads without BROWSER_TARGET_INVALID, and after authoritative physical loss creates exactly one inactive replacement Target without enumerating operator pages",
  });
  emitQualityProofObservation({
    lawId: "LAW-LOCAL-BROWSER-SESSION-005-V6", evidenceMode: "exam.golden",
    clauses: ["forbidden:5", "summary"],
    locator: "acceptance:local-browser-terminal:release-reload-golden",
    observedValue: "the fixed unpacked extension compares the exact governed releaseBuildId and performs one self-reload before any pairing attempt when the build differs",
  });
};
