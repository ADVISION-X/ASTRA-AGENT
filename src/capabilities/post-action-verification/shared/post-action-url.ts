function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function normalizePathname(pathname: string): string[] {
  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function buildPostActionUrlFailure(okReason: "invalid_current_url" | "invalid_expected_prefix" | "host_mismatch" | "prefix_mismatch") {
  return { ok: false as const, reason: okReason };
}

function isSameOrigin(left: URL, right: URL): boolean {
  return left.protocol === right.protocol && left.hostname === right.hostname && left.port === right.port;
}

function pathStartsWith(expectedSegments: string[], currentSegments: string[]): boolean {
  return expectedSegments.every((segment, index) => currentSegments[index] === segment);
}

function resolveCurrentPostActionUrl(input: string) {
  const currentUrl = normalizePostActionUrl(input);
  if (currentUrl === null) {
    return buildPostActionUrlFailure("invalid_current_url");
  }

  return { currentUrl };
}

function verifyPostActionUrlHost(currentUrl: URL, expectedUrlHost: string | null) {
  if (expectedUrlHost === null) {
    return { ok: true as const };
  }

  const expectedHost = normalizeHostname(expectedUrlHost);
  if (currentUrl.hostname !== expectedHost) {
    return buildPostActionUrlFailure("host_mismatch");
  }

  return { ok: true as const };
}

function verifyPostActionUrlPrefix(currentUrl: URL, expectedUrlPrefix: string | null) {
  if (expectedUrlPrefix === null) {
    return { ok: true as const };
  }

  const expectedPrefix = normalizePostActionUrl(expectedUrlPrefix);
  if (expectedPrefix === null) {
    return buildPostActionUrlFailure("invalid_expected_prefix");
  }

  if (!isSameOrigin(currentUrl, expectedPrefix)) {
    return buildPostActionUrlFailure("prefix_mismatch");
  }

  if (!pathStartsWith(normalizePathname(expectedPrefix.pathname), normalizePathname(currentUrl.pathname))) {
    return buildPostActionUrlFailure("prefix_mismatch");
  }

  return { ok: true as const };
}

function resolvePostActionUrlVerification(input: {
  currentUrl: string;
  expectedUrlHost: string | null;
  expectedUrlPrefix: string | null;
}) {
  const currentUrlResult = resolveCurrentPostActionUrl(input.currentUrl);
  if ("reason" in currentUrlResult) {
    return currentUrlResult;
  }

  const hostResult = verifyPostActionUrlHost(currentUrlResult.currentUrl, input.expectedUrlHost);
  if ("reason" in hostResult) {
    return hostResult;
  }

  const prefixResult = verifyPostActionUrlPrefix(currentUrlResult.currentUrl, input.expectedUrlPrefix);
  if ("reason" in prefixResult) {
    return prefixResult;
  }

  return { ok: true as const, reason: null as const };
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
  return resolvePostActionUrlVerification(input);
}