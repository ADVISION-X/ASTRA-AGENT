# GrassEye 法案冻结基线

status: active
version: 2026-05-17

## 冻结结论

GrassEye 只保留 11 个 active capability groups：

1. commander-console
2. orchestration
3. nerve-bus
4. ai
5. open
6. screenshot
7. geometry-guard
8. mouse-click
9. text-input
10. mouse-scroll
11. forensics-persistence

## 角色切割

- 用户：说需求、平台、完成条件。
- AI：看需求、当前截图、坐标图、能力登记册，选择一个原子能力。
- 系统：提供截图、坐标图、打开、点击、输入、滚动、保存证据等原子能力。
- 调度：执行 AI 选择的能力，不做业务判断。
- 能力组：只做自己的小事。
- 质检：用最少 inspector 卡死越权、膨胀、旧概念复活。

## 不得恢复

不得以 archive、compat、fallback、transition、support surface、phase gate、acceptance smoke 的名义恢复任何旧路线。
