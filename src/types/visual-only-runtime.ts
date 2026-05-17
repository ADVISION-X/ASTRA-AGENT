import { z } from "zod";

const VisualOnlyRuntimeModeSchema = z.enum([
  "visual_only_real_platform",
  "fixture_only",
  "unsupported",
]);

const PageUnderstandingSourceSchema = z.enum([
  "screenshot",
  "coordinate_grid",
  "local_visual_ai",
]);

const ForbiddenPageUnderstandingSourceSchema = z.enum([
  "dom",
  "bom",
  "selector",
  "innerText",
  "textContent",
  "accessibility_tree_default",
  "storageState",
  "cookies",
]);

const VisualOnlyRuntimePolicySchema = z.object({
  mode: VisualOnlyRuntimeModeSchema,
  allowedSources: z.array(PageUnderstandingSourceSchema).min(1),
  forbiddenSources: z.array(ForbiddenPageUnderstandingSourceSchema).min(1),
  browserInfrastructureAllowed: z.array(z.string().min(1)).min(1),
  domAccessAllowed: z.literal(false),
  selectorActionAllowed: z.literal(false),
  commentDomExtractionAllowed: z.literal(false),
  metricDomExtractionAllowed: z.literal(false),
});

const VisualOnlyRuntimePolicy = VisualOnlyRuntimePolicySchema.parse({
  mode: "visual_only_real_platform",
  allowedSources: ["screenshot", "coordinate_grid", "local_visual_ai"],
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
  domAccessAllowed: false,
  selectorActionAllowed: false,
  commentDomExtractionAllowed: false,
  metricDomExtractionAllowed: false,
});

type VisualOnlyRuntimeMode = z.infer<typeof VisualOnlyRuntimeModeSchema>;
type PageUnderstandingSource = z.infer<typeof PageUnderstandingSourceSchema>;
type ForbiddenPageUnderstandingSource = z.infer<typeof ForbiddenPageUnderstandingSourceSchema>;
type VisualOnlyRuntimePolicyShape = z.infer<typeof VisualOnlyRuntimePolicySchema>;

export { VisualOnlyRuntimeModeSchema, PageUnderstandingSourceSchema, ForbiddenPageUnderstandingSourceSchema, VisualOnlyRuntimePolicySchema, VisualOnlyRuntimePolicy };
export type { VisualOnlyRuntimeMode, PageUnderstandingSource, ForbiddenPageUnderstandingSource, VisualOnlyRuntimePolicyShape };
