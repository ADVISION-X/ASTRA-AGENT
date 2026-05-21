import type {
  VideoDownloadChildCapability,
} from "./contract.js";
import type { VideoDownloadChildCapabilityId } from "./schema.js";
import { downloadWebVideoOnce } from "./children/download-web-video-once.js";
import { downloadFacebookVideoOnce } from "./children/download-facebook-video-once.js";
import { downloadTikTokVideoOnce } from "./children/download-tiktok-video-once.js";
import { downloadInstagramVideoOnce } from "./children/download-instagram-video-once.js";
import { downloadBilibiliVideoOnce } from "./children/download-bilibili-video-once.js";
import { downloadDouyinVideoOnce } from "./children/download-douyin-video-once.js";
import { downloadXVideoOnce } from "./children/download-x-video-once.js";
import { downloadXiaohongshuVideoOnce } from "./children/download-xiaohongshu-video-once.js";

const VIDEO_DOWNLOAD_CHILDREN: VideoDownloadChildCapability[] = [
  downloadWebVideoOnce,
  downloadFacebookVideoOnce,
  downloadTikTokVideoOnce,
  downloadInstagramVideoOnce,
  downloadBilibiliVideoOnce,
  downloadDouyinVideoOnce,
  downloadXVideoOnce,
  downloadXiaohongshuVideoOnce,
];

export const listVideoDownloadChildren = (): VideoDownloadChildCapabilityId[] =>
  VIDEO_DOWNLOAD_CHILDREN.map((child) => child.childCapabilityId);

export const createVideoDownloadCapabilityRegistry = (): ReadonlyMap<
  VideoDownloadChildCapabilityId,
  VideoDownloadChildCapability
> => new Map(VIDEO_DOWNLOAD_CHILDREN.map((child) => [
    child.childCapabilityId,
    child,
  ]));
