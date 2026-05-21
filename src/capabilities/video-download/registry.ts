import type {
  VideoDownloadChildCapability,
} from "./contract.js";
import type { VideoDownloadChildCapabilityId } from "./schema.js";
import { downloadFacebookVideoOnce } from "./children/download-facebook-video-once.js";

const VIDEO_DOWNLOAD_CHILDREN: VideoDownloadChildCapability[] = [
  downloadFacebookVideoOnce,
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
