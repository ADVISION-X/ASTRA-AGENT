export async function probeHealth({
  url = "http://127.0.0.1:4173/api/runtime/health",
}) {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`health endpoint returned HTTP ${response.status}`);
  }

  return await response.json();
}

export async function waitForHealth({
  url = "http://127.0.0.1:4173/api/runtime/health",
  timeoutMs = 30000,
  intervalMs = 500,
  serviceProcess,
}) {
  const deadline = Date.now() + timeoutMs;
  let lastFailure = "health endpoint not ready";

  while (Date.now() < deadline) {
    if (serviceProcess && serviceProcess.exitCode !== null) {
      throw new Error(`Local service exited before health check passed with code ${serviceProcess.exitCode}.`);
    }

    try {
      return await probeHealth({ url });
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for health check at ${url}: ${lastFailure}`);
}