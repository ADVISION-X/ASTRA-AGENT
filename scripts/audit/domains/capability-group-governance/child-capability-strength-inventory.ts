import { writeChildCapabilityStrengthInventory } from "./child-capability-strength-builder.js";

void writeChildCapabilityStrengthInventory().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});