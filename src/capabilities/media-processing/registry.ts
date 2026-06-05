import type { MediaProcessingChildCapability } from "./contract.js";
import type { MediaProcessingChildCapabilityId } from "./schema.js";
import {
  generateResponsiveImageSet,
  optimizeImageForWeb,
  resizeImageForWeb,
} from "./children/image-children.js";
import {
  compressVideoForWeb,
  generateVideoPosterForWeb,
  optimizeVideoForWeb,
} from "./children/video-children.js";

const MEDIA_PROCESSING_CHILDREN: MediaProcessingChildCapability[] = [
  optimizeImageForWeb,
  resizeImageForWeb,
  generateResponsiveImageSet,
  optimizeVideoForWeb,
  compressVideoForWeb,
  generateVideoPosterForWeb,
];

export const listMediaProcessingChildren = (): MediaProcessingChildCapabilityId[] =>
  MEDIA_PROCESSING_CHILDREN.map((child) => child.childCapabilityId);

export const createMediaProcessingCapabilityRegistry = (): ReadonlyMap<
  MediaProcessingChildCapabilityId,
  MediaProcessingChildCapability
> => new Map(MEDIA_PROCESSING_CHILDREN.map((child) => [
    child.childCapabilityId,
    child,
  ]));
