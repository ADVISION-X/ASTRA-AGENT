# GrassEye 本地真实 Chrome 会话与登录态持久化施工图

版本：2026-05-21  
状态：active

## 1. 当前定位

本地浏览器会话层提供真实 Chrome 控制与会话复用基础能力。

## 2. 当前允许的能力

- 复用本地 profile directory
- 打开 URL
- 等待页面
- 读取当前 session state
- 生成 screenshot evidence
- 配合 file input 完成批准文件附加

## 3. 当前登录策略

- 登录由操作者完成
- 已登录会话由本地 profile 复用
- 遇到登录页、验证码、2FA 时返回人工接管

## 4. 当前隐私边界

- 不读取 cookie
- 不读取 localStorage / sessionStorage
- 不自动输入账号密码
- 不把 secret 写入日志或文档

## 5. 当前与 Amazon 主线的关系

Amazon flow 只把浏览器会话当作基础设施。  
业务顺序不在浏览器层，页面判断不在浏览器层。