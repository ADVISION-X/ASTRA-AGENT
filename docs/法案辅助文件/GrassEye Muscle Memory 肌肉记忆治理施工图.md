# GrassEye Muscle Memory 肌肉记忆治理施工图

## 文件身份

本施工图是 GrassEye 肌肉记忆治理的建设级落地说明，服从 `module-map-plugin-package.instructions.md` 中的 Muscle Memory Governance FINAL。

本文件不新增 ability group，不创建平台专属 muscle，不改变 AI 语义主权。

## 核心裁决

GrassEye 的可视界面任务全部收敛到四个本能：

- Visible State Muscle: 看清当前状态
- Target Action Muscle: 对目标执行动作
- Evidence Analysis Muscle: 取证与分析
- Advance Next Item Muscle: 进入下一项

地图只做入口和 AI 交接。Route Plan 组合四大肌肉。Ability Group 执行原子动作。AI 判断语义。

## 为什么不是所有平台一套地图

地图负责启动入口、平台/目标绑定、Prompt Contract refs、AI 交接、`routePlanId` 和 fail-closed transition。

如果每个平台各写一套完整地图，地图会重新拥有评论链、点击链、证据链、下一项链和采样细节，最终变成平台脚本集合。

TikTok、Facebook、YouTube Shorts、Instagram Reels、Pinterest video feed 都是 visible surface。平台差异应由 profile、targetProfile、surfaceProfile 或 ability policy 吸收，不能把地图写重。

## 为什么不是所有平台一套 Route Plan

Route Plan 不是平台脚本，也不是第二张地图。Route Plan 负责把 AI 的 routeLabel 映射到可复用的肌肉段。

任务差异由 Route Plan 组合四大肌肉表达，平台差异不升格成 TikTok muscle、Facebook muscle、YouTube muscle、Instagram muscle 或 Mac muscle。

## 为什么只保留四个核心肌肉

四个核心肌肉覆盖可视界面自动化的最小充分闭环：

- 先看清当前状态
- 再对目标执行动作
- 再取证和分析
- 再进入下一项

`video-evidence-sampling` 是 Visible State Muscle 的 `videoSamplingMode`。

`local-window-observation` 是 Visible State Muscle 的 `localWindowMode`。

`comment-surface-evidence` 是 Evidence Analysis Muscle 的 `commentEvidenceMode`。

`next-video` 是 Advance Next Item Muscle 的 `videoFeedMode`。

这些都不得成为一级 muscle。

## 视频平台如何复用四个肌肉

视频平台统一为 visible surface：

- TikTok
- Facebook
- YouTube Shorts
- Instagram Reels
- Pinterest video feed

典型组合：

- Visible State Muscle: 打开 feed/reel/shorts，截图，准备 AI 输入，交给 AI 判断页面/视频状态。
- Target Action Muscle: 消费 AI targetCandidateRef，校验评论按钮或下一项入口的目标与坐标，执行点击/滚动/输入。
- Evidence Analysis Muscle: 截取评论区或商品区域，准备 AI 输入，交给 AI 分析，保存证据。
- Advance Next Item Muscle: 定位下一项 affordance，校验坐标，点击或滚动，截图新状态，必要时交给 AI 判断是否进入新项。

## Mac 本地程序如何复用四个肌肉

Mac 本地程序也统一为 visible surface：

- iPhone Mirroring
- Finder
- Chrome
- Preview
- Photos
- any governed local app window

最小路线：

`open-local-program -> Visible State Muscle localWindowMode -> AI local-window readiness -> Target Action Muscle if needed -> Evidence Analysis Muscle if needed`

Mac 差异由 local window profile、targetProfile、surfaceProfile 和 ability policy 吸收。不得创建 MacMuscle。

## 当前 product-discovery-route-plan.v1 的归类

当前 `product-discovery-route-plan.v1` 是肌肉记忆雏形，短期仍兼容 steps/transitions。

归类：

- Visible State: `capture-video-viewport` 作为当前可视状态采集点，由 map 入口和 Route Plan 回环共同使用。
- Target Action: `observe-comments-button`, `normalize-comments-target`, `click-comments-button`, `verify-comments-open`, `normalize-next-video-arrow`, `click-next-video-arrow`。
- Evidence Analysis: `capture-comments-panel`, `analyze-comment-intent`, `persist-seeding-candidate-record`。
- Advance Next Item: `normalize-next-video-arrow`, `click-next-video-arrow`, `capture-video-viewport`。

同一个 step 处在两个概念边界时，按 muscle segment 包裹解释，不重复 step，不把 Route Plan 复制成第二张地图。

## 当前 macos-local-program-open-smoke 的归类

`macos-local-program-open-smoke.meta.map-package.json` 仍是 `genericDiagnosticMap` 和 draft diagnostic smoke。

它只允许作为：

- `open-local-program` diagnostic proof
- local app handoff proof

禁止继续加入：

- click chain
- screenshot analysis chain
- local app workflow chain
- app-specific action scripts

如果 Mac 本地程序后续生产化，应新增 `local-visible-surface-route-plan.v1` 或 `local-window-observation-route-plan.v1`，但该 Route Plan 仍只能组合四大核心肌肉，不得创建 MacMuscle。

## 后续建设顺序

1. 先在 Route Plan schema 中兼容 muscle metadata。
2. 给现有 product discovery Route Plan 标记四大肌肉归属。
3. 用 inspector 阻断平台专属 muscle、地图回潮、profile 变第二地图、Route Plan/Ability 语义越界。
4. 后续再把 video sampling、local window observation、comment evidence 等沉淀为四大肌肉的 mode/profile/segment variation。

