const FORBIDDEN_PROTOCOLS = new Set([
  "javascript:",
  "data:",
  "file:",
  "chrome:",
  "extension:",
  "about:",
]);

export function normalizeOpenUrl(input: string): URL {
  return new URL(input);
}

export function isForbiddenOpenProtocol(protocol: string): boolean {
  return FORBIDDEN_PROTOCOLS.has(protocol.toLowerCase());
}

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

export function matchesAllowedHostname(hostname: string, allowedHostnames: readonly string[]): boolean {
  const normalizedHostname = normalizeHostname(hostname);
  return allowedHostnames.some((candidate) => {
    const normalizedCandidate = normalizeHostname(candidate);
    return normalizedHostname === normalizedCandidate || normalizedHostname.endsWith(`.${normalizedCandidate}`);
  });
}

export function buildRedirectChain(targetUrl: string, openedUrl: string | null): string[] {
  if (!openedUrl || openedUrl === targetUrl) {
    return [targetUrl];
  }

  return [targetUrl, openedUrl];
}