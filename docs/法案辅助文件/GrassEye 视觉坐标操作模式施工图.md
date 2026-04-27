# 《GrassEye 视觉坐标操作模式施工图》

## 基本身份

- 从属权威：
  - module-platform-action.instructions.md
  - module-vision-boundary.instructions.md
  - module-agent-runtime.instructions.md
  - module-security-privacy.instructions.md
- 角色：真实平台视觉坐标操作模式的建造级映射，不是第二法案
- 原则：疑问以上位法案为准
- 版本：1.0

## 一句话原则

GrassEye 第三阶段真实平台默认采用视觉优先坐标操作：先看见，再定位，再有限点击，再截图验证；DOM / Playwright 只作为兜底语义路径。

## 不是反检测声明

本模式不是 stealth、anti-detection、fingerprint spoof、captcha bypass。
本模式只使用用户本机授权浏览器和可见页面。
出现登录、验证码、风控、未知 UI，必须停止或人工复核。

## 模式矩阵

| 模式 | 地位 | 用途 | 不应承担 |
|---|---|---|---|
| Vision-first Coordinate Mode | 主模式 | 真实平台观察、截图、按钮定位、有限点击 | 绕过风控 |
| Visual-Only Runtime | 当前验收主线 | 截图、OCR、视觉目标、坐标动作、动作后验证 | DOM/BOM 内容读取 |
| Fixture Adapter | 开发模式 | 本地闭环验证 | 冒充真实平台完成 |

## 执行链

| 步骤 | 输入 | 输出 | 失败处理 |
|---|---|---|---|
| Browser launch | platform URL | visible local browser | operator review |
| Geometry guard | window info / screenshot | stable viewport | stop/review |
| Screen capture | browser region | screenshot evidence | retry/review |
| Visual target detection | screenshot | target bbox/confidence | skip/review |
| Coordinate action | target center | action result | post-check |
| Post-action verification | after screenshot | verified state | review |
| Record | action/evidence | action log | fail-clear |

## 目标类型矩阵

| targetType | 说明 |
|---|---|
| videoRegion | 当前视频区域 |
| nextVideoArea | 继续/滚动区域 |
| notInterestedButton | 不感兴趣 |
| likeButton | 点赞 |
| saveButton | 收藏/保存 |
| commentsButton | 评论入口 |
| commentsPanel | 评论区 |
| closePanelButton | 关闭面板 |

## Geometry Guard

| 检查 | 目的 |
|---|---|
| window position | 防止坐标漂移 |
| window size | 防止比例变化 |
| screenshot dimension | 防止截错屏 |
| anchor match | 确认仍在目标页面 |
| browser focus | 防止点到别的应用 |
| scale factor | 防止 Retina / 缩放误差 |

## Fallback 规则

| 场景 | 处理 |
|---|---|
| visual target confidence low | retry / review |
| geometry mismatch | stop / review |
| target missing | DOM fallback or review |
| DOM fallback succeeds | action log 标注 fallback |
| DOM fallback fails | stop / review |
| login / captcha / safety page | stop / operator review |

## 验收线

| 验收对象 | 建对表现 | 漂移信号 |
|---|---|---|
| 主模式 | 坐标动作基于视觉目标 | 直接硬编码坐标 |
| 兜底 | DOM 只作为 fallback | DOM 成为隐藏主路径 |
| 安全 | 异常 stop/review | 异常继续点 |
| 日志 | 每次动作有 evidence | 动作无记录 |
| 边界 | 无 stealth 代码 | 出现 anti-detect/fingerprint/captcha bypass |