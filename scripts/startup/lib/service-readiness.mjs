const waitForDelay = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

async function probeHealth(healthUrl, expectedSourceFingerprint) {
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(`Local workbench health returned HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "unknown";
  const healthReport = await response.json();
  if (!isWorkbenchHealthReport(healthReport)) {
    throw new Error("Local workbench health did not return a GrassEye health report.");
  }
  if (healthReport.status !== "healthy") {
    throw new Error(`Local workbench health is not ready: ${healthReport.status}`);
  }
  if (
    expectedSourceFingerprint
    && healthReport.sourceFingerprint !== expectedSourceFingerprint
  ) {
    throw new Error("Local workbench health source fingerprint is stale.");
  }
  return { contentType, status: healthReport.status };
}

function isWorkbenchHealthReport(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "status" in value &&
    (value.status === "healthy" || value.status === "degraded") &&
    "checkedAt" in value &&
    typeof value.checkedAt === "string" &&
    "sourceFingerprint" in value &&
    typeof value.sourceFingerprint === "string" &&
    "components" in value &&
    Array.isArray(value.components)
  );
}

export async function waitForWorkbenchHealth({
  baseUrl,
  attempts = 120,
  delayMs = 500,
  toFailureReason,
  expectedSourceFingerprint,
  onStarted,
  onPassed,
}) {
  const healthStart = Date.now();
  const healthUrl = `${baseUrl}/api/health`;
  onStarted?.({ healthUrl });
  let lastFailureReason = "health probe did not run";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const health = await probeHealth(healthUrl, expectedSourceFingerprint);
      onPassed?.({
        healthUrl,
        contentType: health.contentType,
        status: health.status,
        attempt,
        durationMs: Date.now() - healthStart,
      });
      return;
    } catch (error) {
      lastFailureReason = toFailureReason(error);
      await waitForDelay(delayMs);
    }
  }

  throw new Error(`Local workbench health readiness failed: ${lastFailureReason}`);
}
