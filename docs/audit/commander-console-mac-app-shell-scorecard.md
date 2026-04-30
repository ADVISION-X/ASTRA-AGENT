# Commander Console Mac App Shell Scorecard

该分数卡专门衡量 Commander Console 是否已经从手机化卡片流切换成可建立的 Mac 本地控制台。当前结构已经完成主切换，但桌面窗口证明与部分 copy 质量尚未满足 95 分阈值，所以结论必须保持 NOT READY。

<!-- COMMANDER_CONSOLE_MAC_APP_SHELL_SCORECARD_JSON_START -->
{
  "generatedAt": "2026-04-30T00:00:00.000Z",
  "result": "COMMANDER_CONSOLE_MAC_APP_SHELL_NOT_READY",
  "missingReferences": [
    "docs/法案辅助文件/GrassEye Commander Console 总司令页面施工图.md"
  ],
  "items": [
    {
      "name": "Mac Toolbar / 顶部工具栏主控",
      "score": 97,
      "evidence": [
        "MacToolbar 提供当前任务、当前动作、Processed、Pending Review、Developer Mode、E-Stop。"
      ],
      "filesInspected": [
        "src/features/commander-console/layout/MacToolbar.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/MacToolbar.ts"
      ],
      "proof": [
        "read_page 已确认顶部工具栏渲染上述控件。"
      ],
      "failedReasons": [],
      "requiredFix": "维持工具栏只承载主操作与状态摘要，不再回灌长页面组件。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Sidebar First Navigation / 左侧主导航",
      "score": 98,
      "evidence": [
        "主导航已改为 data-primary-nav。",
        "底部导航不再出现在当前壳体 DOM。"
      ],
      "filesInspected": [
        "src/features/commander-console/layout/LeftSidebar.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/LeftSidebar.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "proof": [
        "run_playwright_code 返回 hasSidebar=true, hasBottomNav=false。"
      ],
      "failedReasons": [],
      "requiredFix": "继续保持 sidebar 作为唯一主导航表面。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Single Active Workspace / 单活动页面工作区",
      "score": 98,
      "evidence": [
        "CommanderAppRouter 仍然维持 data-app-page-host 单宿主。",
        "sidebar 切换 Mission 后 pageCount 仍为 1。"
      ],
      "filesInspected": [
        "src/features/commander-console/CommanderAppRouter.ts",
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "proof": [
        "Mission 点击后 activeNavLabel=Mission，pageCount=1。"
      ],
      "failedReasons": [],
      "requiredFix": "禁止回到多页拼接长滚动模式。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Right Inspector Closed By Default / 右侧检查面默认关闭",
      "score": 97,
      "evidence": [
        "RightInspector 使用 data-inspect-modal hidden aria-hidden。"
      ],
      "filesInspected": [
        "src/features/commander-console/layout/RightInspector.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/layout/RightInspector.ts"
      ],
      "proof": [
        "run_playwright_code 返回 inspectHidden=true。"
      ],
      "failedReasons": [],
      "requiredFix": "继续保持检查面只在显式详情展开后打开。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Desktop Start Surface / 桌面启动面布局",
      "score": 96,
      "evidence": [
        "Start page 右侧已拆出 Current Mission / Run Limits / Safety Controls。"
      ],
      "filesInspected": [
        "src/features/commander-console/pages/HomeStartPage.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/HomeStartPage.ts"
      ],
      "proof": [
        "read_page 看到启动卡与 side stack 分离。"
      ],
      "failedReasons": [],
      "requiredFix": "保持首页只保留启动面，不回流健康、日志、开发者信息。",
      "currentVerdict": "PASS"
    },
    {
      "name": "No Phone Bottom Nav / 首壳去手机底栏",
      "score": 99,
      "evidence": [
        "客户端状态同步已从 syncBottomNav 切到 syncPrimaryNav。"
      ],
      "filesInspected": [
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/commander-console-shell-client.ts"
      ],
      "proof": [
        "run_playwright_code 返回 hasBottomNav=false。"
      ],
      "failedReasons": [],
      "requiredFix": "禁止在主壳重新引入 bottom-nav 作为主要导航。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Desktop 4:3 Proof / 4:3 窗口实证",
      "score": 93,
      "evidence": [
        "viewportGate 已切到桌面断点。"
      ],
      "filesInspected": [
        "src/features/commander-console/commander-app.view-model.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/commander-app.view-model.ts"
      ],
      "proof": [
        "浏览器工具当前仍只提供 innerWidth 603 的窄窗口证明。"
      ],
      "failedReasons": [
        "尚未闭合真实 900x675 以上桌面窗口证据。"
      ],
      "requiredFix": "补桌面 4:3 以上窗口的真实 UI 证明后再提升结论。",
      "currentVerdict": "FAIL"
    },
    {
      "name": "Human Copy Hygiene / 人话文案洁净度",
      "score": 94,
      "evidence": [
        "taskCategory 已从普通模式卡片中移除。",
        "新增 commander-console.copy.ts 承担壳体 copy。"
      ],
      "filesInspected": [
        "src/features/commander-console/modules/TaskTemplateLauncher.ts",
        "src/features/commander-console/commander-console.copy.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/modules/TaskTemplateLauncher.ts",
        "src/features/commander-console/commander-console.copy.ts"
      ],
      "proof": [
        "product-discovery/comment-review 已退出主界面。"
      ],
      "failedReasons": [
        "普通模式仍存在较多英文文案与英文 safetyLevel，中文优先的人话层还未完全建立。"
      ],
      "requiredFix": "继续治理普通模式 copy，使中文主界面不再夹带系统口径或英文半成品。",
      "currentVerdict": "FAIL"
    }
  ]
}
<!-- COMMANDER_CONSOLE_MAC_APP_SHELL_SCORECARD_JSON_END -->