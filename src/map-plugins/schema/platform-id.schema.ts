import { z } from "zod";

export const MAP_PLUGIN_REQUESTED_PLATFORM_IDS = ["tiktok-web", "facebook-web"] as const;

export const RequestedPlatformIdSchema = z.enum(MAP_PLUGIN_REQUESTED_PLATFORM_IDS);