# GrassEye 当前子能力清单与中文物理注释

生成时间：2026-05-12

这份清单只描述“子能力实际会做什么物理动作”，不描述它应该替用户完成什么业务判断。

| actionCode | 子能力绑定 | AI 可直接规划 | 中文物理注释 |
| --- | --- | --- | --- |
| `CAPTURE_SCREEN` | `screenshot/capture-browser-viewport` | 否 | 截取当前浏览器可视区域的一张截图。它只观察页面，不点击、不输入、不滚动、不导航、不点赞、不评论、不保存线索。 |
| `RENDER_COORDINATE_GRID_ONCE` | `screenshot/render-coordinate-grid` | 否 | 在已有截图上渲染坐标网格，生成可供 AI 指认格子的网格图和 `gridSpecRef`。它不接触网页本身。 |
| `CAPTURE_GRID_REGION_ONCE` | `screenshot/capture-grid-region` | 否 | 从已有截图里按指定网格区域裁剪图片。它只处理已保存像素，不操作网页。 |
| `CALL_VISUAL_MISSION_JUDGE_ONCE` | `ai/visual-mission-judge-once` | 否 | 调用视觉判断模型，让 AI 基于当前证据输出动作计划。它只产生命令建议，不执行动作。 |
| `LEFT_CLICK_GRID_CELL_ONCE` | `mouse-click/left-click-browser-viewport-once` | 是 | 在当前浏览器视口内，对 Geometry Guard 批准的 `gridCell/cellZone` 坐标执行一次鼠标左键点击。它不判断点击后业务是否成功。 |
| `DOUBLE_LEFT_CLICK_GRID_CELL` | `mouse-click/double-left-click-browser-viewport` | 是 | 在当前浏览器视口内，对批准坐标执行两次鼠标左键点击。只适合确实需要双击的可见目标。 |
| `RIGHT_CLICK_GRID_CELL_ONCE` | `mouse-click/right-click-browser-viewport-once` | 是 | 在当前浏览器视口内，对批准坐标执行一次鼠标右键点击。通常用于打开上下文菜单。 |
| `TYPE_APPROVED_TEXT_ONCE` | `text-input/type-approved-text-once` | 是 | 向当前已经获得焦点的输入位置键入一段已批准文本。它不选择输入框，不生成文本。 |
| `PRESS_APPROVED_KEY_ONCE` | `text-input/press-approved-key-once` | 是 | 在当前获得焦点的浏览器/页面上下文里按一次批准按键。`ArrowDown` 是键盘下方向键；`L` 是键盘 L 键，在短视频页面通常表示给当前视频点赞。它不是鼠标点击，不会打开评论，不会保存证据。 |
| `CLEAR_FOCUSED_INPUT_ONCE` | `text-input/clear-focused-input-once` | 是 | 清空当前已经获得焦点的输入框内容。它不负责寻找输入框。 |
| `SCROLL_BROWSER_VIEWPORT_ONCE` | `mouse-scroll/scroll-browser-viewport` | 否 | 按受控滚动量滚动当前浏览器视口。它不是点击，也不验证滚动后出现了什么内容。 |
| `OPEN_PLATFORM_ENTRY_ONCE` | `open/open-platform-entry-once` | 否 | 将受治理的 Chrome 会话导航到平台注册过的入口 URL。它不自行发明 URL，也不在打开后继续操作页面。 |
| `OPEN_LOCAL_WORKBENCH_ONCE` | `open/open-local-workbench-once` | 是 | 打开 GrassEye 本地工作台页面。它不操作目标社交平台。 |
| `STOP_REVIEW_REQUIRED_ONCE` | `orchestration/emergency-stop` | 是 | 停止当前自动化任务并标记为需要人工复核。它不点击、不输入、不滚动、不保存证据、不切换视频。 |
| `SAVE_RECORD_ONCE` | `forensics-persistence/append-record` | 否 | 向取证账本追加一条已有记录。它不操作网页，也不自行判断产品状态。 |
| `APPEND_ARTIFACT_ONCE` | `forensics-persistence/append-artifact` | 否 | 将已有文件 artifact 引用追加到取证账本。它不截图，不操作网页。 |
| `READ_RECORD_ONCE` | `forensics-persistence/read-record-ref` | 否 | 按记录引用读取取证账本里的已有记录。它只读取存储数据，不操作网页。 |
| `SAVE_CURRENT_VIDEO_EVIDENCE_ONCE` | `forensics-persistence/append-record` | 是 | 保存当前视频相关证据引用，包括系统注入的截图、网格图和 AI 结果引用。它不点击、不输入、不打开评论、不点赞、不切换视频。 |

## 当前短视频平台动作翻译

| 平台 | 目标角色 | 当前实际执行 |
| --- | --- | --- |
| `facebook-web` / `tiktok-web` | `like_button` | `PRESS_APPROVED_KEY_ONCE` + `approvedKey=L` |
| `facebook-web` / `tiktok-web` | `next_video_arrow` / `next_video_surface` | `PRESS_APPROVED_KEY_ONCE` + `approvedKey=ArrowDown` |
| `facebook-web` / `tiktok-web` | `comments_button` | `LEFT_CLICK_GRID_CELL_ONCE`，仍依赖可见坐标目标 |

