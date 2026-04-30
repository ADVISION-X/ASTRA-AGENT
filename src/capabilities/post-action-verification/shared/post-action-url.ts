function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function normalizePathname(pathname: string): string[] {
  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function normalizePostActionUrl(rawUrl: string): URL | null {
  if (!URL.canParse(rawUrl)) {
    return null;
  }

  const parsedUrl = new URL(rawUrl);
  if (parsedUrl.username || parsedUrl.password) {
    return null;
  }

  parsedUrl.hostname = normalizeHostname(parsedUrl.hostname);
  return parsedUrl;
}

export function verifyNormalizedPostActionUrl(input: {
  currentUrl: string;
  expectedUrlHost: string | null;
  expectedUrlPrefix: string | null;
}): {
  ok: boolean;
  reason: "invalid_current_url" | "invalid_expected_prefix" | "host_mismatch" | "prefix_mismatch" | null;
} {
  const currentUrl = normalizePostActionUrl(input.currentUrl);
  if (currentUrl === null) {
    return { ok: false, reason: "invalid_current_url" };
  }

  if (input.expectedUrlHost !== null) {
    const expectedHost = normalizeHostname(input.expectedUrlHost);
    if (currentUrl.hostname !== expectedHost) {
      return { ok: false, reason: "host_mismatch" };
    }
  }

  if (input.expectedUrlPrefix !== null) {
    const expectedPrefix = normalizePostActionUrl(input.expectedUrlPrefix);
    if (expectedPrefix === null) {
      return { ok: false, reason: "invalid_expected_prefix" };
    }

    const sameOrigin = currentUrl.protocol === expectedPrefix.protocol
      && currentUrl.hostname === expectedPrefix.hostname
      && currentUrl.port === expectedPrefix.port;
    if (!sameOrigin) {
      return { ok: false, reason: "prefix_mismatch" };
    }

    const expectedSegments = normalizePathname(expectedPrefix.pathname);
    const currentSegments = normalizePathname(currentUrl.pathname);
    const pathMatches = expectedSegments.every((segment, index) => currentSegments[index] === segment);
    if (!pathMatches) {
      return { ok: false, reason: "prefix_mismatch" };
    }
  }

  return { ok: true, reason: null };
}