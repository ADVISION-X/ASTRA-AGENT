import type { MediaProcessingChildCapability } from "./contract.js";
import type { MediaProcessingChildCapabilityId } from "./schema.js";
import {
  createGenerateResponsiveImageSet,
  createOptimizeImageForWeb,
  createResizeImageForWeb,
} from "./children/image-children.js";
import {
  createCompressVideoForWeb,
  createGenerateVideoPosterForWeb,
  createOptimizeVideoForWeb,
} from "./children/video-children.js";

const MEDIA_PROCESSING_CHILDREN: MediaProcessingChildCapability[] = [
  createOptimizeImageForWeb(),
  createResizeImageForWeb(),
  createGenerateResponsiveImageSet(),
  createOptimizeVideoForWeb(),
  createCompressVideoForWeb(),
  createGenerateVideoPosterForWeb(),
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
