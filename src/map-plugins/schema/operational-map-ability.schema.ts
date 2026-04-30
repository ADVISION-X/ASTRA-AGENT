import { z } from "zod";

export const MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS = [
  "open",
  "screenshot",
  "ai",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "forensics-persistence",
  "page-state",
  "post-action-verification",
] as const;

export const MapPluginAllowedAbilityGroupIdSchema = z.enum(MAP_PLUGIN_ALLOWED_ABILITY_GROUP_IDS);