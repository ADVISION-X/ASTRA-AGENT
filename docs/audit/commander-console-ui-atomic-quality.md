# Commander Console UI Atomic Quality

当前目标是把 Commander Console 固定到 Mac 本地控制台形态，而不是继续沿用手机卡片流。当前实现已经切到 Toolbar + Sidebar + Workspace + Inspector，但桌面证明与蓝图引用还没有全部闭环，所以该审计文档只记录真实状态，不宣布 READY。

缺失引用：docs/法案辅助文件/GrassEye Commander Console 总司令页面施工图.md

<!-- COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_JSON_START -->
{
  "generatedAt": "2026-04-30T00:00:00.000Z",
  "result": "COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_NOT_READY",
  "missingReferences": [
    "docs/法案辅助文件/GrassEye Commander Console 总司令页面施工图.md"
  ],
  "items": [
    {
      "name": "Mac Shell Composition / Toolbar Sidebar Workspace Inspector",
      "score": 97,
      "evidence": [
        "render-commander-console-page 已经切到 renderCommanderMacShell。",
        "CommanderMacShell 组合了 MacTitleBar、MacToolbar、LeftSidebar、MainWorkspace、RightInspector、RuntimeStatusStrip。"
      ],
      "filesInspected": [
        "src/lib/local-app-shell/render-commander-console-page.ts",
        "src/features/commander-console/CommanderMacShell.ts"
      ],
      "touchedFiles": [
        "src/lib/local-app-shell/render-commander-console-page.ts",
        "src/features/commander-console/CommanderMacShell.ts",
        "src/features/commander-console/layout/MacToolbar.ts",
        "src/features/commander-console/layout/LeftSidebar.ts",
        "src/features/commander-console/layout/RightInspector.ts"
      ],
      "proof": [
        "read_page 看到 banner + sidebar + main workspace + footer strip 的四段结构。"
      ],
      "failedReasons": [],
      "requiredFix": "保持所有首层结构继续只经过 CommanderMacShell 组合，不再回退到手机底栏壳。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Start Page Atomic Layout / 启动页原子分栏",
      "score": 96,
      "evidence": [
        "HomeStartPage 已改成左侧启动区 + 右侧任务摘要/运行限制/安全控制。",
        "样式中新增 cc-home-grid 与 cc-home-sidebar-stack。"
      ],
      "filesInspected": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/styles/commander-console-styles.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/pages/HomeStartPage.ts",
        "src/features/commander-console/styles/commander-console-styles.ts"
      ],
      "proof": [
        "Start 页面 DOM 已拆成 launch card 与 side stack 两个顶层块。"
      ],
      "failedReasons": [],
      "requiredFix": "继续维持启动页不混入健康、日志、开发者字段。",
      "currentVerdict": "PASS"
    },
    {
      "name": "Copy Surface Hygiene / 普通模式文案与字段洁净度",
      "score": 94,
      "evidence": [
        "TaskTemplateLauncher 已移除 taskCategory，改为 safetyLevel。",
        "shell 导航与窗口文案已集中到 commander-console.copy.ts。"
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
        "product-discovery/comment-review 已从首屏普通模式卡片消失。"
      ],
      "failedReasons": [
        "仍然存在较多英文 UI 文案与英文 safetyLevel，主界面优先中文人话还没有完全闭环。"
      ],
      "requiredFix": "继续把普通模式里可见的英文标签、人机口径和状态 copy 收敛到中文优先的人话层。",
      "currentVerdict": "FAIL"
    },
    {
      "name": "Desktop Proof Recording / 桌面证明记录",
      "score": 92,
      "evidence": [
        "viewportGate 已提升到 900x675、960x720、1024x768、1100x825、1280x900、1366x900。",
        "样式主壳已经定义 desktop-first shell min/max token。"
      ],
      "filesInspected": [
        "src/features/commander-console/commander-app.view-model.ts",
        "src/features/commander-console/styles/commander-console-styles.ts"
      ],
      "touchedFiles": [
        "src/features/commander-console/commander-app.view-model.ts",
        "src/features/commander-console/styles/commander-console-styles.ts"
      ],
      "proof": [
        "浏览器工具当前仍报告 innerWidth 603，因此只能验证窄屏降级分支，而不是 4:3 桌面窗口实证。"
      ],
      "failedReasons": [
        "尚未拿到 900x675 以上桌面窗口的真实界面证据。"
      ],
      "requiredFix": "补一份真实 4:3 桌面窗口截图或 DOM 证明，再重跑该审计。",
      "currentVerdict": "FAIL"
    }
  ]
}
<!-- COMMANDER_CONSOLE_UI_ATOMIC_QUALITY_JSON_END -->