export type PageStatePlatformProfile = {
  profileId: string;
  kind: "real_platform" | "local_workbench";
  hosts: readonly string[];
  videoPathMarkers: readonly string[];
};

export const DEFAULT_PAGE_STATE_PLATFORM_PROFILES: readonly PageStatePlatformProfile[] = [
  {
    profileId: "tiktok-web",
    kind: "real_platform",
    hosts: ["www.tiktok.com", "tiktok.com", "m.tiktok.com"],
    videoPathMarkers: ["/video/"],
  },
  {
    profileId: "facebook-web",
    kind: "real_platform",
    hosts: ["www.facebook.com", "facebook.com", "m.facebook.com"],
    videoPathMarkers: ["/watch", "/reel/"],
  },
  {
    profileId: "local-workbench",
    kind: "local_workbench",
    hosts: ["localhost", "127.0.0.1"],
    videoPathMarkers: ["/workbench"],
  },
  {
    profileId: "macos-local",
    kind: "real_platform",
    hosts: ["iphone-mirroring"],
    videoPathMarkers: ["/"],
  },
  {
    profileId: "iphone-mirroring-facebook-app",
    kind: "real_platform",
    hosts: ["iphone-mirroring"],
    videoPathMarkers: ["/facebook"],
  },
  {
    profileId: "iphone-mirroring-tiktok-app",
    kind: "real_platform",
    hosts: ["iphone-mirroring"],
    videoPathMarkers: ["/tiktok"],
  },
];

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  const lowered = pathname.toLowerCase();
  return lowered.endsWith("/") && lowered !== "/" ? lowered.slice(0, -1) : lowered;
}

export function resolvePageStatePlatformProfile(profileId: string): PageStatePlatformProfile | null {
  return DEFAULT_PAGE_STATE_PLATFORM_PROFILES.find((profile) => profile.profileId === profileId) ?? null;
}

export function urlMatchesPlatformHost(currentUrl: string, profile: PageStatePlatformProfile): boolean {
  const parsed = new URL(currentUrl);
  const host = normalizeHost(parsed.hostname);
  return profile.hosts.some((candidateHost) => normalizeHost(candidateHost) === host);
}

export function urlMatchesVideoPath(currentUrl: string, profile: PageStatePlatformProfile): boolean {
  const parsed = new URL(currentUrl);
  const pathname = normalizePathname(parsed.pathname);
  return profile.videoPathMarkers.some((marker) => {
    const normalizedMarker = normalizePathname(marker);
    return pathname === normalizedMarker || pathname.startsWith(`${normalizedMarker}/`) || pathname.includes(normalizedMarker);
  });
}

export function isLocalWorkbenchUrl(currentUrl: string): boolean {
  const parsed = new URL(currentUrl);
  const host = normalizeHost(parsed.hostname);
  return host === "localhost" || host === "127.0.0.1";
}
