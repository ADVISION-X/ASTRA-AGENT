import { LocalAiGateway } from "../../dist/src/lib/local-ai/local-ai-gateway.js";

const main = async () => {
  const gateway = new LocalAiGateway();
  const report = await gateway.getHealth();

  process.stdout.write(`${JSON.stringify({
    generatedAt: new Date().toISOString(),
    ok: report.ok,
    detail: report.detail,
    health: report.health,
  }, null, 2)}\n`);

  if (report.health.overallStatus !== "ready") {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});