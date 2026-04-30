# Commander Console User Love Scorecard

本评分表基于当前 compact app shell 源码、2026-04-30 的真实 DOM 检查、以及本轮本地壳交互验证更新。

<!-- COMMANDER_CONSOLE_USER_LOVE_SCORECARD_JSON_START -->
{
  "generatedAt": "2026-04-30T02:20:00.000Z",
  "result": "COMMANDER_CONSOLE_APP_COMPACT_NOT_READY",
  "missingReferences": [],
  "items": [
    {
      "name": "State Clarity / 3 秒看懂状态",
      "score": 96,
      "evidence": [
        "Compact status bar 把 Task、Current Action、Processed 固定在顶部。",
        "Mission 页继续承接运行态摘要，不需要回到长列表里找状态。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/layout/CompactStatusBar.ts",
        "src/features/commander-console/pages/MissionPage.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/CompactStatusBar.ts",
        "src/features/commander-console/pages/MissionPage.ts",
        "src/features/commander-console/CommanderAppShell.ts"
      ],
      "screenshotsOrDomEvidence": [
        "真实 DOM 显示顶部状态条在 Home 首屏直接给出 Task、Current Action、Processed。"
      ],
      "proof": [
        "read_page 与 run_playwright_code 都确认 Home 初始 activePage 为 home，且顶部状态条始终可见。"
      ],
      "userFacingAcceptance": "用户进入壳层后 3 秒内知道机器当前状态和主要动作。",
      "developerFacingAcceptance": "开发者详情仍在下级页面和 Inspect 中，不需要把内部标识塞回顶部。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Two-Step Launch / 30 秒内启动任务",
      "score": 96,
      "evidence": [
        "Home 只保留任务模板、运行限制和 Start Task。",
        "Start Task 与 Open Mission 在同一启动卡内，没有额外系统字段表单。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/modules/RunLimitMiniForm.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/modules/TaskTemplateLauncher.ts",
        "src/features/commander-console/modules/RunLimitMiniForm.ts"
      ],
      "screenshotsOrDomEvidence": [
        "真实 DOM 中 Start Task 在首屏内，Minutes 和 Items 是唯一的补充输入。"
      ],
      "proof": [
        "run_playwright_code 记录 Start Task 在首屏可见区内。"
      ],
      "userFacingAcceptance": "用户可以在 Home 一屏内完成任务选择并发起运行。",
      "developerFacingAcceptance": "内部 mapBinding 继续由模板派生，不重新暴露到底层表单。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "No System Fields / 主界面不暴露系统字段",
      "score": 95,
      "evidence": [
        "Home 启动流不再显示 selectedMapId、requestedPlatformId、targetProfileRef。",
        "Developer 页和 Inspect 承接内部引用，不再压到首屏。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/pages/DeveloperPage.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/pages/DeveloperPage.ts",
        "src/features/commander-console/layout/InspectModal.ts"
      ],
      "screenshotsOrDomEvidence": [
        "Home 真实 DOM 没有出现系统字段文本，Developer 导航默认 hidden。"
      ],
      "proof": [
        "run_playwright_code 返回 developerHidden=true，证明普通模式没有把开发者入口直接展开。"
      ],
      "userFacingAcceptance": "普通用户首屏不会被系统字段逼着理解底层编排。",
      "developerFacingAcceptance": "开发者仍可以在显式打开的 Developer 和 Inspect 中查看内部字段。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Human Language / 每个步骤都是人话",
      "score": 95,
      "evidence": [
        "Home 和 Mission 使用 Start、Current Action、Current Mission 等自然语言标题。",
        "Inspect Modal 文案也以 Inspect details、Summary、References 为主。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/layout/InspectModal.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/layout/InspectModal.ts",
        "src/features/commander-console/view-helpers.ts"
      ],
      "screenshotsOrDomEvidence": [
        "真实 DOM 标题和操作文案均为自然语言，不是 raw stepId 或 mapId。"
      ],
      "proof": [
        "Home 和 Mission 的二级标题来自 localizeCommanderText，而不是内部字段直出。"
      ],
      "userFacingAcceptance": "用户可以直接读懂壳层在做什么，而不是先翻译内部 ID。",
      "developerFacingAcceptance": "内部真相仍保留在 inspect body 和 developer refs 中。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Actionable Errors / 出错知道发生什么、为什么、怎么办",
      "score": 95,
      "evidence": [
        "Home 的 Actionable Error Banner 只在存在非 ok 错误时出现。",
        "错误横幅支持打开 error inspect，而不是把完整调试结构常驻在主流。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/modules/ActionableErrorBanner.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/modules/ActionableErrorBanner.ts",
        "src/features/commander-console/commander-console-shell-client.ts",
        "src/features/commander-console/CommanderAppShell.ts"
      ],
      "screenshotsOrDomEvidence": [
        "错误横幅不再要求用户穿越长 dashboard；入口集中在 Home 顶部。"
      ],
      "proof": [
        "client 脚本保留 data-open-error-inspect 路径，错误详情通过 Inspect Modal 展开。"
      ],
      "userFacingAcceptance": "当有阻塞错误时，用户知道该看哪里、点哪里。",
      "developerFacingAcceptance": "错误详情仍然通过 inspect payload 下钻，不伪造运行真相。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Debug Without Pressure / Debug 透明但不压迫主界面",
      "score": 96,
      "evidence": [
        "Inspect 改为默认关闭的 modal overlay，不再常驻右侧。",
        "Health 和 Developer 被降到单独页面，不再堆在 Home 主流。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/layout/InspectModal.ts",
        "src/features/commander-console/pages/HealthPage.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/InspectModal.ts",
        "src/features/commander-console/pages/HealthPage.ts",
        "src/features/commander-console/pages/DeveloperPage.ts"
      ],
      "screenshotsOrDomEvidence": [
        "真实 DOM 和脚本检查均返回 inspectHidden=true。"
      ],
      "proof": [
        "run_playwright_code 与 read_page 都确认 Home 首屏没有默认展开的 debug panel。"
      ],
      "userFacingAcceptance": "普通用户不会被日志表、能力表和 JSON 压住主流程。",
      "developerFacingAcceptance": "调试面仍可通过 Health、Developer 和 Inspect 进入。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Result Visibility / 跑完能看到结果",
      "score": 95,
      "evidence": [
        "Results 被提升为一级页面，不再埋在长滚动中段。",
        "Home 仅在有进度时显示紧凑结果卡，把首屏重心留给启动。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/pages/ResultsPage.ts",
        "src/features/commander-console/modules/ResultSummaryCard.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/ResultsPage.ts",
        "src/features/commander-console/modules/ResultSummaryCard.ts",
        "src/features/commander-console/CommanderAppRouter.ts"
      ],
      "screenshotsOrDomEvidence": [
        "底部导航包含 Results 一级入口，结果不再依赖主页面长滚动定位。"
      ],
      "proof": [
        "底部导航点击可将 activePage 切到 results，且 pageCount 维持 1。"
      ],
      "userFacingAcceptance": "用户能明确知道结果去哪看，而不是在大页面里找结果区块。",
      "developerFacingAcceptance": "结果导出仍然走公共 handler，不越权进入存储细节。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Safety Control / 暂停、停止、急停、运行限制清晰",
      "score": 96,
      "evidence": [
        "E-Stop 固定在顶部状态条，Pause、Resume、Stop 保留在 Home 启动卡中。",
        "Minutes 和 Items 作为小型运行限制控件直接可见。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/layout/CompactStatusBar.ts",
        "src/features/commander-console/modules/SafetyControls.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/CompactStatusBar.ts",
        "src/features/commander-console/modules/SafetyControls.ts",
        "src/features/commander-console/modules/RunLimitMiniForm.ts"
      ],
      "screenshotsOrDomEvidence": [
        "run_playwright_code 在页面顶部测得 E-Stop 位于可视区域内。"
      ],
      "proof": [
        "滚回顶部后 emergencyTop=31、emergencyBottom=62，证明急停按钮保持在首屏。"
      ],
      "userFacingAcceptance": "用户在启动前和运行中都能迅速找到停机手段和运行边界。",
      "developerFacingAcceptance": "边界校验仍要求 selectedMapId 与 requestedPlatformId 同时存在。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Density Control / 主界面低密度、不蚂蚁化",
      "score": 96,
      "evidence": [
        "Home 现在只保留启动卡和紧凑任务摘要，结果卡仅在有进度时出现。",
        "状态条改成两列指标布局，避免 compact 视口回到三列蚂蚁化。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/styles/commander-console-styles.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/styles/commander-console-styles.ts",
        "src/features/commander-console/layout/CompactStatusBar.ts"
      ],
      "screenshotsOrDomEvidence": [
        "run_playwright_code 记录 Home 真实卡片数为 2。"
      ],
      "proof": [
        "Home 真实 DOM 没有健康表、日志表、复核表和长列表混挂。"
      ],
      "userFacingAcceptance": "首屏不再是后台长网页，而是明确的启动和摘要界面。",
      "developerFacingAcceptance": "高密度信息被拆去子页面，并未被删除。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "Normal / Developer Mode Separation / 普通模式与开发者模式分离",
      "score": 96,
      "evidence": [
        "Developer 是 hidden 的一级导航项，只有显式打开开发者模式后才出现。",
        "Developer 页与 Home、Mission、Results 分离，不再共用长页面滚动。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/layout/BottomNav.ts",
        "src/features/commander-console/pages/DeveloperPage.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/BottomNav.ts",
        "src/features/commander-console/pages/DeveloperPage.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "screenshotsOrDomEvidence": [
        "run_playwright_code 返回 developerHidden=true。"
      ],
      "proof": [
        "client 只在 developerModeOpen 为真时解除 hidden，并在关闭后把 activePage 拉回 home。"
      ],
      "userFacingAcceptance": "普通用户不需要进入开发者页面也能完成主要任务。",
      "developerFacingAcceptance": "开发者仍保有完整 refs 和 debug JSON 页面。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "User Control Feeling / 用户感觉能控制机器",
      "score": 96,
      "evidence": [
        "一级导航让用户明确切换到 Mission、Results、Review、Health。",
        "单 active page 避免了在长网页里迷路。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/features/commander-console/CommanderAppRouter.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/CommanderAppRouter.ts",
        "src/features/commander-console/commander-console-shell-client.ts",
        "src/features/commander-console/layout/BottomNav.ts"
      ],
      "screenshotsOrDomEvidence": [
        "底部导航切换 Mission 和 Results 时，activePage 会改变且 pageCount 保持 1。"
      ],
      "proof": [
        "run_playwright_code 记录 missionState.activePage=mission、resultsState.activePage=results、homeState.activePage=home。"
      ],
      "userFacingAcceptance": "用户感觉是在驾驶一个有明确页面边界的控制台，而不是翻一张后台长表单。",
      "developerFacingAcceptance": "页面切换仍基于只读 pageHtml 映射，不让 UI 接管运行事实。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "App Shell Readiness / 未来 App 化承载友好",
      "score": 96,
      "evidence": [
        "render-commander-console-page 已切到 renderCommanderAppShell。",
        "AppShell 通过 safeJsonScript 注入只读 view model 和 pageHtml map，使命令边界不变。"
      ],
      "failedReasons": [],
      "filesInspected": [
        "src/lib/local-app-shell/render-commander-console-page.ts",
        "src/features/commander-console/CommanderAppShell.ts"
      ],
      "touchedFiles": [
        "src/lib/local-app-shell/render-commander-console-page.ts",
        "src/features/commander-console/CommanderAppShell.ts",
        "src/features/commander-console/CommanderAppRouter.ts"
      ],
      "screenshotsOrDomEvidence": [
        "服务启动后直接输出 GrassEye Commander Console shell listening on http://127.0.0.1:4173。"
      ],
      "proof": [
        "边界检查仍通过公共 task、candidate、runtime handler 进入，不让 Local App Shell 拿运行主权。"
      ],
      "userFacingAcceptance": "当前 UI 已经是可承载在本地壳里的单窗口控制台，而不是网页后台拼装页。",
      "developerFacingAcceptance": "壳层仍然只做渲染与路由，不侵入 runtime 和 storage internals。",
      "requiredFix": "NONE",
      "currentVerdict": "PASS"
    },
    {
      "name": "App Compact Viewport / 三分之一屏幕可用性",
      "score": 93,
      "evidence": [
        "Home 一屏内存在 Start Task、Open Mission、E-Stop，Inspect 默认关闭。",
        "activePage 已真实切换到 mission、results、home，且每次 pageCount 都维持 1。",
        "viewModel 明确声明 390x740、420x800、520x860、768x900 四个 viewport checkpoints。"
      ],
      "failedReasons": [
        "本轮浏览器工具的实际 innerWidth 固定在约 603px，无法在同一集成浏览器里完成 390x740 与 420x800 的端到端像素级验证。",
        "虽然 compact shell 结构和单页路由已成立，但精确到 390 和 420 宽度的实机 proof 还没有独立截图和 DOM 证据闭环。"
      ],
      "filesInspected": [
        "src/features/commander-console/commander-app.view-model.ts",
        "src/features/commander-console/styles/commander-console-styles.ts",
        "src/features/commander-console/pages/HomeStartPage.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/commander-app.view-model.ts",
        "src/features/commander-console/styles/commander-console-styles.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "screenshotsOrDomEvidence": [
        "run_playwright_code 已确认 Start Task 位于首屏、developerHidden=true、inspectHidden=true、homeCards=2。"
      ],
      "proof": [
        "当前真实验证已经证明 compact shell 行为成立，但 390x740 和 420x800 仍缺独立的 viewport-level 取证，因此不能诚实声明 READY。"
      ],
      "userFacingAcceptance": "三分之一屏幕宽度下仍应一屏完成启动、停机、页切换和详情下钻。",
      "developerFacingAcceptance": "需要补齐 390 和 420 宽度的真实 viewport 证据后，才可以把 compact ready 写成通过。",
      "requiredFix": "Capture exact 390x740 and 420x800 viewport proof for Home, Mission, and Inspect behavior before claiming READY.",
      "currentVerdict": "FAIL"
    }
  ]
}
<!-- COMMANDER_CONSOLE_USER_LOVE_SCORECARD_JSON_END -->