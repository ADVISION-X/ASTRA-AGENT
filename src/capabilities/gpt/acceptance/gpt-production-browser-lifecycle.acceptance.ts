import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";

await import("./gpt-production-browser-wait.acceptance-support.js");
await import("./gpt-production-browser-mismatch.acceptance-support.js");
await import("./gpt-production-artifact-recovery.acceptance-support.js");
await import("./gpt-settled-conversation-rename.acceptance.js");

emitQualityProofObservation({
  lawId: "LAW-GPT-002-V19", evidenceMode: "exam.property",
  clauses: ["forbidden:1", "forbidden:2", "forbidden:4", "forbidden:6", "forbidden:7"],
  locator: "acceptance:gpt:frozen-submit-properties",
  observedValue: "attachment effect identity and text-response third-gate mutants fail closed",
});
emitQualityProofObservation({
  lawId: "LAW-GPT-002-V19", evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:3", "forbidden:5", "forbidden:6", "summary"],
  locator: "acceptance:gpt:confirmed-readback-state-machine",
  observedValue: "pending releases the lease stop survives deadline and confirmed recovery performs zero submit",
});
