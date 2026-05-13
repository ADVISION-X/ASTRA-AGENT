import { buildMuscleMemorySystemManual } from "../../../muscle-memory/manual.js";
import type { PlatformProfile } from "../../../platforms/platform-profile.schema.js";
import { getPlatformProfile } from "../../../platforms/platform-registry.js";
import type { VisualMissionActionPlanRequestInput } from "../../../types/visual-mission-action-plan.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolvePlatformProfile(input: VisualMissionActionPlanRequestInput): PlatformProfile {
  const platformId = (input.platformContext as { platformId?: string } | null)?.platformId ?? "facebook-web";
  const profile = getPlatformProfile(platformId as Parameters<typeof getPlatformProfile>[0]);
  if (!profile) throw new Error(`No platform profile registered for platformId: ${platformId}`);
  return profile;
}

function buildContinuitySection(input: VisualMissionActionPlanRequestInput): string {
  if (!input.roundMissionPacket) return "任务连续性包: 无";
  return [
    `连续性引用: ${input.roundMissionPacketRef ?? "无"}`,
    `连续性数据:\n${JSON.stringify(input.roundMissionPacket, null, 2)}`,
  ].join("\n");
}

// ─── Section 1 + 3 + 5 — System Prompt (static, same every call) ──────────────

const SYSTEM_PROMPT = `
# 第一段 — 你是谁

你是 GrassEye Agent，一个视觉驱动的自动化动作执行器，也是 agent 动作执行序列的指挥官。

你的职责：
1. 理解用户的任务需求
2. 观察当前页面截图和坐标网格
3. 从【子能力清单】中选择并排列正确的动作序列
4. 以 JSON 格式输出完整动作方案

你不直接执行任何动作。你输出方案后，系统会严格按你的 actions[] 顺序逐一执行。
仅返回一个合法 JSON 对象。不加 markdown 围栏、不加注释、不加多余文字。

---

# 第三段 — 你收到的图片说明

每次任务最多附带 5 张图片，编号、内容和用途如下：

| 编号  | 内容                              | 用途                                                        |
|-------|-----------------------------------|------------------------------------------------------------|
| 图片1 | 当前视口原始截图                   | 产品识别、页面状态理解                                       |
| 图片2 | 坐标网格截图（含网格行列标签）      | 选择 gridCell 的唯一来源（必须看此图来命名格子）              |
| 图片3 | 时序上下文帧（较早帧）              | 图片1内容模糊时辅助识别产品                                  |
| 图片4 | 时序上下文帧（较晚帧）              | 图片1内容模糊时辅助识别产品                                  |
| 图片5 | cellZone 精确定位参考图（非视频）   | 必须看此图，精确判断点击目标在网格单元内的 cellZone 九宫格位置 |

坐标使用规则：
- gridCell 必须且只能从图片2（坐标网格截图）中读取行列标签
- cellZone 精确位置必须参考图片5（精确定位参考图）来判断，图片5就是为了让你定位准确而提供的
- 图片1、3、4 只用于内容识别，不用于选择坐标
- 图片5 不是视频截图，禁止用图片5来分类产品内容

---

# 第五段 — 输出格式 + 硬规则

## 输出格式

返回一个平铺 JSON 对象，字段如下（不得添加额外字段）：

{
  "schemaVersion":               "visualMissionActionPlan.v1",
  "userIntentUnderstanding":     { "matched": boolean, "summary": string },
  "platform":                    string,
  "isTargetPlatform":            boolean,
  "surface":                     string,
  "isTargetFeed":                boolean,
  "pageStateDecision":           "ready" | "recover" | "review_required" | "blocked",
  "isProductVideo":              boolean,
  "productDecision":             "product_yes" | "product_no" | "uncertain",
  "confidence":                  number (0.0–1.0),
  "visibleProductTypes":         string[],
  "visualEvidence":              string[],
  "reason":                      string,
  "actions":                     Action[],
  "visibleInteractiveElements":  VisibleElement[],
  "nonExecutableClickTargets":   [{ "gridCell": string, "targetName": string }],
  "riskFlags":                   string[],
  "nonExecutableSummary":        string
}

每个 Action 对象：
{
  "actionCode":  string,
  "required":    boolean,
  "targetRole":  "like_button" | "comments_button" | "comments_panel_close" |
                 "next_video_surface" | "next_video_arrow" | "unknown" | null,
  "reason":      string,
  "input":       object
}

每个 VisibleElement 对象（视觉扫描结果，必须如实填写，与业务决策无关）：
{
  "elementType": string,   // 元素类型，例如: button | input | icon | link | video | image | text
  "label":       string,   // 元素上的可见文字或图标描述，例如: "👍 1,124" / "搜索" / "关注"
  "gridCell":    string,   // 从图片2读取的坐标，例如: "H7"
  "cellZone":    string    // 可选，元素在格子内的精确位置，例如: "top_center"
}

## 硬规则（任意一条违反 = 整个输出无效，系统拒绝执行）

1. actionCode 必须精确复制自子能力清单，禁止发明、缩写、翻译或重命名
2. 每个点击/鼠标动作必须包含 input.gridCell（从图片2读取，格式：A–H行 + 1–8列）
3. 有点击目标但找不到有效 gridCell 时，不要输出该点击动作；必须输出 STOP_REVIEW_REQUIRED_ONCE 或选择一个独立、合法、可解释的原子能力
4. cellZone 使用下划线格式（top_center），禁止连字符（top-center）
5. 所有枚举字段只填机器值，禁止填写自然语言描述
6. visualEvidence 至少1条，禁止返回空数组
7. actions[] 必须包含完整有序序列，禁止只返回第一步
8. nonExecutableSummary 若无内容填 "none"，禁止为空字符串
9. 产品识别使用图片1–4；gridCell 只从图片2选取；cellZone 必须参考图片5精确定位
10. visibleInteractiveElements 必须填写，禁止返回空数组；无论做何业务决策，必须先扫描并如实列出图片2中所有可见的可交互元素（按钮、输入框、图标、链接等）及其坐标
`.trim();

// ─── Section 2 + 4 — User Prompt (dynamic, injected per call) ─────────────────

function buildPlatformSection(profile: PlatformProfile): string {
  const likeApprovedKey = profile.likeApprovedKey
    ?? (profile.likeActionHint === "PRESS_APPROVED_KEY_ONCE" ? "L" : null);

  const likeHintLine = profile.likeActionHint
    ? `  点赞目标 (like_button)     → 推荐: ${profile.likeActionHint}${likeApprovedKey ? `  (approvedKey: "${likeApprovedKey}")` : ""}`
    : "  点赞目标 (like_button)     → 无平台提示";

  const nextVideoHintLine = profile.nextVideoPreferredActionCode
    ? `  跳下一视频 (next_video)    → 推荐: ${profile.nextVideoPreferredActionCode}  (approvedKey: "ArrowDown")`
    : "  跳下一视频 (next_video)    → 无平台提示";

  const commentsHintLine = profile.commentsActionHint
    ? `  打开评论 (comments_button) → 推荐: ${profile.commentsActionHint}`
    : "  打开评论 (comments_button) → 无平台提示";

  return [
    `平台标识: ${profile.platformId}`,
    `平台名称: ${profile.displayName}`,
    "",
    "平台行为提示（由平台档案自动注入，不同平台此处不同）：",
    likeHintLine,
    nextVideoHintLine,
    commentsHintLine,
    "",
    "本平台已注册支持的 actionCode（只能从此列表选）：",
    profile.supportedActionCodes.join(" | "),
  ].join("\n");
}

function buildUserPrompt(input: VisualMissionActionPlanRequestInput): string {
  const manual = buildMuscleMemorySystemManual();
  const profile = resolvePlatformProfile(input);

  return [
    "# 第二段 — 用户需求",
    "",
    "## 用户任务需求",
    input.userRequirementText,
    "",
    "## 当前运行平台",
    buildPlatformSection(profile),
    "",
    "## 任务连续性包",
    buildContinuitySection(input),
    "",
    "## 视觉证据引用",
    `原始截图引用: ${input.originalScreenshotRef}`,
    `坐标网格截图引用: ${input.coordinateGridScreenshotRef}`,
    `网格规格引用: ${input.gridSpecRef}`,
    "",
    "---",
    "",
    "# 第四段 — 子能力清单 + 物理动作原理",
    "",
    `系统手册引用: ${manual.systemManualRef}`,
    `目录版本: ${manual.catalogVersion}`,
    "",
    "以下是全部已注册的原子动作。每个动作的 physicalSemantics 描述其真实的物理行为，请在选择动作前仔细阅读，选错物理含义会导致执行失败。",
    "",
    manual.text,
    "",
    "选择规则：",
    "1. actionCode 精确复制，禁止自造",
    "2. 必须填写 aiRequiredInput 中列出的全部字段",
    "3. 禁止填写 forbiddenInput 中的任何字段",
    "4. 有候选值的字段只能从候选值中选",
    "",
    `输出协议引用: ${input.outputSchemaRef}`,
  ].join("\n");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function buildVisualMissionJudgePrompt(input: VisualMissionActionPlanRequestInput) {
  const userPrompt = buildUserPrompt(input);
  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    fullPrompt: [SYSTEM_PROMPT, userPrompt].join("\n\n"),
  };
}

export { buildVisualMissionJudgePrompt };
