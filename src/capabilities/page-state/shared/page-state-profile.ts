export type PageStatePlatformProfile = {
  profileId: string;
  kind: "real_platform" | "local_workbench";
  hosts: readonly string[];
  feedPathPrefixes: readonly string[];
  videoPathMarkers: readonly string[];
};

export const DEFAULT_PAGE_STATE_PLATFORM_PROFILES: readonly PageStatePlatformProfile[] = [
  {
    profileId: "tiktok-web",
    kind: "real_platform",
    hosts: ["www.tiktok.com", "tiktok.com", "m.tiktok.com"],
    feedPathPrefixes: ["/", "/foryou", "/following", "/@"],
    videoPathMarkers: ["/video/"],
  },
  {
    profileId: "facebook-web",
    kind: "real_platform",
    hosts: ["www.facebook.com", "facebook.com", "m.facebook.com"],
    feedPathPrefixes: ["/", "/watch", "/reel/"],
    videoPathMarkers: ["/watch", "/reel/"],
  },
  {
    profileId: "local-workbench",
    kind: "local_workbench",
    hosts: ["localhost", "127.0.0.1"],
    feedPathPrefixes: ["/", "/workbench"],
    videoPathMarkers: ["/workbench"],
  },
];