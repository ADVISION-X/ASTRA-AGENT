import { z } from "zod";

export const VisualOnlyRuntimeModeSchema = z.enum([
  "visual_only_real_platform",
  "fixture_only",
  "unsupported",
]);

export const PageUnderstandingSourceSchema = z.enum([
  "screenshot",
  "ocr",
  "local_visual_ai",
  "visual_target_detection",
]);

export const ForbiddenPageUnderstandingSourceSchema = z.enum([
  "dom",
  "bom",
  "selector",
  "innerText",
  "textContent",
  "accessibility_tree_default",
  "storageState",
  "cookies",
]);

export const VisualOnlyRuntimePolicySchema = z.object({
  mode: VisualOnlyRuntimeModeSchema,
  allowedSources: z.array(PageUnderstandingSourceSchema).min(1),
  forbiddenSources: z.array(ForbiddenPageUnderstandingSourceSchema).min(1),
  browserInfrastructureAllowed: z.array(z.string().min(1)).min(1),
  domFallbackAllowed: z.literal(false),
  selectorActionAllowed: z.literal(false),
  commentDomExtractionAllowed: z.literal(false),
  metricDomExtractionAllowed: z.literal(false),
});

export const VisualOnlyRuntimePolicy = VisualOnlyRuntimePolicySchema.parse({
  mode: "visual_only_real_platform",
  allowedSources: ["screenshot", "ocr", "local_visual_ai", "visual_target_detection"],
  forbiddenSources: ["dom", "bom", "selector", "innerText", "textContent", "accessibility_tree_default", "storageState", "cookies"],
  browserInfrastructureAllowed: [
    "launch_local_real_chrome",
    "persistent_user_data_dir",
    "open_url",
    "get_current_url",
    "get_viewport_geometry",
    "take_screenshot",
    "coordinate_mouse_click",
    "coordinate_scroll",
    "coordinate_keyboard_input",
    "browser_health_check",
    "close_browser_process",
  ],
  domFallbackAllowed: false,
  selectorActionAllowed: false,
  commentDomExtractionAllowed: false,
  metricDomExtractionAllowed: false,
});

export type VisualOnlyRuntimeMode = z.infer<typeof VisualOnlyRuntimeModeSchema>;
export type PageUnderstandingSource = z.infer<typeof PageUnderstandingSourceSchema>;
export type ForbiddenPageUnderstandingSource = z.infer<typeof ForbiddenPageUnderstandingSourceSchema>;
export type VisualOnlyRuntimePolicy = z.infer<typeof VisualOnlyRuntimePolicySchema>;