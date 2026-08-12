import { register } from "tsx/esm/api";

const unregister = register();
try {
  await import("./run-generated-plan-worker.ts");
} finally {
  await unregister();
}
