const ACCEPTED_SHELL_MARKER_SETS = [
  {
    name: "commander_console_full_page_shell",
    markers: [
      'class="cc-topbar"',
      'data-page="command-center"',
      'data-page="mission-cockpit"',
      'data-drawer-root',
      'window.__grasseyeCommanderConsoleViewModel',
    ],
  },
  {
    name: "commander_console_app_router_shell",
    markers: [
      'class="cc-mac-shell"',
      'data-app-shell',
      'data-app-router',
      'data-app-page-host',
      'window.__grasseyeCommanderConsoleViewModel',
      'window.__grasseyeCommanderAppViewModel',
    ],
  },
];

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

function assertCommanderConsoleResponse(response) {
  if (!response.ok) {
    throw new Error(`Commander Console returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Commander Console returned unexpected content-type: ${contentType || "unknown"}`);
  }

  return contentType;
}

function findMatchingShellTopology(html) {
  return ACCEPTED_SHELL_MARKER_SETS.find((candidate) => candidate.markers.every((marker) => html.includes(marker))) ?? null;
}

function buildUnsupportedShellMessage(html) {
  const markerSummary = ACCEPTED_SHELL_MARKER_SETS
    .map((candidate) => {
      const missing = candidate.markers.filter((marker) => !html.includes(marker));
      return `${candidate.name} missing: ${missing.join(", ")}`;
    })
    .join(" | ");

  return `Commander Console is serving an unsupported shell topology. ${markerSummary}`;
}

export async function probeCommanderConsolePage({
  url = "http://127.0.0.1:4173/",
}) {
  const response = await fetch(url, {
    headers: { accept: "text/html" },
  });

  const contentType = assertCommanderConsoleResponse(response);
  const html = await response.text();
  const matchingShell = findMatchingShellTopology(html);

  if (!matchingShell) {
    throw new Error(buildUnsupportedShellMessage(html));
  }

  return {
    status: response.status,
    contentType,
    shellTopology: matchingShell.name,
  };
}

function getFailingComponents(report) {
  if (!Array.isArray(report?.components)) {
    return [];
  }

  return report.components.filter((component) => component?.ok !== true);
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
      const report = await probeHealth({ url });
      const failingComponents = getFailingComponents(report);
      if (failingComponents.length === 0) {
        return report;
      }
      lastFailure = `components not ready: ${failingComponents.map((component) => `${component.name}:${component.detail}`).join("; ")}`;
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for health check at ${url}: ${lastFailure}`);
}