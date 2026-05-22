import type { VideoDownloadChildCapabilityId } from "../schema.js";

const PLATFORM_ROUTES: Array<{ hosts: string[]; child: VideoDownloadChildCapabilityId }> = [
  { hosts: ["facebook.com", "fb.watch", "m.facebook.com"], child: "download-facebook-video-once" },
  { hosts: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"], child: "download-tiktok-video-once" },
  { hosts: ["instagram.com", "www.instagram.com"], child: "download-instagram-video-once" },
  { hosts: ["bilibili.com", "www.bilibili.com", "b23.tv", "m.bilibili.com"], child: "download-bilibili-video-once" },
  { hosts: ["douyin.com", "www.douyin.com", "iesdouyin.com"], child: "download-douyin-video-once" },
  { hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"], child: "download-x-video-once" },
  { hosts: ["xiaohongshu.com", "www.xiaohongshu.com", "xhslink.com"], child: "download-xiaohongshu-video-once" },
  { hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "youtu.be"], child: "download-youtube-video-once" },
  { hosts: ["web.telegram.org"], child: "download-telegram-web-video-once" },
];

/**
 * Maps a source page URL host to the most appropriate child capability ID.
 * Pure URL-to-ID mapping — no DOM access, no network requests.
 */
export const routeToChildCapability = (sourcePageUrl: string): VideoDownloadChildCapabilityId => {
  let host: string;
  try {
    host = new URL(sourcePageUrl).hostname.toLowerCase();
  } catch {
    return "download-web-video-once";
  }

  for (const route of PLATFORM_ROUTES) {
    if (route.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return route.child;
    }
  }
  return "download-web-video-once";
};
