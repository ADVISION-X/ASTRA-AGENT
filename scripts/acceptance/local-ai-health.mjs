import { checkLocalAiReadiness, loadLocalAiConfig } from "../../dist/src/lib/local-ai/index.js";

const main = async () => {
  const config = await loadLocalAiConfig();
  const result = await checkLocalAiReadiness(config);

  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    ok: result.status === "ready",
    detail: result.detail,
    health: {
      overallStatus: result.status,
      endpointReachable: result.endpointReachable,
      modelConfigured: result.modelConfigured,
      modelAvailable: result.modelAvailable,
      modelName: config.modelName,
      runtimeName: config.runtimeName,
    },
  }, null, 2)}\n`);

  if (result.status !== "ready") {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});