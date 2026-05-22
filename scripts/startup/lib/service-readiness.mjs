const waitForDelay = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

async function probeHealth(healthUrl) {
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(`Local workbench health returned HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "unknown";
  const healthReport = await response.json();
  if (!isWorkbenchHealthReport(healthReport)) {
    throw new Error("Local workbench health did not return a GrassEye health report.");
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
    "components" in value &&
    Array.isArray(value.components)
  );
}

export async function probeExistingWorkbench({ baseUrl, toFailureReason }) {
  const healthUrl = `${baseUrl}/api/health`;
  try {
    const health = await probeHealth(healthUrl);
    return {
      mounted: true,
      healthUrl,
      contentType: health.contentType,
      status: health.status,
      failureReason: null,
    };
  } catch (error) {
    return {
      mounted: false,
      healthUrl,
      contentType: null,
      status: null,
      failureReason: toFailureReason(error),
    };
  }
}

export async function waitForWorkbenchHealth({
  baseUrl,
  attempts = 20,
  delayMs = 250,
  toFailureReason,
  onStarted,
  onPassed,
}) {
  const healthStart = Date.now();
  const healthUrl = `${baseUrl}/api/health`;
  onStarted?.({ healthUrl });
  let lastFailureReason = "health probe did not run";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const health = await probeHealth(healthUrl);
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
